import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { collectProductPages, summarizeHtml } from "../scripts/collect-product-pages.mjs";
import {
  fetchText,
  hash,
  isPublicAddress,
  publicUrl,
  retryAfter,
} from "../scripts/catalog-research-utils.mjs";

const lookupImpl = async () => [{ address: "93.184.215.14", family: 4 }];
const html = (body) => new Response(body, { headers: { "content-type": "text/html" } });
const product = (id) => ({
  productId: id,
  name: id,
  homepage: `https://${id}.example.com/`,
  pricingUrl: null,
  verification: "needs-review",
  relationshipIds: [id],
});
test("research links prefer actual agreements and reject glossary, privacy and department pages", () => {
  const summary = summarizeHtml(
    `
    <a href="/glossary/terms">Terms</a><a href="/w/departments/legal">Legal</a>
    <a href="/legal/privacy">Privacy</a><a href="/legal/contact-us">Legal contact</a>
    <a href="/hc/en-us/articles/proofing-pricing">Pricing</a>
    <a href="/legal">Legal</a><a href="/legal/master-services-agreement">Agreement</a>
    <a href="/pricing">Pricing</a>
  `,
    "https://example.com/",
  );
  assert.deepEqual(summary.discoveredLinks, [
    { url: "https://example.com/legal/master-services-agreement", role: "terms" },
    { url: "https://example.com/pricing", role: "pricing" },
    { url: "https://example.com/legal", role: "terms" },
  ]);
});
async function fixture(run, products = [product("first"), product("second")]) {
  const root = await mkdtemp(join(tmpdir(), "proudlypaid-product-pages-"));
  try {
    const input = join(root, "products.json");
    await writeFile(
      input,
      JSON.stringify({ schemaVersion: 1, verification: "needs-review", products }),
    );
    await run({
      input,
      cache: join(root, "cache"),
      outputRoot: join(root, "output"),
      lookupImpl,
      minIntervalMs: 0,
      root,
    });
  } finally {
    assert.equal(dirname(root), resolve(tmpdir()));
    assert.ok(root.includes("proudlypaid-product-pages-"));
    await rm(root, { recursive: true, force: true });
  }
}

test("research URL/address guards reject credentials, private hosts and mapped addresses", async () => {
  for (const url of [
    "http://example.com",
    "https://user:secret@example.com",
    "https://127.0.0.1",
    "https://[::1]",
    "https://host.local",
    "https://example.com/?token=secret",
  ])
    assert.throws(() => publicUrl(url));
  for (const ip of [
    "127.0.0.1",
    "10.0.0.1",
    "100.64.0.1",
    "169.254.169.254",
    "198.18.0.1",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "fe80::1",
    "2001:db8::1",
  ])
    assert.equal(isPublicAddress(ip), false, ip);
  assert.equal(isPublicAddress("1.1.1.1"), true);
  assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
  let calls = 0;
  await assert.rejects(
    fetchText("https://safe.example.com/", {
      lookupImpl: async () => [{ address: "10.0.0.1" }],
      fetchImpl: async () => {
        calls++;
      },
    }),
    /non-public/,
  );
  assert.equal(calls, 0);
});

test("redirects cannot downgrade HTTPS or fetch a private destination, and bodies are bounded", async () => {
  let calls = 0;
  await assert.rejects(
    fetchText("https://safe.example.com/", {
      lookupImpl,
      fetchImpl: async () => {
        calls++;
        return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/" } });
      },
    }),
    /HTTPS/,
  );
  assert.equal(calls, 1);
  await assert.rejects(
    fetchText("https://safe.example.com/", {
      lookupImpl,
      maxBytes: 4,
      fetchImpl: async () => html("too large"),
    }),
    /byte limit/,
  );
  assert.equal(retryAfter("120", 1000), 121000);
  assert.equal(retryAfter("not a date", 1000), null);
});

test("HTML extraction removes scripts and isolates hints from verified prices and cross-site links", () => {
  const result = summarizeHtml(
    '<title>Pricing &amp; plans</title><script>throw new Error("$999")</script><h1>Team</h1><p>USD 20 / user / month</p><p>Billed annually</p><a href="/terms">Terms</a><a href="https://unrelated.example.org/pricing">Pricing</a>',
    "https://vendor.example.com/",
  );
  assert.equal(result.title, "Pricing & plans");
  assert.ok(result.priceHints.length);
  assert.ok(result.priceHints.every((hint) => hint.verification === "needs-review"));
  assert.equal(result.textPreview.includes("$999"), false);
  assert.deepEqual(result.discoveredLinks, [
    { url: "https://vendor.example.com/terms", role: "terms" },
  ]);
});

test("robots wildcard disallow prevents page requests and preserves a review outcome", async () => {
  await fixture(async (options) => {
    const calls = [];
    const result = await collectProductPages({
      ...options,
      fetchImpl: async (url) => {
        calls.push(url);
        return new Response("User-agent: *\nDisallow: /", {
          headers: { "content-type": "text/plain" },
        });
      },
    });
    assert.equal(calls.length, 2);
    assert.ok(calls.every((url) => url.endsWith("/robots.txt")));
    assert.equal(result.report.outcomes["robots-disallowed"], 2);
    assert.equal(result.report.status, "complete-with-gaps");
  });
});

test("reviewed collection restrictions defer fresh requests even when robots would allow them", async () => {
  await fixture(
    async (options) => {
      let calls = 0;
      const result = await collectProductPages({
        ...options,
        fetchImpl: async () => {
          calls++;
          return html("Allowed");
        },
      });
      assert.equal(calls, 0);
      const drafts = JSON.parse(await readFile(join(result.output, "review-drafts.json"), "utf8"));
      assert.equal(drafts.products[0].pages[0].outcome, "manual-review-required");
    },
    [{ ...product("manual"), homepage: "https://www.jotform.com/" }],
  );
});

test("product checkpoints advance later batches and shared URLs are fetched only once", async () => {
  const products = [
    product("first"),
    { ...product("second"), homepage: "https://first.example.com/" },
  ];
  await fixture(async (options) => {
    const calls = [];
    const fetchImpl = async (url) => {
      calls.push(url);
      return url.endsWith("/robots.txt")
        ? new Response("User-agent: *\nAllow: /", { headers: { "content-type": "text/plain" } })
        : html("<title>Product</title><p>USD 20 monthly</p>");
    };
    const first = await collectProductPages({ ...options, fetchImpl, maxProducts: 1 });
    assert.equal(first.report.status, "paused");
    assert.equal(first.report.processedProducts, 1);
    const second = await collectProductPages({ ...options, fetchImpl, maxProducts: 1 });
    assert.equal(second.report.status, "complete");
    assert.equal(second.report.processedProducts, 2);
    assert.equal(second.report.productsAttemptedThisRun, 1);
    assert.equal(calls.length, 2);
    const drafts = JSON.parse(await readFile(join(second.output, "review-drafts.json"), "utf8"));
    assert.ok(
      drafts.products.every(
        (row) => row.verification === "needs-review" && row.sourceClassification === "unclassified",
      ),
    );
  }, products);
});

test("request-budget interruption resumes from cached pages without dropping the current product", async () => {
  await fixture(
    async (options) => {
      const calls = [];
      const fetchImpl = async (url) => {
        calls.push(url);
        if (url.endsWith("/robots.txt"))
          return new Response("User-agent: *\nAllow: /", {
            headers: { "content-type": "text/plain" },
          });
        return html(
          url.endsWith("/pricing")
            ? "<title>Pricing</title><p>USD 10 monthly</p>"
            : '<title>Home</title><a href="/pricing">Pricing</a>',
        );
      };
      const first = await collectProductPages({ ...options, fetchImpl, maxRequests: 2 });
      assert.equal(first.report.status, "paused");
      assert.equal(first.report.requests, 2);
      assert.equal(first.report.processedProducts, 0);
      const second = await collectProductPages({ ...options, fetchImpl, maxRequests: 2 });
      assert.equal(second.report.status, "complete");
      assert.equal(second.report.requests, 1);
      assert.equal(calls.filter((url) => url.endsWith("/pricing")).length, 1);
      assert.equal(second.report.fetchedPages, 2);
    },
    [product("first")],
  );
});

test("Retry-After cooldown survives a new run, even when retry-failed is requested", async () => {
  await fixture(
    async (options) => {
      let calls = 0;
      const now = () => 1700000000000;
      const fetchImpl = async (url) => {
        calls++;
        return url.endsWith("/robots.txt")
          ? new Response("User-agent: *\nAllow: /", { headers: { "content-type": "text/plain" } })
          : new Response("Slow down", { status: 429, headers: { "retry-after": "600" } });
      };
      const first = await collectProductPages({ ...options, now, fetchImpl });
      assert.equal(first.report.outcomes.deferred, 1);
      assert.equal(calls, 2);
      const second = await collectProductPages({ ...options, now, fetchImpl, retryFailed: true });
      assert.equal(second.report.outcomes.deferred, 1);
      assert.equal(calls, 2);
    },
    [product("first")],
  );
});

test("redirected pages check the destination origin's bot-specific robots rules", async () => {
  await fixture(
    async (options) => {
      const calls = [];
      const result = await collectProductPages({
        ...options,
        fetchImpl: async (url) => {
          calls.push(url);
          if (url === "https://first.example.com/robots.txt")
            return new Response("User-agent: *\nAllow: /", {
              headers: { "content-type": "text/plain" },
            });
          if (url === "https://first.example.com/")
            return new Response(null, {
              status: 302,
              headers: { location: "https://destination.example.com/pricing" },
            });
          if (url === "https://destination.example.com/robots.txt")
            return new Response(
              "User-agent: *\nAllow: /\n\nUser-agent: ProudlyPaidResearch\nDisallow: /pricing",
              { headers: { "content-type": "text/plain" } },
            );
          throw new Error("Disallowed destination must never be fetched");
        },
      });
      assert.equal(result.report.outcomes["robots-disallowed"], 1);
      assert.equal(calls.length, 3);
      assert.equal(calls.includes("https://destination.example.com/pricing"), false);
    },
    [product("first")],
  );
});

test("corrupted cached bodies are fetched again when resuming an interrupted product", async () => {
  await fixture(
    async (options) => {
      let homepageRequests = 0;
      const fetchImpl = async (url) => {
        if (url.endsWith("/robots.txt"))
          return new Response("User-agent: *\nAllow: /", {
            headers: { "content-type": "text/plain" },
          });
        if (url.endsWith("/pricing")) return html("<title>Pricing</title><p>USD 10 monthly</p>");
        homepageRequests++;
        return html('<title>Home</title><a href="/pricing">Pricing</a>');
      };
      await collectProductPages({ ...options, fetchImpl, maxRequests: 2 });
      const metadata = JSON.parse(
        await readFile(
          join(options.cache, "pages", `${hash("https://first.example.com/")}.json`),
          "utf8",
        ),
      );
      assert.match(metadata.sha256, /^[a-f0-9]{64}$/);
      await writeFile(join(options.cache, "objects", `${metadata.sha256}.txt`), "corrupted body");
      const resumed = await collectProductPages({ ...options, fetchImpl });
      assert.equal(resumed.report.status, "complete");
      assert.equal(homepageRequests, 2);
      assert.equal(resumed.report.fetchedPages, 2);
    },
    [product("first")],
  );
});

test("a rendering challenge produces a browser-review task instead of price facts", async () => {
  await fixture(
    async (options) => {
      const result = await collectProductPages({
        ...options,
        fetchImpl: async (url) =>
          url.endsWith("/robots.txt")
            ? new Response("", { status: 404 })
            : html("<title>Just a moment...</title><p>$999</p>"),
      });
      assert.equal(result.report.outcomes["needs-browser-review"], 1);
      assert.equal(result.report.pagesWithPriceHints, 0);
      assert.equal(result.report.status, "complete-with-gaps");
    },
    [product("first")],
  );
});

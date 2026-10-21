import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import robotsParser from "robots-parser";
import {
  cliOptions,
  fetchText,
  hash,
  positiveInteger,
  publicUrl,
  readJson,
  ResearchError,
  USER_AGENT,
  writeJson,
  writeText,
} from "./catalog-research-utils.mjs";

const ROBOT = "ProudlyPaidResearch";
// Explicit restrictions found during review; robots.txt alone is not permission to collect.
const MANUAL_REVIEW_HOSTS = ["jotform.com", "superblocks.com"];
const unescapeText = (value) =>
  value
    .replace(/&#(x[\da-f]+|\d+);/gi, (match, number) => {
      const code =
        number[0].toLowerCase() === "x" ? Number.parseInt(number.slice(1), 16) : Number(number);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    })
    .replace(
      /&(amp|lt|gt|quot|apos|nbsp|dollar|euro|pound);/gi,
      (_, entity) =>
        ({
          amp: "&",
          lt: "<",
          gt: ">",
          quot: '"',
          apos: "'",
          nbsp: " ",
          dollar: "$",
          euro: "€",
          pound: "£",
        })[entity.toLowerCase()],
    );

export function summarizeHtml(body, finalUrl) {
  const title = unescapeText(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(body)?.[1] ?? "")
    .replace(/\s+/g, " ")
    .trim();
  const clean = body
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ");
  const lines = unescapeText(
    clean
      .replace(/<\/(?:p|h[1-6]|li|tr|div|section|article)>|<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const priceHints = [];
  for (let index = 0; index < lines.length && priceHints.length < 20; index++) {
    if (
      /(?:[$€£¥]\s*\d|\b(?:USD|EUR|GBP|CNY|JPY|AUD|CAD)\s*\d|\d\s*(?:USD|EUR|GBP)\b|contact\s+(?:sales|us)|billed\s+(?:annually|monthly))/i.test(
        lines[index],
      )
    ) {
      priceHints.push({
        textLine: index + 1,
        text: lines
          .slice(Math.max(0, index - 1), index + 2)
          .join(" | ")
          .slice(0, 1000),
        verification: "needs-review",
      });
    }
  }
  const base = publicUrl(finalUrl);
  const rootHost = base.hostname.replace(/^www\./, "");
  const links = new Map();
  for (const match of clean.matchAll(
    /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    try {
      const url = publicUrl(new URL(unescapeText(match[1]), base).href);
      if (url.hostname !== rootHost && !url.hostname.endsWith(`.${rootHost}`)) continue;
      if (/\b(?:login|signin|signup|logout|delete|checkout|oauth)\b/i.test(url.pathname)) continue;
      const label = unescapeText(match[2].replace(/<[^>]+>/g, " "))
        .replace(/\s+/g, " ")
        .trim();
      if (
        /\/(?:glossary|blog|departments|hc|privacy|subprocessors|contact-us)(?:\/|$)/i.test(
          url.pathname,
        )
      )
        continue;
      const role =
        /\/(?:[^/]*-)?(?:pricing|plans)(?:\/|$)/i.test(url.pathname) ||
        /^(?:pricing|plans|价格|定价)$/i.test(label)
          ? "pricing"
          : /\/(?:terms(?:-of-(?:service|use))?|tos|eula|(?:master-|customer-|service-)?(?:services?-)?agreement|legal)(?:\/|$)/i.test(
                url.pathname,
              ) ||
              /^(?:terms(?: of (?:service|use))?|legal|license agreement|条款|许可)$/i.test(label)
            ? "terms"
            : null;
      if (role && !links.has(url.href)) links.set(url.href, { url: url.href, role });
    } catch {
      /* Unsupported links remain in the preserved raw page, not in the fetch queue. */
    }
  }
  return {
    extractorVersion: 2,
    title,
    challenge:
      /^(?:just a moment|access denied|attention required|verify you are human|security check)/i.test(
        title,
      ) || /\bcf-chl-(?:opt|widget)/.test(body),
    priceHints,
    textPreview: lines.join("\n").slice(0, 6000),
    discoveredLinks: [...links.values()]
      .sort(
        (a, b) =>
          Number(/\/legal\/?$/i.test(new URL(a.url).pathname)) -
          Number(/\/legal\/?$/i.test(new URL(b.url).pathname)),
      )
      .slice(0, 20),
  };
}

async function optionalJson(path) {
  try {
    return await readJson(path);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export async function collectProductPages({
  input,
  cache = resolve(".local/catalog-page-cache"),
  outputRoot = resolve(".local/catalog-page-runs"),
  maxProducts = 20,
  maxRequests = 100,
  maxAgeHours = 168,
  retryFailed = false,
  fetchImpl = fetch,
  lookupImpl,
  now = Date.now,
  sleep = delay,
  minIntervalMs = 1000,
} = {}) {
  if (!input) throw new Error("--input must explicitly select a products.json import batch.");
  const bytes = await readFile(input);
  const document = JSON.parse(bytes.toString("utf8"));
  if (
    document?.schemaVersion !== 1 ||
    document.verification !== "needs-review" ||
    !Array.isArray(document.products)
  )
    throw new Error("Invalid discovery products document.");
  maxProducts = positiveInteger(maxProducts, 20);
  maxRequests = positiveInteger(maxRequests, 100);
  maxAgeHours = positiveInteger(maxAgeHours, 168);
  const ids = new Set();
  for (const product of document.products) {
    if (
      !product ||
      typeof product.productId !== "string" ||
      !product.productId ||
      ids.has(product.productId) ||
      typeof product.name !== "string" ||
      product.verification !== "needs-review" ||
      !Array.isArray(product.relationshipIds)
    )
      throw new Error("Malformed or duplicate product queue entry.");
    ids.add(product.productId);
    for (const url of [product.homepage, product.pricingUrl].filter(Boolean)) publicUrl(url);
  }
  await mkdir(outputRoot, { recursive: true });
  const output = await mkdtemp(resolve(outputRoot, "run-"));
  for (const subdirectory of ["pages", "objects", "origins", "products"])
    await mkdir(resolve(cache, subdirectory), { recursive: true });
  const startedAt = new Date(now()).toISOString();
  let requests = 0;
  let cacheHits = 0;
  let budgetReached = false;
  const robots = new Map();
  const origins = new Map();
  const results = [];
  const eligible = [];
  let productsAttemptedThisRun = 0;
  const checkpointPath = (id) => resolve(cache, "products", `${hash(`${hash(bytes)}:${id}`)}.json`);
  for (const product of document.products) {
    const saved = await optionalJson(checkpointPath(product.productId));
    const fresh = saved && now() - Date.parse(saved.completedAt) < maxAgeHours * 3_600_000;
    if (fresh) {
      if (
        saved.draft?.productId !== product.productId ||
        saved.draft.verification !== "needs-review" ||
        !Array.isArray(saved.draft.pages)
      )
        throw new Error("Invalid product checkpoint.");
      results.push(saved.draft);
      if (
        retryFailed &&
        (!saved.draft.pages.length || saved.draft.pages.some((page) => page.outcome !== "fetched"))
      )
        eligible.push(product);
    } else eligible.unshift(product);
  }
  // New products come before retries; retain the import's coverage-priority ordering.
  eligible.sort(
    (a, b) =>
      Number(results.some((row) => row.productId === a.productId)) -
        Number(results.some((row) => row.productId === b.productId)) ||
      document.products.indexOf(a) - document.products.indexOf(b),
  );

  async function originState(origin) {
    if (!origins.has(origin))
      origins.set(
        origin,
        (await optionalJson(resolve(cache, "origins", `${hash(origin)}.json`))) ?? {
          nextAt: 0,
          intervalMs: minIntervalMs,
        },
      );
    return origins.get(origin);
  }
  async function limitedFetch(url, options) {
    if (requests >= maxRequests)
      throw new ResearchError("budget-reached", "This run's request budget has been reached.");
    const origin = new URL(url).origin;
    const state = await originState(origin);
    const wait = state.nextAt - now();
    if (wait > 10_000)
      throw new ResearchError("deferred", "Host cooldown has not elapsed.", {
        retryAt: state.nextAt,
      });
    if (wait > 0) await sleep(wait);
    requests++;
    let response;
    try {
      response = await fetchImpl(url, options);
      return response;
    } finally {
      const header = response?.headers.get("retry-after");
      const retry = header
        ? /^\d+$/.test(header)
          ? now() + Number(header) * 1000
          : Date.parse(header)
        : null;
      state.nextAt = Math.max(
        now() + state.intervalMs,
        Number.isFinite(retry) && retry <= 8.64e15 ? retry : 0,
        response?.status === 429 ? now() + 60_000 : 0,
      );
      await writeJson(resolve(cache, "origins", `${hash(origin)}.json`), state);
    }
  }
  async function getPage(url, isRobots = false) {
    const key = hash(url);
    const metadataPath = resolve(cache, "pages", `${key}.json`);
    const saved = await optionalJson(metadataPath);
    const ageLimit = (isRobots ? 24 : maxAgeHours) * 3_600_000;
    if (
      saved &&
      now() - Date.parse(saved.fetchedAt) < ageLimit &&
      !(retryFailed && saved.outcome !== "fetched")
    ) {
      if (saved.outcome === "fetched") {
        try {
          if (!/^[a-f0-9]{64}$/.test(saved.sha256)) throw new Error("Invalid object identity");
          const body = await readFile(resolve(cache, "objects", `${saved.sha256}.txt`), "utf8");
          if (hash(body) === saved.sha256) {
            cacheHits++;
            return { ...saved, body, cached: true };
          }
        } catch (error) {
          if (error.code && error.code !== "ENOENT") throw error;
        }
      } else if (!saved.retryAt || saved.retryAt > now()) {
        cacheHits++;
        return { ...saved, cached: true };
      }
    }
    let record;
    try {
      const response = await fetchText(url, {
        fetchImpl: limitedFetch,
        lookupImpl,
        maxBytes: isRobots ? 512 * 1024 : 3 * 1024 * 1024,
        beforeRequest: isRobots ? undefined : ensureRobots,
      });
      record = {
        requestedUrl: url,
        finalUrl: response.finalUrl,
        fetchedAt: new Date(now()).toISOString(),
        statusCode: response.statusCode,
        contentType: response.contentType,
        retryAt: response.retryAt,
        verification: "needs-review",
        outcome:
          response.statusCode === 200
            ? "fetched"
            : [401, 403].includes(response.statusCode)
              ? "access-denied"
              : response.statusCode === 429 || response.statusCode >= 500
                ? "deferred"
                : "http-error",
      };
      if (record.outcome === "deferred" && !record.retryAt) record.retryAt = now() + 60_000;
      if (record.outcome === "fetched") {
        record.sha256 = hash(response.body);
        record.object = `objects/${record.sha256}.txt`;
        // Raw text is an internal research input, never an automatically published description.
        await writeText(resolve(cache, record.object), response.body);
        await writeJson(metadataPath, record);
        return { ...record, body: response.body, cached: false };
      }
    } catch (error) {
      if (error.code === "budget-reached") throw error;
      record = {
        requestedUrl: url,
        fetchedAt: new Date(now()).toISOString(),
        verification: "needs-review",
        outcome: error.code ?? "error",
        message: error instanceof ResearchError ? error.message : "Page research failed.",
        retryAt: error.retryAt ?? now() + 60_000,
      };
    }
    await writeJson(metadataPath, record);
    return record;
  }
  async function ensureRobots(url) {
    if (
      MANUAL_REVIEW_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
    )
      throw new ResearchError(
        "manual-review-required",
        "Reviewed site terms require manual research or explicit collection permission.",
      );
    if (!robots.has(url.origin)) {
      const robotsUrl = new URL("/robots.txt", url.origin).href;
      const record = await getPage(robotsUrl, true);
      let parser;
      if (record.statusCode === 404 || record.statusCode === 410)
        parser = robotsParser(robotsUrl, "");
      else if (record.outcome === "fetched" && !/text\/html/i.test(record.contentType))
        parser = robotsParser(robotsUrl, record.body);
      robots.set(url.origin, { parser, record });
      if (parser) {
        const state = await originState(url.origin);
        const seconds = parser.getCrawlDelay(ROBOT);
        if (Number.isFinite(seconds) && seconds >= 0) {
          state.intervalMs = Math.max(minIntervalMs, seconds * 1000);
          state.nextAt = Math.max(state.nextAt, Date.parse(record.fetchedAt) + state.intervalMs);
          await writeJson(resolve(cache, "origins", `${hash(url.origin)}.json`), state);
        }
      }
    }
    const policy = robots.get(url.origin);
    if (!policy.parser)
      throw new ResearchError(
        "robots-unavailable",
        "robots.txt could not be checked; page fetch is deferred.",
        { retryAt: policy.record.retryAt ?? now() + 60_000 },
      );
    if (policy.parser.isAllowed(url.href, USER_AGENT) !== true)
      throw new ResearchError("robots-disallowed", "Page is disallowed by robots.txt.", {
        retryAt: now() + 24 * 3_600_000,
      });
  }

  async function draft(product) {
    const pages = [];
    const queue = [];
    const seen = new Set();
    const add = (url, role) => {
      if (url && !seen.has(url)) {
        seen.add(url);
        queue.push({ url, role });
      }
    };
    add(product.homepage, "homepage");
    add(product.pricingUrl, "pricing");
    for (let index = 0; index < queue.length && pages.length < 4; index++) {
      const task = queue[index];
      const record = await getPage(task.url);
      const { body, ...metadata } = record;
      const summary = body ? summarizeHtml(body, record.finalUrl) : null;
      const page = { ...metadata, role: task.role, ...(summary ?? {}) };
      if (summary?.challenge) {
        page.outcome = "needs-browser-review";
        page.priceHints = [];
        page.discoveredLinks = [];
      }
      pages.push(page);
      if (summary && !summary.challenge) {
        // Two explicitly linked research pages at most; never guess a /pricing URL.
        const discovered = summary.discoveredLinks;
        for (const role of ["pricing", "terms"]) {
          if (!queue.some((entry) => entry.role === role)) {
            const link = discovered.find((entry) => entry.role === role);
            if (link) add(link.url, role);
          }
        }
      }
    }
    return {
      productId: product.productId,
      name: product.name,
      verification: "needs-review",
      sourceClassification: "unclassified",
      relationshipIds: product.relationshipIds,
      pages,
      nextReview: !pages.length
        ? "Find and confirm the product's official website."
        : "Review the product scope, relationship evidence, proprietary terms, and billing configuration. Price-like snippets are not approved prices.",
    };
  }
  async function persist(status) {
    const report = {
      schemaVersion: 1,
      extractorVersion: 1,
      status,
      verification: "needs-review",
      startedAt,
      updatedAt: new Date(now()).toISOString(),
      input: resolve(input),
      inputSha256: hash(bytes),
      cache: resolve(cache),
      limits: { maxProducts, maxRequests, maxAgeHours },
      productsInInput: document.products.length,
      processedProducts: results.length,
      productsAttemptedThisRun,
      remainingProducts: document.products.length - results.length,
      requests,
      cacheHits,
      fetchedPages: results.flatMap((row) => row.pages).filter((page) => page.outcome === "fetched")
        .length,
      uniqueFetchedPages: new Set(
        results
          .flatMap((row) => row.pages)
          .filter((page) => page.outcome === "fetched")
          .map((page) => page.finalUrl),
      ).size,
      productsWithFetchedPages: results.filter((row) =>
        row.pages.some((page) => page.outcome === "fetched"),
      ).length,
      productsWithPricingPageHints: results.filter((row) =>
        row.pages.some((page) => page.role === "pricing" && page.priceHints?.length),
      ).length,
      pagesWithPriceHints: results
        .flatMap((row) => row.pages)
        .filter((page) => page.priceHints?.length).length,
      outcomes: results
        .flatMap((row) => row.pages)
        .reduce((counts, page) => {
          counts[page.outcome] = (counts[page.outcome] ?? 0) + 1;
          return counts;
        }, {}),
      notes:
        "Research evidence only. HTML, price-like text and source labels do not approve products, relationships or prices. Resume using the same input and cache; no catalog or database writes occur.",
    };
    await writeJson(resolve(output, "review-drafts.json"), {
      schemaVersion: 1,
      verification: "needs-review",
      products: results,
    });
    await writeJson(resolve(output, "report.json"), report);
    const label = (value) =>
      value.replace(/[\r\n]/g, " ").replace(/[\\`*_{}[\]()<>#+.!|]/g, "\\$&");
    await writeText(
      resolve(output, "review-summary.md"),
      [
        "# Product research batch",
        "",
        "Unverified local research. Nothing in this batch automatically approves a price, proprietary classification or recommendation.",
        "",
        `Status: ${status}. Products attempted: ${results.length}/${document.products.length}. Requests this run: ${requests}. Cached pages reused: ${cacheHits}.`,
        "",
        "| Product | Fetched pages | Pages with price hints | Follow-up outcomes |",
        "| --- | ---: | ---: | --- |",
        ...results.map(
          (row) =>
            `| ${label(row.name)} | ${row.pages.filter((page) => page.outcome === "fetched").length} | ${row.pages.filter((page) => page.priceHints?.length).length} | ${row.pages.length ? [...new Set(row.pages.filter((page) => page.outcome !== "fetched").map((page) => page.outcome))].join(", ") || "Review scope, terms and billing" : "Confirm official website"} |`,
        ),
        "",
        "See review-drafts.json for page URLs, hashes, previews and price-like snippets. Raw documents are retained only in the local research cache. Missing/uncertain facts remain needs-review. No D1 write or catalog publication was performed.",
        "",
      ].join("\n"),
    );
    return report;
  }
  try {
    for (const product of eligible.slice(0, maxProducts)) {
      const result = await draft(product);
      await writeJson(checkpointPath(product.productId), {
        completedAt: new Date(now()).toISOString(),
        draft: result,
      });
      const previous = results.findIndex((row) => row.productId === product.productId);
      if (previous >= 0) results[previous] = result;
      else results.push(result);
      productsAttemptedThisRun++;
      await persist("running");
      console.log(
        JSON.stringify({ product: product.name, processed: results.length, requests, cacheHits }),
      );
    }
  } catch (error) {
    if (error.code !== "budget-reached") {
      await persist("failed");
      throw error;
    }
    budgetReached = true;
  }
  const gaps = results.some(
    (row) => !row.pages.length || row.pages.some((page) => page.outcome !== "fetched"),
  );
  const status =
    budgetReached || productsAttemptedThisRun < eligible.length
      ? "paused"
      : gaps
        ? "complete-with-gaps"
        : "complete";
  const report = await persist(status);
  return { output, report };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = cliOptions(
      process.argv.slice(2),
      [
        "--input",
        "--cache",
        "--out",
        "--max-products",
        "--max-requests",
        "--max-age-hours",
        "--retry-failed",
      ],
      ["--retry-failed"],
    );
    const result = await collectProductPages({
      input: args["--input"],
      cache: args["--cache"],
      outputRoot: args["--out"],
      maxProducts: args["--max-products"],
      maxRequests: args["--max-requests"],
      maxAgeHours: args["--max-age-hours"],
      retryFailed: args["--retry-failed"],
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

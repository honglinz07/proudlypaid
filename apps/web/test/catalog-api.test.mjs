import assert from "node:assert/strict";
import { test } from "node:test";
import { CatalogApiError, getAlternatives, searchProjects } from "../src/lib/catalog-api.ts";

const project = {
  id: "example/tool",
  name: "Tool",
  fullName: "example/tool",
  repository: "https://github.com/example/tool",
  category: null,
  license: null,
  reviewedOn: null,
};
const catalog = {
  version: "test-snapshot",
  reviewedOn: "2026-10-19",
  projectCount: 1,
  collectionScope: "curated-only",
};
const search = {
  apiVersion: 1,
  query: "Tool",
  match: "exact",
  projects: [project],
  preferredProjectId: project.id,
  truncated: false,
  catalog,
};
const fixed = {
  plan: "Test plan",
  kind: "list-price",
  amount: 12,
  currency: "USD",
  unit: "user",
  period: "month",
  billing: "annual",
  configuration: "Test fixture only",
  notes: "Synthetic data",
  sourceUrl: "https://example.com/pricing",
  currencyEvidenceUrl: "https://example.com/terms",
  reviewedOn: "2026-10-19",
};
const quote = {
  ...fixed,
  plan: "Test quote",
  kind: "contact-sales",
  amount: null,
  currency: null,
  unit: null,
  period: null,
  billing: null,
};
const product = {
  id: "test-product",
  name: "Test product",
  homepage: "https://example.com/",
  availability: {
    classification: "proprietary-hosted-service",
    scope: "Test scope",
    evidenceUrls: ["https://example.com/terms"],
    notes: "Synthetic data",
    reviewedOn: "2026-10-19",
  },
  relationship: {
    verification: "feature-overlap-reviewed",
    overlap: "Test overlap",
    limitations: "Test limitation",
    evidenceUrls: ["https://example.com/"],
    reviewedOn: "2026-10-19",
  },
  prices: [fixed, quote],
  pendingPriceCount: 1,
};
const detail = {
  apiVersion: 1,
  project,
  alternatives: [product],
  priceGroups: [
    {
      key: "test-basis",
      currency: "USD",
      unit: "user",
      period: "month",
      billing: "annual",
      entries: [{ productId: product.id, price: fixed }],
    },
  ],
  pendingAlternativeCount: 0,
  catalog,
};
const signal = () => new AbortController().signal;
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
const invalid = (error) => error instanceof CatalogApiError && error.code === "INVALID_RESPONSE";

test("client encodes query and repository identity and forwards cancellation", async (t) => {
  const controller = new AbortController();
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, options });
    return json(calls.length === 1 ? search : detail);
  });
  assert.deepEqual(await searchProjects("owner/tool & fork", controller.signal), search);
  assert.equal(calls[0].url, "/api/v1/search?q=owner%2Ftool%20%26%20fork");
  assert.deepEqual(await getAlternatives(project.id, controller.signal), detail);
  assert.equal(calls[1].url, "/api/v1/projects/example%2Ftool/alternatives");
  controller.abort();
  assert.equal(calls[0].options.signal.aborted, true);
});
test("client refuses HTML fallbacks, invalid JSON, unsupported contracts and unsafe links", async (t) => {
  const responses = [
    new Response("<html>SPA fallback</html>", { headers: { "content-type": "text/html" } }),
    new Response("{", { headers: { "content-type": "application/json" } }),
    json({ ...search, apiVersion: 999 }),
    json({ ...search, projects: [{ ...project, repository: "javascript:alert(1)" }] }),
    json({ ...search, preferredProjectId: "unlisted/repo" }),
  ];
  t.mock.method(globalThis, "fetch", async () => responses.shift());
  for (let i = 0; i < 5; i++) await assert.rejects(searchProjects("Tool", signal()), invalid);
});
test("API errors stay distinct from valid empty search results", async (t) => {
  const responses = [
    json({ apiVersion: 1, error: { code: "CATALOG_NOT_READY" } }, 503),
    json({ message: "Gateway failed" }, 502),
    json({ ...search, match: "none", projects: [], preferredProjectId: null }),
  ];
  t.mock.method(globalThis, "fetch", async () => responses.shift());
  await assert.rejects(
    searchProjects("Tool", signal()),
    (error) => error.code === "CATALOG_NOT_READY",
  );
  await assert.rejects(searchProjects("Tool", signal()), (error) => error.code === "API_ERROR");
  assert.deepEqual((await searchProjects("Tool", signal())).projects, []);
});
test("nullable quotes and currency evidence survive; incompatible or unknown price groups fail", async (t) => {
  const badUnit = structuredClone(detail);
  badUnit.priceGroups[0].unit = "host";
  const zeroQuote = structuredClone(detail);
  zeroQuote.alternatives[0].prices[1].amount = 0;
  const unknownProduct = structuredClone(detail);
  unknownProduct.priceGroups[0].entries[0].productId = "not-published";
  const pendingCurrency = structuredClone(detail);
  pendingCurrency.alternatives[0].prices[0].currency = null;
  const responses = [detail, badUnit, zeroQuote, unknownProduct, pendingCurrency];
  t.mock.method(globalThis, "fetch", async () => json(responses.shift()));
  const result = await getAlternatives(project.id, signal());
  assert.equal(result.alternatives[0].prices[1].unit, null);
  assert.equal(result.alternatives[0].prices[1].amount, null);
  assert.equal(result.alternatives[0].prices[0].currencyEvidenceUrl, fixed.currencyEvidenceUrl);
  for (let i = 0; i < 4; i++) await assert.rejects(getAlternatives(project.id, signal()), invalid);
});
test("network and abort failures are not converted into empty successful results", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    options.signal.throwIfAborted();
    throw new TypeError("Network unavailable");
  });
  await assert.rejects(searchProjects("Tool", signal()), /Network unavailable/u);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    searchProjects("Tool", controller.signal),
    (error) => error.name === "AbortError",
  );
});

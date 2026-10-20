import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultFilters, demoAlternatives, getDemoResults } from "../src/lib/demo-catalog.ts";

test("demo results use descending numeric prices, with undisclosed prices last", () => {
  const results = getDemoResults("Supabase");
  assert.deepEqual(
    results.map((item) => item.monthlyUsd),
    [2499, 899, 299, null],
  );
});

test("demo project matching trims whitespace, ignores case, and supports the postgres alias", () => {
  assert.deepEqual(getDemoResults("  sUPAbase "), getDemoResults("Postgres"));
});

test("unknown, empty, and arbitrary input cannot produce unrelated demo matches", () => {
  for (const query of [
    "",
    "unknown project",
    "<script>alert(1)</script>",
    "toString",
    "constructor",
  ]) {
    assert.deepEqual(getDemoResults(query), []);
  }
});

test("budget, enterprise, and undisclosed-price filters work together", () => {
  assert.deepEqual(
    getDemoResults("Supabase", { maxPrice: 1000, enterpriseOnly: false, includeQuote: false }).map(
      (item) => item.id,
    ),
    ["vaultstack", "meterdb"],
  );
  assert.deepEqual(
    getDemoResults("Supabase", { maxPrice: 5000, enterpriseOnly: true, includeQuote: false }).map(
      (item) => item.id,
    ),
    ["paybase"],
  );
  assert.deepEqual(
    getDemoResults("Supabase", { maxPrice: 0, enterpriseOnly: true, includeQuote: true }).map(
      (item) => item.id,
    ),
    ["opaque-cloud"],
  );
});

test("repeated filtering cannot mutate the catalog or the defaults", () => {
  const before = structuredClone(demoAlternatives);
  getDemoResults("Grafana", { maxPrice: 0, enterpriseOnly: true, includeQuote: false });
  assert.deepEqual(demoAlternatives, before);
  assert.equal(getDemoResults("Grafana").length, 3);
  assert.deepEqual(defaultFilters, { maxPrice: 5000, enterpriseOnly: false, includeQuote: true });
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { groupCandidates, validateIdentities } from "../scripts/group-catalog-candidates.mjs";
import { readCatalog } from "../scripts/check-catalog.mjs";

const registry = JSON.parse(
  await readFile(new URL("../data/catalog/product-identities.json", import.meta.url), "utf8"),
);
const evidence = (id, targetText) => ({
  id,
  targetText,
  repositoryName: "example/project",
  repositoryUrl: "https://github.com/example/project",
  line: 3,
  readmeSha256: "a".repeat(64),
  verification: "needs-review",
});

test("registry has unambiguous identities and includes every researched product", async () => {
  assert.deepEqual(validateIdentities(registry), []);
  const catalog = await readCatalog();
  const ids = new Set(registry.products.map((product) => product.id));
  for (const product of catalog.products) assert.ok(ids.has(product.id), product.id);
});

test("one explicit multi-product statement enters each product queue with its evidence intact", () => {
  const row = evidence("first", "Vercel, Heroku and Netlify.");
  const result = groupCandidates([row], registry);
  assert.equal(result.products.length, 3);
  assert.equal(result.report.matchedCandidates, 1);
  assert.equal(result.report.productEvidenceLinks, 3);
  for (const group of result.products) {
    assert.equal(group.verification, "needs-review");
    assert.deepEqual(group.evidence, [row]);
  }
});

test("word boundaries and case policy prevent substring and ordinary-word false matches", () => {
  const result = groupCandidates(
    [
      evidence("zoominfo", "ZoomInfo"),
      evidence("coda", "undecodable bytes"),
      evidence("linear", "linear probing"),
      evidence("make", "make tools easier"),
    ],
    registry,
  );
  assert.equal(result.products.length, 0);
  assert.equal(result.unresolved.length, 4);
});

test("brand aliases and Unicode normalization resolve without classifying software licensing", () => {
  const result = groupCandidates(
    [evidence("brands", "Ｌｉｎｅａｒ, Integromat and Microsoft Teams")],
    registry,
  );
  assert.deepEqual(result.products.map((product) => product.productId).sort(), [
    "linear",
    "make",
    "microsoft-teams",
  ]);
  for (const group of result.products) assert.equal(group.verification, "needs-review");
});

test("unrecognized statements remain byte-for-byte available in the unresolved queue", () => {
  const row = evidence("unknown", "an unknown tool with unusual punctuation");
  const result = groupCandidates([row], registry);
  assert.deepEqual(result.unresolved, [row]);
  assert.equal(
    result.report.matchedCandidates + result.report.unresolvedCandidates,
    result.report.candidates,
  );
});

test("duplicate evidence and malformed rows fail instead of inflating coverage", () => {
  const row = evidence("duplicate", "Airtable");
  assert.throws(() => groupCandidates([row, row], registry), /Duplicate candidate/);
  assert.throws(
    () => groupCandidates([{ ...row, readmeSha256: null }], registry),
    /Invalid candidate/,
  );
});

test("conflicting aliases and credential-bearing source URLs are rejected", () => {
  const copy = structuredClone(registry);
  copy.products[1].aliases.push(copy.products[0].aliases[0]);
  assert.ok(validateIdentities(copy).some((error) => error.includes("Ambiguous alias")));
  copy.products[0].homepage = "https://user:password@example.com/";
  assert.ok(validateIdentities(copy).some((error) => error.includes("Incomplete identity")));
});

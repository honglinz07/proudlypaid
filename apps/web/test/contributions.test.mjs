import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeRepositoryUrl,
  contributionPath,
  contributionIssueUrl,
  isPublicSourceUrl,
  formatContribution,
} from "../src/lib/contributions.ts";

test("public repository configuration cannot become a credential-bearing or external feedback destination", () => {
  assert.equal(
    normalizeRepositoryUrl(" https://github.com/example/closedsources/ "),
    "https://github.com/example/closedsources",
  );
  for (const value of [
    undefined,
    "",
    "http://github.com/a/b",
    "https://github.com.evil.test/a/b",
    "https://user:secret@github.com/a/b",
    "https://github.com/a/b?token=secret",
    "https://github.com/a/b#fragment",
    "https://github.com/a/b/issues",
    "https://github.com/a//b",
    "javascript:alert(1)",
  ])
    assert.equal(normalizeRepositoryUrl(value), null);
  assert.equal(contributionIssueUrl(undefined), null);
  assert.equal(
    contributionIssueUrl("https://github.com/example/closedsources"),
    "https://github.com/example/closedsources/issues/new?template=catalog_suggestion.md",
  );
});
test("search context stays bounded and encoded within the local contribution route", () => {
  const input = "example/tool?x=1&redirect=https://other.test/#片段";
  const path = contributionPath(input);
  assert.equal(new URL(path, "https://local.test").searchParams.get("project"), input);
  assert.equal(contributionPath(""), "/contribute");
  assert.equal(
    new URL(contributionPath("x".repeat(500)), "https://local.test").searchParams.get("project")
      .length,
    200,
  );
});
test("drafts preserve research evidence as text and never turn unknown prices into asserted facts", () => {
  const text = formatContribution({
    project: " Penpot ",
    product: "",
    source: "",
    notes: "价格和付款周期待核验。\n<script>example</script>",
  });
  assert.ok(text.includes("\n\nPenpot\n\n"));
  assert.ok(text.includes("To be researched"));
  assert.ok(text.includes("价格和付款周期待核验。\n<script>example</script>"));
  assert.ok(text.includes("not a verified catalog record"));
  assert.ok(!text.includes("$0"));
});
test("draft validation rejects unsafe evidence URLs and oversized or empty submissions", () => {
  const base = {
    project: "Tool",
    product: "",
    source: "https://vendor.example/pricing",
    notes: "",
  };
  assert.equal(isPublicSourceUrl(base.source), true);
  for (const source of [
    "https://token:secret@vendor.example",
    "javascript:alert(1)",
    "http://vendor.example",
    "/relative",
  ])
    assert.throws(() => formatContribution({ ...base, source }));
  assert.throws(() => formatContribution({ ...base, project: " " }));
  assert.throws(() => formatContribution({ ...base, notes: "x".repeat(3001) }));
});

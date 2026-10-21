import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { adaptSources, importCatalogSources } from "../scripts/import-catalog-sources.mjs";

const registry = {
  schemaVersion: 1,
  status: "discovery-only",
  products: [
    {
      id: "notion",
      name: "Notion",
      aliases: ["Notion Workspace"],
      homepage: "https://www.notion.com/",
      pricingUrl: "https://www.notion.com/pricing",
      scope: "Hosted workspace",
      category: "notes",
      caseSensitive: false,
    },
  ],
};
const macrostack = {
  license_short: "CC-BY-4.0",
  data: [
    {
      repo: "https://github.com/example/notes",
      replaces: "Notion Workspace",
      website: "https://oss.example.com",
      pricing: "Free",
      open_source: true,
    },
    {
      repo: "https://github.com/example/other",
      replaces: "Other SaaS",
      website: "https://oss.example.com",
      pricing: "Free",
      open_source: true,
    },
  ],
};
const saas = [
  {
    name: "Notion",
    repo: null,
    website: "https://www.notion.com",
    pricing: "freemium",
    openSource: false,
    replaces: [],
  },
  {
    name: "Notes",
    repo: "example/notes",
    website: "https://oss.example.com",
    replaces: ["Notion"],
  },
  {
    name: "Other SaaS",
    repo: null,
    website: "https://other.example.com",
    pricing: "paid",
    replaces: [],
  },
];
const adapt = (options = {}) =>
  adaptSources({
    macrostack,
    saas,
    registry,
    indexedRepositories: new Set(["example/notes"]),
    ...options,
  });

test("bulk adapters merge known aliases and retain every source without approving paid claims", () => {
  const result = adapt();
  assert.equal(result.relationships.length, 2);
  const notion = result.products.find((p) => p.productId === "notion");
  const relation = result.relationships.find((r) => r.productId === "notion");
  assert.equal(relation.evidence.length, 2);
  assert.equal(relation.repositoryInCollectedIndex, true);
  assert.equal(relation.verification, "needs-review");
  assert.equal(relation.sourceClassification, "unclassified");
  assert.equal(notion.pricingUrl, "https://www.notion.com/pricing");
  assert.equal(Object.hasOwn(notion, "pricing"), false);
  assert.equal(result.counts.indexedRelationships, 1);
});

test("target locators never inherit the alternative's homepage or its free price", () => {
  const result = adapt({ saas: [] });
  const other = result.products.find((p) => p.name === "Other SaaS");
  assert.equal(other.homepage, null);
  assert.equal(other.pricingUrl, null);
  assert.equal(result.counts.productsWithoutHomepage, 1);
  const outside = result.relationships.find((r) => r.repositoryName === "example/other");
  assert.equal(outside.repositoryInCollectedIndex, false);
  assert.ok(outside.evidence[0].jsonPointer);
});

test("distinct products on one vendor domain stay distinct and unsafe locators are not queued", () => {
  const result = adapt({
    saas: [
      { name: "A", repo: "example/a", replaces: ["Product B", "Product C", "Unsafe"] },
      { name: "Product B", website: "https://vendor.example.com/b", replaces: [] },
      { name: "Product C", website: "https://vendor.example.com/c", replaces: [] },
      { name: "Unsafe", website: "https://secret:token@vendor.example.com", replaces: [] },
    ],
  });
  assert.equal(
    result.products.filter((p) => p.homepage?.startsWith("https://vendor.example.com")).length,
    2,
  );
  assert.equal(result.products.find((p) => p.name === "Unsafe").homepage, null);
});

test("source schema/license changes fail and invalid repository rows remain in diagnostics", () => {
  assert.throws(
    () => adapt({ macrostack: { ...macrostack, license_short: "unknown" } }),
    /license/,
  );
  const result = adapt({
    macrostack: {
      ...macrostack,
      data: [{ repo: "https://github.com/an-organization", replaces: "Tool" }],
    },
  });
  assert.equal(result.unresolved[0].reason, "invalid-repository");
});

test("README grouping joins without fabricating line numbers or treating a mention as approval", () => {
  const result = adapt({
    readmeGroups: [
      {
        name: "Notion",
        evidence: [
          {
            id: "original-evidence",
            repositoryUrl: "https://github.com/example/notes",
            line: 12,
            readmeSha256: "a".repeat(64),
            verification: "needs-review",
            excerpt: "Sponsor mentions Notion",
          },
        ],
      },
    ],
  });
  const relation = result.relationships.find((r) => r.productId === "notion");
  assert.equal(relation.evidence.length, 3);
  assert.equal(relation.evidence.at(-1).kind, "readme-mention");
  assert.equal(relation.evidence.at(-1).line, 12);
  assert.throws(
    () => adapt({ readmeGroups: [{ name: "Notion", evidence: [{ id: "invalid" }] }] }),
    /Invalid README/,
  );
});

test("offline imports preserve source snapshots, license and index bytes in independent runs", async () => {
  const root = await mkdtemp(join(tmpdir(), "proudlypaid-bulk-import-"));
  try {
    const from = join(root, "sources");
    const index = join(root, "collection", "index.jsonl");
    await mkdir(from);
    await mkdir(dirname(index));
    await writeFile(join(from, "macrostack.json"), JSON.stringify(macrostack));
    await writeFile(join(from, "awesome-saas-alternatives.json"), JSON.stringify(saas));
    const license = "MIT License\n\nCopyright (c) 2026 awesome-saas-alternatives contributors\n";
    await writeFile(join(from, "awesome-saas-license.txt"), license);
    await writeFile(
      index,
      `${JSON.stringify({ name: "example/notes", url: "https://github.com/example/notes", readme: null })}\n`,
    );
    const before = await readFile(index);
    const options = { from, index, outputRoot: join(root, "output") };
    const first = await importCatalogSources(options);
    const second = await importCatalogSources(options);
    assert.notEqual(first.output, second.output);
    assert.deepEqual(await readFile(index), before);
    assert.equal(
      await readFile(join(first.output, "sources", "awesome-saas-license.txt"), "utf8"),
      license,
    );
    assert.equal(
      await readFile(join(first.output, "relationships.jsonl"), "utf8"),
      await readFile(join(second.output, "relationships.jsonl"), "utf8"),
    );
    assert.equal(first.report.sources[0].acquisition, "local-snapshot");
    await assert.rejects(
      importCatalogSources({ ...options, outputRoot: join(from, "bad-output") }),
      /outside/,
    );
  } finally {
    assert.equal(dirname(root), resolve(tmpdir()));
    assert.ok(root.includes("proudlypaid-bulk-import-"));
    await rm(root, { recursive: true, force: true });
  }
});

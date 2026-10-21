import { createReadStream } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { validateIdentities } from "./group-catalog-candidates.mjs";
import {
  cliOptions,
  fetchText,
  hash,
  nameKey,
  publicUrl,
  readJson,
  repositoryIdentity,
  separateOutput,
  writeJson,
} from "./catalog-research-utils.mjs";

export const DISCOVERY_SOURCES = [
  {
    id: "macrostack",
    file: "macrostack.json",
    url: "https://www.macrostack.net/data/macrostack-alternatives.json",
    license: "CC-BY-4.0",
    attribution: "Data from Macrostack (https://www.macrostack.net) — CC-BY-4.0.",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  },
  {
    id: "awesome-saas-alternatives",
    file: "awesome-saas-alternatives.json",
    url: "https://raw.githubusercontent.com/Emmraan/awesome-saas-alternatives/main/data/products.json",
    license: "MIT",
    attribution: "Copyright (c) 2026 awesome-saas-alternatives contributors.",
    licenseUrl: "https://raw.githubusercontent.com/Emmraan/awesome-saas-alternatives/main/LICENSE",
  },
];
const registryUrl = new URL("../data/catalog/product-identities.json", import.meta.url);
const text = (value) => typeof value === "string" && value.trim().length > 0 && value.length <= 300;
const locator = (value) => {
  try {
    return publicUrl(value).href;
  } catch {
    return null;
  }
};

// Source labels and URLs are discovery hints, never approved classifications or prices.
export function adaptSources({
  macrostack,
  saas,
  registry,
  indexedRepositories,
  readmeGroups = [],
  sourceHashes = {},
}) {
  const errors = validateIdentities(registry);
  if (errors.length) throw new Error(errors.join("\n"));
  if (
    macrostack?.license_short !== "CC-BY-4.0" ||
    !Array.isArray(macrostack.data) ||
    !Array.isArray(saas)
  )
    throw new Error("Unexpected source schema or Macrostack license; import requires review.");
  const aliases = new Map();
  for (const product of registry.products)
    for (const alias of [product.name, ...product.aliases]) aliases.set(nameKey(alias), product);
  const inventory = new Map();
  for (const row of saas)
    if (text(row?.name)) {
      const key = nameKey(row.name);
      if (inventory.has(key)) throw new Error("Ambiguous product names in source inventory.");
      inventory.set(key, row);
    }
  const groups = new Map();
  const pairs = new Map();
  const unresolved = [];
  let sourceRows = 0;
  function productFor(name) {
    const known = aliases.get(nameKey(name));
    const canonicalName = known?.name ?? name.trim();
    const productId = known?.id ?? `candidate-${hash(nameKey(canonicalName)).slice(0, 16)}`;
    if (!groups.has(productId)) {
      const hint = inventory.get(nameKey(canonicalName)) ?? inventory.get(nameKey(name));
      groups.set(productId, {
        productId,
        name: canonicalName,
        aliases: [],
        verification: "needs-review",
        sourceClassification: "unclassified",
        homepage: locator(known?.homepage ?? hint?.website),
        pricingUrl: locator(known?.pricingUrl),
        locatorSource: known ? "product-identities" : hint ? "awesome-saas-alternatives" : null,
        scope: known?.scope ?? null,
        relationshipIds: [],
        indexedRelationshipCount: 0,
        notes:
          "Identity and page locators only. Paid status, proprietary scope, relationships and prices require separate evidence review.",
      });
    }
    const group = groups.get(productId);
    if (!group.aliases.includes(name)) group.aliases.push(name);
    return group;
  }
  function addPair(repository, target, evidence) {
    const group = productFor(target);
    const id = hash(`${repository}|${group.productId}`);
    if (!pairs.has(id)) {
      const indexed = indexedRepositories.has(repository);
      pairs.set(id, {
        id,
        repositoryName: repository,
        repositoryUrl: `https://github.com/${repository}`,
        productId: group.productId,
        verification: "needs-review",
        sourceClassification: "unclassified",
        repositoryInCollectedIndex: indexed,
        evidence: [],
      });
      group.relationshipIds.push(id);
      if (indexed) group.indexedRelationshipCount++;
    }
    const pair = pairs.get(id);
    if (!pair.evidence.some((item) => item.id === evidence.id)) pair.evidence.push(evidence);
  }
  for (const source of DISCOVERY_SOURCES) {
    const rows = source.id === "macrostack" ? macrostack.data : saas;
    for (const [rowIndex, row] of rows.entries()) {
      sourceRows++;
      if (!row || typeof row !== "object") {
        unresolved.push({ source: source.id, rowIndex, reason: "invalid-row" });
        continue;
      }
      if (!row.repo) continue; // Inventory-only rows remain in the preserved source snapshot.
      const repository = repositoryIdentity(row.repo);
      if (!repository) {
        unresolved.push({ source: source.id, rowIndex, reason: "invalid-repository" });
        continue;
      }
      const targets = source.id === "macrostack" ? [row.replaces] : row.replaces;
      if (!Array.isArray(targets) || targets.some((target) => !text(target))) {
        unresolved.push({ source: source.id, rowIndex, reason: "invalid-targets" });
        continue;
      }
      const pointer = source.id === "macrostack" ? `/data/${rowIndex}` : `/${rowIndex}`;
      for (const target of targets)
        addPair(repository, target, {
          id: hash(
            `${source.id}:${sourceHashes[source.id] ?? "unspecified"}:${pointer}:${nameKey(target)}`,
          ),
          kind: "external-dataset",
          source: source.id,
          url: source.url,
          jsonPointer: pointer,
          sourceSha256: sourceHashes[source.id] ?? null,
          license: source.license,
          attribution: source.attribution,
        });
    }
  }
  if (!Array.isArray(readmeGroups))
    throw new Error("README groups must be an array from catalog:group.");
  for (const group of readmeGroups) {
    if (!text(group?.name) || !Array.isArray(group.evidence))
      throw new Error("Invalid README product group.");
    for (const row of group.evidence) {
      const repository = repositoryIdentity(row?.repositoryUrl);
      if (
        !repository ||
        !text(row.id) ||
        row.verification !== "needs-review" ||
        !Number.isInteger(row.line) ||
        row.line < 1 ||
        !/^[a-f0-9]{64}$/.test(row.readmeSha256)
      )
        throw new Error("Invalid README evidence; import stopped without approving partial data.");
      addPair(repository, group.name, {
        id: row.id,
        kind: "readme-mention",
        url: row.repositoryUrl,
        line: row.line,
        readmeSha256: row.readmeSha256,
        excerpt: String(row.excerpt ?? "").slice(0, 300),
        license: "third-party-repository-license",
        note: "A mention may describe a sponsor or another project; verify its subject.",
      });
    }
  }
  const relationships = [...pairs.values()].sort((a, b) => a.id.localeCompare(b.id));
  const products = [...groups.values()].sort(
    (a, b) =>
      b.indexedRelationshipCount - a.indexedRelationshipCount ||
      a.productId.localeCompare(b.productId),
  );
  return {
    products,
    relationships,
    unresolved,
    counts: {
      sourceRows,
      products: products.length,
      relationships: relationships.length,
      indexedRelationships: relationships.filter((row) => row.repositoryInCollectedIndex).length,
      indexedRepositories: new Set(
        relationships
          .filter((row) => row.repositoryInCollectedIndex)
          .map((row) => row.repositoryName),
      ).size,
      productsWithHomepage: products.filter((row) => row.homepage).length,
      productsWithoutHomepage: products.filter((row) => !row.homepage).length,
      sourceRowsNeedingReview: unresolved.length,
    },
  };
}

export async function importCatalogSources({
  from,
  index = resolve(".local/github-collection/index.jsonl"),
  outputRoot = resolve(".local/catalog-bulk"),
  readmeGroupsPath,
  fetchImpl,
  lookupImpl,
} = {}) {
  if (from) separateOutput(from, outputRoot);
  separateOutput(dirname(index), outputRoot);
  const registry = await readJson(registryUrl);
  const indexedRepositories = new Set();
  for await (const line of createInterface({
    input: createReadStream(index),
    crlfDelay: Infinity,
  })) {
    if (!line.trim()) continue;
    const key = repositoryIdentity(JSON.parse(line).url);
    if (!key) throw new Error("Invalid repository in collection index.");
    indexedRepositories.add(key);
  }
  const snapshots = [];
  for (const source of [
    ...DISCOVERY_SOURCES,
    {
      id: "awesome-saas-license",
      file: "awesome-saas-license.txt",
      url: DISCOVERY_SOURCES[1].licenseUrl,
    },
  ]) {
    const body = from
      ? await readFile(resolve(from, source.file), "utf8")
      : await fetchText(source.url, { fetchImpl, lookupImpl }).then((result) => {
          if (result.statusCode !== 200)
            throw new Error(`Source download failed: ${source.id}, HTTP ${result.statusCode}`);
          return result.body;
        });
    snapshots.push({
      ...source,
      body,
      sha256: hash(body),
      acquiredAt: new Date().toISOString(),
      acquisition: from ? "local-snapshot" : "https-download",
    });
  }
  if (
    !/^MIT License\s/m.test(snapshots[2].body) ||
    !snapshots[2].body.includes("awesome-saas-alternatives contributors")
  )
    throw new Error("Unexpected SaaS dataset license; review before importing.");
  const readmeBytes = readmeGroupsPath ? await readFile(readmeGroupsPath) : null;
  const result = adaptSources({
    macrostack: JSON.parse(snapshots[0].body),
    saas: JSON.parse(snapshots[1].body),
    registry,
    indexedRepositories,
    readmeGroups: readmeBytes ? JSON.parse(readmeBytes.toString("utf8")) : [],
    sourceHashes: Object.fromEntries(snapshots.map((row) => [row.id, row.sha256])),
  });
  await mkdir(outputRoot, { recursive: true });
  const output = await mkdtemp(resolve(outputRoot, "run-"));
  await mkdir(resolve(output, "sources"));
  for (const source of snapshots)
    await writeFile(resolve(output, "sources", source.file), source.body, { flag: "wx" });
  const report = {
    schemaVersion: 1,
    status: "complete",
    verification: "needs-review",
    generatedAt: new Date().toISOString(),
    collectionIndex: resolve(index),
    readmeGroupsSha256: readmeBytes ? hash(readmeBytes) : null,
    sources: snapshots.map(({ body: _body, ...source }) => source),
    ...result.counts,
    notes:
      "All inputs remain discovery-only. Third-party pricing fields are not copied as target prices. No source index, curated catalog or database is modified.",
  };
  await writeJson(resolve(output, "products.json"), {
    schemaVersion: 1,
    verification: "needs-review",
    products: result.products,
  });
  await writeFile(
    resolve(output, "relationships.jsonl"),
    result.relationships.map((row) => `${JSON.stringify(row)}\n`).join(""),
    { flag: "wx" },
  );
  await writeJson(resolve(output, "source-rows-needing-review.json"), result.unresolved);
  await writeJson(resolve(output, "report.json"), report);
  await writeFile(
    resolve(output, "SOURCES.md"),
    `# Third-party discovery input\n\nThese local inputs and derived candidates retain their source licenses. They are not automatically published under ProudlyPaid's MIT license.\n\n${DISCOVERY_SOURCES.map((source) => `- ${source.attribution} Source: ${source.url} License: ${source.licenseUrl}`).join("\n")}\n\nThe full SaaS dataset MIT notice is preserved in sources/awesome-saas-license.txt. README evidence retains its repository's license; no blanket permission is inferred.\n`,
    { flag: "wx" },
  );
  return { output, report };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = cliOptions(process.argv.slice(2), [
      "--from",
      "--out",
      "--index",
      "--readme-groups",
    ]);
    const result = await importCatalogSources({
      from: args["--from"],
      outputRoot: args["--out"],
      index: args["--index"],
      readmeGroupsPath: args["--readme-groups"],
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

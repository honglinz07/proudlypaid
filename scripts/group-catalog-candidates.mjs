import { createHash } from "node:crypto";
import { readFile, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const identitiesUrl = new URL("../data/catalog/product-identities.json", import.meta.url);
const nonempty = (value) => typeof value === "string" && value.trim().length > 0;
const secureUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
};

export function validateIdentities(registry) {
  if (
    registry?.schemaVersion !== 1 ||
    registry.status !== "discovery-only" ||
    !Array.isArray(registry.products) ||
    !registry.products.length
  )
    return ["Invalid discovery identity registry."];
  const errors = [];
  const ids = new Set();
  const aliases = new Map();
  for (const product of registry.products) {
    if (!product || typeof product !== "object") {
      errors.push("Invalid identity record.");
      continue;
    }
    if (!nonempty(product.id) || ids.has(product.id))
      errors.push(`Duplicate or missing identity: ${product.id}`);
    ids.add(product.id);
    if (
      !nonempty(product.name) ||
      !nonempty(product.scope) ||
      !nonempty(product.category) ||
      !secureUrl(product.homepage) ||
      !secureUrl(product.pricingUrl)
    )
      errors.push(`Incomplete identity: ${product.id}`);
    if (
      !Array.isArray(product.aliases) ||
      !product.aliases.length ||
      !product.aliases.every(nonempty) ||
      typeof product.caseSensitive !== "boolean"
    ) {
      errors.push(`Invalid aliases: ${product.id}`);
      continue;
    }
    for (const alias of product.aliases) {
      const key = alias.normalize("NFKC").toLowerCase();
      if (aliases.has(key) && aliases.get(key) !== product.id)
        errors.push(`Ambiguous alias: ${alias}`);
      aliases.set(key, product.id);
    }
  }
  return errors;
}

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function groupCandidates(candidates, registry) {
  const errors = validateIdentities(registry);
  if (errors.length) throw new Error(errors.join("\n"));
  const matchers = registry.products.map((product) => ({
    product,
    expression: new RegExp(
      `(?<![\\p{L}\\p{N}])(?:${[...product.aliases]
        .sort((a, b) => b.length - a.length)
        .map(escapeRegex)
        .join("|")})(?![\\p{L}\\p{N}])`,
      product.caseSensitive ? "u" : "iu",
    ),
  }));
  const groups = new Map();
  const unresolved = [];
  const seen = new Set();
  for (const candidate of candidates) {
    if (
      !candidate ||
      !nonempty(candidate.id) ||
      !nonempty(candidate.targetText) ||
      !nonempty(candidate.repositoryName) ||
      !secureUrl(candidate.repositoryUrl) ||
      !Number.isInteger(candidate.line) ||
      candidate.line < 1 ||
      !/^[a-f0-9]{64}$/.test(candidate.readmeSha256) ||
      candidate.verification !== "needs-review"
    ) {
      throw new Error(
        "Invalid candidate evidence. Grouping stopped without publishing a partial queue.",
      );
    }
    if (seen.has(candidate.id)) throw new Error(`Duplicate candidate evidence ID: ${candidate.id}`);
    seen.add(candidate.id);
    const text = candidate.targetText.normalize("NFKC");
    let matched = false;
    for (const { product, expression } of matchers) {
      if (!expression.test(text)) continue;
      matched = true;
      if (!groups.has(product.id))
        groups.set(product.id, {
          productId: product.id,
          name: product.name,
          homepage: product.homepage,
          pricingUrl: product.pricingUrl,
          scope: product.scope,
          category: product.category,
          verification: "needs-review",
          evidence: [],
        });
      groups.get(product.id).evidence.push(candidate);
    }
    if (!matched) unresolved.push(candidate);
  }
  const products = [...groups.values()].sort(
    (a, b) => b.evidence.length - a.evidence.length || a.productId.localeCompare(b.productId),
  );
  const report = {
    candidates: candidates.length,
    matchedCandidates: candidates.length - unresolved.length,
    unresolvedCandidates: unresolved.length,
    productGroups: products.length,
    productEvidenceLinks: products.reduce((total, product) => total + product.evidence.length, 0),
    notes:
      "Identity matching only. README statements may describe sponsors, other projects, hypothetical work or open-source products. Every evidence row is retained. No alternative relationship, closed-source status or price is automatically verified.",
  };
  return { products, unresolved, report };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    let input;
    let outputRoot = resolve(".local/catalog-review");
    const args = process.argv.slice(2);
    for (let index = 0; index < args.length; index += 2) {
      const name = args[index];
      const value = args[index + 1];
      if (!["--input", "--out"].includes(name) || !value || value.startsWith("--")) {
        throw new Error(
          "Usage: npm run catalog:group -- --input CANDIDATES.jsonl [--out DIRECTORY]",
        );
      }
      if (name === "--input") input = resolve(value);
      else outputRoot = resolve(value);
    }
    if (!input) throw new Error("--input is required; choose the discovery run explicitly.");
    const inputBytes = await readFile(input);
    const candidates = inputBytes
      .toString("utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
    const registryBytes = await readFile(identitiesUrl);
    const result = groupCandidates(candidates, JSON.parse(registryBytes.toString("utf8")));
    await mkdir(outputRoot, { recursive: true });
    const output = await mkdtemp(resolve(outputRoot, "run-"));
    const report = {
      schemaVersion: 1,
      status: "complete",
      generatedAt: new Date().toISOString(),
      input,
      inputSha256: createHash("sha256").update(inputBytes).digest("hex"),
      registrySha256: createHash("sha256").update(registryBytes).digest("hex"),
      ...result.report,
    };
    await writeFile(
      resolve(output, "products.json"),
      `${JSON.stringify(result.products, null, 2)}\n`,
    );
    await writeFile(
      resolve(output, "unresolved.jsonl"),
      result.unresolved.map((row) => `${JSON.stringify(row)}\n`).join(""),
    );
    await writeFile(resolve(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    console.log(
      `Grouped ${report.candidates} candidates: ${report.productGroups} product groups, ${report.unresolvedCandidates} unresolved. Output: ${output}`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Grouping failed.");
    process.exitCode = 1;
  }
}

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { validateCatalog } from "./check-catalog.mjs";

export function normalizeTerm(value) {
  return value.normalize("NFKC").toLowerCase().trim().replace(/\s+/gu, " ");
}

function repoIdentity(value) {
  const parsed = new URL(value);
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== "github.com" ||
    parsed.port ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("Expected a public HTTPS github.com repository URL.");
  }
  const parts = parsed.pathname
    .replace(/\/$/u, "")
    .replace(/\.git$/iu, "")
    .split("/")
    .slice(1);
  if (
    parts.length !== 2 ||
    !parts.every((part) => /^[A-Za-z0-9_.-]+$/u.test(part) && part !== "." && part !== "..")
  ) {
    throw new Error("Invalid GitHub repository path.");
  }
  return {
    id: parts.join("/").toLowerCase(),
    fullName: parts.join("/"),
    repository: `https://github.com/${parts.join("/")}`,
  };
}

const literal = (value) =>
  value === null
    ? "NULL"
    : typeof value === "number"
      ? String(value)
      : `'${String(value).replaceAll("'", "''")}'`;

/** Immutable, content-addressed snapshots; the last statement activates a complete import. */
export function buildSeed(catalog, collected = [], scope = "curated-only", researchBase = null) {
  if (!["curated-only", "local-github-index"].includes(scope))
    throw new Error("Invalid collection scope.");
  const errors = validateCatalog(catalog);
  if (errors.length) throw new Error(errors.join("\n"));
  if (researchBase) {
    if (
      collected.length ||
      !/^[a-f0-9]{64}$/u.test(researchBase.activeVersion) ||
      !/^[a-f0-9]{64}$/u.test(researchBase.indexVersion) ||
      researchBase.collectionScope !== scope ||
      !Array.isArray(researchBase.repositoryIds) ||
      researchBase.repositoryIds.length !== researchBase.projectCount ||
      new Set(researchBase.repositoryIds).size !== researchBase.projectCount ||
      researchBase.repositoryIds.some(
        (id) => typeof id !== "string" || repoIdentity(`https://github.com/${id}`).id !== id,
      )
    )
      throw new Error(
        "Invalid research base; capture the active snapshot and its repository IDs first.",
      );
  }
  const projects = new Map();
  for (const row of collected) {
    if (typeof row.name !== "string" || typeof row.url !== "string")
      throw new Error("Invalid collection row.");
    const repo = repoIdentity(row.url);
    if (repo.fullName.toLowerCase() !== row.name.toLowerCase())
      throw new Error("Repository name/URL mismatch.");
    if (projects.has(repo.id)) throw new Error(`Duplicate collected repository: ${repo.id}`);
    projects.set(repo.id, {
      ...repo,
      name: repo.fullName.split("/")[1],
      category: null,
      license: null,
      reviewedOn: null,
      aliases: [],
    });
  }
  const projectIds = new Map();
  for (const project of catalog.projects) {
    const repo = repoIdentity(project.repository);
    projectIds.set(project.id, repo.id);
    projects.set(repo.id, {
      ...repo,
      name: project.name,
      category: project.category,
      license: project.license,
      reviewedOn: project.reviewedOn,
      aliases: project.aliases,
    });
  }
  const ordered = [...projects.values()].sort((a, b) => a.id.localeCompare(b.id, "en"));
  const baseIds = new Set(researchBase?.repositoryIds ?? []);
  const projectCount = researchBase
    ? researchBase.projectCount + ordered.filter((project) => !baseIds.has(project.id)).length
    : ordered.length;
  const version = createHash("sha256")
    .update(
      JSON.stringify(
        researchBase
          ? { seedFormat: 2, catalog, indexVersion: researchBase.indexVersion, projectCount, scope }
          : { seedFormat: 1, catalog, projects: ordered, scope },
      ),
    )
    .digest("hex");
  const statements = [];
  const insert = (table, columns, rows) => {
    // Bound statement size; every string is a SQL literal, never executable input.
    for (let index = 0; index < rows.length; index += 30) {
      statements.push(
        `INSERT OR IGNORE INTO ${table} (${columns}) VALUES ${rows
          .slice(index, index + 30)
          .map((row) => `(${row.map(literal).join(",")})`)
          .join(",")};`,
      );
    }
  };
  insert(
    "catalog_snapshots",
    `version,reviewed_on,project_count,collection_scope${researchBase ? ",index_version" : ""}`,
    [
      [
        version,
        catalog.reviewedOn,
        projectCount,
        scope,
        ...(researchBase ? [researchBase.indexVersion] : []),
      ],
    ],
  );
  const terms = [];
  insert(
    "projects",
    "version,id,name,full_name,repository,category,license_json,reviewed_on,terms",
    ordered.map((project) => {
      const names = [
        ...new Set(
          [project.name, project.fullName.split("/")[1], project.fullName, ...project.aliases].map(
            normalizeTerm,
          ),
        ),
      ];
      for (const term of names) terms.push([version, term, project.id]);
      return [
        version,
        project.id,
        project.name,
        project.fullName,
        project.repository,
        project.category,
        project.license ? JSON.stringify(project.license) : null,
        project.reviewedOn,
        names.join("\n"),
      ];
    }),
  );
  insert("project_terms", "version,term,project_id", terms);
  insert(
    "products",
    "version,id,verification,data_json",
    catalog.products.map((product) => [
      version,
      product.id,
      product.sourceAvailability.verification,
      JSON.stringify(product),
    ]),
  );
  insert(
    "relationships",
    "version,project_id,product_id,data_json",
    catalog.relationships.map((relation) => [
      version,
      projectIds.get(relation.projectId),
      relation.productId,
      JSON.stringify(relation),
    ]),
  );
  statements.push(
    researchBase
      ? `INSERT INTO catalog_state (id,version) SELECT 1,${literal(version)} WHERE EXISTS (SELECT 1 FROM catalog_state WHERE id=1 AND version IN (${literal(researchBase.activeVersion)},${literal(version)})) ON CONFLICT(id) DO UPDATE SET version=excluded.version;`
      : `INSERT INTO catalog_state (id,version) VALUES (1,${literal(version)}) ON CONFLICT(id) DO UPDATE SET version=excluded.version;`,
  );
  return {
    statements,
    version,
    projectCount,
    collectionScope: scope,
    storedProjectCount: ordered.length,
    ...(researchBase ? { indexVersion: researchBase.indexVersion } : {}),
  };
}

export async function generateSeed(args = []) {
  let indexPath;
  let basePath;
  let output = fileURLToPath(new URL("../.local/catalog-seeds/catalog.sql", import.meta.url));
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    const value = args[++i];
    if (!value || !["--index", "--base", "--out"].includes(flag))
      throw new Error(
        "Usage: catalog:seed [--index index.jsonl | --base base.json] [--out output.sql]",
      );
    if (flag === "--index") indexPath = resolve(value);
    else if (flag === "--base") basePath = resolve(value);
    else output = resolve(value);
  }
  if (indexPath && basePath) throw new Error("Use either --index or --base, never both.");
  const root = fileURLToPath(new URL("../", import.meta.url));
  const local = fileURLToPath(new URL("../.local/catalog-seeds/", import.meta.url));
  if (!output.startsWith(local) || output === indexPath || output === basePath)
    throw new Error(`Seed output must stay inside ${local}`);
  const collected = [];
  if (indexPath) {
    const lines = createInterface({
      input: createReadStream(indexPath, { encoding: "utf8" }),
      crlfDelay: Infinity,
    });
    let lineNumber = 0;
    for await (const line of lines) {
      lineNumber++;
      if (!line.trim()) continue;
      try {
        collected.push(JSON.parse(line));
      } catch {
        throw new Error(`Invalid JSON at collection line ${lineNumber}`);
      }
    }
  }
  const catalog = JSON.parse(await readFile(resolve(root, "data/catalog/pilot.json"), "utf8"));
  const base = basePath ? JSON.parse(await readFile(basePath, "utf8")) : null;
  const seed = buildSeed(
    catalog,
    collected,
    base ? base.collectionScope : indexPath ? "local-github-index" : "curated-only",
    base,
  );
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${seed.statements.join("\n")}\n`, "utf8");
  console.log(
    `Seed generated: ${seed.projectCount} searchable projects, ${seed.storedProjectCount} project rows to import (${seed.collectionScope}); ${output}`,
  );
  return { ...seed, output };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await generateSeed(process.argv.slice(2));
}

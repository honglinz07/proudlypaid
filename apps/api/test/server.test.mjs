import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { buildSeed } from "../../../scripts/seed-catalog.mjs";
import worker from "../src/index.ts";

process.env.WRANGLER_SEND_METRICS = "false";
process.env.WRANGLER_LOG_PATH = fileURLToPath(
  new URL("../../../.local/wrangler-logs/", import.meta.url),
);
const { getPlatformProxy, unstable_splitSqlQuery } = await import("wrangler");
let platform;
let seed;
const catalog = JSON.parse(
  await readFile(new URL("../../../data/catalog/pilot.json", import.meta.url), "utf8"),
);
const extra = [
  { name: "example/no-alternatives", url: "https://github.com/example/no-alternatives" },
  { name: "fork/penpot", url: "https://github.com/fork/penpot" },
  { name: "quote/owner's-tool", url: "https://github.com/quote/owners-tool" },
];

before(async () => {
  platform = await getPlatformProxy({
    configPath: fileURLToPath(new URL("../wrangler.jsonc", import.meta.url)),
    persist: false,
    remoteBindings: false,
  });
  const migration = await readFile(
    new URL("../migrations/0001_catalog.sql", import.meta.url),
    "utf8",
  );
  await platform.env.DB.batch(
    unstable_splitSqlQuery(migration).map((sql) => platform.env.DB.prepare(sql)),
  );
  const notReady = await request("/api/health");
  assert.equal(notReady.status, 503);
  assert.equal((await notReady.json()).error.code, "CATALOG_NOT_READY");
  seed = buildSeed(catalog, extra.slice(0, 2), "local-github-index");
  await importStatements(seed.statements);
});
after(async () => {
  await platform?.dispose();
});
const request = (path, method = "GET", env = platform.env) =>
  worker.fetch(new Request(`https://test.local${path}`, { method }), env);
const search = async (query, suffix = "") => {
  const response = await request(`/api/v1/search?q=${encodeURIComponent(query)}${suffix}`);
  assert.equal(response.status, 200, await response.clone().text());
  return response.json();
};
const alternatives = async (id) => {
  const response = await request(`/api/v1/projects/${encodeURIComponent(id)}/alternatives`);
  assert.equal(response.status, 200, await response.clone().text());
  return response.json();
};
async function importStatements(statements) {
  for (let i = 0; i < statements.length; i += 20)
    await platform.env.DB.batch(
      statements.slice(i, i + 20).map((sql) => platform.env.DB.prepare(sql)),
    );
}

test("health declares real search, catalog provenance, secure JSON headers and HEAD", async () => {
  const response = await request("/api/health");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  const data = await response.json();
  assert.equal(data.search, "name-and-fuzzy");
  assert.equal(data.catalog.projectCount, catalog.projects.length + 2);
  assert.equal(data.catalog.version, seed.version);
  for (const path of [
    "/api/health",
    "/api/v1/search?q=Penpot",
    "/api/v1/projects/penpot%2Fpenpot/alternatives",
  ]) {
    const head = await request(path, "HEAD");
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
    const post = await request(path, "POST");
    assert.equal(post.status, 405);
    assert.equal(post.headers.get("allow"), "GET, HEAD");
  }
});
test("exact matching supports case, aliases, full repository paths and HTTPS URLs", async () => {
  for (const query of [" PenPot ", "penpot/penpot", "https://github.com/penpot/penpot.git/"]) {
    const result = await search(query);
    assert.equal(result.match, "exact");
    assert.equal(result.preferredProjectId, "penpot/penpot");
  }
  const aliasProject = catalog.projects.find((project) => project.aliases.length);
  assert.ok(aliasProject);
  assert.equal((await search(aliasProject.aliases[0])).projects[0].name, aliasProject.name);
  const forks = await search("penpot");
  assert.equal(forks.projects.length, 2);
  assert.equal(forks.projects[0].repository, "https://github.com/penpot/penpot");
});
test("substring and bounded typo matches use actual FTS indexes; fuzzy hits require selection", async () => {
  const partial = await search("pot");
  assert.equal(partial.match, "substring");
  assert.equal(partial.projects[0].id, "penpot/penpot");
  const typo = await search("grafnaa");
  assert.equal(typo.match, "fuzzy");
  assert.equal(typo.projects[0].id, "grafana/grafana");
  assert.equal(typo.preferredProjectId, null);
  const plan = await platform.env.DB.prepare(
    "EXPLAIN QUERY PLAN SELECT * FROM project_terms WHERE version=? AND term=?",
  )
    .bind(seed.version, "penpot")
    .all();
  assert.match(JSON.stringify(plan.results), /INDEX/u);
});
test("hostile or nonexistent queries cannot execute SQL or FTS operators", async () => {
  for (const query of [
    "zzzzzznonexistent",
    "' OR 1=1 --",
    '" OR "',
    "*",
    "NEAR(foo bar)",
    "constructor",
  ])
    assert.deepEqual((await search(query)).projects, []);
  assert.equal((await search("Penpot")).projects[0].id, "penpot/penpot");
  const limited = await search("penpot", "&limit=1");
  assert.equal(limited.projects.length, 1);
  assert.equal(limited.truncated, true);
  assert.equal(limited.preferredProjectId, null);
});
test("bad queries, missing projects and unknown routes have distinct non-success responses", async () => {
  for (const path of [
    "/api/v1/search",
    "/api/v1/search?q=",
    "/api/v1/search?q=x&q=y",
    "/api/v1/search?q=x&limit=999",
    "/api/v1/search?q=x&limit=1&limit=2",
    `/api/v1/search?q=${"x".repeat(121)}`,
    "/api/v1/search?q=%00",
  ])
    assert.equal((await request(path)).status, 400, path);
  assert.equal((await request("/api/v1/projects/%ZZ/alternatives")).status, 400);
  assert.equal((await request("/api/v1/projects/unknown%2Frepository/alternatives")).status, 404);
  assert.equal((await request("/api/missing")).status, 404);
});
test("reviewed alternatives include scope, relationship evidence and independently dated prices", async () => {
  const data = await alternatives("penpot/penpot");
  assert.equal(data.alternatives.length, 3);
  const figma = data.alternatives.find((product) => product.id === "figma");
  assert.equal(figma.prices[0].amount, 90);
  assert.equal(figma.prices[0].currency, "USD");
  assert.equal(figma.prices[0].reviewedOn, "2026-10-17");
  assert.ok(figma.availability.scope);
  assert.ok(figma.availability.evidenceUrls.length);
  assert.ok(figma.relationship.limitations);
  const sketch = data.alternatives.find((product) => product.id === "sketch");
  assert.equal(sketch.pendingPriceCount, 3);
  assert.ok(sketch.prices.every((price) => price.amount === null));
  const uxpin = data.alternatives.find((product) => product.id === "uxpin");
  assert.deepEqual(
    uxpin.prices.filter((price) => price.amount !== null).map((price) => price.amount),
    [29, 40],
  );
  assert.equal(uxpin.prices[0].reviewedOn, "2026-10-20");
  assert.equal(data.priceGroups.length, 2);
  assert.deepEqual(
    new Set(data.priceGroups.map((group) => group.unit)),
    new Set(["full-seat", "seat"]),
  );
});
test("pending classifications and pending price amounts are never published", async () => {
  const appflowy = await alternatives("appflowy-io/appflowy");
  assert.ok(appflowy.alternatives.every((product) => product.id !== "notion"));
  assert.equal(appflowy.pendingAlternativeCount, 1);
  const supabase = await alternatives("supabase/supabase");
  assert.equal(supabase.alternatives.length, 0);
  assert.equal(supabase.pendingAlternativeCount, 1);
  assert.ok(!JSON.stringify(appflowy).includes("11.16"));
});
test("a found but unreviewed repository is distinct from an absent repository", async () => {
  const data = await alternatives("example/no-alternatives");
  assert.equal(data.project.license, null);
  assert.equal(data.project.reviewedOn, null);
  assert.deepEqual(data.alternatives, []);
  assert.deepEqual(data.priceGroups, []);
});
test("unit-price groups never mix hosts and users, and prices descend only within a basis", async () => {
  const monitoring = await alternatives("grafana/grafana");
  assert.equal(monitoring.priceGroups.length, 2);
  assert.deepEqual(
    new Set(monitoring.priceGroups.map((group) => group.unit)),
    new Set(["infrastructure-host", "full-platform-user"]),
  );
  const chat = await alternatives("zulip/zulip");
  assert.deepEqual(
    chat.priceGroups[0].entries.map((entry) => entry.price.amount),
    [15, 7, 4],
  );
  assert.ok(chat.alternatives.some((product) => product.id === "slack"));
  const twist = chat.alternatives.find((product) => product.id === "twist");
  assert.equal(twist.pendingPriceCount, 1);
  assert.deepEqual(twist.prices, []);
  for (const group of monitoring.priceGroups)
    assert.ok(
      group.entries.every(
        (entry) =>
          entry.price.currency === group.currency &&
          entry.price.unit === group.unit &&
          entry.price.billing === group.billing,
      ),
    );
});

test("expanded project relations publish reviewed services while preserving pending scope and amounts", async () => {
  const found = await search("Plane");
  assert.equal(found.preferredProjectId, "makeplane/plane");
  const plane = await alternatives("makeplane/plane");
  assert.equal(plane.project.license.label, "AGPL-3.0");
  assert.equal(plane.pendingAlternativeCount, 1);
  assert.deepEqual(
    new Set(plane.alternatives.map((product) => product.id)),
    new Set(["jira-cloud", "linear", "clickup"]),
  );
  assert.ok(
    plane.alternatives.every((product) => product.relationship.verification === "author-claimed"),
  );
  assert.deepEqual(
    plane.priceGroups[0].entries.map((entry) => entry.price.amount),
    [16, 12, 7],
  );
  const openproject = await alternatives("opf/openproject");
  const basecamp = openproject.alternatives.find((product) => product.id === "basecamp");
  assert.equal(basecamp.pendingPriceCount, 4);
  assert.deepEqual(basecamp.prices, []);
  const baserow = await alternatives("baserow/baserow");
  assert.equal(baserow.pendingAlternativeCount, 0);
  assert.deepEqual(
    baserow.priceGroups[0].entries.map((entry) => entry.price.amount),
    [45, 20],
  );
});

test("API tooling publishes Postman components without mixing individual accounts and Team seats", async () => {
  for (const id of ["hoppscotch/hoppscotch", "usebruno/bruno"]) {
    const data = await alternatives(id);
    assert.equal(data.pendingAlternativeCount, 0);
    assert.deepEqual(
      data.alternatives.map((product) => product.id),
      ["postman"],
    );
    const groups = new Map(data.priceGroups.map((group) => [group.unit, group]));
    assert.equal(groups.size, 2);
    assert.deepEqual(
      groups.get("user").entries.map((entry) => entry.price.amount),
      [19],
    );
    assert.deepEqual(
      groups.get("account").entries.map((entry) => entry.price.amount),
      [9],
    );
    assert.ok(
      data.priceGroups.every((group) => group.currency === "USD" && group.billing === "annual"),
    );
    const usage = data.alternatives[0].prices.find((price) => price.kind === "usage-based");
    assert.equal(usage.amount, null);
  }
  assert.equal((await search("Bruno")).preferredProjectId, "usebruno/bruno");
});

test("automation and form services can publish while incomplete starting prices stay withheld", async () => {
  const activepieces = await alternatives("activepieces/activepieces");
  const formbricks = await alternatives("formbricks/formbricks");
  for (const [data, id, pendingAmount] of [
    [activepieces, "zapier", "19.99"],
    [formbricks, "typeform", "39"],
  ]) {
    assert.equal(data.pendingAlternativeCount, 0);
    const product = data.alternatives.find((product) => product.id === id);
    assert.ok(product);
    assert.equal(product.pendingPriceCount, 1);
    assert.ok(product.prices.every((price) => price.amount === null));
    assert.deepEqual(data.priceGroups, []);
    assert.ok(!JSON.stringify(product.prices).includes(pendingAmount));
  }
  assert.ok(
    activepieces.alternatives
      .find((product) => product.id === "zapier")
      .prices.some((price) => price.kind === "usage-based"),
  );
});

test("Retool regional euro components retain role groups while ambiguous dollar amounts stay private", async () => {
  const data = await alternatives("appsmithorg/appsmith");
  assert.equal(data.pendingAlternativeCount, 0);
  assert.equal(data.alternatives[0].id, "retool");
  assert.equal(data.alternatives[0].pendingPriceCount, 2);
  assert.ok(
    data.priceGroups.every((group) => group.currency === "EUR" && group.billing === "annual"),
  );
  const groups = new Map(data.priceGroups.map((group) => [group.unit, group]));
  assert.equal(groups.size, 2);
  assert.deepEqual(
    groups.get("builder").entries.map((entry) => entry.price.amount),
    [46, 9],
  );
  assert.deepEqual(
    groups.get("internal-user").entries.map((entry) => entry.price.amount),
    [14, 5],
  );
  assert.ok(
    data.alternatives[0].prices.every((price) => price.amount === null || price.currency === "EUR"),
  );
});
test("an unfinished snapshot stays invisible; activation and reimport are deterministic", async () => {
  const updated = structuredClone(catalog);
  updated.projects[0].aliases.push("a-new-review-alias");
  const next = buildSeed(updated, extra.slice(0, 2), "local-github-index");
  await importStatements(next.statements.slice(0, -1));
  assert.equal((await search("a-new-review-alias")).match, "none");
  assert.equal((await search("Penpot")).catalog.version, seed.version);
  await importStatements(next.statements.slice(-1));
  assert.equal((await search("a-new-review-alias")).match, "exact");
  await importStatements(next.statements);
  assert.equal((await search("pot")).projects.length, 2);
  await importStatements(seed.statements.slice(-1));
});
test("seed validation rejects broken input before producing executable SQL", () => {
  assert.throws(() => buildSeed(catalog, extra), /mismatch/u);
  assert.throws(() => buildSeed(catalog, [extra[0], extra[0]]), /Duplicate/u);
  assert.throws(
    () => buildSeed(catalog, [{ name: "evil/repo", url: "https://evil.example/evil/repo" }]),
    /github.com/u,
  );
  assert.throws(() => buildSeed({ ...catalog, products: [] }), /nonempty/u);
  assert.equal(buildSeed(catalog).version, buildSeed(catalog).version);
});

test("new support plans keep workspace and agent prices separate and withhold ambiguous billing", async () => {
  const data = await alternatives("chatwoot/chatwoot");
  assert.ok(data.alternatives.some((product) => product.id === "crisp"));
  assert.ok(data.alternatives.some((product) => product.id === "freshdesk"));
  const workspace = data.priceGroups.find((group) => group.unit === "workspace");
  assert.deepEqual(
    workspace.entries.map((entry) => entry.price.amount),
    [295, 95, 45],
  );
  assert.ok(workspace.entries.every((entry) => entry.productId === "crisp"));
  const agents = data.priceGroups.find(
    (group) => group.unit === "agent" && group.billing === "annual",
  );
  assert.deepEqual(
    agents.entries
      .filter((entry) => entry.productId === "freshdesk")
      .map((entry) => entry.price.amount),
    [89, 55, 19],
  );
  const scout = data.alternatives.find((product) => product.id === "helpscout");
  assert.equal(scout.pendingPriceCount, 3);
  assert.ok(scout.prices.every((price) => price.amount === null));
  for (const [id, productId, count] of [
    ["activepieces/activepieces", "ifttt", 2],
    ["appsmithorg/appsmith", "superblocks", 1],
  ]) {
    const product = (await alternatives(id)).alternatives.find(
      (product) => product.id === productId,
    );
    assert.equal(product.pendingPriceCount, count);
    assert.ok(product.prices.every((price) => price.amount === null));
  }
});

test("research-only snapshots reuse the full index, shadow aliases, reject stale activation and roll back", async () => {
  const migration = await readFile(
    new URL("../migrations/0002_research_snapshots.sql", import.meta.url),
    "utf8",
  );
  await platform.env.DB.batch(
    unstable_splitSqlQuery(migration).map((sql) => platform.env.DB.prepare(sql)),
  );
  const base = {
    activeVersion: seed.version,
    indexVersion: seed.version,
    projectCount: seed.projectCount,
    collectionScope: "local-github-index",
    repositoryIds: [
      ...catalog.projects.map((p) => new URL(p.repository).pathname.slice(1).toLowerCase()),
      ...extra.slice(0, 2).map((p) => p.name),
    ],
  };
  const updated = structuredClone(catalog);
  const penpot = updated.projects.find((p) => p.id === "penpot");
  penpot.aliases = ["fresh-review-alias"];
  const next = buildSeed(updated, [], "local-github-index", base);
  assert.equal(next.storedProjectCount, catalog.projects.length);
  await importStatements(next.statements.slice(0, -1));
  assert.equal((await search("fresh-review-alias")).match, "none");
  await importStatements(next.statements.slice(-1));
  assert.equal((await search("fresh-review-alias")).preferredProjectId, "penpot/penpot");
  assert.equal((await search("no-alternatives")).projects[0].id, "example/no-alternatives");
  assert.equal((await alternatives("example/no-alternatives")).alternatives.length, 0);
  assert.equal((await search("grafnaa")).projects[0].id, "grafana/grafana");
  assert.equal((await search("pot")).projects.length, 2);
  assert.equal(
    (await alternatives("chatwoot/chatwoot")).alternatives.some((p) => p.id === "freshdesk"),
    true,
  );
  assert.equal((await search("penpot")).catalog.projectCount, seed.projectCount);
  const stored = await platform.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM projects WHERE version=?",
  )
    .bind(next.version)
    .first();
  assert.equal(stored.count, catalog.projects.length);
  await importStatements(next.statements);
  assert.equal((await search("pot")).projects.length, 2);
  const stale = structuredClone(updated);
  stale.projects[0].aliases.push("stale-alias");
  const rejected = buildSeed(stale, [], "local-github-index", base);
  await importStatements(rejected.statements);
  assert.equal((await search("penpot")).catalog.version, next.version);
  assert.equal((await search("stale-alias")).match, "none");
  // A later research snapshot points directly to the original full index, never a chain.
  const second = buildSeed(stale, [], "local-github-index", {
    ...base,
    activeVersion: next.version,
  });
  assert.equal(second.version, rejected.version);
  await importStatements(second.statements.slice(-1));
  assert.equal((await search("stale-alias")).match, "exact");
  assert.equal((await search("no-alternatives")).projects.length, 1);
  await importStatements(seed.statements.slice(-1));
  assert.equal((await search("fresh-review-alias")).match, "none");
  assert.equal((await search("penpot")).catalog.version, seed.version);
});

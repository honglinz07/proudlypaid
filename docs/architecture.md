# Architecture

## Boundaries

| Workspace | Runtime | Responsibility | Build |
| --- | --- | --- | --- |
| `apps/web` | Browser, React, TypeScript, Vite | UI, routes, locale, API client and response validation | Static `dist/` |
| `apps/api` | Cloudflare Workers, TypeScript | Read-only JSON API, D1 retrieval, publication and unit-price grouping | Wrangler dry-run bundle in `dist/` |
| `packages/contracts` | Type declarations only | Version 1 JSON interfaces, independent of storage/runtime | No runtime bundle |

The web application does not import backend source; the API does not serve frontend files. Both consume `@closedsources/contracts`. Node.js 24+ is the development/tooling runtime, not the production API runtime. The former Node health-only skeleton has been replaced by the lightweight Worker. A VPS/PostgreSQL/pgvector implementation remains future work and should implement the same contract and publication rules.

Local development uses Wrangler's local D1 with state in `.local/worker-state/`. Frontend development (5273) and preview (4173) proxy `/api` to 8787. Production requires an explicit same-origin gateway; see [deployment](deployment-lite.md). CORS is not enabled. Missing API routing must not fall through to SPA HTML.

## Data flow

1. `data/catalog/pilot.json` is the version-controlled source of researched project scopes, products, relationships and pricing observations. `scripts/check-catalog.mjs` validates references, evidence, dates and pricing invariants.
2. `scripts/seed-catalog.mjs` validates that catalog and optionally reads every row of the local GitHub `index.jsonl`. It imports names and repository URLs only. It never fetches, renders, changes or uploads raw README files.
3. The importer merges curated project names and aliases onto canonical lowercase `owner/repository` identities. Other collected repositories retain null license/category/review fields: a public repository is not automatically classified as open source.
4. The generated SQL builds an immutable snapshot. Its SHA-256 covers the seed-format revision, research data, sorted project identities and collection scope. Reimporting identical content is idempotent. A final `catalog_state` pointer activates the snapshot only after all import statements succeed. An interrupted import leaves the previous active snapshot readable; rerun the importer to finish.
5. Each API request reads the active version once, then queries only that snapshot. Responses include the version, research batch date, project count and `curated-only` or `local-github-index` scope. These dates are not a claim of a live or atomic GitHub snapshot.

`npm run db:local` uses the collected index when it exists, otherwise the curated catalog. `--curated-only` explicitly seeds just the latter. Generated SQL is ignored under `.local/catalog-seeds/`. Older snapshots are retained for recovery; there is no automatic cleanup. Repeated changed imports increase storage and index size, so long-running deployments need a deliberate backup/retention procedure.

The migration creates snapshots/state, projects, exact project terms, an FTS5 trigram index, products and relationships. Product and relationship research records remain validated JSON inside their relational rows; there is no price-history schema yet. Insert/delete triggers keep the external-content FTS index synchronized. Snapshot rows are immutable; modifications are imported as a new snapshot rather than SQL updates in place.

## Version 1 HTTP contract

All successful responses have `apiVersion: 1`. All listed routes support GET and HEAD; HEAD has the same status/headers and no body. Other methods return 405 with `Allow: GET, HEAD`. Responses use JSON, `X-Content-Type-Options: nosniff` and `Cache-Control: no-store`.

| Route | Result |
| --- | --- |
| `/api/health` | Status, service name, `search: "name-and-fuzzy"`, active catalog metadata |
| `/api/v1/search?q=Penpot&limit=10` | Query, match type, project candidates, optional preferred project, truncation indicator, catalog metadata |
| `/api/v1/projects/penpot%2Fpenpot/alternatives` | Project, reviewed alternatives, price groups, pending classification count, catalog metadata |

`q` must occur once, contain 1–120 characters after trimming and contain no control characters. `limit` defaults to 10 and accepts integers 1–20. Project IDs come from search results and are encoded as a single URL segment (`encodeURIComponent(id)`), including the slash. Invalid queries/IDs return 400; absent projects and unknown routes return 404. Errors have the form:

```json
{"apiVersion":1,"error":{"code":"CATALOG_NOT_READY","message":"The catalog has not been imported yet."}}
```

An empty initialized database returns 503 `CATALOG_NOT_READY`. Database/runtime failures return 503 `CATALOG_UNAVAILABLE`; raw SQL errors and user queries are not logged or returned. A project with no reviewed alternatives still returns 200 with its identity and empty arrays, distinct from a missing project.

Research-only snapshots may set `catalog_snapshots.index_version` to an immutable full snapshot. Only curated project overrides, terms, products and relationships are written; other repositories remain searchable in the base index. Overrides shadow the entire base project row and its aliases. Index references point directly to a full snapshot, never a chain. The final activation statement checks the expected active version, so a stale release cannot replace a newer one. Full snapshots and their hashes remain unchanged; an older version can be reactivated without rebuilding the index. See [small catalog updates](deployment-cloudflare.md#small-research-updates) for base manifests, write accounting and recovery dependencies.

## Name search

Normalization uses Unicode NFKC, lowercase and collapsed whitespace. HTTPS GitHub URLs may be converted to repository paths, including a trailing slash and `.git` suffix. There is no live GitHub call on the request path.

- Exact name/alias/repository matches use the indexed `project_terms` table, with curated identities first.
- When exact matches are absent, queries of at least three Unicode characters use literal FTS5 trigram phrases for indexed substring matching. One- and two-character queries support exact matching only.
- If no substring matches exist, inputs of 4–64 UTF-16 code units generate up to 24 unique trigrams and retrieve at most 60 candidates. Adjacent-transposition-aware edit distance filters and orders this bounded set. This is limited typo assistance, not exhaustive fuzzy or semantic retrieval.
- Results are capped by `limit`; `truncated` signals additional candidates. Use a full repository identity to disambiguate forks. A preferred exact curated result or sole non-fuzzy candidate may open automatically only when the result set is not truncated. Fuzzy results always require explicit selection.

SQL values are bound parameters; FTS input is quoted as literal phrases. No table scan with a leading-wildcard `LIKE`, model inference, README search, remote catalog request or query-history write is performed. The index and candidate bounds reduce work but do not promise a specific cloud cost or latency; benchmark actual deployment data, especially after retaining multiple snapshots. See [D1 index guidance](https://developers.cloudflare.com/d1/best-practices/use-indexes/).

## Publication and prices

The database preserves research and pending observations, but the public API only returns products with `sourceAvailability.verification: official-reviewed` and supported relationship evidence. This status means a scoped researcher judgment supported by official sources, not an endorsement or a classification of every component/vendor product. SDKs, agents and enterprise modules can have separate licensing.

Price observations are published only when `verification: verified`. Pending amounts are withheld; their count is visible. Quote and usage models retain null amounts and any null billing metadata rather than inventing zero prices. Currency evidence links, original configurations, limitations and each record's own review date are retained. A newer import does not refresh an older fact's review date.

Numeric components group by **currency + unit + display period + payment cycle**, then sort descending inside each group. This compares advertised unit rates only; configurations, bundled features and additional usage may differ. The API never calculates a complete product bill, converts currencies, mixes host and user fees or claims the highest observed component is the most expensive possible contract. Quote/usage observations stay outside numeric groups. The UI ceiling filters the chosen group's components only, not product scope/evidence cards.

No automatic price refresh or age-based suspension policy exists yet. Users must check review dates and official sources. Historical fictional examples remain isolated in `demo-catalog.ts`/`ProductCard.tsx` with regression tests; live pages do not use them.

## Browser behavior and privacy

Production builds prerender the shared React routes into static HTML without calling the API or reading D1. Page metadata and discovery rules live in `apps/web/src/lib/seo.ts`; the build renders these alongside the same page components. The browser starts the interactive client and updates metadata on navigation. The production asset profile serves each route's own HTML and returns a custom HTTP 404 for missing pages, while `/api` paths still reach the JSON handler first. See [search discovery](search-discovery.md) for canonical URLs, indexing exclusions, and Search Console setup.

The client validates JSON and rejects HTML fallbacks, unsupported versions, unsafe links and malformed prices/groups. Search and detail requests share cancellation on navigation; each render is keyed to its current query/selection, so stale results cannot replace a later search. Requests have a 15-second timeout. Loading, retry, no-match, ambiguous/fuzzy, found-without-reviewed-alternative and unavailable-price states are explicit and localized. Research summaries retain their original English wording.

Queries appear in the address bar and are sent to the API. The application does not store search history or add analytics. Only the locale preference is stored in local storage. Wrangler metrics and Worker invocation logs are disabled in the supplied config; infrastructure, reverse proxy and local development logs may still record requests, depending on deployment. Do not promise infrastructure-level anonymity.

## Offline collection and enrichment

The standalone GitHub collector targets all public repositories with stars >= 1,000, including forks and archives, without filtering language/license/type. It records resumable search partitions and README outcomes; the original report's incomplete search segments or missing README states are not changed by SQL import. Stars and GitHub indexing can change during collection.

`.local/github-collection/` remains ignored. Tokens belong in the process environment/hidden user input and never in database seed SQL, source, ordinary configuration or logs. Third-party README bodies retain their authorship/licenses and are not automatically published under this repository's MIT license.

Discovery and grouping tools produce evidence queues under `.local/`; their output is never automatically accepted as a proprietary product or reviewed replacement. See [research catalog](../data/catalog/README.md) and [expansion plan](catalog-expansion-plan.md).

## Validation

`npm run check` runs catalog validation, generated binding types, typechecks, lint, formatting, catalog/collector/client tests, real local-D1 API integration tests and both production builds. Integration tests create an isolated nonpersistent database and do not depend on a user's collected index, Cloudflare login or development database. Worker builds use `wrangler deploy --dry-run`. No check deploys remotely.

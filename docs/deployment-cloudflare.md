# Proudly Paid on Cloudflare

**English** | [简体中文](deployment-cloudflare.zh-CN.md)

The production profile is `apps/api/wrangler.production.jsonc`. Frontend and API source remain separate workspaces. One Worker serves the independently built React assets and the existing read-only API on the same hostname.

## Resources

- Site and API: `proudlypaid`, with the custom domains `proudlypaid.com` and `www.proudlypaid.com`.
- Search database: D1 `proudlypaid-catalog`. The database ID in the production configuration is a public resource identifier, not a credential. Forks must use their own database and hostname.
- Recovery snapshots: private R2 bucket `proudlypaid-snapshots`. R2 is operated by the deployment CLI, not exposed as an anonymous download or write API. The Worker needs only its D1 binding.
- Local development continues to use `apps/api/wrangler.jsonc` and local simulated storage. Remote commands require an explicitly authenticated Cloudflare session.

The asset configuration sends `/api` and `/api/*` to the Worker first, including browser navigations. Other known routes serve their own prerendered HTML without trailing slashes, then start the interactive app. Unknown pages return the custom `404.html` with status 404. See [search discovery](search-discovery.md) for canonical URLs, the generated sitemap, and Search Console setup. Forks must set `VITE_SITE_URL` to their own public origin before building.

## Before deploying a fork

Authenticate with your own Cloudflare account. Replace the official Worker name, route hostnames and zone IDs, and D1 database binding in `apps/api/wrangler.production.jsonc` with your own resources. The [separate deployment guide](deployment-lite.md#cloudflare-api-and-d1) explains D1 creation. Use your own private R2 bucket if you keep recovery snapshots; it is managed separately from the Worker binding.

For a new database, review the write budget and complete the schema/catalog initialization below before expecting search to work. Publishing code does not initialize D1. Existing deployments do not need another database import for a code-only update.

## Build and publish code

```bash
npm ci
npm run check
npm run deploy:cloudflare
```

`check` and `build` include a dry run of the production profile. Only `deploy:cloudflare` publishes remotely. The deploy command builds both workspaces and uploads the frontend assets with the Worker; it does not import or change database contents. Source maps belong to the Worker upload and are not public frontend assets.

An active Cloudflare zone in the same account is required for the custom domains. Cloudflare manages their Worker routing and certificates. The configured `workers.dev` address is also available for diagnostics. Both hostnames serve the application; no canonical-host redirect is configured.

### Existing Squarespace parking records

Changing nameservers to Cloudflare can leave imported Squarespace A records and the `www` parking CNAME in place. They still send visitors to the parking page, and can block Worker custom-domain creation with error `100117`. Inspect the exact records before removing the web parking entries for the intended hostnames. Keep unrelated mail MX, SPF and DKIM records. A proxy toggle or browser cache clear does not replace an origin DNS record with a Worker binding. Retry the deployment after clearing the conflicting web records, then validate HTTPS on both hostnames. DNS caches can still delay when individual resolvers see the new records.

Source and contribution links default to `https://github.com/honglinz07/proudlypaid`. Forks should override `VITE_REPOSITORY_URL` in the frontend build environment or `apps/web/.env.local` with their own HTTPS repository URL. An explicitly empty value hides the GitHub links; research leads can still be copied or downloaded locally. Never use a token in a `VITE_` value.

## Import or update a catalog

### Check the write budget first

The initial 66,531-project import reported 465,932 written rows; migrations brought the initial total to 465,961. Search indexes and related tables contribute to this count. This exceeds the Workers Free plan's 100,000-row daily write allowance. Free-tier daily limits are account-wide and reset at 00:00 UTC (08:00 Asia/Shanghai); enforcement can affect subsequent queries without removing stored data. Consult the current [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) and [limit enforcement notice](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/) before any further remote import.

Do not repeat the full import when publishing code. `deploy:cloudflare` never runs a D1 migration, seed or write. Start new free-tier installations with the small curated catalog after checking its budget. The current immutable seed format repeats repository identities for a new research snapshot; frequent full snapshots are unsuitable for the free daily write allowance. Incremental index updates or a deliberately budgeted import workflow must be implemented before automating data refreshes. No paid-plan upgrade or scheduled import is configured.

Apply the checked-in schema to a new database:

```bash
node scripts/wrangler.mjs d1 migrations apply DB --config wrangler.production.jsonc --remote
```

Generate only the checked-in curated catalog with `npm run catalog:seed`. To include the existing repository name index:

```bash
npm run catalog:seed -- --index .local/github-collection/index.jsonl --out .local/catalog-seeds/proudlypaid.sql
node scripts/wrangler.mjs d1 execute DB --config wrangler.production.jsonc --remote --file ../../.local/catalog-seeds/proudlypaid.sql --yes
```

Paths passed to Wrangler resolve from `apps/api/` because the repository wrapper runs it there. A remote file import can make D1 unavailable during processing; schedule future imports accordingly. The seed activates its content-addressed snapshot in its final statement. Verify `/api/health` after importing and before announcing an update.

The first production dataset has 66,531 repository identities and the checked-in reviewed catalog. Repository indexing does not imply a reviewed recommendation or an approved open-source license. README bodies are not imported into D1 or uploaded to the production bucket.

## Small research updates

Use this path when only the checked-in research changes. Do not reimport the 66,531-row name index for each small batch. Apply migration `0002_research_snapshots.sql` once, and publish the compatible Worker before activating a research snapshot. Old full snapshots remain readable before and after this nullable-column migration.

Before editing, capture the active catalog version and resolve its root index version (`index_version ?? version`). Retain a local `base.json` with `activeVersion`, `indexVersion`, `collectionScope`, `projectCount`, and `repositoryIds`: the complete lowercase identities belonging to that **root full snapshot**, not the current curated overlay. Verify these against the active deployment and its original recovery inputs. `projectCount` describes the root index; any new curated identities are added by the generator. Keep this manifest under ignored `.local/`.

```bash
npm run catalog:seed -- --base .local/catalog-releases/RELEASE/base.json --out .local/catalog-seeds/research-update.sql
```

The output contains the complete small research snapshot, only curated project rows, and a guarded final activation statement. Its hash includes the research and root index identity. It does not refresh older review dates. Test the SQL against isolated local D1 with the same schema; inspect row counts and measured writes including index/FTS maintenance, then review current D1 usage before executing it remotely. The generator's searchable project count is not its write count. Stop on import errors; verify that the active pointer actually changed, because a stale expected version deliberately prevents activation.

```bash
node scripts/wrangler.mjs d1 execute DB --config wrangler.production.jsonc --remote --file ../../.local/catalog-seeds/research-update.sql --yes
```

Keep the old snapshot intact for rollback. An explicit `UPDATE catalog_state SET version='<previous-version>' WHERE id=1 AND version='<new-version>'` restores the previous catalog; code rollback alone does not restore data. Do not delete the root snapshot or its recovery objects while a research snapshot depends on it.

For R2, retain `research-update.sql`, `research.json`, both schema migrations and a checksummed manifest at the new version's prefix. The manifest must identify the required root snapshot. Recovery into a new database first restores the root schema/seed, then applies migration 0002 and the research update. A research update is **not** a standalone full backup. Read back and verify all uploaded objects. No raw README or vendor HTML belongs in these recovery inputs.

## R2 recovery snapshots

Keep a versioned prefix `catalog/<snapshot-version>/` containing:

- `seed.sql`: repository identities and original research records, including snapshot activation.
- `0001_catalog.sql`: the schema and FTS5 indexes needed to rebuild a fresh database.
- `research.json`: the checked-in research catalog used for the seed.
- `manifest.json`: snapshot identity, project count, scope, date and SHA-256 checksums.

Upload with `node scripts/wrangler.mjs r2 object put <bucket>/<key> --remote --file <path>`. Keep public bucket access disabled. Do not upload credentials, private environment files or raw third-party README collections. Read back the uploaded seed and compare its SHA-256 checksum before treating the snapshot as a usable backup.

For recovery, download the snapshot with `r2 object get <bucket>/<key> --remote --file <path>`, verify every checksum, and apply the schema and seed to a **new** D1 database. Validate its active version and search results before switching the production binding. The current schema includes FTS5 virtual tables, which are subject to D1 export limitations; the versioned schema and seed are the reproducible recovery inputs.

The initial snapshot version is `64505fe4692aa1bc43c83381894d28e1c429da55f8d452ee6ed4d97261660955` under `proudlypaid-snapshots/catalog/`.

## Verify a release

Check HTTPS, `/api/health` and the intended snapshot/count. Try Penpot, Bruno, a typo such as `grafnaa`, an indexed project without reviewed recommendations, and a nonexistent project. Unknown `/api/*` paths must return a JSON 404 even when requested as a page. Verify direct SPA routes, both languages, narrow screens and the manual contribution flow.

### Initial launch evidence

- Worker version: `81d23f10-4133-46b7-85cc-b44d83aaa1f5`; both custom domains were accepted by Cloudflare.
- D1 migration and the complete 66,531-project snapshot were imported once. The active version was read back successfully, and subsequent checks performed no remote writes.
- Four recovery objects were stored in private R2. Public `r2.dev` access is disabled and no bucket custom domains exist. The SQL seed was downloaded and its SHA-256 matched the original.
- Full local checks passed with 74 executed tests. Production static-asset routing returned HTML for direct SPA routes and JSON 404 responses for unknown API routes, including navigation requests.
- HTTPS on `www.proudlypaid.com` returned the expected catalog version. Penpot returned three reviewed alternatives in two price groups; Bruno returned one in two groups. Homepage, search and contribution deep links returned the application, and an unknown API returned JSON 404.
- A public resolver returned Cloudflare addresses for the root hostname. The current local proxy still returned Squarespace for a normal root request; sending the root Host header through the working same-site www TLS connection returned the correct Worker catalog. This isolates the root routing from the client's stale resolution path; it does not claim all resolver caches have refreshed. Public-browser automation was unavailable during final verification; local UI and online HTTP checks were used.
- D1's information endpoint reported 465,961 rows written in the initial 24-hour period. Read-only catalog checks remained successful at verification time. No paid-plan upgrade, repeated import, scheduled update or write endpoint was added.

Code rollback uses Wrangler's versioned deployments; it does not roll back D1. Keep the previously active catalog version and recovery inputs when updating data. This release has no scheduled price scraping, automatic research approval or vector search.

References: [Workers static assets](https://developers.cloudflare.com/workers/static-assets/), [custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/), [D1 imports and export limitations](https://developers.cloudflare.com/d1/best-practices/import-export-data/), [R2 Wrangler commands](https://developers.cloudflare.com/r2/reference/wrangler-commands/).

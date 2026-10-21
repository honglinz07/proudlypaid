# Deploying the lightweight profile

**English** | [简体中文](deployment-lite.zh-CN.md)

This guide covers separate frontend and API deployments. For the same-hostname Worker + D1 + private R2 production profile, use [the Cloudflare deployment guide](deployment-cloudflare.md). The production database identifier is public configuration; no credentials are included in source. The all-zero D1 ID in `apps/api/wrangler.jsonc` remains a local placeholder; the following remote commands are manual deployment steps, not part of `npm run check`.

## Local verification

```bash
npm ci
npm run db:local -- --curated-only
npm run check
npm run dev
```

Open <http://127.0.0.1:5273/search?q=Penpot>. The API runs at 8787. Local D1 state persists in `.local/worker-state/`; frontend build output is `apps/web/dist/`, and Worker dry-run output is `apps/api/dist/`. No account or token is needed for these steps. To use an existing full local GitHub index, run `npm run db:local` without `--curated-only`.

## Cloudflare API and D1

Authenticate with Wrangler yourself or provide appropriately scoped credentials through the deployment environment. Never put tokens in source, config, shell history or generated SQL. `scripts/wrangler.mjs` runs the locked CLI from `apps/api/`, so configuration and migration paths resolve consistently.

Before any remote migration or import, review the [D1 write budget](deployment-cloudflare.md#check-the-write-budget-first). Search indexes contribute additional written rows. Start with the curated catalog and check your account's current allowance; publishing code does not require reimporting data.

1. Create your database:

   ```bash
   node scripts/wrangler.mjs d1 create closedsources-catalog
   ```

2. Copy the returned database ID into the `DB` binding in `apps/api/wrangler.jsonc`, replacing the local placeholder. Database IDs are not credentials; use your own account's ID. Keep `remote: true` out of the local binding configuration unless remote development is intentional.
3. Apply the checked-in migration to that remote database:

   ```bash
   node scripts/wrangler.mjs d1 migrations apply DB --remote
   ```

4. Generate a seed from the checked-in research catalog and import it remotely:

   ```bash
   npm run catalog:seed
   node scripts/wrangler.mjs d1 execute DB --remote --file ../../.local/catalog-seeds/catalog.sql
   ```

   To include a collected name index, generate it explicitly with `npm run catalog:seed -- --index .local/github-collection/index.jsonl` before the import. The seed contains repository metadata and original research records, not README bodies or credentials. Decide deliberately which metadata to publish and check the source report's completeness caveats.

5. Validate the configured bundle and deploy the Worker:

   ```bash
   npm run build --workspace @closedsources/api
   node scripts/wrangler.mjs deploy
   ```

6. Check the deployed `/api/health`, a name query and an encoded repository detail path. Verify the catalog version/count matches the intended import. An uninitialized catalog deliberately returns 503.

Migrations and snapshot activation serve different purposes: migrations change structure; importing an updated catalog builds a new immutable data snapshot and switches the active pointer at the end. Keep backups and monitor storage before retaining many generations. Identical imports reuse rows; failed or superseded snapshots are not automatically cleaned up. This initial version does not include a retention command or a scheduled updater.

See official [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/), [D1 import](https://developers.cloudflare.com/d1/best-practices/import-export-data/) and [Wrangler commands](https://developers.cloudflare.com/workers/wrangler/commands/) for account-specific operation and current platform behavior. Cloud resources can incur charges according to the account's plan and usage.

## Static frontend and same-origin API

Public source/feedback links default to `https://github.com/honglinz07/proudlypaid`. For a fork, override the frontend build's `VITE_REPOSITORY_URL` with its own HTTPS GitHub repository URL. Local configuration can use `apps/web/.env.local` based on its `.env.example`; rebuild after changes. This is a public address, never a secret. An explicitly empty value hides the GitHub links while keeping local draft copying/downloading. See [beta release steps](release-beta.md).

Build with `npm run build --workspace @closedsources/web` and upload `apps/web/dist/` to a static host. Serve each generated route's own HTML and return `404.html` with HTTP 404 for unknown pages. Route `/api` and `/api/*` to the Worker first. A Cloudflare custom-domain Worker route or a reverse proxy can provide the same-origin boundary. The production frontend always requests relative `/api/...` URLs; the Vite proxy only handles local development and preview. Set `VITE_SITE_URL` to the fork's public HTTPS origin before building; see [search discovery](search-discovery.md).

For example, an existing Nginx gateway serving the web build can preserve the full API path:

```nginx
location ~ ^/api(?:/|$) {
    proxy_pass https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev;
    proxy_ssl_server_name on;
    proxy_ssl_verify on;
    proxy_ssl_trusted_certificate /etc/ssl/certs/ca-certificates.crt;
    proxy_set_header Host YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev;
}
location / {
    try_files $uri $uri/index.html =404;
}
error_page 404 /404.html;
location = /404.html { internal; }
```

Replace the example hostname and configure TLS/static-root/access logging for your gateway. The CA bundle path shown is a Debian/Ubuntu example; use your system's trusted CA bundle while keeping upstream certificate verification enabled. Native Cloudflare route deployments do not require Nginx. Current code has no cross-origin API mode; simply putting the frontend and Worker on different hosts will not connect search. The browser must receive JSON for `/api` paths, including API 404/503 responses, rather than the SPA document.

The generated `404.html` preserves the site's missing-page design without pretending a missing URL exists. Known routes, including `/search` and `/contribute`, have their own generated HTML; keep search query parameters intact. Review infrastructure request logging separately from the app, which has no search-history database or analytics. Contribution drafts are prepared in the browser and are not submitted to this API.

## Scope of this release

This is name/alias/repository matching with bounded typo assistance. VPS packaging, PostgreSQL, vector embeddings, semantic ranking, automated product discovery, live price scraping and price-history jobs are not implemented. They can reuse the researched catalog and `@closedsources/contracts` without coupling the frontend to a storage engine.

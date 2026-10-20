# Lightweight backend — completed local milestone

Completed local integration on **2026-10-20**, continuing the work saved on 2026-10-19. The name-search milestone is ready for local review. No cloud database/Worker was created, no deployment was published, and no Git commit or remote repository was created.

The latest **2026-10-20 API/automation/forms enrichment** now contains **24 projects, 34 products and 54 relationships**. Twenty-four products have reviewed classifications; 37 publishable relationships cover 19 projects. Postman, Zapier, Typeform and Retool are now available for their researched projects, with Bruno Community added. Full checks passed with **70 tests, 0 failures, 0 skips** (28 catalog, 17 collector, 15 API, 10 web). The full 66,531-repository import activated snapshot **`64505fe4692a`**. The live frontend proxy returned all five affected project responses from this snapshot, including separate USD account/user and EUR builder/internal-user groups. See the [fifth batch](../data/catalog/batches/2026-10-20-api-automation-forms.md). Later paragraphs retain earlier milestone results as history.

Later catalog enrichment on **2026-10-20** expanded the overlay to **23 researched projects, 34 products and 53 relationships**. Twenty products have reviewed service classifications; 32 publishable relationships cover 14 projects. Full checks passed again with **67 tests, 0 failures, 0 skips** (28 catalog, 17 collector, 12 API, 10 web), including pending amount withholding and new Plane/Baserow relations. The full local index was reimported and snapshot prefix **`f4e722cefc19`** activated. See the [enrichment record](../data/catalog/batches/2026-10-20-enrichment.md). The milestone details and browser evidence below describe the earlier integration baseline.

## Delivered behavior

- Separate React frontend and Cloudflare Worker + D1 API, sharing the runtime-independent `@closedsources/contracts` version 1 JSON types.
- Exact project/alias/repository/HTTPS GitHub URL search, indexed substrings and bounded typo suggestions. Fuzzy and truncated results require explicit repository selection.
- A local D1 snapshot with **66,531 collected repository identities**, overlaid with the existing **20 researched projects, 31 product records and 40 relationships**. This does not imply all repositories have reviewed replacements or that the original GitHub collection has no remaining gaps.
- Public responses only expose reviewed product classifications and verified price observations. Scope, relationship limitations, independent review dates, price configuration and currency evidence links are retained. Pending classifications/amounts remain withheld and counted.
- Numeric billing components sort descending within currency/unit/period/payment-cycle groups. They are not complete product bills. Quote and usage records retain null amounts; a ceiling filters only the selected unit-price group.
- Loading/cancellation, error/retry, spelling/repository selection, no repository match and indexed-without-reviewed-replacement states. Homepage, FAQ, research documentation, API architecture and deployment instructions now describe the live data boundary.
- Content-addressed, repeatable local imports activate only after the final statement. The schema and isolated integration tests exercise migrations and partial-import recovery. Old snapshots remain retained; cleanup is not automatic.

## Verification

`npm run check` passed on 2026-10-20 with **66 tests executed, 0 failures, 0 skips**:

- Catalog/discovery/grouping: 28.
- GitHub collector regression tests: 17.
- Worker/API with actual isolated local D1: 11.
- Frontend API client and historical demo regressions: 10.

Catalog validation, generated Worker types, both typechecks, lint, formatting, Worker dry-run build and web production build all passed. Existing dependency versions/integrities were unchanged; the lockfile adds the shared workspace and Wrangler's dependency graph. The obsolete generated Node health-server output was removed.

`npm run db:local` successfully regenerated/imported all 66,531 repository identities and activated snapshot prefix `ed1985238692`. Import success output is now summarized rather than printing thousands of empty statement results. Raw collection files and README contents were not changed.

Browser checks covered homepage → Penpot → real Figma/Sketch results, replacing Penpot with Zulip and submitting with Enter, descending Teams component prices, a selected-basis ceiling, reset, typo selection, GitHub URL lookup, an indexed repository without reviewed replacements and an absent repository. The previous partial input-fill observation did not reproduce with these normal replacement/submission steps.

An isolated production preview intentionally used an unavailable local API: the error state appeared; after restoring the proxy, clicking Retry loaded real results. That deliberate test produced an expected proxy/network error. Normal application browsing had no captured console warnings or errors.

English/Chinese rendering and a 390-pixel viewport (375-pixel content area including the scrollbar difference) were checked; document width equaled scroll width, with no horizontal overflow. Quote visibility worked and viewport overrides were reset. Evidence:

- [Desktop real search](screenshots/search-live-desktop.png).
- [Mobile real search](screenshots/search-live-mobile.png).

The temporary failure-test preview was stopped. The normal local development services remain running for review at <http://127.0.0.1:5273/search?q=Penpot> and <http://127.0.0.1:8787/api/health>. After a shutdown, use `npm run dev`; existing D1 data persists in `.local/worker-state/`. A clean clone can initialize the curated-only dataset without credentials.

## Boundaries and next work

See [architecture](architecture.md) and [deployment instructions](deployment-lite.md). The all-zero D1 ID is a local placeholder and must be replaced with an account-specific ID before remote commands. Production needs same-origin `/api/*` routing ahead of SPA fallback.

The catalog remains a small research pilot with dated observations, not live pricing or broad replacement coverage. Complete workload-bill comparisons, automated price refresh/history, snapshot retention tooling, cloud deployment, VPS packaging, PostgreSQL/pgvector and semantic search remain future work. Continue targeted verification/enrichment using actual catalog gaps while keeping this API contract stable.

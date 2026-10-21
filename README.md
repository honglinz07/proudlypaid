# Proudly Paid.

**Your software is free. Let’s fix that.**

**English** | [简体中文](README.zh-CN.md)

[Live website](https://www.proudlypaid.com/) · [Source code](https://github.com/honglinz07/proudlypaid) · [Suggest an alternative](https://github.com/honglinz07/proudlypaid/issues/new?template=catalog_suggestion.md)

An entirely serious directory of paid, proprietary alternatives to open-source software. Search for a project, explore your next financial commitment, and bring back the joy of paying.

Ironically, **Proudly Paid is fully open source**. Its frontend, backend, original assets, documentation, and original research summaries are MIT licensed. The source workspaces retain their original `closedsources` package names.

## Current status

This is a **lightweight search beta**: a React frontend calls an independent Cloudflare Workers + D1 API backed by repository identities and a source-linked research catalog. Prices are dated research observations, not live quotes.

- Search project names, aliases, `owner/repository`, or HTTPS GitHub repository URLs. Substring matching and bounded typo assistance are supported; fuzzy results require explicit repository selection.
- The official website indexes **66,531 repository names and URLs**. A fresh clone includes a curated catalog of **24 projects, 34 products, and 54 researched relationships**. Of these, 37 publishable relationships cover 19 projects; 24 products have scoped classification reviews. An indexed repository does not necessarily have a reviewed recommendation.
- Try `Penpot`, `Grafana`, `Zulip`, `Plane`, `Bruno`, `Hoppscotch`, `Appsmith`, `Activepieces`, or `Formbricks`.
- Distinguish an unknown repository from an indexed repository awaiting recommendations. A public repository is not automatically open source; unreviewed licenses are labeled accordingly.
- Numeric prices sort highest first **within the same currency, unit, display period, and payment cycle**. Choose a billing basis, set a unit-price ceiling, and inspect configurations and original sources. Sales quotes and usage-based models stay outside numeric rankings.
- A billing component is not a complete product bill or proof of equivalent features. Separate price groups are not ranked against one another. Product names do not imply affiliation or endorsement.
- English and Chinese interfaces, responsive layouts, keyboard navigation, FAQ, manifesto, and a very professional 404 page. The app has no accounts, analytics, or search-history storage. Queries appear in the URL and are sent to the API; infrastructure logging depends on the deployment.
- `/contribute` prepares a copyable or downloadable Markdown research lead in the browser. It can carry over search context, but does not automatically submit anything to the server or GitHub.

## Quick start

Use **Node.js 24+ and npm 11+**. Wrangler simulates Workers and D1 locally. No Cloudflare account, GitHub token, or paid service is required for local development; the first installation downloads the open-source dependencies.

```bash
npm ci
npm run db:local -- --curated-only
npm run dev
```

- Frontend: <http://127.0.0.1:5273>
- API health: <http://127.0.0.1:8787/api/health>
- Run them separately with `npm run dev:web` and `npm run dev:api` if preferred.
- Stop the development servers with `Ctrl+C`.

Local data persists in `.local/worker-state/`; restarting the servers does not require another import. Reimport after updating research records to activate a new snapshot.

To include an existing `.local/github-collection/index.jsonl`, run `npm run db:local` without `--curated-only`. It imports every repository name and URL in that index alongside the curated catalog. It does not modify collection files or read README bodies. Without a collected index, this command imports only the curated catalog. The collected index and raw README files are not distributed with the source.

## Source and contribution links

The source dialog and contribution page link to [honglinz07/proudlypaid](https://github.com/honglinz07/proudlypaid) by default. When deploying a fork, copy `apps/web/.env.example` to `apps/web/.env.local` and set `VITE_REPOSITORY_URL` to your own repository’s HTTPS web URL. Restart development or rebuild the frontend after changing it. Production builds can also receive this value from the build environment.

This is a public URL, never a token. An explicitly empty `VITE_REPOSITORY_URL=` hides GitHub links while retaining draft copying and downloads. With a repository configured, users copy their draft, open the GitHub template, and confirm submission themselves. The website does not post issues or collect contact information. See [Contributing](CONTRIBUTING.md) and the [beta release guide](docs/release-beta.md).

## Frontend and API separation

```text
apps/
  web/                  React + TypeScript + Vite static frontend
    src/components/     Search, navigation, product cards, source dialog
    src/pages/          Home, search, FAQ, manifesto, contribution, 404
    src/lib/            API client, response validation, locale state
    test/               Client contract and historical demo regression tests
  api/                  Cloudflare Workers + TypeScript HTTP API
    src/                Request handling, D1 queries, publication rules
    migrations/         Versioned database schema
    test/               Integration tests using local D1
packages/contracts/     Versioned JSON types shared by backend profiles
data/catalog/           Original research catalog and discovery identities
docs/                   Architecture, deployment, research records
scripts/                Development, collection, discovery, database tooling
test/                   Catalog and collector tests
.github/                CI, issue templates, pull request template
```

The API handler returns JSON and does not render frontend pages. The frontend does not import backend source. Vite development and preview proxy `/api` to `127.0.0.1:8787`. In the combined production profile, Workers serves the independently built static assets alongside the API.

The main endpoints support GET and HEAD:

| Endpoint | Response |
| --- | --- |
| `/api/health` | Database readiness, search capability, and active catalog metadata |
| `/api/v1/search?q=Penpot` | Project matches; optional `limit=1..20` |
| `/api/v1/projects/penpot%2Fpenpot/alternatives` | Alternatives, billing components, evidence, review dates, and pending counts |

See [Architecture](docs/architecture.md) for request limits, error codes, publication rules, and the future VPS adapter boundary.

Set `WEB_PORT` to change the frontend port. To use a different API port, run `node scripts/wrangler.mjs dev --ip 127.0.0.1 --port 9000 --persist-to ../../.local/worker-state` and set `API_PROXY_TARGET=http://127.0.0.1:9000` for the frontend. Use environment-variable syntax appropriate to your shell.

## Checks and builds

```bash
npm run check          # Catalog, types, lint, formatting, tests, production builds
npm run format         # Apply formatting
npm run build          # Build both workspaces and validate production packaging
```

Frontend output goes to `apps/web/dist/`. API builds use a Wrangler **dry run**, writing to `apps/api/dist/`; combined production validation writes to `apps/api/dist/production/`. These commands do not deploy to the cloud. Checks generate binding types and run migration/search tests in an isolated temporary local D1, without changing the development database.

Preview the frontend with `npm run preview --workspace @closedsources/web` at port 4173. Search still requires the API, for example through `npm run dev:api`.

## Deployment

The official instance at <https://www.proudlypaid.com/> uses **Workers + D1 + private R2**: one Worker serves frontend assets and the API, D1 stores the search catalog, and R2 holds recovery snapshots. The frontend and API remain separate source workspaces and can also be deployed independently.

- **Combined Cloudflare deployment:** follow the [Workers + D1 + R2 guide](docs/deployment-cloudflare.md). The production profile includes the official instance’s public resource identifiers; forks must substitute their own database and domains. The all-zero D1 ID in the local profile is a development placeholder.
- **Separate frontend and API:** follow the [lightweight deployment guide](docs/deployment-lite.md). Serve the generated route HTML in `apps/web/dist/` and route `/api` and `/api/*` to the Worker first. Production uses same-origin relative API URLs; the Vite proxy is not included in the build, and there is no cross-origin API mode.
- **Static pages and discovery:** builds prerender public pages, metadata, `robots.txt`, a sitemap, and a custom 404. The Cloudflare profile returns HTTP 404 for unknown pages while retaining client-side navigation. Forks should set `VITE_SITE_URL` to their own HTTPS origin. See [search discovery](docs/search-discovery.md), including the separate Search Console ownership/submission steps.
- **VPS semantic profile:** planned, not implemented. It can reuse the catalog, JSON contract, and review rules while adding PostgreSQL/pgvector and semantic retrieval.

`npm run deploy:cloudflare` publishes code and frontend assets; it does **not** import data. Before any remote migration or import, check the D1 write budget described in the deployment guide. Cloud resources follow the deploying account’s plan and service rules.

## Research and collection

The catalog retains source URLs, license scopes, pricing configurations, individual review dates, and pending states. Only records meeting the publication rules appear as recommendations. See the English [publication and pricing rules](docs/architecture.md#publication-and-prices), [research notes](data/catalog/README.md) (Chinese), [latest research batch](data/catalog/batches/2026-10-20-api-automation-forms.md) (Chinese), and [catalog JSON](data/catalog/pilot.json).

`npm run catalog:discover` scans collected READMEs offline for alternative claims and writes candidates with line numbers and content hashes to `.local/catalog-discovery/run-*/`. `npm run catalog:group -- --input <candidates.jsonl>` groups an explicitly selected batch using the discovery identity registry, writing review queues to `.local/catalog-review/run-*/`. Original evidence is retained; neither tool automatically approves a proprietary classification or adds recommendations. The [catalog expansion plan](docs/catalog-expansion-plan.md) is currently in Chinese.

The standalone GitHub collector targets **all public repositories with at least 1,000 stars**, including forks, without filtering project type, language, or license. Each index entry stores the full repository name, repository web URL, and local README path. Collection supports partitioned searches, resumable progress, status reporting, and file verification. Importing the local index does not prove full GitHub coverage: unresolved search partitions and README outcomes remain in the collection report. The [original collection brief](docs/github-collection-brief.md) is currently in Chinese.

```bash
npm run github:collect
npm run github:status
npm run github:verify
```

The collector requires Node.js 24+. Supply an existing GitHub credential through `GH_TOKEN` or `GITHUB_TOKEN` for authenticated API access; public access without a token is subject to lower unauthenticated limits. Windows users can run `scripts/collect-github.ps1` for hidden token input and automatic resumption after rate-limit resets. Tokens are not written to project files.

Outputs default to the ignored `.local/github-collection/` directory. `npm run github:collect -- --max-requests 5` limits a single run for connectivity checks; it does not reduce the collection target. Use `--retry-failed` to retry failed README downloads. Windows users can use:

```powershell
.\scripts\collect-github.ps1 -RetryFailed
```

After bounded retries, persistent network failures stop collection with saved progress and a concrete error code such as `ENOTFOUND`, `EACCES`, or `UND_ERR_CONNECT_TIMEOUT`. Remaining repositories are not marked as failed in bulk. Resume once connectivity is restored. For long Windows collection runs, use a normal PowerShell session. Node.js proxy behavior depends on its version and configuration; enabling a system proxy does not necessarily configure Node.js, and this tool does not change system proxy settings.

## Documentation

| Guide | English | 简体中文 |
| --- | --- | --- |
| Overview and local setup | [README](README.md) | [项目说明](README.zh-CN.md) |
| Workers + D1 + R2 | [Cloudflare deployment](docs/deployment-cloudflare.md) | [Cloudflare 部署](docs/deployment-cloudflare.zh-CN.md) |
| Separate frontend and API | [Lightweight deployment](docs/deployment-lite.md) | [轻量版部署](docs/deployment-lite.zh-CN.md) |
| Beta release and verification | [Beta release](docs/release-beta.md) | [测试版发布](docs/release-beta.zh-CN.md) |
| Search engine discovery | [Search discovery](docs/search-discovery.md) | [搜索引擎发现](docs/search-discovery.zh-CN.md) |

[Architecture](docs/architecture.md) and [Contributing](CONTRIBUTING.md) are in English. Historical research records and the original collection brief retain their original Chinese text and dates.

## License and contributions

Original frontend, backend, CSS, SVG icons, documentation, and research summaries use the [MIT License](LICENSE). Dependencies retain their own open-source licenses and are recorded in `package-lock.json`. Third-party READMEs retain their authorship and licenses and are not automatically published with local data. The UI uses system fonts rather than redistributing commercial fonts. Local development needs no paid services. The application has no analytics integration, and Wrangler tool metrics are disabled.

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

> We used open source to help you stop using open source. We understand how this looks.

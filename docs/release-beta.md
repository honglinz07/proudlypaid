# First beta release

**English** | [简体中文](release-beta.zh-CN.md)

Proudly Paid is deployed on Workers, production D1, and private R2, with both the root and www domains bound. At launch verification, www pages, real search, and API routing passed online HTTP checks. The root hostname also worked when connecting directly to Cloudflare, while the local proxy path still returned the old Squarespace page.

The first full index import triggered a D1 write alert. Further remote writes were stopped; subsequent code deployments do not import data. The public repository is [honglinz07/proudlypaid](https://github.com/honglinz07/proudlypaid), the default destination for source and contribution links. Original site code, frontend, backend, and research summaries are MIT licensed; dependencies, third-party READMEs, and assets retain their own licenses. See the [Cloudflare deployment guide](deployment-cloudflare.md).

## What this beta supports

- Independent Workers + D1 API search by name, alias, or repository URL, with bounded typo assistance.
- Reviewed alternative relationships and prices with configurations, sources, and dates. Unit prices sort highest first only within a matching currency and billing basis.
- A visible Beta label and separate states for indexed repositories and reviewed recommendations. The homepage links to six covered example projects.
- `/contribute` can carry over search context, prepare project requests or corrections, and copy or download a Markdown draft.
- Source and contribution links point to the public repository. Users confirm submissions on GitHub themselves; forks can override the destination.

As of 2026-10-20, the research catalog contains **24 projects, 34 products, and 54 researched relationships**. Of these, 37 publishable relationships cover 19 projects. A clean clone includes this curated catalog, without private local collections, raw READMEs, accounts, or tokens. Deployers may separately import a repository-name index after checking their write budget.

## Run from a clean clone

Use Node.js 24+ and npm 11+. From the repository root:

```bash
npm ci
npm run db:local -- --curated-only
npm run check
npm run dev
```

Open <http://127.0.0.1:5273>. After stopping the servers, `npm run dev` reuses the existing local database. These local steps do not require GitHub or Cloudflare credentials.

Useful checks include Penpot’s Figma/UXPin price groups, Bruno’s Postman individual/team groups, Appsmith’s Retool euro-denominated role groups, Formbricks’ pending-price indicator, and Supabase’s indexed-but-awaiting-recommendations state.

## Forks and GitHub links

1. Fork the [public repository](https://github.com/honglinz07/proudlypaid). Keep the MIT license, lockfile, CI, and issue templates. Do not upload `.local/`, `node_modules/`, build output, or private environment files.
2. Links default to the official repository. For your own deployment, copy `apps/web/.env.example` to `apps/web/.env.local` and set `VITE_REPOSITORY_URL` to your real repository web URL, such as `https://github.com/your-account/your-repository`. This is a public address, not a credential, and must follow GitHub’s account/repository naming rules.
3. Restart development or rebuild the frontend. Check the source dialog, prepare a research lead, and confirm that “Open GitHub to submit” targets your repository’s template. Opening the form does not publish an issue.
4. Once GitHub CI passes, a verified commit can be used for a beta release. Release notes should state catalog coverage and pricing limitations.

An explicitly empty `VITE_REPOSITORY_URL=` hides the repository links while retaining local copying and downloads. `VITE_` values are bundled into the public frontend and must never hold credentials. Invalid repository URLs, including URLs with embedded credentials, make development startup/build fail with a correction message.

## Deployment and online verification

Use the [combined Cloudflare guide](deployment-cloudflare.md) for one Worker serving assets and the API with D1 and private R2 recovery snapshots, or the [lightweight deployment guide](deployment-lite.md) for separate frontend/API deployment. Use your own database and domains. Route same-origin `/api` and `/api/*` to the API before SPA fallback; the Vite proxy is not deployed with static assets. Allow direct visits to `/search`, `/faq`, `/manifesto`, and `/contribute`.

Check the health response’s catalog version/count, the five search cases above, both languages, narrow screens, source links, and the manual contribution flow. There is no online submission backend, search analytics, or automatic catalog acceptance. Contribution drafts are not persisted by the website and are lost on leaving the page unless copied or downloaded.

## Remaining scope

Prices are research observations, not live procurement quotes. Billing components are not complete product bills. Candidates and prices still need review; semantic search, automatic price updates, an editorial dashboard, and snapshot cleanup are not implemented. Forks use their own deployment accounts, repositories, and domains, and should validate local operation and production separately.

## Initial local verification record

- On Windows with Node.js 24 and npm 11, a clean source copy without dependencies, a local database, or the collected index completed `npm ci`, migrations, and import of the 24-project curated catalog.
- Both the main workspace and clean source copy passed the full `npm run check`: 74 tests executed and passed, alongside typechecks, lint, formatting, API dry runs, and frontend builds. Subsequent accessibility-label and style adjustments also passed focused frontend checks and a build.
- The clean copy ran frontend and API on isolated local ports. The proxied health endpoint reported `curated-only` with 24 projects; an exact Bruno query returned the real catalog record.
- Browser checks covered desktop, tablet, mobile, both languages, search context, HTTPS evidence validation, draft preview, copying, Markdown downloads, invalidation after editing, keyboard dialog dismissal, and configured/unconfigured repository links. No remote issues were submitted, and no browser warnings or errors were recorded during those checks.
- That release added configuration, pages, contribution templates, and documentation without changing dependency versions, the lockfile, database schema, or collected data. Wrangler reported an available patch release; the locked version was retained.

Screenshots: [homepage](screenshots/proudlypaid-beta-local.png), [contribution page](screenshots/release-feedback-desktop.png), and [mobile draft](screenshots/release-feedback-mobile.png). Some historical screenshots retain the earlier brand. Verify GitHub CI and the corresponding cloud deployment for subsequent releases.

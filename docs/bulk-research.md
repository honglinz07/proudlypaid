# Bulk discovery and product-page research

**English** | [简体中文](bulk-research.zh-CN.md)

These local Node.js 24.5+ tools import relationship leads, group them by product, and collect reusable website evidence. They never modify the curated catalog, original GitHub collection, or D1. Everything remains `needs-review`: a price-like number does not verify a plan, proprietary classification, or replacement relationship.

## Import

An existing GitHub collection index is required. After `npm ci`, run:

```bash
npm run catalog:import
```

The importer downloads [Macrostack's public alternatives JSON](https://www.macrostack.net/data), [awesome-saas-alternatives' product JSON](https://github.com/Emmraan/awesome-saas-alternatives), and the latter's MIT notice. It joins repositories to `.local/github-collection/index.jsonl` and uses `data/catalog/product-identities.json` for known aliases and locators. Each `.local/catalog-bulk/run-*/` contains:

- `products.json`: product groups and website/pricing locators for the collector.
- `relationships.jsonl`: candidates, including unmatched repositories, with source hashes, JSON pointers or README evidence IDs.
- `sources/` and `SOURCES.md`: preserved inputs, attribution and license notice. Macrostack data remains CC-BY-4.0; import does not relicense it as MIT.
- `report.json` and `source-rows-needing-review.json`: counts and source rows needing identity/schema review.

The alternative entry's website and pricing are never mistaken for the target's facts. Homepage hints come from the identity registry or an exactly named SaaS inventory entry. Different products on a shared company domain stay separate. Missing identities, unknown aliases, combined product names and source assertions still need review.

To reuse snapshots and optionally join an explicit `catalog:group` output:

```bash
npm run catalog:import -- --from /path/to/source-snapshots --index /path/to/collection/index.jsonl --readme-groups /path/to/review/products.json
```

Snapshots must contain `macrostack.json`, `awesome-saas-alternatives.json`, and `awesome-saas-license.txt`. README groups retain their original evidence; a mention can describe a sponsor or another project. `--out DIRECTORY` changes the output root. Sources are read only, and output inside a source directory is rejected.

## Collect and resume

Replace `run-EXAMPLE` with the actual import directory:

```bash
npm run catalog:pages -- --input .local/catalog-bulk/run-EXAMPLE/products.json --max-products 20 --max-requests 100
```

Defaults are 20 product attempts, 100 requests including robots and redirects, and a 168-hour page/product cache. Each product can collect up to four pages: supplied homepage/pricing locators and explicitly linked pricing/terms pages. It never guesses pricing paths or submits forms. Missing homepages produce identity-research tasks.

Repeat the same command to advance to unprocessed products. Checkpoints and content-hashed page caches survive interruption; interrupted products reuse already fetched pages. Each run writes cumulative `review-drafts.json`, `report.json`, and a readable `review-summary.md` to `.local/catalog-page-runs/run-*/`. `paused` means a run budget was reached. `complete-with-gaps` means work was attempted but some identities/pages need follow-up. Neither means recommendations are verified.

```bash
npm run catalog:pages -- --input .local/catalog-bulk/run-EXAMPLE/products.json --max-products 20 --max-requests 100 --retry-failed
```

`--retry-failed` revisits products with missing identities or unsuccessful pages after new products; cooldowns still apply. `--max-age-hours N` controls freshness. Robots policies expire after 24 hours. `--cache DIRECTORY` and `--out DIRECTORY` select cache/report roots. Use one collector process per cache. No scheduler or background service is installed.

## Fetching and evidence

Product-page requests identify `ProudlyPaidResearch`, check robots.txt on every destination origin, and honor exclusion rules, crawl delays and Retry-After. Only robots HTTP 404/410 is treated as absent; unreadable/denied policies defer pages. Requests are sequential with at least a one-second host interval, a 15-second request/body timeout, and bounded text responses/redirects. No cookies or credentials are sent. Login barriers and browser challenges become review outcomes. TLS verification stays enabled.

Only public HTTPS URLs are accepted; credentials, IP-literal hosts and private/local DNS answers are rejected. This is an operator-run CLI, not a public URL-fetching endpoint. Do not expose it as one. The commands use Node's `--use-env-proxy` to honor explicitly configured `HTTPS_PROXY`/`HTTP_PROXY`; they do not change system proxy settings or discover credentials. A Windows system proxy alone may not configure Node.

Drafts contain URLs, retrieval times, decoded-text SHA-256 hashes, titles, bounded text previews and price-like snippets. The report records the extractor version. Snippet line numbers refer to normalized extracted text, not original HTML. Raw decoded documents stay in `.local/catalog-page-cache/objects/` as internal third-party research inputs, not public product descriptions.

Before adding original summaries to `data/catalog/pilot.json`, review product scope, functional overlap, licensing evidence, currency, units, billing cycle and configuration. Uncertain observations remain pending. The D1 snapshot publication budget must be checked separately; these tools perform no migrations, imports or deployment.

## Validation

```bash
npm run test:catalog
npm run check
```

Tests cover source attribution, target/alternative separation, alias grouping, source preservation, robots exclusion, URL/DNS guards, redirects, response limits, checkpoint advancement, shared-page caching, request budgets, browser challenges and persistent rate-limit cooldowns.

The link extractor excludes privacy pages, help articles, glossaries and department landing pages, and prefers direct agreements over legal hubs. These remain link hints requiring review. Reviewed Jotform and Superblocks terms restrict automated collection, so fresh requests to those domains are deferred for manual review or explicit permission. Previously retained evidence is not republished.

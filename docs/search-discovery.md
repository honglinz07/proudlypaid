# Search discovery

**English** | [简体中文](search-discovery.zh-CN.md)

Production builds render the existing React pages to static HTML at build time. Crawlers receive the same English content users see, without needing JavaScript to discover the homepage, FAQ, or manifesto. The browser then starts the interactive app, including the saved language preference and live search. Rendering does not call the API, read the catalog, or write D1.

## Included configuration

- Page-specific titles, descriptions, canonical URLs, Open Graph and Twitter summary metadata.
- `WebSite` JSON-LD on the homepage, using the real site name and canonical homepage. No fabricated ratings or prices.
- `/sitemap.xml` lists `/`, `/faq`, and `/manifesto`. It has no invented modification dates and excludes search queries and contribution forms.
- `/robots.txt` advertises the sitemap and asks crawlers to avoid `/api`. Search pages remain crawlable so their `noindex, follow` directive can be read.
- Search, contribution, and missing pages have `noindex, follow`. Unknown production URLs return the custom `404.html` with HTTP 404; API misses continue returning JSON 404.

The canonical origin is `https://www.proudlypaid.com`. Both bound hostnames use this canonical; no root-to-www redirect is added. Set the public build variable `VITE_SITE_URL` to your own HTTPS origin for a fork, without credentials, a path, query, or fragment. It controls canonical URLs, structured data, and discovery files. Rebuild after changing it. See `apps/web/.env.example`.

Static HTML is English. The Chinese interface currently uses the same URLs and a browser preference; there are no separate Chinese landing URLs or `hreflang` claims.

## Deployment and checks

Run `npm run check`, then publish code as described in the [Cloudflare guide](deployment-cloudflare.md). The production asset profile serves directory index files without trailing slashes and uses the nearest custom 404 page for unknown URLs. On a separate static host, serve each generated route's own HTML, preserve query parameters for `/search`, and return `404.html` with status 404 for missing pages. Forward `/api` and `/api/*` before handling static pages.

Verify the public homepage, `/faq`, `/robots.txt`, and `/sitemap.xml`. Inspect the original HTML for real text and route-specific metadata; check that a nonexistent URL returns 404, `/search?q=Penpot` remains interactive, and search pages are not in the sitemap. Code deployment does not require another database import.

## Search Console

The site files make discovery possible; they do not register a Google account or guarantee indexing. In your own [Google Search Console](https://search.google.com/search-console/):

1. Add a domain property for `proudlypaid.com`, or the URL-prefix property `https://www.proudlypaid.com/`.
2. Complete the [ownership verification](https://support.google.com/webmasters/answer/9008080) shown for that property. Domain properties require a DNS verification record. Do not replace existing website or mail records.
3. Submit `https://www.proudlypaid.com/sitemap.xml` under Sitemaps.
4. Inspect the homepage URL, run the live test, and request indexing. Review reported crawling/indexing issues as Google processes the site.

No Search Console property, verification token, or submission is created automatically by this repository. Do not place account credentials in frontend environment variables. Google decides when to crawl, index, and display a site; technical eligibility does not guarantee ranking or inclusion.

References: [Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics), [site names](https://developers.google.com/search/docs/appearance/site-names), [sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [how Google Search works](https://developers.google.com/search/docs/fundamentals/how-search-works/).

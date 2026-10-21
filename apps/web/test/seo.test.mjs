import assert from "node:assert/strict";
import { test } from "node:test";
import { discoveryFiles, metadataHtml, normalizeSiteOrigin, pageMetadata } from "../src/lib/seo.ts";

test("canonical origins cannot carry credentials or turn public metadata into arbitrary URLs", () => {
  assert.equal(normalizeSiteOrigin("https://example.org/"), "https://example.org");
  for (const origin of [
    "",
    "http://example.org",
    "https://user:secret@example.org",
    "https://example.org/path",
    "https://example.org/?token=secret",
    "https://example.org/#fragment",
  ])
    assert.throws(() => normalizeSiteOrigin(origin));
});

test("only editorial pages enter the sitemap; search, contributions and unknown routes stay noindex", () => {
  const { sitemap, robots } = discoveryFiles("https://example.org");
  for (const page of ["/", "/faq", "/manifesto"]) {
    assert(sitemap.includes(`<loc>https://example.org${page}</loc>`));
    assert.equal(pageMetadata(page).robots, "index, follow");
  }
  for (const page of [
    "/search",
    "/contribute",
    "/404",
    "/__proto__",
    "/constructor",
    "/missing<script>",
  ]) {
    assert.equal(pageMetadata(page).robots, "noindex, follow");
    assert(!sitemap.includes(`<loc>https://example.org${page}</loc>`));
  }
  assert(robots.includes("Disallow: /api"));
  assert(!robots.includes("Disallow: /search"));
  assert(robots.includes("Sitemap: https://example.org/sitemap.xml"));
});

test("metadata remains route-specific and never reflects unknown user paths into HTML", () => {
  const home = metadataHtml("/");
  const faq = metadataHtml("/faq");
  const unknown = metadataHtml('/bad"><script>alert(1)</script>');
  assert(home.includes('id="website-data"'));
  assert(!faq.includes('id="website-data"'));
  assert.notEqual(pageMetadata("/").title, pageMetadata("/faq").title);
  assert.equal(pageMetadata("/faq/").canonical, pageMetadata("/faq").canonical);
  assert(!unknown.includes("alert(1)"));
  assert(!unknown.includes('rel="canonical"'));
  assert(unknown.includes('content="noindex, follow"'));
});

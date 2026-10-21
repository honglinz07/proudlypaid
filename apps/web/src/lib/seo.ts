export function normalizeSiteOrigin(value = "https://www.proudlypaid.com"): string {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("VITE_SITE_URL must be an HTTPS origin without credentials, path or query.");
  return url.origin;
}

export const siteOrigin = normalizeSiteOrigin(import.meta.env?.VITE_SITE_URL);
export const staticPaths = ["/", "/faq", "/manifesto", "/contribute", "/search", "/404"];

const pages: Record<string, { en: string; zh: string; description: string; index: boolean }> = {
  "/": {
    en: "ProudlyPaid — Paid alternatives to open-source software",
    zh: "ProudlyPaid — 开源项目的付费闭源替代品",
    description:
      "Find paid, proprietary alternatives to open-source software. Compare reviewed prices, highest first within each billing basis. Bring back the joy of paying.",
    index: true,
  },
  "/faq": {
    en: "FAQ — How the directory works · ProudlyPaid",
    zh: "常见问题 — 目录与价格规则 · ProudlyPaid",
    description:
      "How ProudlyPaid reviews proprietary alternatives, groups comparable prices, and handles projects without recommendations. Even our invoices require evidence.",
    index: true,
  },
  "/manifesto": {
    en: "Our philosophy — The joy of paying · ProudlyPaid",
    zh: "闭源宣言 — 找回付费的快乐 · ProudlyPaid",
    description:
      "A very serious philosophy of premium software, procurement, and the joy of paying. ProudlyPaid is, inconveniently, fully open source.",
    index: true,
  },
  "/contribute": {
    en: "Contribute a research lead · ProudlyPaid",
    zh: "补充目录 — 提交研究线索 · ProudlyPaid",
    description:
      "Suggest a paid alternative, request project coverage, or correct a price with official evidence.",
    index: false,
  },
  "/search": {
    en: "Search paid alternatives · ProudlyPaid",
    zh: "搜索付费闭源替代品 · ProudlyPaid",
    description:
      "Search the repository index and explore reviewed proprietary alternatives with source-linked pricing.",
    index: false,
  },
};

export function pageMetadata(pathname: string, language = "en", origin = siteOrigin) {
  const path = pathname.replace(/\/+$/u, "") || "/";
  const page = Object.hasOwn(pages, path) ? pages[path] : undefined;
  return {
    title: page ? (language === "zh" ? page.zh : page.en) : "404 — Page not found · ProudlyPaid",
    description:
      page?.description ??
      "This page is not included in your current plan. Actually, it does not exist.",
    robots: page?.index ? "index, follow" : "noindex, follow",
    canonical: page ? `${origin}${path === "/" ? "/" : path}` : null,
    home: path === "/",
  };
}

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/gu,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ??
      character,
  );

export function websiteData(origin = siteOrigin) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "ProudlyPaid",
    alternateName: "Proudly Paid",
    url: `${origin}/`,
  }).replace(/</gu, "\\u003c");
}

export function metadataHtml(pathname: string, origin = siteOrigin) {
  const page = pageMetadata(pathname, "en", origin);
  return [
    `<title>${escapeHtml(page.title)}</title>`,
    `<meta name="description" content="${escapeHtml(page.description)}" />`,
    `<meta name="robots" content="${page.robots}" />`,
    page.canonical ? `<link rel="canonical" href="${escapeHtml(page.canonical)}" />` : "",
    '<meta property="og:type" content="website" />',
    '<meta property="og:site_name" content="ProudlyPaid" />',
    `<meta property="og:title" content="${escapeHtml(page.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(page.description)}" />`,
    page.canonical ? `<meta property="og:url" content="${escapeHtml(page.canonical)}" />` : "",
    '<meta name="twitter:card" content="summary" />',
    `<meta name="twitter:title" content="${escapeHtml(page.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(page.description)}" />`,
    page.home
      ? `<script id="website-data" type="application/ld+json">${websiteData(origin)}</script>`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function discoveryFiles(origin = siteOrigin) {
  const urls = Object.keys(pages).filter((path) => pages[path].index);
  return {
    robots: `User-agent: *\nAllow: /\nDisallow: /api\n\nSitemap: ${origin}/sitemap.xml\n`,
    sitemap: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((path) => `  <url><loc>${escapeHtml(`${origin}${path}`)}</loc></url>`).join("\n")}\n</urlset>\n`,
  };
}

export function updatePageMetadata(pathname: string, language: string) {
  const page = pageMetadata(pathname, language);
  document.title = page.title;
  for (const [key, content] of [
    ["name:description", page.description],
    ["name:robots", page.robots],
    ["property:og:title", page.title],
    ["property:og:description", page.description],
    ["property:og:url", page.canonical],
    ["name:twitter:title", page.title],
    ["name:twitter:description", page.description],
  ] as const) {
    const separator = key.indexOf(":");
    const attribute = key.slice(0, separator);
    const value = key.slice(separator + 1);
    const selector = `meta[${attribute}="${value}"]`;
    let element = document.head.querySelector(selector);
    if (!content) {
      element?.remove();
      continue;
    }
    if (!element) {
      element = document.createElement("meta");
      element.setAttribute(attribute, value);
      document.head.append(element);
    }
    element.setAttribute("content", content);
  }
  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (page.canonical) {
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.append(canonical);
    }
    canonical.setAttribute("href", page.canonical);
  } else canonical?.remove();
  let structured = document.getElementById("website-data");
  if (page.home) {
    if (!structured) {
      structured = document.createElement("script");
      structured.id = "website-data";
      structured.setAttribute("type", "application/ld+json");
      document.head.append(structured);
    }
    structured.textContent = websiteData();
  } else structured?.remove();
}

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const web = path.join(root, "apps/web");
const output = path.join(web, "dist");
const serverOutput = path.join(root, ".local/prerender");

await build({
  root: web,
  publicDir: false,
  build: {
    ssr: path.join(web, "src/prerender.tsx"),
    outDir: serverOutput,
    emptyOutDir: false,
    rollupOptions: { output: { entryFileNames: "entry.mjs" } },
  },
});
const { renderPages, discoveryFiles } = await import(
  pathToFileURL(path.join(serverOutput, "entry.mjs"))
);
const template = await readFile(path.join(output, "index.html"), "utf8");
assert(template.includes("<!--seo:start-->"), "Missing metadata marker in the client build");
assert(template.includes('<div id="root"></div>'), "Missing application root in the client build");

for (const page of renderPages()) {
  const html = template
    .replace(
      /<!--seo:start-->[\s\S]*?<!--seo:end-->/u,
      () => `<!--seo:start-->${page.head}<!--seo:end-->`,
    )
    .replace('<div id="root"></div>', () => `<div id="root">${page.body}</div>`);
  assert(page.body.includes("<h1"), `Missing static page content: ${page.path}`);
  assert.equal((html.match(/<title>/gu) ?? []).length, 1, `Duplicate title: ${page.path}`);
  const file =
    page.path === "/"
      ? "index.html"
      : page.path === "/404"
        ? "404.html"
        : `${page.path.slice(1)}/index.html`;
  const target = path.join(output, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, html);
}
const discovery = discoveryFiles();
await writeFile(path.join(output, "robots.txt"), discovery.robots);
await writeFile(path.join(output, "sitemap.xml"), discovery.sitemap);
console.log(
  "Prerendered 6 pages with metadata, robots.txt and sitemap.xml; no API or database access.",
);

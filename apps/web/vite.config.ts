import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { normalizeRepositoryUrl } from "./src/lib/contributions.ts";
import { metadataHtml, normalizeSiteOrigin } from "./src/lib/seo.ts";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  const origin = normalizeSiteOrigin(env.VITE_SITE_URL);
  if (env.VITE_REPOSITORY_URL?.trim() && !normalizeRepositoryUrl(env.VITE_REPOSITORY_URL))
    throw new Error(
      "VITE_REPOSITORY_URL must be an HTTPS github.com/owner/repository URL without credentials or query parameters.",
    );
  return {
    plugins: [
      react(),
      {
        name: "site-metadata",
        transformIndexHtml(html) {
          return html.replace(
            "<!--seo-head-->",
            `<!--seo:start-->${metadataHtml("/", origin)}<!--seo:end-->`,
          );
        },
      },
    ],
    server: {
      host: "127.0.0.1",
      port: Number(process.env.WEB_PORT ?? 5273),
      strictPort: true,
      proxy: { "/api": process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8787" },
    },
    preview: {
      host: "127.0.0.1",
      port: 4173,
      strictPort: true,
      proxy: { "/api": process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8787" },
    },
  };
});

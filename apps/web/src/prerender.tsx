import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router";
import { AppRoutes } from "./App";
import { LocaleProvider } from "./lib/locale";
import { discoveryFiles, metadataHtml, staticPaths } from "./lib/seo";

export function renderPages() {
  return staticPaths.map((path) => ({
    path,
    head: metadataHtml(path),
    body: renderToString(
      <LocaleProvider>
        <StaticRouter location={path}>
          <AppRoutes />
        </StaticRouter>
      </LocaleProvider>,
    ),
  }));
}

export { discoveryFiles };

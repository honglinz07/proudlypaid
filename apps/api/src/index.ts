import { CatalogStore } from "./catalog.ts";

function json(value: unknown, status = 200, method = "GET", extra: Record<string, string> = {}) {
  return new Response(method === "HEAD" ? null : JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
      ...extra,
    },
  });
}
const failure = (
  code: string,
  message: string,
  status: number,
  method: string,
  extra?: Record<string, string>,
) => json({ apiVersion: 1, error: { code, message } }, status, method, extra);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const projectPath = /^\/api\/v1\/projects\/([^/]+)\/alternatives$/u.exec(url.pathname);
    if (url.pathname !== "/api/health" && url.pathname !== "/api/v1/search" && !projectPath)
      return failure("NOT_FOUND", "API route not found.", 404, request.method);
    if (request.method !== "GET" && request.method !== "HEAD")
      return failure("METHOD_NOT_ALLOWED", "Use GET or HEAD.", 405, request.method, {
        Allow: "GET, HEAD",
      });
    let query = "";
    let limit = 10;
    let projectId = "";
    if (url.pathname === "/api/v1/search") {
      query = url.searchParams.get("q")?.trim() ?? "";
      const rawLimit = url.searchParams.get("limit");
      if (
        !query ||
        query.length > 120 ||
        [...query].some(
          (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
        ) ||
        url.searchParams.getAll("q").length !== 1 ||
        (rawLimit !== null && !/^(?:[1-9]|1[0-9]|20)$/u.test(rawLimit)) ||
        url.searchParams.getAll("limit").length > 1
      )
        return failure(
          "INVALID_QUERY",
          "Provide q (1–120 characters) and an optional limit (1–20).",
          400,
          request.method,
        );
      limit = rawLimit === null ? 10 : Number(rawLimit);
    } else if (projectPath) {
      try {
        projectId = decodeURIComponent(projectPath[1]);
      } catch {
        return failure("INVALID_PROJECT", "Invalid project ID.", 400, request.method);
      }
      if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/u.test(projectId) || projectId.length > 200)
        return failure(
          "INVALID_PROJECT",
          "Use a project ID returned by search.",
          400,
          request.method,
        );
    }
    try {
      const catalog = await CatalogStore.open(env.DB);
      if (!catalog)
        return failure(
          "CATALOG_NOT_READY",
          "The catalog has not been imported yet.",
          503,
          request.method,
        );
      if (url.pathname === "/api/health")
        return json(
          {
            apiVersion: 1,
            status: "ok",
            service: "closedsources-api",
            search: "name-and-fuzzy",
            catalog: catalog.info,
          },
          200,
          request.method,
        );
      if (url.pathname === "/api/v1/search")
        return json(await catalog.search(query, limit), 200, request.method);
      const result = await catalog.alternatives(projectId);
      return result
        ? json(result, 200, request.method)
        : failure("PROJECT_NOT_FOUND", "No indexed repository has this ID.", 404, request.method);
    } catch {
      console.error(JSON.stringify({ event: "catalog_request_failed" }));
      return failure(
        "CATALOG_UNAVAILABLE",
        "The catalog is temporarily unavailable.",
        503,
        request.method,
      );
    }
  },
} satisfies ExportedHandler<Env>;

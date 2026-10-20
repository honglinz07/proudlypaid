import type { AlternativesResponse, SearchResponse } from "@closedsources/contracts";

export class CatalogApiError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = "CatalogApiError";
    this.code = code;
  }
}
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const count = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const https = (value: unknown) => {
  if (!text(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
};
const links = (value: unknown) => Array.isArray(value) && value.every(https);
const project = (value: unknown) =>
  object(value) &&
  text(value.id) &&
  text(value.name) &&
  text(value.fullName) &&
  https(value.repository) &&
  (value.category === null || text(value.category)) &&
  (value.reviewedOn === null || text(value.reviewedOn)) &&
  (value.license === null ||
    (object(value.license) &&
      text(value.license.label) &&
      https(value.license.url) &&
      text(value.license.scope)));
const info = (value: unknown) =>
  object(value) &&
  text(value.version) &&
  text(value.reviewedOn) &&
  typeof value.projectCount === "number" &&
  Number.isSafeInteger(value.projectCount) &&
  value.projectCount >= 0 &&
  ["curated-only", "local-github-index"].includes(String(value.collectionScope));
function price(value: unknown) {
  if (
    !object(value) ||
    !text(value.plan) ||
    !text(value.configuration) ||
    !text(value.notes) ||
    !https(value.sourceUrl) ||
    !text(value.reviewedOn) ||
    (value.currencyEvidenceUrl !== undefined && !https(value.currencyEvidenceUrl))
  )
    return false;
  if (value.kind === "list-price")
    return (
      typeof value.amount === "number" &&
      Number.isFinite(value.amount) &&
      value.amount >= 0 &&
      typeof value.currency === "string" &&
      /^[A-Z]{3}$/u.test(value.currency) &&
      text(value.unit) &&
      ["month", "year", "one-time"].includes(String(value.period)) &&
      ["annual", "monthly", "one-time"].includes(String(value.billing))
    );
  return (
    ["contact-sales", "usage-based"].includes(String(value.kind)) &&
    value.amount === null &&
    (value.currency === null || text(value.currency)) &&
    (value.unit === null || text(value.unit)) &&
    (value.period === null || ["month", "year", "one-time"].includes(String(value.period))) &&
    (value.billing === null || text(value.billing))
  );
}
function alternative(value: unknown) {
  if (
    !object(value) ||
    !text(value.id) ||
    !text(value.name) ||
    !https(value.homepage) ||
    !Array.isArray(value.prices) ||
    !value.prices.every(price) ||
    !count(value.pendingPriceCount)
  )
    return false;
  const a = value.availability;
  const r = value.relationship;
  return (
    object(a) &&
    ["proprietary-hosted-service", "proprietary-software"].includes(String(a.classification)) &&
    text(a.scope) &&
    text(a.notes) &&
    links(a.evidenceUrls) &&
    text(a.reviewedOn) &&
    object(r) &&
    ["author-claimed", "feature-overlap-reviewed"].includes(String(r.verification)) &&
    text(r.overlap) &&
    text(r.limitations) &&
    links(r.evidenceUrls) &&
    text(r.reviewedOn)
  );
}
function isSearch(value: unknown): value is SearchResponse {
  return (
    object(value) &&
    value.apiVersion === 1 &&
    text(value.query) &&
    ["exact", "substring", "fuzzy", "none"].includes(String(value.match)) &&
    Array.isArray(value.projects) &&
    value.projects.every(project) &&
    (value.preferredProjectId === null ||
      (text(value.preferredProjectId) &&
        value.projects.some((item) => object(item) && item.id === value.preferredProjectId))) &&
    typeof value.truncated === "boolean" &&
    info(value.catalog)
  );
}
function isAlternatives(value: unknown): value is AlternativesResponse {
  return (
    object(value) &&
    value.apiVersion === 1 &&
    project(value.project) &&
    Array.isArray(value.alternatives) &&
    value.alternatives.every(alternative) &&
    count(value.pendingAlternativeCount) &&
    info(value.catalog) &&
    Array.isArray(value.priceGroups) &&
    value.priceGroups.every(
      (group) =>
        object(group) &&
        [group.key, group.currency, group.unit, group.period, group.billing].every(text) &&
        Array.isArray(group.entries) &&
        group.entries.every(
          (entry) =>
            object(entry) &&
            text(entry.productId) &&
            price(entry.price) &&
            object(entry.price) &&
            entry.price.kind === "list-price" &&
            entry.price.currency === group.currency &&
            entry.price.unit === group.unit &&
            entry.price.period === group.period &&
            entry.price.billing === group.billing &&
            Array.isArray(value.alternatives) &&
            value.alternatives.some((item) => object(item) && item.id === entry.productId),
        ),
    )
  );
}
async function getJson<T>(
  url: string,
  signal: AbortSignal,
  validate: (value: unknown) => value is T,
): Promise<T> {
  const response = await fetch(url, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
    headers: { Accept: "application/json" },
  });
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new CatalogApiError("INVALID_RESPONSE");
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new CatalogApiError("INVALID_RESPONSE");
  }
  if (!response.ok)
    throw new CatalogApiError(
      object(value) && object(value.error) && text(value.error.code)
        ? value.error.code
        : "API_ERROR",
    );
  if (!validate(value)) throw new CatalogApiError("INVALID_RESPONSE");
  return value;
}
export const searchProjects = (query: string, signal: AbortSignal) =>
  getJson(`/api/v1/search?q=${encodeURIComponent(query)}`, signal, isSearch);
export const getAlternatives = (id: string, signal: AbortSignal) =>
  getJson(`/api/v1/projects/${encodeURIComponent(id)}/alternatives`, signal, isAlternatives);

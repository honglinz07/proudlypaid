import type {
  Alternative,
  AlternativesResponse,
  CatalogInfo,
  Price,
  PriceGroup,
  Project,
  SearchResponse,
} from "@closedsources/contracts";

type ProjectRow = {
  id: string;
  name: string;
  full_name: string;
  repository: string;
  category: string | null;
  license_json: string | null;
  reviewed_on: string | null;
  terms: string;
};
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid catalog record");
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== "string" || !value) throw new Error("Invalid catalog string");
  return value;
}
function safeLink(value: string) {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password;
}
function links(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string" && safeLink(item)))
    throw new Error("Invalid catalog links");
  return value;
}
function link(value: unknown) {
  const text = string(value);
  if (!safeLink(text)) throw new Error("Invalid catalog URL");
  return text;
}
function projectFrom(row: ProjectRow): Project {
  const license = row.license_json ? record(JSON.parse(row.license_json)) : null;
  return {
    id: row.id,
    name: row.name,
    fullName: row.full_name,
    repository: link(row.repository),
    category: row.category,
    license: license
      ? { label: string(license.label), url: link(license.url), scope: string(license.scope) }
      : null,
    reviewedOn: row.reviewed_on,
  };
}
export function normalizeQuery(input: string): string {
  let value = input.normalize("NFKC").trim().toLowerCase().replace(/\s+/gu, " ");
  if (value.startsWith("https://github.com/")) {
    const url = new URL(value);
    if (!url.username && !url.password && !url.search && !url.hash)
      value = url.pathname
        .slice(1)
        .replace(/\/$/u, "")
        .replace(/\.git$/u, "");
  }
  return value;
}
function editDistance(left: string, right: string) {
  let previous = Array.from({ length: right.length + 1 }, (_, i) => i);
  let beforePrevious = previous;
  for (let i = 1; i <= left.length; i++) {
    const current = [i];
    for (let j = 1; j <= right.length; j++) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
      if (i > 1 && j > 1 && left[i - 1] === right[j - 2] && left[i - 2] === right[j - 1])
        current[j] = Math.min(current[j], beforePrevious[j - 2] + 1);
    }
    beforePrevious = previous;
    previous = current;
  }
  return previous[right.length];
}
function priceFrom(value: unknown): Price | null {
  const price = record(value);
  if (price.verification !== "verified") return null;
  const kind = price.kind;
  if (kind !== "list-price" && kind !== "contact-sales" && kind !== "usage-based")
    throw new Error("Invalid price kind");
  const period = price.period;
  if (period !== null && period !== "month" && period !== "year" && period !== "one-time")
    throw new Error("Invalid price period");
  const currency = price.currency;
  if (currency !== null && (typeof currency !== "string" || !/^[A-Z]{3}$/u.test(currency)))
    throw new Error("Invalid price currency");
  const amount = price.amount;
  const billing = price.billing === null ? null : string(price.billing);
  const unit = price.unit === null ? null : string(price.unit);
  if (kind === "list-price") {
    if (
      typeof amount !== "number" ||
      !Number.isFinite(amount) ||
      amount < 0 ||
      !currency ||
      !period ||
      !unit ||
      !billing ||
      !["monthly", "annual", "one-time"].includes(billing)
    )
      throw new Error("Invalid verified price");
  } else if (amount !== null) throw new Error("Nonfixed price must be null");
  return {
    plan: string(price.plan),
    kind,
    amount,
    currency,
    unit,
    period,
    billing,
    configuration: string(price.configuration),
    notes: string(price.notes),
    sourceUrl: link(price.sourceUrl),
    ...(price.currencyEvidenceUrl === undefined
      ? {}
      : { currencyEvidenceUrl: link(price.currencyEvidenceUrl) }),
    reviewedOn: string(price.reviewedOn),
  };
}
function alternativeFrom(productJson: string, relationshipJson: string): Alternative {
  const product = record(JSON.parse(productJson));
  const availability = record(product.sourceAvailability);
  const classification = availability.classification;
  if (
    availability.verification !== "official-reviewed" ||
    (classification !== "proprietary-hosted-service" && classification !== "proprietary-software")
  )
    throw new Error("Unreviewed product");
  const relation = record(JSON.parse(relationshipJson));
  const verification = relation.verification;
  if (verification !== "author-claimed" && verification !== "feature-overlap-reviewed")
    throw new Error("Invalid relationship verification");
  if (!Array.isArray(product.pricing)) throw new Error("Invalid pricing observations");
  const prices = product.pricing.map(priceFrom).filter((price) => price !== null);
  return {
    id: string(product.id),
    name: string(product.name),
    homepage: link(product.homepage),
    availability: {
      classification,
      scope: string(availability.scope),
      evidenceUrls: links(availability.evidenceUrls),
      notes: string(availability.notes),
      reviewedOn: string(availability.reviewedOn),
    },
    relationship: {
      verification,
      overlap: string(relation.overlap),
      limitations: string(relation.limitations),
      evidenceUrls: links(relation.evidenceUrls),
      reviewedOn: string(relation.reviewedOn),
    },
    prices,
    pendingPriceCount: product.pricing.length - prices.length,
  };
}
/** Advertised unit components only: this never computes a complete product bill. */
export function groupPrices(alternatives: Alternative[]): PriceGroup[] {
  const groups = new Map<string, PriceGroup>();
  for (const product of alternatives)
    for (const price of product.prices) {
      if (
        price.kind !== "list-price" ||
        price.amount === null ||
        !price.currency ||
        !price.period ||
        !price.unit ||
        !price.billing
      )
        continue;
      const key = JSON.stringify([price.currency, price.unit, price.period, price.billing]);
      let group = groups.get(key);
      if (!group) {
        group = {
          key,
          currency: price.currency,
          unit: price.unit,
          period: price.period,
          billing: price.billing,
          entries: [],
        };
        groups.set(key, group);
      }
      group.entries.push({ productId: product.id, price });
    }
  for (const group of groups.values())
    group.entries.sort(
      (a, b) =>
        (b.price.amount ?? 0) - (a.price.amount ?? 0) ||
        a.productId.localeCompare(b.productId) ||
        a.price.plan.localeCompare(b.price.plan),
    );
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
}
export class CatalogStore {
  private readonly db: D1Database;
  readonly info: CatalogInfo;
  constructor(db: D1Database, info: CatalogInfo) {
    this.db = db;
    this.info = info;
  }
  static async open(db: D1Database) {
    const row = await db
      .prepare(
        "SELECT s.* FROM catalog_state c JOIN catalog_snapshots s ON c.version=s.version WHERE c.id=1",
      )
      .first<{
        version: string;
        reviewed_on: string;
        project_count: number;
        collection_scope: CatalogInfo["collectionScope"];
      }>();
    return row
      ? new CatalogStore(db, {
          version: row.version,
          reviewedOn: row.reviewed_on,
          projectCount: row.project_count,
          collectionScope: row.collection_scope,
        })
      : null;
  }
  async search(query: string, limit: number): Promise<SearchResponse> {
    const normalized = normalizeQuery(query);
    const exact = await this.db
      .prepare(
        "SELECT p.* FROM project_terms t JOIN projects p ON p.version=t.version AND p.id=t.project_id WHERE t.version=? AND t.term=? ORDER BY p.reviewed_on IS NULL,p.id LIMIT ?",
      )
      .bind(this.info.version, normalized, limit + 1)
      .all<ProjectRow>();
    let rows = exact.results;
    let match: SearchResponse["match"] = rows.length ? "exact" : "none";
    if (!rows.length && [...normalized].length >= 3) {
      const phrase = `"${normalized.replaceAll('"', '""')}"`;
      const found = await this.db
        .prepare(
          "SELECT p.* FROM project_search f JOIN projects p ON p.rowid=f.rowid WHERE project_search MATCH ? AND p.version=? ORDER BY p.reviewed_on IS NULL,bm25(project_search),p.id LIMIT ?",
        )
        .bind(phrase, this.info.version, limit + 1)
        .all<ProjectRow>();
      rows = found.results;
      if (rows.length) match = "substring";
      else if (normalized.length >= 4 && normalized.length <= 64) {
        const chars = [...normalized];
        const grams = [
          ...new Set(chars.slice(0, -2).map((_, i) => chars.slice(i, i + 3).join(""))),
        ].slice(0, 24);
        const expression = grams.map((gram) => `"${gram.replaceAll('"', '""')}"`).join(" OR ");
        const candidates = await this.db
          .prepare(
            "SELECT p.* FROM project_search f JOIN projects p ON p.rowid=f.rowid WHERE project_search MATCH ? AND p.version=? ORDER BY bm25(project_search),p.id LIMIT 60",
          )
          .bind(expression, this.info.version)
          .all<ProjectRow>();
        const threshold = Math.max(1, Math.floor(normalized.length / 4));
        rows = candidates.results
          .map((row) => ({
            row,
            distance: Math.min(
              ...row.terms
                .split("\n")
                .map((term) =>
                  Math.abs(term.length - normalized.length) > threshold
                    ? 1000
                    : editDistance(term, normalized),
                ),
            ),
          }))
          .filter(({ distance }) => distance <= threshold)
          .sort(
            (a, b) =>
              a.distance - b.distance ||
              Number(a.row.reviewed_on === null) - Number(b.row.reviewed_on === null) ||
              a.row.id.localeCompare(b.row.id),
          )
          .map(({ row }) => row)
          .slice(0, limit + 1);
        if (rows.length) match = "fuzzy";
      }
    }
    const projects = rows.slice(0, limit).map(projectFrom);
    const reviewed = projects.filter((project) => project.reviewedOn !== null);
    const preferredProjectId =
      rows.length <= limit && match === "exact" && reviewed.length === 1
        ? reviewed[0].id
        : match !== "fuzzy" && rows.length === 1
          ? projects[0].id
          : null;
    return {
      apiVersion: 1,
      query,
      match,
      projects,
      preferredProjectId,
      truncated: rows.length > limit,
      catalog: this.info,
    };
  }
  async alternatives(id: string): Promise<AlternativesResponse | null> {
    const project = await this.db
      .prepare("SELECT * FROM projects WHERE version=? AND id=?")
      .bind(this.info.version, id)
      .first<ProjectRow>();
    if (!project) return null;
    const [reviewed, pending] = await this.db.batch<{
      product_json: string;
      relationship_json: string;
      count: number;
    }>([
      this.db
        .prepare(
          "SELECT p.data_json AS product_json,r.data_json AS relationship_json FROM relationships r JOIN products p ON p.version=r.version AND p.id=r.product_id WHERE r.version=? AND r.project_id=? AND p.verification='official-reviewed' ORDER BY p.id",
        )
        .bind(this.info.version, id),
      this.db
        .prepare(
          "SELECT COUNT(*) AS count FROM relationships r JOIN products p ON p.version=r.version AND p.id=r.product_id WHERE r.version=? AND r.project_id=? AND p.verification='needs-review'",
        )
        .bind(this.info.version, id),
    ]);
    const alternatives = reviewed.results.map((row) =>
      alternativeFrom(row.product_json, row.relationship_json),
    );
    return {
      apiVersion: 1,
      project: projectFrom(project),
      alternatives,
      priceGroups: groupPrices(alternatives),
      pendingAlternativeCount: pending.results[0].count,
      catalog: this.info,
    };
  }
}

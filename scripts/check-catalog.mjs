import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const catalogUrl = new URL("../data/catalog/pilot.json", import.meta.url);
const nonempty = (value) => typeof value === "string" && value.trim().length > 0;
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const records = (value) => (Array.isArray(value) ? value : []);
const calendarDate = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;

export function validateCatalog(catalog) {
  const errors = [];
  const require = (condition, message) => {
    if (!condition) errors.push(message);
  };
  const url = (value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "https:" && !parsed.username && !parsed.password;
    } catch {
      return false;
    }
  };
  const urls = (values) => Array.isArray(values) && values.length > 0 && values.every(url);
  if (!object(catalog)) return ["Catalog must be an object."];
  require(catalog.schemaVersion === 1, "Unsupported schemaVersion.");
  require(catalog.status === "research-pilot", "Pilot must remain labeled research-pilot.");
  require(calendarDate(catalog.reviewedOn), "reviewedOn must be a valid ISO calendar date.");
  const reviewDate = (entry, label) => {
    require(calendarDate(
      entry.reviewedOn,
    ), `${label}: reviewedOn must be a valid ISO calendar date.`);
    require(!calendarDate(entry.reviewedOn) ||
      !calendarDate(catalog.reviewedOn) ||
      entry.reviewedOn <= catalog.reviewedOn, `${label}: review date exceeds catalog review date.`);
  };

  const indexes = {};
  for (const group of ["projects", "products", "relationships"]) {
    const entries = catalog[group];
    require(Array.isArray(entries) && entries.length > 0, `${group} must be a nonempty array.`);
    indexes[group] = new Set();
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!object(entry)) {
        errors.push(`${group} contains a non-object record.`);
        continue;
      }
      require(typeof entry.id === "string" &&
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id), `${group}: invalid id.`);
      require(!indexes[group].has(entry.id), `${group}: duplicate id ${entry.id}.`);
      indexes[group].add(entry.id);
      reviewDate(entry, `${group} ${entry.id}`);
    }
  }

  for (const project of records(catalog.projects)) {
    if (!object(project)) continue;
    const label = `Project ${project.id}`;
    require(nonempty(project.name) &&
      nonempty(project.category), `${label}: name and category required.`);
    require(Array.isArray(project.aliases) &&
      project.aliases.every(nonempty), `${label}: invalid aliases.`);
    require(url(project.repository), `${label}: HTTPS repository required.`);
    require(object(project.license) &&
      nonempty(project.license.label) &&
      nonempty(project.license.scope) &&
      url(project.license.url), `${label}: scoped license evidence required.`);
  }

  for (const product of records(catalog.products)) {
    if (!object(product)) continue;
    const label = `Product ${product.id}`;
    require(nonempty(product.name) &&
      url(product.homepage), `${label}: name and homepage required.`);
    const availability = product.sourceAvailability;
    if (!object(availability)) errors.push(`${label}: sourceAvailability required.`);
    else {
      reviewDate(availability, `${label} availability`);
      require(["official-reviewed", "needs-review"].includes(
        availability.verification,
      ), `${label}: invalid availability verification.`);
      require([
        "proprietary-hosted-service",
        "proprietary-software",
        "proprietary-service-candidate",
      ].includes(availability.classification), `${label}: invalid classification.`);
      require(nonempty(availability.scope) &&
        nonempty(availability.notes) &&
        urls(availability.evidenceUrls), `${label}: scoped availability evidence required.`);
      require(availability.verification !== "needs-review" ||
        availability.classification ===
          "proprietary-service-candidate", `${label}: unreviewed classification must remain a candidate.`);
      require(availability.verification !== "official-reviewed" ||
        ["proprietary-hosted-service", "proprietary-software"].includes(
          availability.classification,
        ), `${label}: reviewed classification must specify proprietary software or a hosted service.`);
    }
    require(Array.isArray(product.pricing) &&
      product.pricing.length > 0, `${label}: pricing observations required.`);
    for (const price of Array.isArray(product.pricing) ? product.pricing : []) {
      if (!object(price)) {
        errors.push(`${label}: invalid pricing record.`);
        continue;
      }
      const prefix = `${label}, ${price.plan}`;
      reviewDate(price, prefix);
      if (price.currencyEvidenceUrl !== undefined) {
        require(url(price.currencyEvidenceUrl), `${prefix}: invalid currency evidence URL.`);
      }
      if (price.conflictingObservationUrl !== undefined) {
        require(url(
          price.conflictingObservationUrl,
        ), `${prefix}: invalid conflicting observation URL.`);
        require(price.verification ===
          "needs-review", `${prefix}: conflicting observations require review.`);
      }
      require(nonempty(price.plan) &&
        nonempty(price.configuration) &&
        nonempty(price.notes) &&
        url(price.sourceUrl), `${prefix}: plan, configuration, notes and source required.`);
      require(["verified", "needs-review"].includes(
        price.verification,
      ), `${prefix}: invalid price verification.`);
      require(["list-price", "contact-sales", "usage-based", "unavailable"].includes(
        price.kind,
      ), `${prefix}: invalid price kind.`);
      if (price.kind === "list-price") {
        require(typeof price.amount === "number" &&
          Number.isFinite(price.amount) &&
          price.amount >= 0, `${prefix}: invalid numeric amount.`);
        const knownCurrency =
          typeof price.currency === "string" && /^[A-Z]{3}$/.test(price.currency);
        require(knownCurrency ||
          (price.currency === null &&
            price.verification === "needs-review" &&
            nonempty(
              price.currencySymbol,
            )), `${prefix}: confirmed currency or pending currency symbol required.`);
        require(nonempty(price.unit) &&
          ["month", "year", "one-time"].includes(
            price.period,
          ), `${prefix}: currency, unit and period required.`);
        require(["annual", "monthly", "one-time", "unknown"].includes(
          price.billing,
        ), `${prefix}: invalid billing.`);
        require(price.verification !== "verified" ||
          price.billing !== "unknown", `${prefix}: unknown billing cannot be verified.`);
      } else if (["contact-sales", "usage-based", "unavailable"].includes(price.kind)) {
        require(price.amount === null, `${prefix}: nonfixed prices must use null, never zero.`);
        if (price.kind === "unavailable") {
          require(price.verification ===
            "needs-review", `${prefix}: unavailable price must remain unverified.`);
        }
      }
    }
  }

  const pairs = new Set();
  for (const relationship of records(catalog.relationships)) {
    if (!object(relationship)) continue;
    const label = `Relationship ${relationship.id}`;
    if (relationship.discoveryEvidenceIds !== undefined) {
      require(Array.isArray(relationship.discoveryEvidenceIds) &&
        relationship.discoveryEvidenceIds.length > 0 &&
        relationship.discoveryEvidenceIds.every(
          (id) => typeof id === "string" && /^[a-f0-9]{64}$/.test(id),
        ) &&
        new Set(relationship.discoveryEvidenceIds).size ===
          relationship.discoveryEvidenceIds.length, `${label}: invalid discovery evidence IDs.`);
    }
    require(indexes.projects.has(relationship.projectId), `${label}: unknown project.`);
    require(indexes.products.has(relationship.productId), `${label}: unknown product.`);
    const pair = `${relationship.projectId}:${relationship.productId}`;
    require(!pairs.has(pair), `${label}: duplicate project/product pair.`);
    pairs.add(pair);
    require(["author-claimed", "feature-overlap-reviewed"].includes(
      relationship.verification,
    ), `${label}: invalid relationship verification.`);
    require(url(relationship.discoveryUrl) &&
      urls(relationship.evidenceUrls), `${label}: discovery and evidence URLs required.`);
    require(nonempty(relationship.overlap) &&
      nonempty(relationship.limitations), `${label}: overlap and limitations required.`);
  }
  return errors;
}

export async function readCatalog() {
  return JSON.parse(await readFile(catalogUrl, "utf8"));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const catalog = await readCatalog();
  const errors = validateCatalog(catalog);
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log(
      `Catalog valid: ${catalog.projects.length} projects, ${catalog.products.length} products, ${catalog.relationships.length} relationships.`,
    );
  }
}

/** Versioned, runtime-independent JSON contract shared by both deployment profiles. */
export interface Project {
  id: string;
  name: string;
  fullName: string;
  repository: string;
  category: string | null;
  license: { label: string; url: string; scope: string } | null;
  reviewedOn: string | null;
}

export interface CatalogInfo {
  version: string;
  reviewedOn: string;
  projectCount: number;
  collectionScope: "curated-only" | "local-github-index";
}

export interface SearchResponse {
  apiVersion: 1;
  query: string;
  match: "exact" | "substring" | "fuzzy" | "none";
  projects: Project[];
  preferredProjectId: string | null;
  truncated: boolean;
  catalog: CatalogInfo;
}

export interface Price {
  plan: string;
  kind: "list-price" | "contact-sales" | "usage-based";
  amount: number | null;
  currency: string | null;
  unit: string | null;
  period: "month" | "year" | "one-time" | null;
  billing: string | null;
  configuration: string;
  notes: string;
  sourceUrl: string;
  currencyEvidenceUrl?: string;
  reviewedOn: string;
}

export interface Alternative {
  id: string;
  name: string;
  homepage: string;
  availability: {
    classification: "proprietary-hosted-service" | "proprietary-software";
    scope: string;
    evidenceUrls: string[];
    notes: string;
    reviewedOn: string;
  };
  relationship: {
    verification: "author-claimed" | "feature-overlap-reviewed";
    overlap: string;
    limitations: string;
    evidenceUrls: string[];
    reviewedOn: string;
  };
  prices: Price[];
  pendingPriceCount: number;
}

export interface PriceGroup {
  key: string;
  currency: string;
  unit: string;
  period: string;
  billing: string;
  entries: { productId: string; price: Price }[];
}

export interface AlternativesResponse {
  apiVersion: 1;
  project: Project;
  alternatives: Alternative[];
  priceGroups: PriceGroup[];
  pendingAlternativeCount: number;
  catalog: CatalogInfo;
}

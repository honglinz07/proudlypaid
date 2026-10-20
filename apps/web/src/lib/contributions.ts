export function normalizeRepositoryUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    const parts = url.pathname.replace(/\/$/u, "").split("/").filter(Boolean);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "github.com" ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      parts.length !== 2 ||
      !/^[a-z\d][a-z\d-]{0,38}$/iu.test(parts[0]) ||
      !/^[a-z\d_.-]{1,100}$/iu.test(parts[1]) ||
      /^\.+$/u.test(parts[1]) ||
      url.pathname !== `/${parts.join("/")}${url.pathname.endsWith("/") ? "/" : ""}`
    )
      return null;
    return `https://github.com/${parts.join("/")}`;
  } catch {
    return null;
  }
}

export function contributionPath(project = ""): string {
  const query = new URLSearchParams();
  if (project.trim()) query.set("project", project.trim().slice(0, 200));
  return `/contribute${query.size ? `?${query}` : ""}`;
}

export function contributionIssueUrl(repository: unknown): string | null {
  const url = normalizeRepositoryUrl(repository);
  return url ? `${url}/issues/new?template=catalog_suggestion.md` : null;
}

export function isPublicSourceUrl(value: string): boolean {
  if (!value.trim()) return true;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

type Contribution = { project: string; product: string; source: string; notes: string };
export function formatContribution(input: Contribution): string {
  const project = input.project.trim();
  if (
    !project ||
    project.length > 200 ||
    input.product.length > 160 ||
    input.source.length > 1000 ||
    input.notes.length > 3000
  )
    throw new Error("Invalid contribution length");
  if (!isPublicSourceUrl(input.source)) throw new Error("Use an HTTPS source without credentials");
  return `${[
    "## Open-source project",
    project,
    "## Paid alternative or correction",
    input.product.trim() || "To be researched",
    "## Official source",
    input.source.trim() || "To be researched",
    "## Evidence and limitations",
    input.notes.trim() ||
      "Please review the project scope, product licensing and billing configuration.",
    "---",
    "Submitted as a research lead. This is not a verified catalog record.",
  ].join("\n\n")}\n`;
}

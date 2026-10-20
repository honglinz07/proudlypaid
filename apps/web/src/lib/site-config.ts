import { normalizeRepositoryUrl } from "./contributions";

export const repositoryUrl = normalizeRepositoryUrl(
  import.meta.env.VITE_REPOSITORY_URL ?? "https://github.com/honglinz07/proudlypaid",
);

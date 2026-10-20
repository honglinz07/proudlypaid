import { createHash, randomUUID } from "node:crypto";
import { open, mkdir, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const API_ORIGIN = "https://api.github.com";
const MIN_STARS = 1000;
const SAFE_LEAF_COUNT = 800;
const PER_PAGE = 100;
const MAX_RETRIES = 3;
const MIN_CREATED = "1970-01-01T00:00:00Z";
const MAX_CREATED = "2970-12-31T23:59:59Z";
const DEFAULT_OUTPUT = path.resolve(".local/github-collection");

export class CollectionPausedError extends Error {
  constructor(message, retryAt = null) {
    super(message);
    this.name = "CollectionPausedError";
    this.retryAt = retryAt;
  }
}

export class GitHubApiError extends Error {
  constructor(message, { status, retryAt = null } = {}) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
    this.retryAt = retryAt;
  }
}

export class GitHubNetworkError extends GitHubApiError {
  constructor(error) {
    const cause = error?.cause ?? error;
    const errors = [error, cause, ...(Array.isArray(cause?.errors) ? cause.errors : [])];
    const codes = [
      ...new Set(
        errors
          .map((item) => item?.code)
          .filter((code) => typeof code === "string" && /^[A-Z0-9_]{1,64}$/u.test(code)),
      ),
    ];
    const detail = codes.length
      ? codes.join(", ")
      : ["AbortError", "TimeoutError"].includes(error?.name)
        ? error.name
        : "cause unavailable";
    super(
      `Network request failed (${detail}); collection stopped. Check connectivity and resume from the saved checkpoint.`,
    );
    this.name = "GitHubNetworkError";
    this.cause = error;
  }
}

export function buildRepositorySearchUrl(segment, page = 1) {
  const queryParts = [`stars:${segment.starsMin}..${segment.starsMax}`, "fork:true", "is:public"];
  if (segment.createdSince && segment.createdBefore) {
    // Repeated created qualifiers do not intersect; express the half-open interval as one range.
    const inclusiveEnd = new Date(Date.parse(segment.createdBefore) - 1000)
      .toISOString()
      .replace(".000Z", "Z");
    queryParts.push(`created:${segment.createdSince}..${inclusiveEnd}`);
  } else if (segment.createdSince) {
    queryParts.push(`created:>=${segment.createdSince}`);
  } else if (segment.createdBefore) {
    queryParts.push(`created:<${segment.createdBefore}`);
  }

  const url = new URL("/search/repositories", API_ORIGIN);
  url.searchParams.set("q", queryParts.join(" "));
  url.searchParams.set("per_page", String(PER_PAGE));
  url.searchParams.set("page", String(page));
  url.searchParams.set("sort", "stars");
  url.searchParams.set("order", "desc");
  return url;
}

export function splitSearchSegment(segment) {
  if (segment.starsMin < segment.starsMax) {
    const middle = Math.floor((segment.starsMin + segment.starsMax) / 2);
    return [
      {
        starsMin: segment.starsMin,
        starsMax: middle,
        createdSince: segment.createdSince ?? null,
        createdBefore: segment.createdBefore ?? null,
      },
      {
        starsMin: middle + 1,
        starsMax: segment.starsMax,
        createdSince: segment.createdSince ?? null,
        createdBefore: segment.createdBefore ?? null,
      },
    ];
  }

  const lower = Date.parse(segment.createdSince ?? MIN_CREATED);
  const upper = Date.parse(segment.createdBefore ?? MAX_CREATED);
  if (!Number.isFinite(lower) || !Number.isFinite(upper) || upper - lower < 2000) {
    return null;
  }

  const middleSeconds = Math.floor((lower + upper) / 2000);
  const middle = new Date(middleSeconds * 1000).toISOString().replace(".000Z", "Z");
  if (middle === segment.createdSince || middle === segment.createdBefore) return null;

  return [
    {
      starsMin: segment.starsMin,
      starsMax: segment.starsMax,
      createdSince: segment.createdSince ?? MIN_CREATED,
      createdBefore: middle,
    },
    {
      starsMin: segment.starsMin,
      starsMax: segment.starsMax,
      createdSince: middle,
      createdBefore: segment.createdBefore ?? MAX_CREATED,
    },
  ];
}

export function parseNextLink(linkHeader) {
  if (!linkHeader) return null;
  for (const match of linkHeader.matchAll(/<([^>]+)>\s*;\s*rel="?([^";,]+)"?/gu)) {
    if (match[2].trim() === "next") return match[1];
  }
  return null;
}

export function decodeBase64FileContent(content, expectedSize) {
  if (typeof content !== "string") throw new Error("README response has no encoded file content.");
  const normalized = content.replace(/\s/gu, "");
  const padding = normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0;
  if (
    normalized.length % 4 !== 0 ||
    /[^A-Za-z0-9+/]/u.test(normalized.slice(0, normalized.length - padding))
  ) {
    throw new Error("README response contains invalid Base64 data.");
  }
  const bytes = Buffer.from(normalized, "base64");
  if (Number.isSafeInteger(expectedSize) && bytes.byteLength !== expectedSize) {
    throw new Error(
      `README size mismatch: expected ${expectedSize} bytes, received ${bytes.byteLength}.`,
    );
  }
  return bytes;
}

export function safeReadmeFilename(filename) {
  const basename = path.posix.basename(String(filename ?? "README.md").replaceAll("\\", "/"));
  const cleaned = basename
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._-]/gu, "_")
    .replace(/^\.+$/u, "_")
    .slice(0, 120);
  const windowsDeviceName = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu;
  if (!cleaned || cleaned === "." || cleaned === ".." || windowsDeviceName.test(cleaned)) {
    return "README.md";
  }
  return cleaned;
}

export function makeInitialState(now = new Date().toISOString()) {
  return {
    schemaVersion: 1,
    status: "not_started",
    phase: "seed",
    pass: 1,
    target: { starsAtLeast: MIN_STARS, visibility: "public", includeForks: true },
    startedAt: now,
    updatedAt: now,
    completedAt: null,
    retryAt: null,
    maxStars: null,
    segments: [],
    passes: [],
    lastError: null,
  };
}

async function atomicWrite(filePath, bytes) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    const handle = await open(temporaryPath, "wx");
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporaryPath, filePath);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }
}

async function appendEvents(filePath, events) {
  if (!events.length) return;
  await mkdir(path.dirname(filePath), { recursive: true });
  const handle = await open(filePath, "a");
  try {
    await handle.writeFile(`${events.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function readLedger(filePath) {
  let contents;
  try {
    contents = await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return new Map();
    throw error;
  }

  const completeLength = contents.lastIndexOf("\n") + 1;
  if (completeLength !== contents.length) {
    const handle = await open(filePath, "r+");
    try {
      await handle.truncate(completeLength);
      await handle.sync();
    } finally {
      await handle.close();
    }
    contents = contents.slice(0, completeLength);
  }

  const repositories = new Map();
  for (const line of contents.split("\n")) {
    if (!line) continue;
    const event = JSON.parse(line);
    repositories.set(String(event.id), event);
  }
  return repositories;
}

async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

function parseLinkNext(response, currentUrl) {
  const next = parseNextLink(response.headers.get("link"));
  if (!next) return null;
  const nextUrl = new URL(next, currentUrl);
  if (nextUrl.origin !== API_ORIGIN || nextUrl.pathname !== "/search/repositories") {
    throw new Error("GitHub returned an unexpected pagination URL; refusing to follow it.");
  }
  return nextUrl.href;
}

export class GitHubApiClient {
  constructor({
    token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "",
    fetchImpl = fetch,
    maxRequests = Infinity,
    sleepImpl = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  } = {}) {
    this.token = token;
    this.fetchImpl = fetchImpl;
    this.maxRequests = maxRequests;
    this.requestsMade = 0;
    this.sleep = sleepImpl;
  }

  async request(url, { allowStatuses = [], retryAt = null } = {}) {
    const target = new URL(url);
    if (target.origin !== API_ORIGIN)
      throw new Error("Refusing to send GitHub credentials outside api.github.com.");

    for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
      if (this.requestsMade >= this.maxRequests) {
        throw new CollectionPausedError(
          `Reached this run's request budget (${this.maxRequests}).`,
          retryAt,
        );
      }
      this.requestsMade += 1;
      const headers = {
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "closedsources-open-source-collector",
      };
      if (this.token) headers.authorization = `Bearer ${this.token}`;

      let response;
      try {
        response = await this.fetchImpl(target, { headers, signal: AbortSignal.timeout(30_000) });
      } catch (error) {
        if (attempt === MAX_RETRIES - 1) throw new GitHubNetworkError(error);
        await this.sleep(1000 * 2 ** attempt);
        continue;
      }

      if (response.ok || allowStatuses.includes(response.status)) return response;
      if (response.status === 401)
        throw new GitHubApiError("GitHub rejected the credentials (HTTP 401).", { status: 401 });

      if (response.status === 403 || response.status === 429) {
        const retryAfterHeader = Number(response.headers.get("retry-after"));
        const resetHeader = Number(response.headers.get("x-ratelimit-reset"));
        const remainingHeader = response.headers.get("x-ratelimit-remaining");
        const body = await response
          .clone()
          .json()
          .catch(() => null);
        const rateLimited =
          response.status === 429 ||
          retryAfterHeader > 0 ||
          remainingHeader === "0" ||
          /rate limit/iu.test(body?.message ?? "");
        if (!rateLimited) {
          throw new GitHubApiError(`GitHub denied this request (HTTP ${response.status}).`, {
            status: response.status,
          });
        }
        const retryTime =
          Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
            ? Date.now() + retryAfterHeader * 1000
            : Number(response.headers.get("x-ratelimit-remaining")) === 0 &&
                Number.isFinite(resetHeader) &&
                resetHeader > 0
              ? resetHeader * 1000
              : Date.now() + 60_000;
        throw new CollectionPausedError(
          `GitHub rate limited this request (HTTP ${response.status}); resume after ${new Date(retryTime).toISOString()}.`,
          new Date(retryTime).toISOString(),
        );
      }

      if (response.status >= 500 && attempt < MAX_RETRIES - 1) {
        await this.sleep(1000 * 2 ** attempt);
        continue;
      }

      throw new GitHubApiError(`GitHub API request failed (HTTP ${response.status}).`, {
        status: response.status,
      });
    }
    throw new GitHubApiError("GitHub API request exhausted its retry limit.");
  }

  async json(url, options) {
    const response = await this.request(url, options);
    if (options?.allowStatuses?.includes(response.status)) return { response, data: null };
    let data;
    try {
      data = await response.json();
    } catch {
      throw new GitHubApiError("GitHub returned malformed JSON.", { status: response.status });
    }
    return { response, data };
  }
}

function makeSegmentId(pass, segment) {
  return [
    pass,
    segment.starsMin,
    segment.starsMax,
    segment.createdSince ?? "all-from-start",
    segment.createdBefore ?? "all-to-end",
  ].join(":");
}

function makeSegment(pass, range) {
  return {
    id: makeSegmentId(pass, range),
    ...range,
    status: "pending",
    nextUrl: null,
    expectedCount: null,
    receivedCount: 0,
    retries: 0,
    startedAt: null,
    completedAt: null,
    error: null,
  };
}

function sortUniqueRepositories(repositories) {
  return [...repositories.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function summaryFor(state, repositories) {
  const counts = {
    total: repositories.size,
    downloaded: 0,
    empty: 0,
    missing: 0,
    unavailable: 0,
    error: 0,
    pending: 0,
  };
  for (const repository of repositories.values()) {
    const status = repository.readmeStatus ?? "pending";
    if (Object.hasOwn(counts, status)) counts[status] += 1;
    else counts.pending += 1;
  }
  const currentSegments = state?.segments ?? [];
  return {
    status: state?.status ?? "not_started",
    phase: state?.phase ?? null,
    pass: state?.pass ?? 0,
    target: state?.target ?? { starsAtLeast: MIN_STARS, visibility: "public", includeForks: true },
    startedAt: state?.startedAt ?? null,
    updatedAt: state?.updatedAt ?? null,
    completedAt: state?.completedAt ?? null,
    retryAt: state?.retryAt ?? null,
    repositories: counts,
    segments: {
      completed: currentSegments.filter((segment) => segment.status === "completed").length,
      split: currentSegments.filter((segment) => segment.status === "split").length,
      pending: currentSegments.filter(
        (segment) => segment.status === "pending" || segment.status === "processing",
      ).length,
      unresolved: currentSegments.filter((segment) => segment.status === "unresolved").length,
      total: currentSegments.length,
    },
    passes: state?.passes ?? [],
    requestsInThisRun: state?.requestsInThisRun ?? 0,
    lastError: state?.lastError ?? null,
  };
}

export class GitHubCollector {
  constructor({
    output = DEFAULT_OUTPUT,
    client = new GitHubApiClient(),
    now = () => new Date(),
  } = {}) {
    this.output = path.resolve(output);
    this.statePath = path.join(this.output, "run.json");
    this.ledgerPath = path.join(this.output, "repositories.jsonl");
    this.indexPath = path.join(this.output, "index.jsonl");
    this.reportPath = path.join(this.output, "report.json");
    this.client = client;
    this.now = now;
    this.state = null;
    this.repositories = new Map();
    this.processedReadmes = new Set();
  }

  timestamp() {
    return this.now().toISOString();
  }

  async load() {
    await mkdir(this.output, { recursive: true });
    this.state = await readJson(this.statePath, null);
    if (!this.state) this.state = makeInitialState(this.timestamp());
    if (this.state.schemaVersion !== 1)
      throw new Error("Unsupported GitHub collector checkpoint schema.");
    this.repositories = await readLedger(this.ledgerPath);
    return this;
  }

  async saveState() {
    this.state.updatedAt = this.timestamp();
    this.state.requestsInThisRun = this.client.requestsMade;
    await atomicWrite(this.statePath, `${JSON.stringify(this.state, null, 2)}\n`);
  }

  async recordRepositories(items) {
    const updates = [];
    const observedAt = this.timestamp();
    for (const item of items) {
      if (
        !Number.isSafeInteger(item?.id) ||
        typeof item.full_name !== "string" ||
        typeof item.html_url !== "string"
      ) {
        throw new Error(
          "GitHub returned a repository result without a stable ID, full name, or canonical URL.",
        );
      }
      const id = String(item.id);
      const previous = this.repositories.get(id);
      const updated = {
        ...(previous ?? {}),
        id,
        name: item.full_name,
        url: item.html_url,
        starsObserved: Number.isSafeInteger(item.stargazers_count)
          ? item.stargazers_count
          : (previous?.starsObserved ?? null),
        observedAt,
        createdAt: item.created_at ?? previous?.createdAt ?? null,
        defaultBranch: item.default_branch ?? previous?.defaultBranch ?? null,
        readmeStatus: previous?.readmeStatus ?? "pending",
        readmePath: previous?.readmePath ?? null,
        readmeBytes: previous?.readmeBytes ?? null,
        readmeSha256: previous?.readmeSha256 ?? null,
        readmeBlobSha: previous?.readmeBlobSha ?? null,
        readmeOriginalName: previous?.readmeOriginalName ?? null,
        readmeSourcePath: previous?.readmeSourcePath ?? null,
        attempts: previous?.attempts ?? 0,
        error: previous?.error ?? null,
      };
      if (
        !previous ||
        previous.name !== updated.name ||
        previous.url !== updated.url ||
        previous.starsObserved !== updated.starsObserved ||
        previous.readmeStatus === "pending"
      ) {
        updates.push(updated);
      }
      this.repositories.set(id, updated);
    }
    await appendEvents(this.ledgerPath, updates);
  }

  async updateRepository(id, patch) {
    const updated = { ...this.repositories.get(String(id)), ...patch };
    this.repositories.set(String(id), updated);
    await appendEvents(this.ledgerPath, [updated]);
  }

  async writeIndexAndReport() {
    const indexLines = sortUniqueRepositories(this.repositories).map((repository) => ({
      name: repository.name,
      url: repository.url,
      readme: repository.readmePath,
    }));
    const indexContent = indexLines.map((entry) => JSON.stringify(entry)).join("\n");
    await atomicWrite(this.indexPath, indexContent ? `${indexContent}\n` : "");
    const report = summaryFor(this.state, this.repositories);
    await atomicWrite(this.reportPath, `${JSON.stringify(report, null, 2)}\n`);
    return report;
  }

  async seedPass() {
    const url = new URL("/search/repositories", API_ORIGIN);
    url.searchParams.set("q", `stars:>=${MIN_STARS} fork:true is:public`);
    url.searchParams.set("per_page", String(PER_PAGE));
    url.searchParams.set("sort", "stars");
    url.searchParams.set("order", "desc");
    const { response, data } = await this.client.json(url);
    if (data.incomplete_results)
      throw new GitHubApiError(
        "GitHub marked the broad seed search incomplete; this pass cannot be seeded safely.",
      );
    await this.recordRepositories(data.items ?? []);
    const maximum = (data.items ?? []).reduce(
      (value, item) => Math.max(value, item.stargazers_count ?? MIN_STARS),
      MIN_STARS,
    );
    this.state.maxStars = maximum;
    this.state.phase = "search";
    this.state.segments = [
      makeSegment(this.state.pass, { starsMin: MIN_STARS, starsMax: maximum }),
    ];
    this.state.retryAt = null;
    this.state.lastError = null;
    return response;
  }

  async splitSegment(segment, reason = null) {
    const children = splitSearchSegment(segment);
    segment.status = children ? "split" : "unresolved";
    segment.completedAt = this.timestamp();
    if (reason) segment.error = reason;
    if (!children)
      segment.error =
        reason ??
        "The query is still above the safe result limit at the smallest supported time range.";
    if (children) {
      for (const child of children) {
        const childSegment = makeSegment(this.state.pass, child);
        if (!this.state.segments.some((existing) => existing.id === childSegment.id))
          this.state.segments.push(childSegment);
      }
    }
    await this.saveState();
  }

  async requeueSegment(segment, reason) {
    segment.retries += 1;
    segment.error = reason;
    segment.nextUrl = null;
    segment.expectedCount = null;
    segment.receivedCount = 0;
    segment.status = segment.retries <= MAX_RETRIES ? "pending" : "unresolved";
    await this.saveState();
  }

  async processSegment(segment) {
    segment.status = "processing";
    if (!segment.startedAt) segment.startedAt = this.timestamp();
    const url = segment.nextUrl ?? buildRepositorySearchUrl(segment);
    let response;
    let data;
    try {
      ({ response, data } = await this.client.json(url));
    } catch (error) {
      if (error instanceof CollectionPausedError) throw error;
      if (error instanceof GitHubNetworkError || error.status === 401) throw error;
      await this.requeueSegment(segment, error.message);
      return;
    }

    if (data.incomplete_results) {
      await this.requeueSegment(segment, "GitHub marked this query result incomplete.");
      return;
    }
    await this.recordRepositories(data.items ?? []);
    if (segment.expectedCount === null) {
      segment.expectedCount = data.total_count;
      if (data.total_count > SAFE_LEAF_COUNT) {
        await this.splitSegment(segment);
        return;
      }
    }
    segment.receivedCount += (data.items ?? []).length;
    segment.nextUrl = parseLinkNext(response, url);
    if (segment.nextUrl) {
      await this.saveState();
      return;
    }

    if (segment.receivedCount !== segment.expectedCount) {
      await this.splitSegment(
        segment,
        `Result count changed during pagination (expected ${segment.expectedCount}, received ${segment.receivedCount}).`,
      );
      return;
    }
    segment.status = "completed";
    segment.completedAt = this.timestamp();
    segment.error = null;
    await this.saveState();
  }

  async getReadmeBlob(descriptor) {
    if (!descriptor.git_url || !/^[a-f0-9]{40,64}$/iu.test(descriptor.sha ?? "")) return null;
    const url = new URL(descriptor.git_url);
    if (url.origin !== API_ORIGIN || !url.pathname.startsWith("/repos/")) return null;
    const { data } = await this.client.json(url);
    return decodeBase64FileContent(data.content, descriptor.size);
  }

  async classifyReadme404(repository) {
    const response = await this.client.request(
      `${API_ORIGIN}/repos/${repository.name.split("/").map(encodeURIComponent).join("/")}`,
      { allowStatuses: [404] },
    );
    return response.status === 200 ? "missing" : "unavailable";
  }

  async processReadme(repository) {
    const ownerAndName = repository.name.split("/").map(encodeURIComponent).join("/");
    const url = `${API_ORIGIN}/repos/${ownerAndName}/readme`;
    try {
      const { response, data } = await this.client.json(url, { allowStatuses: [404] });
      if (response.status === 404) {
        const readmeStatus = await this.classifyReadme404(repository);
        await this.updateRepository(repository.id, {
          readmeStatus,
          readmePath: null,
          attempts: repository.attempts,
          error:
            readmeStatus === "unavailable"
              ? "Repository was no longer publicly accessible when its README was requested."
              : null,
        });
        return;
      }

      if (!["file", "symlink"].includes(data.type) || typeof data.path !== "string")
        throw new Error("GitHub returned an unexpected README descriptor.");
      let bytes;
      try {
        bytes =
          data.encoding === "base64" ? decodeBase64FileContent(data.content, data.size) : null;
      } catch (error) {
        if (!data.git_url) throw error;
      }
      if (!bytes) bytes = await this.getReadmeBlob(data);
      if (!bytes) throw new Error("GitHub did not provide the raw README or a retrievable blob.");

      const filename = safeReadmeFilename(data.name ?? path.posix.basename(data.path));
      const relativePath = path.posix.join("readmes", repository.id, filename);
      const filePath = path.join(this.output, ...relativePath.split("/"));
      await atomicWrite(filePath, bytes);
      await this.updateRepository(repository.id, {
        readmeStatus: bytes.byteLength === 0 ? "empty" : "downloaded",
        readmePath: relativePath,
        readmeBytes: bytes.byteLength,
        readmeSha256: createHash("sha256").update(bytes).digest("hex"),
        readmeBlobSha: data.sha ?? null,
        readmeOriginalName: data.name ?? path.posix.basename(data.path),
        readmeSourcePath: data.path,
        attempts: repository.attempts,
        error: null,
      });
    } catch (error) {
      if (error instanceof CollectionPausedError) throw error;
      if (error instanceof GitHubNetworkError || error.status === 401) throw error;
      await this.updateRepository(repository.id, {
        readmeStatus: "error",
        readmePath: null,
        attempts: repository.attempts + 1,
        error: error.message,
      });
    }
  }

  async processReadmes() {
    const candidates = [...this.repositories.values()].filter((repository) => {
      const status = repository.readmeStatus ?? "pending";
      return (
        (status === "pending" || (status === "error" && repository.attempts < MAX_RETRIES)) &&
        !this.processedReadmes.has(repository.id)
      );
    });
    for (const repository of candidates) {
      await this.processReadme(repository);
      this.processedReadmes.add(repository.id);
      await this.saveState();
    }
  }

  async finishPass() {
    const unresolved = this.state.segments.filter(
      (segment) => segment.status === "unresolved",
    ).length;
    this.state.passes.push({
      pass: this.state.pass,
      startedAt: this.state.passStartedAt,
      completedAt: this.timestamp(),
      maxStars: this.state.maxStars,
      segments: this.state.segments.length,
      unresolvedSegments: unresolved,
    });
    if (this.state.pass < 2) {
      this.state.pass += 1;
      this.state.passStartedAt = this.timestamp();
      this.state.phase = "seed";
      this.state.segments = [];
      this.state.maxStars = null;
      await this.saveState();
      return;
    }

    const hasReadmeFailures = [...this.repositories.values()].some((repository) =>
      ["error", "unavailable"].includes(repository.readmeStatus),
    );
    this.state.status = unresolved > 0 || hasReadmeFailures ? "partial" : "complete";
    this.state.phase = "done";
    this.state.completedAt = this.timestamp();
    this.state.retryAt = null;
    await this.saveState();
  }

  async collect({ maxRequests = Infinity, retryFailed = false } = {}) {
    if (!this.state) await this.load();
    this.client.maxRequests = maxRequests;
    const scheduledRetry = Date.parse(this.state.retryAt ?? "");
    if (Number.isFinite(scheduledRetry) && scheduledRetry > this.now().getTime()) {
      this.state.lastError = `GitHub's retry window has not opened yet; resume after ${this.state.retryAt}.`;
      await this.saveState();
      return this.writeIndexAndReport();
    }

    if (retryFailed) {
      for (const repository of this.repositories.values()) {
        if (repository.readmeStatus === "error" || repository.readmeStatus === "unavailable") {
          await this.updateRepository(repository.id, {
            readmeStatus: "pending",
            attempts: 0,
            error: null,
          });
        }
      }
      if (this.state.status !== "in_progress") {
        this.state.status = "in_progress";
        this.state.pass = Math.max(1, this.state.pass);
        this.state.completedAt = null;
        for (const segment of this.state.segments) {
          if (segment.status === "unresolved") {
            segment.status = "pending";
            segment.retries = 0;
            segment.error = null;
          }
        }
        this.state.phase = this.state.segments.some((segment) =>
          ["pending", "processing"].includes(segment.status),
        )
          ? "search"
          : "readmes";
      }
    }
    if (["complete", "partial"].includes(this.state.status) && !retryFailed) {
      await this.writeIndexAndReport();
      return summaryFor(this.state, this.repositories);
    }

    this.state.status = "in_progress";
    this.state.retryAt = null;
    this.state.lastError = null;
    await this.saveState();
    try {
      while (true) {
        if (this.state.phase === "seed") {
          if (!this.state.passStartedAt) this.state.passStartedAt = this.timestamp();
          await this.seedPass();
          await this.saveState();
          continue;
        }
        if (this.state.phase === "search") {
          const segment = this.state.segments.find(
            (entry) => entry.status === "pending" || entry.status === "processing",
          );
          if (segment) {
            await this.processSegment(segment);
            continue;
          }
          this.state.phase = "readmes";
          await this.saveState();
          continue;
        }
        if (this.state.phase === "readmes") {
          await this.processReadmes();
          await this.finishPass();
          if (this.state.phase === "done") break;
          continue;
        }
        if (this.state.phase === "done") break;
        throw new Error(`Unknown collector phase: ${this.state.phase}`);
      }
    } catch (error) {
      if (error instanceof CollectionPausedError) {
        this.state.retryAt = error.retryAt;
        this.state.lastError = error.message;
      } else {
        this.state.lastError = error.message;
        if (error.status === 401) this.state.status = "blocked";
      }
      await this.saveState();
      await this.writeIndexAndReport();
      if (!(error instanceof CollectionPausedError) && error.status !== 401) throw error;
    }
    const report = await this.writeIndexAndReport();
    return report;
  }

  async status() {
    if (!this.state) await this.load();
    return summaryFor(this.state, this.repositories);
  }

  async verify() {
    if (!this.state) await this.load();
    const failures = [];
    for (const repository of this.repositories.values()) {
      if (!["downloaded", "empty"].includes(repository.readmeStatus)) continue;
      if (typeof repository.readmePath !== "string") {
        failures.push({
          id: repository.id,
          issue: "README status is successful but the saved path is missing.",
        });
        continue;
      }
      const filePath = path.resolve(this.output, ...repository.readmePath.split("/"));
      if (!filePath.startsWith(`${this.output}${path.sep}`)) {
        failures.push({ id: repository.id, issue: "README path escapes the output directory." });
        continue;
      }
      try {
        const bytes = await readFile(filePath);
        const sha256 = createHash("sha256").update(bytes).digest("hex");
        if (bytes.byteLength !== repository.readmeBytes || sha256 !== repository.readmeSha256) {
          failures.push({
            id: repository.id,
            issue: "README size or SHA-256 does not match its checkpoint.",
          });
        }
      } catch (error) {
        failures.push({ id: repository.id, issue: `README file is unavailable: ${error.message}` });
      }
    }
    return {
      verified: failures.length === 0,
      checked: [...this.repositories.values()].filter((repository) =>
        ["downloaded", "empty"].includes(repository.readmeStatus),
      ).length,
      failures,
    };
  }
}

function parseArguments(argv) {
  const [command = "help", ...args] = argv;
  const options = { command, output: DEFAULT_OUTPUT, maxRequests: Infinity, retryFailed: false };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--output") {
      if (!args[index + 1]) throw new Error("--output requires a path.");
      options.output = path.resolve(args[++index]);
    } else if (args[index] === "--max-requests") {
      const maximum = Number(args[++index]);
      if (!Number.isSafeInteger(maximum) || maximum < 1)
        throw new Error("--max-requests requires a positive integer.");
      options.maxRequests = maximum;
    } else if (args[index] === "--retry-failed") {
      options.retryFailed = true;
    } else {
      throw new Error(`Unknown argument: ${args[index]}`);
    }
  }
  return options;
}

function printHelp() {
  process.stdout.write(
    [
      "GitHub public repository collector (stars >= 1000; forks included)",
      "",
      "Usage:",
      "  node scripts/github-collector.mjs collect [--output PATH] [--max-requests N] [--retry-failed]",
      "  node scripts/github-collector.mjs status [--output PATH]",
      "  node scripts/github-collector.mjs verify [--output PATH]",
      "",
      "Set GH_TOKEN or GITHUB_TOKEN for authenticated GitHub API access.",
      `Default output: ${DEFAULT_OUTPUT}`,
      "",
    ].join("\n"),
  );
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  if (options.command === "help" || options.command === "--help" || options.command === "-h") {
    printHelp();
    return 0;
  }
  if (!["collect", "status", "verify"].includes(options.command))
    throw new Error(`Unknown command: ${options.command}`);

  const collector = await new GitHubCollector({ output: options.output }).load();
  if (options.command === "status") {
    process.stdout.write(`${JSON.stringify(await collector.status(), null, 2)}\n`);
    return 0;
  }
  if (options.command === "verify") {
    const verification = await collector.verify();
    process.stdout.write(`${JSON.stringify(verification, null, 2)}\n`);
    return verification.verified ? 0 : 1;
  }

  const lockPath = path.join(options.output, "collector.lock");
  let lockHandle;
  try {
    lockHandle = await open(lockPath, "wx");
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const existing = await readJson(lockPath, null);
    if (Number.isSafeInteger(existing?.pid)) {
      try {
        process.kill(existing.pid, 0);
        throw new Error(
          `A collector process (PID ${existing.pid}) is already using this output directory.`,
        );
      } catch (probeError) {
        if (probeError.code !== "ESRCH") throw probeError;
      }
      await rm(lockPath, { force: true });
      lockHandle = await open(lockPath, "wx");
    } else {
      throw new Error(
        "A collector lock exists but its owner cannot be verified; inspect and remove it only if no collector is running.",
      );
    }
  }
  await lockHandle.writeFile(
    `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`,
    "utf8",
  );
  await lockHandle.sync();
  await lockHandle.close();
  let report;
  try {
    report = await collector.collect(options);
  } finally {
    await rm(lockPath, { force: true });
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return report.status === "complete" ? 0 : 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}

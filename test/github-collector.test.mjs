import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  buildRepositorySearchUrl,
  CollectionPausedError,
  decodeBase64FileContent,
  GitHubApiClient,
  GitHubCollector,
  parseNextLink,
  safeReadmeFilename,
  splitSearchSegment,
} from "../scripts/github-collector.mjs";

async function createTestOutput(prefix) {
  const root = path.resolve(".local");
  await mkdir(root, { recursive: true });
  const output = await mkdtemp(path.join(root, prefix));
  assert.ok(output.startsWith(`${root}${path.sep}`));
  return output;
}

test("search queries include every public repository and explicitly include forks", () => {
  const url = buildRepositorySearchUrl({
    starsMin: 1000,
    starsMax: 1499,
    createdSince: "2012-01-01T00:00:00Z",
    createdBefore: "2014-01-01T00:00:00Z",
  });
  const query = url.searchParams.get("q");

  assert.match(query, /stars:1000\.\.1499/u);
  assert.match(query, /fork:true/u);
  assert.match(query, /is:public/u);
  assert.deepEqual(
    query.split(" ").filter((part) => part.startsWith("created:")),
    ["created:2012-01-01T00:00:00Z..2013-12-31T23:59:59Z"],
  );
  assert.equal(url.searchParams.get("per_page"), "100");
});

test("star and timestamp partitions are disjoint and cover their parent boundaries", () => {
  const starChildren = splitSearchSegment({ starsMin: 1000, starsMax: 1001 });
  assert.deepEqual(
    starChildren.map(({ starsMin, starsMax }) => [starsMin, starsMax]),
    [
      [1000, 1000],
      [1001, 1001],
    ],
  );

  const dateChildren = splitSearchSegment({ starsMin: 1000, starsMax: 1000 });
  assert.equal(dateChildren.length, 2);
  assert.equal(dateChildren[0].createdSince, "1970-01-01T00:00:00Z");
  assert.equal(dateChildren[0].createdBefore, dateChildren[1].createdSince);
  assert.equal(dateChildren[1].createdBefore, "2970-12-31T23:59:59Z");
  for (const child of dateChildren) {
    for (const boundary of [child.createdSince, child.createdBefore]) {
      const year = new Date(boundary).getUTCFullYear();
      assert.ok(
        year >= 1970 && year <= 2970,
        "date partitions must stay inside GitHub's accepted years",
      );
    }
  }
  assert.equal(
    splitSearchSegment({
      starsMin: 1000,
      starsMax: 1000,
      createdSince: "2020-01-01T00:00:00Z",
      createdBefore: "2020-01-01T00:00:01Z",
    }),
    null,
  );
});

test("pagination links and README bytes are parsed and validated", () => {
  assert.equal(
    parseNextLink(
      '<https://api.github.com/search/repositories?q=next&page=2>; rel="next", <https://api.github.com/search/repositories?q=next&page=1>; rel="prev"',
    ),
    "https://api.github.com/search/repositories?q=next&page=2",
  );
  assert.equal(parseNextLink(null), null);
  assert.deepEqual(
    decodeBase64FileContent(Buffer.from("hello\n").toString("base64"), 6),
    Buffer.from("hello\n"),
  );
  assert.deepEqual(decodeBase64FileContent("", 0), Buffer.alloc(0));
  assert.throws(() => decodeBase64FileContent("not base64!", 8), /invalid Base64/u);
  assert.throws(() => decodeBase64FileContent("aGVsbG8=", 6), /size mismatch/u);
});

test("multi-megabyte README content decodes without exhausting the regular expression stack", () => {
  const bytes = Buffer.alloc(4 * 1024 * 1024, 97);
  assert.deepEqual(decodeBase64FileContent(bytes.toString("base64"), bytes.length), bytes);
  for (const invalid of ["=AAA", "AA=A", "A===", "AAAA=", "AA!A"]) {
    assert.throws(() => decodeBase64FileContent(invalid), /invalid Base64/u);
  }
});

test("README filenames cannot escape the repository folder or collide with Windows device names", () => {
  assert.equal(safeReadmeFilename("../../README.md"), "README.md");
  assert.equal(safeReadmeFilename("CON.txt"), "README.md");
  assert.equal(safeReadmeFilename("README.rst"), "README.rst");
});

test("API client never sends a GitHub token to another origin", async () => {
  const client = new GitHubApiClient({
    token: "test-token",
    fetchImpl: async () => assert.fail("fetch must not run"),
  });
  await assert.rejects(
    client.request("https://raw.githubusercontent.com/user/repo/README.md"),
    /outside api.github.com/u,
  );
});

test("API client pauses on rate limits and does not retry an ordinary access denial", async () => {
  const limited = new GitHubApiClient({
    fetchImpl: async () =>
      new Response(JSON.stringify({ message: "API rate limit exceeded" }), {
        status: 403,
        headers: {
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 60),
        },
      }),
  });
  await assert.rejects(
    limited.request("https://api.github.com/search/repositories?q=stars%3A1000"),
    CollectionPausedError,
  );

  const denied = new GitHubApiClient({
    fetchImpl: async () =>
      new Response(JSON.stringify({ message: "Resource not accessible by integration" }), {
        status: 403,
        headers: { "x-ratelimit-remaining": "40" },
      }),
  });
  await assert.rejects(
    denied.request("https://api.github.com/search/repositories?q=stars%3A1000"),
    (error) => error.status === 403,
  );
});

test("a two-pass collection writes one three-field index entry and verifies the README", async (context) => {
  const output = await createTestOutput("collector-test-");
  context.after(async () => rm(output, { recursive: true, force: true }));

  const repository = {
    id: 123,
    full_name: "owner/example",
    html_url: "https://github.com/owner/example",
    stargazers_count: 1000,
    created_at: "2021-05-01T12:00:00Z",
    default_branch: "trunk",
  };
  const readmeBytes = Buffer.from("# Example\n");
  const readme = {
    type: "file",
    encoding: "base64",
    size: readmeBytes.byteLength,
    content: readmeBytes.toString("base64"),
    name: "README.rst",
    path: "README.rst",
    sha: "a".repeat(40),
    git_url: `https://api.github.com/repos/owner/example/git/blobs/${"a".repeat(40)}`,
  };
  let readmeRequests = 0;
  const fetchImpl = async (input) => {
    const url = new URL(input);
    if (url.pathname === "/search/repositories") {
      return new Response(
        JSON.stringify({ total_count: 1, incomplete_results: false, items: [repository] }),
        { status: 200 },
      );
    }
    if (url.pathname === "/repos/owner/example/readme") {
      readmeRequests += 1;
      return new Response(JSON.stringify(readme), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  };

  const collector = await new GitHubCollector({
    output,
    client: new GitHubApiClient({ fetchImpl }),
  }).load();
  const report = await collector.collect();
  assert.equal(report.status, "complete");
  assert.equal(report.repositories.total, 1);
  assert.equal(report.repositories.downloaded, 1);
  assert.equal(readmeRequests, 1);

  const index = (await readFile(path.join(output, "index.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map(JSON.parse);
  assert.deepEqual(index, [
    { name: repository.full_name, url: repository.html_url, readme: "readmes/123/README.rst" },
  ]);
  assert.deepEqual(await readFile(path.join(output, "readmes", "123", "README.rst")), readmeBytes);
  assert.deepEqual(await collector.verify(), { verified: true, checked: 1, failures: [] });
});

test("README symlinks preserve their Git blob without following the target", async (context) => {
  const output = await createTestOutput("collector-symlink-test-");
  context.after(async () => rm(output, { recursive: true, force: true }));
  const bytes = Buffer.from("Development moved to https://example.invalid/upstream.\n");
  const blobUrl = `https://api.github.com/repos/owner/linked/git/blobs/${"b".repeat(40)}`;
  const requests = [];
  const collector = await new GitHubCollector({
    output,
    client: new GitHubApiClient({
      fetchImpl: async (url) => {
        requests.push(String(url));
        return new Response(
          JSON.stringify(
            String(url) === blobUrl
              ? { encoding: "base64", content: bytes.toString("base64") }
              : {
                  type: "symlink",
                  name: "README.md",
                  path: "README.md",
                  target: bytes.toString(),
                  size: bytes.length,
                  sha: "b".repeat(40),
                  git_url: blobUrl,
                },
          ),
          { status: 200 },
        );
      },
    }),
  }).load();
  await collector.recordRepositories([
    {
      id: 456,
      full_name: "owner/linked",
      html_url: "https://github.com/owner/linked",
      stargazers_count: 1000,
    },
  ]);
  await collector.processReadme(collector.repositories.get("456"));
  assert.equal((await collector.status()).repositories.downloaded, 1);
  assert.deepEqual(requests, ["https://api.github.com/repos/owner/linked/readme", blobUrl]);
  assert.deepEqual(await readFile(path.join(output, "readmes", "456", "README.md")), bytes);
  assert.deepEqual(await collector.verify(), { verified: true, checked: 1, failures: [] });
});

test("pagination count mismatches split the entire range and preserve every child result", async (context) => {
  const output = await createTestOutput("collector-count-test-");
  context.after(async () => rm(output, { recursive: true, force: true }));
  const repositories = [1, 2].map((id) => ({
    id,
    full_name: `owner/count-${id}`,
    html_url: `https://github.com/owner/count-${id}`,
    stargazers_count: 999 + id,
  }));
  const collector = await new GitHubCollector({
    output,
    client: new GitHubApiClient({
      fetchImpl: async (url) => {
        const query = new URL(url).searchParams.get("q");
        const items = query.includes("stars:1001..1001") ? [repositories[1]] : [repositories[0]];
        return new Response(
          JSON.stringify({
            total_count: query.includes("stars:1000..1001") ? 2 : 1,
            incomplete_results: false,
            items,
          }),
          { status: 200 },
        );
      },
    }),
  }).load();
  const parent = {
    id: "parent",
    starsMin: 1000,
    starsMax: 1001,
    status: "pending",
    expectedCount: null,
    receivedCount: 0,
    retries: 0,
    nextUrl: null,
  };
  collector.state.segments = [parent];
  await collector.processSegment(parent);
  assert.equal(parent.status, "split");
  assert.match(parent.error, /expected 2, received 1/u);
  const children = collector.state.segments.slice(1);
  assert.deepEqual(
    children.map(({ starsMin, starsMax }) => [starsMin, starsMax]),
    [
      [1000, 1000],
      [1001, 1001],
    ],
  );
  for (const child of children) await collector.processSegment(child);
  const report = await collector.status();
  assert.equal(report.repositories.total, 2);
  assert.equal(report.segments.completed, 2);
  assert.equal(report.segments.unresolved, 0);
});

test("an unsplittable count mismatch stays unresolved with its actual reason", async (context) => {
  const output = await createTestOutput("collector-count-boundary-test-");
  context.after(async () => rm(output, { recursive: true, force: true }));
  const collector = await new GitHubCollector({
    output,
    client: new GitHubApiClient({
      fetchImpl: async () =>
        new Response(JSON.stringify({ total_count: 2, incomplete_results: false, items: [] }), {
          status: 200,
        }),
    }),
  }).load();
  const segment = {
    id: "smallest",
    starsMin: 1000,
    starsMax: 1000,
    createdSince: "2020-01-01T00:00:00Z",
    createdBefore: "2020-01-01T00:00:01Z",
    status: "pending",
    expectedCount: null,
    receivedCount: 0,
    retries: 0,
    nextUrl: null,
  };
  collector.state.segments = [segment];
  await collector.processSegment(segment);
  assert.equal(segment.status, "unresolved");
  assert.match(segment.error, /expected 2, received 0/u);
});

test("request budgets pause with a durable checkpoint and resume without losing results", async (context) => {
  const output = await createTestOutput("collector-resume-test-");
  context.after(async () => rm(output, { recursive: true, force: true }));

  const repository = {
    id: 321,
    full_name: "owner/resume",
    html_url: "https://github.com/owner/resume",
    stargazers_count: 1001,
    created_at: "2022-01-01T00:00:00Z",
    default_branch: "main",
  };
  const fetchImpl = async () => {
    return new Response(
      JSON.stringify({ total_count: 1, incomplete_results: false, items: [repository] }),
      { status: 200 },
    );
  };

  const first = await new GitHubCollector({
    output,
    client: new GitHubApiClient({ fetchImpl }),
  }).load();
  const paused = await first.collect({ maxRequests: 1 });
  assert.equal(paused.status, "in_progress");
  assert.equal(paused.repositories.total, 1);
  assert.equal(paused.phase, "search");

  const second = await new GitHubCollector({
    output,
    client: new GitHubApiClient({ fetchImpl }),
  }).load();
  const resumed = await second.collect({ maxRequests: 1 });
  assert.equal(resumed.status, "in_progress");
  assert.equal(resumed.repositories.total, 1);
  assert.equal(resumed.segments.completed, 1);
});

test("a saved rate-limit reset time prevents premature requests", async (context) => {
  const output = await createTestOutput("collector-rate-limit-test-");
  context.after(async () => rm(output, { recursive: true, force: true }));
  let requests = 0;
  const now = Date.now();
  const collector = await new GitHubCollector({
    output,
    now: () => new Date(now),
    client: new GitHubApiClient({
      fetchImpl: async () => {
        requests += 1;
        return new Response("{}", { status: 200 });
      },
    }),
  }).load();
  collector.state.status = "in_progress";
  collector.state.retryAt = new Date(now + 60_000).toISOString();
  await collector.saveState();

  const paused = await collector.collect({ maxRequests: 1 });
  assert.equal(paused.status, "in_progress");
  assert.equal(requests, 0);
});

for (const [repositoryStatus, expectedStatus] of [
  [200, "missing"],
  [404, "unavailable"],
]) {
  test(`README 404 is classified as ${expectedStatus} using the repository response`, async (context) => {
    const output = await createTestOutput("collector-404-test-");
    context.after(async () => rm(output, { recursive: true, force: true }));
    const repository = {
      id: 404,
      full_name: "owner/no-readme",
      html_url: "https://github.com/owner/no-readme",
      stargazers_count: 1000,
    };
    const collector = await new GitHubCollector({
      output,
      client: new GitHubApiClient({
        fetchImpl: async (url) =>
          new Response("{}", {
            status: new URL(url).pathname.endsWith("/readme") ? 404 : repositoryStatus,
          }),
      }),
    }).load();
    await collector.recordRepositories([repository]);
    await collector.processReadme(collector.repositories.get("404"));
    const report = await collector.status();
    assert.equal(report.repositories[expectedStatus], 1);
    assert.equal(report.repositories.error, 0);
    assert.equal(collector.repositories.get("404").readmePath, null);
  });
}

for (const phase of ["readmes", "search"]) {
  test(`persistent network failure stops ${phase} with a diagnostic and a resumable checkpoint`, async (context) => {
    const output = await createTestOutput("collector-network-test-");
    context.after(async () => rm(output, { recursive: true, force: true }));
    let requests = 0;
    const waits = [];
    const collector = await new GitHubCollector({
      output,
      client: new GitHubApiClient({
        fetchImpl: async () => {
          requests += 1;
          throw new TypeError("fetch failed", {
            cause: Object.assign(new Error(), { code: "EACCES" }),
          });
        },
        sleepImpl: async (milliseconds) => {
          waits.push(milliseconds);
        },
      }),
    }).load();
    collector.state.phase = phase;
    if (phase === "readmes") {
      await collector.recordRepositories(
        [1, 2].map((id) => ({
          id,
          full_name: `owner/repo-${id}`,
          html_url: `https://github.com/owner/repo-${id}`,
          stargazers_count: 1000,
        })),
      );
    } else {
      collector.state.segments = [
        {
          starsMin: 1000,
          starsMax: 1001,
          status: "pending",
          retries: 0,
          nextUrl: String(buildRepositorySearchUrl({ starsMin: 1000, starsMax: 1001 }, 2)),
        },
      ];
    }
    await assert.rejects(
      collector.collect({ maxRequests: 3 }),
      (error) => error.name === "GitHubNetworkError" && /EACCES/u.test(error.message),
    );
    assert.equal(requests, 3);
    assert.deepEqual(waits, [1000, 2000]);
    const resumed = await new GitHubCollector({ output }).load();
    const report = await resumed.status();
    assert.match(report.lastError, /EACCES/u);
    assert.equal(report.phase, phase);
    assert.equal(report.repositories.error, 0);
    if (phase === "readmes") {
      assert.equal(report.repositories.pending, 2);
      assert.equal(resumed.repositories.get("1").attempts, 0);
    } else {
      assert.equal(resumed.state.segments[0].retries, 0);
      assert.match(resumed.state.segments[0].nextUrl, /page=2/u);
    }
  });
}

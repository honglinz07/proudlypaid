import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { test } from "node:test";
import { discoverCatalog, extractMentions } from "../scripts/discover-catalog.mjs";

test("English and Chinese statements produce line-addressed candidate text", () => {
  const mentions = extractMentions(
    [
      "# Example",
      "An open-source alternative to [Notion](https://www.notion.com/).",
      "A replacement for Slack!",
      "Notion 的开源替代品。",
    ].join("\n"),
  );
  assert.equal(mentions.length, 3);
  assert.deepEqual(
    mentions.map((entry) => entry.line),
    [2, 3, 4],
  );
  assert.ok(mentions[0].targetText.startsWith("Notion"));
  assert.equal(mentions[1].targetText, "Slack");
  assert.equal(mentions[2].targetText, "Notion");
});

test("code examples, link definitions and explicit negations do not assert alternatives", () => {
  assert.deepEqual(
    extractMentions(
      [
        "```md",
        "alternative to Notion",
        "```",
        "~~~",
        "replacement for Slack",
        "~~~",
        "[alternative to Slack]: https://example.org",
        "This is not an alternative to Slack.",
      ].join("\n"),
    ),
    [],
  );
});

test("long lines retain the assertion inside a bounded evidence excerpt", () => {
  const [mention] = extractMentions(`${"x".repeat(1500)} An alternative to Slack.`);
  assert.ok(mention.excerpt.includes("alternative to Slack"));
  assert.ok(mention.excerpt.length <= 300);
});

async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), "closedsources-catalog-discovery-"));
  try {
    const collection = join(root, "collection");
    await mkdir(join(collection, "readmes", "1"), { recursive: true });
    await writeFile(join(collection, "readmes", "1", "README.md"), "An alternative to Notion.");
    const repository = {
      name: "example/project",
      url: "https://github.com/example/project",
      readme: "readmes/1/README.md",
    };
    await writeFile(join(collection, "index.jsonl"), `${JSON.stringify(repository)}\n`);
    await run({ collection, outputRoot: join(root, "output"), repository, root });
  } finally {
    assert.ok(basename(root).startsWith("closedsources-catalog-discovery-"));
    assert.equal(resolve(root, ".."), resolve(tmpdir()));
    await rm(root, { recursive: true, force: true });
  }
}

test("runs preserve source bytes and emit stable, explicitly unverified evidence", async () => {
  await fixture(async (options) => {
    const source = join(options.collection, "readmes", "1", "README.md");
    const before = await readFile(source);
    const first = await discoverCatalog(options);
    const second = await discoverCatalog(options);
    assert.notEqual(first.output, second.output);
    const candidateText = await readFile(join(first.output, "candidates.jsonl"), "utf8");
    assert.equal(candidateText, await readFile(join(second.output, "candidates.jsonl"), "utf8"));
    const candidate = JSON.parse(candidateText);
    assert.equal(candidate.verification, "needs-review");
    assert.equal(candidate.sourceClassification, "unclassified");
    assert.match(candidate.readmeSha256, /^[a-f0-9]{64}$/);
    assert.equal(candidate.line, 1);
    assert.equal(first.report.status, "complete");
    assert.equal(first.report.readmesScanned, 1);
    assert.deepEqual(await readFile(source), before);
  });
});

test("missing README metadata stays distinct from unreadable or invalid source paths", async () => {
  await fixture(async (options) => {
    const rows = [
      options.repository,
      { ...options.repository, readme: null },
      { ...options.repository, readme: "../outside.md" },
      { ...options.repository, readme: "readmes/missing.md" },
    ];
    await writeFile(join(options.root, "outside.md"), "alternative to Secret");
    await writeFile(join(options.collection, "index.jsonl"), rows.map(JSON.stringify).join("\n"));
    const result = await discoverCatalog(options);
    assert.equal(result.report.indexedRepositories, 4);
    assert.equal(result.report.withoutReadme, 1);
    assert.equal(result.report.errors, 2);
    assert.equal(result.report.status, "partial");
    assert.equal(result.report.candidates, 1);
  });
});

test("malformed index rows are reported without dropping subsequent repositories", async () => {
  await fixture(async (options) => {
    await writeFile(
      join(options.collection, "index.jsonl"),
      `\ninvalid json\n${JSON.stringify(options.repository)}\n`,
    );
    const result = await discoverCatalog(options);
    assert.equal(result.report.errors, 1);
    assert.equal(result.report.candidates, 1);
    const error = JSON.parse(await readFile(join(result.output, "errors.jsonl"), "utf8"));
    assert.equal(error.indexLine, 2);
  });
});

test("scanner refuses to create output inside the original collection", async () => {
  await fixture(async (options) => {
    await assert.rejects(
      discoverCatalog({ ...options, outputRoot: join(options.collection, "output") }),
      /outside the source collection/,
    );
  });
});

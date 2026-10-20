import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, mkdtemp, open, readFile, realpath, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const inside = (root, path) => {
  const pathWithinRoot = relative(root, path);
  return (
    pathWithinRoot !== "" &&
    !isAbsolute(pathWithinRoot) &&
    pathWithinRoot !== ".." &&
    !pathWithinRoot.startsWith(`..${sep}`)
  );
};

// These are author statements to investigate, never verified proprietary products.
export function extractMentions(markdown) {
  const mentions = [];
  let fence;
  const lines = markdown.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const delimiter = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (delimiter) {
      if (!fence) fence = delimiter;
      else if (delimiter[0] === fence[0] && delimiter.length >= fence.length) fence = undefined;
      continue;
    }
    if (fence || /^\s*\[[^\]]+\]:/.test(line)) continue;
    const patterns = [
      ["alternative-to", /\balternatives?\s+(?:to|for)\s+([^\n!?。！？]{2,200})/giu],
      ["replacement-for", /\breplacement\s+for\s+([^\n!?。！？]{2,200})/giu],
      [
        "chinese-alternative",
        /([^。！？\n]{2,100}?)(?:的)(?:开源|自托管|免费)(?:软件)?替代(?:品|方案|工具)/gu,
      ],
    ];
    for (const [pattern, expression] of patterns) {
      for (const match of line.matchAll(expression)) {
        // An explicit negation does not assert an alternative relationship.
        const before = line.slice(Math.max(0, match.index - 35), match.index);
        if (/\b(?:not|never|no)\s+(?:(?:an?|the|direct|drop-in)\s+)*$/i.test(before)) continue;
        const targetText = match[1]
          .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
          .replace(/[`*_]/g, "")
          .replace(/\s+/g, " ")
          .trim();
        if (!targetText) continue;
        const start = Math.max(0, match.index - 60);
        mentions.push({
          pattern,
          targetText,
          line: index + 1,
          excerpt: line.slice(start, start + 300).trim(),
        });
      }
    }
  }
  return mentions;
}

export async function discoverCatalog({ collection, outputRoot }) {
  const collectionRoot = await realpath(resolve(collection));
  const readmeRoot = await realpath(resolve(collectionRoot, "readmes"));
  const indexPath = resolve(collectionRoot, "index.jsonl");
  const outputPath = resolve(outputRoot);
  if (outputPath === collectionRoot || inside(collectionRoot, outputPath)) {
    throw new Error("Discovery output must be outside the source collection.");
  }
  // Check the input before creating an output run. Existing runs are never overwritten.
  const input = await open(indexPath, "r");
  await input.close();
  await mkdir(outputRoot, { recursive: true });
  const output = await mkdtemp(resolve(outputRoot, "run-"));
  const candidates = await open(resolve(output, "candidates.jsonl"), "wx");
  let failures;
  const report = {
    schemaVersion: 1,
    status: "running",
    startedAt: new Date().toISOString(),
    completedAt: null,
    collection: collectionRoot,
    indexedRepositories: 0,
    readmesScanned: 0,
    withoutReadme: 0,
    repositoriesWithMentions: 0,
    candidates: 0,
    errors: 0,
    notes:
      "Offline extraction only. Mentions may refer to open-source software, sponsors or unrelated text. No product, source classification, price or replacement relationship is verified by this tool.",
  };
  let lines;
  let indexLine = 0;
  try {
    failures = await open(resolve(output, "errors.jsonl"), "wx");
    lines = createInterface({ input: createReadStream(indexPath), crlfDelay: Infinity });
    for await (const line of lines) {
      indexLine++;
      if (!line.trim()) continue;
      report.indexedRepositories++;
      try {
        const repository = JSON.parse(line);
        const url = new URL(repository.url);
        if (
          typeof repository.name !== "string" ||
          !repository.name.trim() ||
          url.protocol !== "https:" ||
          url.hostname !== "github.com" ||
          url.username ||
          url.password ||
          !/^\/[^/]+\/[^/]+\/?$/.test(url.pathname)
        ) {
          throw new Error("Invalid repository identity in collection index.");
        }
        if (repository.readme === null) {
          report.withoutReadme++;
          continue;
        }
        if (typeof repository.readme !== "string") throw new Error("Invalid README reference.");
        const readmePath = resolve(collectionRoot, repository.readme);
        if (!inside(readmeRoot, readmePath))
          throw new Error("README reference escapes readmes directory.");
        const actualPath = await realpath(readmePath);
        if (!inside(readmeRoot, actualPath))
          throw new Error("README symlink escapes readmes directory.");
        const bytes = await readFile(actualPath);
        const mentions = extractMentions(bytes.toString("utf8"));
        const readmeSha256 = createHash("sha256").update(bytes).digest("hex");
        report.readmesScanned++;
        if (mentions.length) report.repositoriesWithMentions++;
        const seen = new Set();
        for (const mention of mentions) {
          const key = `${mention.line}:${mention.targetText.toLowerCase()}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const id = createHash("sha256")
            .update(`${repository.url}:${readmeSha256}:${key}`)
            .digest("hex");
          await candidates.write(
            `${JSON.stringify({
              id,
              verification: "needs-review",
              sourceClassification: "unclassified",
              repositoryName: repository.name,
              repositoryUrl: repository.url,
              localReadme: repository.readme,
              readmeSha256,
              ...mention,
            })}\n`,
          );
          report.candidates++;
        }
      } catch (error) {
        report.errors++;
        await failures.write(
          `${JSON.stringify({
            indexLine,
            message: error instanceof Error ? error.message : "Unknown scan error",
          })}\n`,
        );
      }
      if (report.indexedRepositories % 5000 === 0) {
        console.log(
          `Scanned ${report.indexedRepositories} repositories; ${report.candidates} candidate mentions.`,
        );
      }
    }
    report.status = report.errors ? "partial" : "complete";
  } catch (error) {
    report.status = "failed";
    throw error;
  } finally {
    lines?.close();
    await candidates.close();
    await failures?.close();
    report.completedAt = new Date().toISOString();
    await writeFile(resolve(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  }
  return { output, report };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = {
      collection: resolve(".local/github-collection"),
      outputRoot: resolve(".local/catalog-discovery"),
    };
    const args = process.argv.slice(2);
    for (let index = 0; index < args.length; index += 2) {
      const name = args[index];
      const value = args[index + 1];
      if (!["--collection", "--out"].includes(name) || !value || value.startsWith("--")) {
        throw new Error(
          "Usage: npm run catalog:discover -- [--collection DIRECTORY] [--out DIRECTORY]",
        );
      }
      options[name === "--collection" ? "collection" : "outputRoot"] = resolve(value);
    }
    const { output, report } = await discoverCatalog(options);
    console.log(
      `Discovery ${report.status}: ${report.candidates} unverified mentions. Output: ${output}`,
    );
    if (report.status !== "complete") process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Discovery failed.");
    process.exitCode = 1;
  }
}

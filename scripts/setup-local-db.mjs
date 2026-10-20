import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { generateSeed } from "./seed-catalog.mjs";
import { runWrangler } from "./wrangler.mjs";

const root = new URL("../", import.meta.url);
const index = fileURLToPath(new URL(".local/github-collection/index.jsonl", root));
const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--curated-only"))
  throw new Error("Usage: db:local [--curated-only]");
const seed = await generateSeed(
  !args.includes("--curated-only") && existsSync(index) ? ["--index", index] : [],
);
console.log(`Importing ${seed.projectCount} repository identities into local D1…`);
await runWrangler([
  "d1",
  "migrations",
  "apply",
  "DB",
  "--local",
  "--persist-to",
  "../../.local/worker-state",
]);
await runWrangler(
  [
    "d1",
    "execute",
    "DB",
    "--local",
    "--persist-to",
    "../../.local/worker-state",
    "--file",
    seed.output,
  ],
  { quiet: true },
);
console.log(
  `Local catalog ready: ${seed.projectCount} repositories; snapshot ${seed.version.slice(0, 12)}.`,
);

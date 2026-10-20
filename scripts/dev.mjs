import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
// Local initialization is explicit: npm run db:local. This never imports on every restart.
const children = [
  spawn(
    process.execPath,
    [
      fileURLToPath(new URL("./wrangler.mjs", import.meta.url)),
      "dev",
      "--ip",
      "127.0.0.1",
      "--port",
      "8787",
      "--persist-to",
      "../../.local/worker-state",
    ],
    {
      cwd: fileURLToPath(new URL("../apps/api/", import.meta.url)),
      stdio: "inherit",
    },
  ),
  spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "--config", "apps/web/vite.config.ts", "apps/web"],
    {
      cwd: root,
      stdio: "inherit",
    },
  ),
];

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
for (const child of children) {
  child.on("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on("exit", (code, signal) => {
    if (!stopping) stop(signal ? 1 : (code ?? 1));
  });
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());

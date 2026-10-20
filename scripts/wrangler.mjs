import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
export async function runWrangler(args, { quiet = false } = {}) {
  const logs = fileURLToPath(new URL(".local/wrangler-logs/", root));
  await mkdir(logs, { recursive: true });
  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL("node_modules/wrangler/bin/wrangler.js", root)), ...args],
    {
      cwd: fileURLToPath(new URL("apps/api/", root)),
      stdio: quiet ? ["inherit", "pipe", "inherit"] : "inherit",
      env: { ...process.env, WRANGLER_LOG_PATH: logs, WRANGLER_SEND_METRICS: "false" },
    },
  );
  let output = "";
  child.stdout?.on("data", (chunk) => {
    output = (output + chunk.toString()).slice(-65536);
  });
  const onInterrupt = () => child.kill("SIGINT");
  const onTerminate = () => child.kill("SIGTERM");
  process.once("SIGINT", onInterrupt);
  process.once("SIGTERM", onTerminate);
  try {
    await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code) => {
        if (code === 0) resolve();
        else {
          if (output) process.stderr.write(output);
          reject(new Error(`Wrangler exited with ${code}`));
        }
      });
    });
  } finally {
    process.removeListener("SIGINT", onInterrupt);
    process.removeListener("SIGTERM", onTerminate);
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])
  await runWrangler(process.argv.slice(2));

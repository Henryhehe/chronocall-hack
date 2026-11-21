import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runSmoke } from "./smoke.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

async function availablePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const port = probe.address().port;
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function main() {
  if (!existsSync(new URL("../dist/index.html", import.meta.url))) {
    throw new Error("Missing production build. Run npm run build, then npm run test:production.");
  }
  const port = await availablePort();
  const child = spawn(process.execPath, ["--import", "tsx", "server/index.ts", "--production"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    // Override local files/shell values: production tests must never contact Gemini.
    env: { ...process.env, NODE_ENV: "production", DEMO_MODE: "true", GEMINI_API_KEY: "", APP_URL: "", HOST: "127.0.0.1", PORT: String(port) },
  });
  let output = "";
  let failure;
  const collect = (chunk) => { output = (output + chunk.toString()).slice(-16_000); };
  child.stdout.on("data", collect);
  child.stderr.on("data", collect);
  const exited = new Promise((resolve) => {
    child.once("error", (error) => { failure = error; resolve(null); });
    child.once("exit", resolve);
  });
  try {
    await runSmoke(`http://127.0.0.1:${port}`, { expectDemo: true });
  } catch (error) {
    throw new Error(`${failure?.message ?? error.message}\n${output}`);
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
    const timeout = setTimeout(() => child.kill("SIGKILL"), 5000);
    const code = await exited;
    clearTimeout(timeout);
    if (code !== 0 && !process.exitCode) {
      // Preserve diagnostics for startup failures and unclean shutdowns.
      console.error(`Production server exited with ${code ?? child.signalCode ?? "an error"}.\n${output}`);
      process.exitCode = 1;
    }
  }
}

await main().catch((error) => {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
});

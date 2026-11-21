import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const child = spawn(process.execPath, ["--watch", "--import", "tsx", "server/index.ts"], {
  cwd: fileURLToPath(new URL("../", import.meta.url)),
  stdio: "inherit",
  env: { ...process.env, PORT: "3000", HOST: process.env.HOST || "0.0.0.0", ...(process.argv.includes("--demo") ? { DEMO_MODE: "true" } : {}) },
});
child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 0; });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));

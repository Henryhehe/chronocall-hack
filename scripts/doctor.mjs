import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { spawnSync } from "node:child_process";

const root = new URL("../", import.meta.url);
let failed = false;
function check(label, ok, detail) {
  console.log(`${ok ? "OK" : "MISSING"} ${label}: ${detail}`);
  if (!ok) failed = true;
}
check("Node.js", Number(process.versions.node.split(".")[0]) >= 22, process.versions.node);
const npm = spawnSync("npm", ["--version"], { encoding: "utf8" });
check("npm", !npm.error && npm.status === 0, npm.stdout?.trim() || "npm is required");
check("Dependencies", existsSync(new URL("node_modules/tsx", root)), "run npm install if missing");
const env = { ...process.env };
for (const name of [".env.local", ".env"]) {
  const file = new URL(name, root);
  if (existsSync(file)) for (const [key, value] of Object.entries(parseEnv(readFileSync(file, "utf8")))) env[key] ??= value;
}
const hasKey = Boolean(env.GEMINI_API_KEY?.trim() && env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY");
console.log(`Gemini key: ${hasKey ? "configured (value hidden)" : "not configured; use npm run dev:demo"}`);
console.log(`URL: http://localhost:${env.PORT || 3000}`);
process.exitCode = failed ? 1 : 0;

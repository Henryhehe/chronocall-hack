import { copyFileSync, constants, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
if (Number(process.versions.node.split(".")[0]) < 22) {
  console.error("Chronocall requires Node.js 22 or newer.");
  process.exit(1);
}
const env = new URL("../.env.local", import.meta.url);
if (!existsSync(env)) {
  copyFileSync(new URL("../.env.example", import.meta.url), env, constants.COPYFILE_EXCL);
  console.log("Created .env.local. Existing environment files are never overwritten.");
}
const install = spawnSync("npm", ["install"], { cwd: root, stdio: "inherit" });
if (install.error || install.status !== 0) {
  console.error("Dependency installation failed. Check network/registry access, then rerun setup.");
  process.exit(install.status || 1);
}
console.log("Ready: npm run dev:demo (no API key), or add GEMINI_API_KEY to .env.local and run npm run dev.");

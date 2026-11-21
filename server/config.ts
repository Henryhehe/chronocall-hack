import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Shell variables win, followed by .env.local, then .env. Never logs values. */
export function loadEnvironment(root = projectRoot, env = process.env) {
  for (const name of [".env.local", ".env"]) {
    const path = resolve(root, name);
    if (!existsSync(path)) continue;
    for (const [key, value] of Object.entries(parseEnv(readFileSync(path, "utf8")))) {
      if (env[key] === undefined) env[key] = value;
    }
  }
}

export function getServerConfig(env = process.env) {
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }
  return {
    port,
    host: env.HOST || "0.0.0.0",
    production: env.NODE_ENV === "production",
    demoMode: env.DEMO_MODE === "true",
    apiKeyConfigured: Boolean(env.GEMINI_API_KEY?.trim() && env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY"),
  };
}

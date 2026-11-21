import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getServerConfig, loadEnvironment } from "../server/config.ts";

test("environment precedence: shell > .env.local > .env", () => {
  const root = mkdtempSync(join(tmpdir(), "chronocall-env-"));
  try {
    writeFileSync(join(root, ".env"), "GEMINI_API_KEY=base\nPORT=3000\nHOST=127.0.0.1\n");
    writeFileSync(join(root, ".env.local"), "GEMINI_API_KEY=local\nPORT=4000\n");
    const env: NodeJS.ProcessEnv = { PORT: "5000" };
    loadEnvironment(root, env);
    assert.equal(env.GEMINI_API_KEY, "local");
    assert.equal(env.PORT, "5000");
    assert.equal(env.HOST, "127.0.0.1");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("demo mode does not require a key and defaults to port 3000", () => {
  const config = getServerConfig({ DEMO_MODE: "true" });
  assert.equal(config.demoMode, true);
  assert.equal(config.apiKeyConfigured, false);
  assert.equal(config.port, 3000);
  assert.equal(getServerConfig({ GEMINI_API_KEY: "MY_GEMINI_API_KEY" }).apiKeyConfigured, false);
  assert.equal(getServerConfig({ DEMO_MODE: "false" }).demoMode, false);
});

test("invalid ports fail with an actionable message", () => {
  for (const PORT of ["0", "65536", "abc", "3.5", ""]) {
    assert.throws(() => getServerConfig({ PORT }), /PORT must be an integer/);
  }
});

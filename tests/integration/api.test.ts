import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { createApp } from "../../server/app.ts";
import { demoServices } from "../../server/services/demo.ts";

test("HTTP contracts: health, validation, fixtures, and JSON errors", async () => {
  const server = createServer(createApp({ services: demoServices, demoMode: true, apiKeyConfigured: false }));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const post = (path: string, body: unknown) => fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  try {
    const health = await (await fetch(base + "/api/health")).json();
    assert.deepEqual(health, { ok: true, demoMode: true, apiKeyConfigured: false });
    for (const path of ["/api/detect", "/api/ask", "/api/character-world/transform", "/api/world/interact", "/api/world/generate-scene", "/api/world/spawn-object"]) {
      const response = await post(path, {});
      assert.equal(response.status, 400, path);
      assert.equal(typeof (await response.json()).error, "string");
    }
    const detection = await post("/api/detect", { imageBase64: "data:image/jpeg;base64,sample" });
    assert.equal(detection.status, 200);
    assert.equal((await detection.json()).model, "demo");
    const scene = await post("/api/world/generate-scene", { scenePrompt: "test" });
    assert.equal(scene.status, 200);
    assert.ok((await scene.json()).objects.length > 0);
    assert.equal((await post("/api/genie/session", {})).status, 503);
    assert.equal((await post("/api/genie/proxy/v1beta/interactions/demo:webrtc", {})).status, 503);
    const missing = await fetch(base + "/api/does-not-exist");
    assert.equal(missing.status, 404);
    assert.match(missing.headers.get("content-type") ?? "", /application\/json/);
    const malformed = await fetch(base + "/api/detect", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
    assert.equal(malformed.status, 400);
    assert.equal(typeof (await malformed.json()).error, "string");
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
});

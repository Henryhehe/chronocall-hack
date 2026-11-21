import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

async function request(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(10_000) });
}

async function waitForHealth(base) {
  const deadline = Date.now() + 20_000;
  let lastError;
  do {
    try {
      const response = await request(new URL("/api/health", base));
      assert.equal(response.status, 200, "Health endpoint must return 200");
      const health = await response.json();
      assert.equal(health.ok, true);
      assert.equal(typeof health.demoMode, "boolean");
      assert.equal(typeof health.apiKeyConfigured, "boolean");
      return health;
    } catch (error) {
      lastError = error;
      await delay(250);
    }
  } while (Date.now() < deadline);
  throw new Error(`Health check failed: ${lastError?.message}. Start the full server; warm an idle hosted service first.`);
}

async function checkDemoWebSocket(base, path) {
  const url = new URL(path, base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  await new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    let receivedDemoError = false;
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error(`${path} did not finish its demo handshake within 10 seconds`));
    }, 10_000);
    socket.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(String(event.data));
        if (payload.type === "error" && /demo mode/i.test(payload.message ?? "")) receivedDemoError = true;
      } catch (error) {
        clearTimeout(timeout);
        socket.close();
        reject(error);
      }
    });
    socket.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error(`${path} handshake failed; check proxy upgrade support`));
    });
    socket.addEventListener("close", () => {
      clearTimeout(timeout);
      if (receivedDemoError) resolve();
      else reject(new Error(`${path} closed without the expected demo-mode response`));
    });
  });
}

/** Checks a built deployment without making paid model calls. */
export async function runSmoke(baseUrl, { expectDemo = false, log = console.log } = {}) {
  const base = new URL(baseUrl);
  assert.ok(["http:", "https:"].includes(base.protocol), "Use an HTTP(S) origin");
  assert.ok(!base.username && !base.password, "Do not put credentials in the smoke URL");
  assert.ok(base.pathname === "/" && !base.search && !base.hash, "Use the root URL, without a path or query");
  const health = await waitForHealth(base);
  if (expectDemo) assert.equal(health.demoMode, true, "Expected DEMO_MODE=true; refusing fixture calls to a real model server");
  log(`PASS health (${health.demoMode ? "demo" : "Gemini"} mode; key ${health.apiKeyConfigured ? "configured" : "not configured"})`);

  const page = await request(base);
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-type") ?? "", /text\/html/);
  const html = await page.text();
  assert.match(html, /<title>Chronocall/);
  assert.doesNotMatch(html, /\/src\/main\.tsx|\/@vite\/client/, "Use the production server, not Vite development mode");
  const assets = [...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+\.(?:js|css))"/g)].map((match) => match[1]))];
  assert.ok(assets.some((asset) => asset.endsWith(".js")), "Built JavaScript entry is missing");
  assert.ok(assets.some((asset) => asset.endsWith(".css")), "Built CSS is missing");
  for (const asset of assets) {
    const response = await request(new URL(asset, base));
    assert.equal(response.status, 200, asset);
    assert.match(response.headers.get("content-type") ?? "", asset.endsWith(".js") ? /(?:java|ecma)script/ : /text\/css/, asset);
    assert.ok((await response.arrayBuffer()).byteLength > 0, `${asset} is empty`);
  }
  log(`PASS production HTML and ${assets.length} built assets`);

  const museum = await request(new URL("/museum", base));
  assert.equal(museum.status, 200, "Museum deep link");
  assert.match(museum.headers.get("content-type") ?? "", /text\/html/);
  assert.equal(await museum.text(), html, "Museum must serve the built SPA");
  const portrait = await request(new URL("/assets/aistudio/washington_fd94f6dd.jpeg", base));
  assert.equal(portrait.status, 200, "Museum portrait asset");
  assert.match(portrait.headers.get("content-type") ?? "", /image\/jpeg/);
  assert.ok((await portrait.arrayBuffer()).byteLength > 0, "Portrait must not be empty");
  const appUrlResponse = await request(new URL("/api/app-url", base));
  assert.equal(appUrlResponse.status, 200);
  const appUrl = new URL((await appUrlResponse.json()).appUrl);
  assert.equal(appUrl.origin, base.origin, "APP_URL must match the tested public origin for phone QR links");
  assert.equal(appUrl.pathname, "/museum");
  log("PASS museum deep link, portrait asset, and mobile QR destination");

  const unknown = await request(new URL("/api/smoke-does-not-exist", base));
  assert.equal(unknown.status, 404);
  assert.equal(typeof (await unknown.json()).error, "string", "Unknown API routes must not return the SPA HTML");
  const post = (path, body) => request(new URL(path, base), {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const invalid = await post("/api/detect", {});
  assert.equal(invalid.status, 400);
  assert.equal(typeof (await invalid.json()).error, "string");
  log("PASS API routing and request validation");

  // Only exercise fixtures when explicitly requested AND the server confirms demo mode.
  if (expectDemo) {
    const imageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/C9sAAAAASUVORK5CYII=";
    const fixtures = [
      ["/api/detect", { imageBase64 }, (data) => data.model === "demo" && Array.isArray(data.objects)],
      ["/api/ask", { imageBase64, question: "What is visible?" }, (data) => data.model === "demo" && typeof data.answer === "string"],
      ["/api/character-world/transform", { imageBase64, mimeType: "image/png" }, (data) => data.model === "demo" && data.imageDataUrl === `data:image/png;base64,${imageBase64}`],
      ["/api/world/interact", { objectName: "Crystal" }, (data) => typeof data.reply === "string" && typeof data.worldEffect === "string"],
      ["/api/world/generate-scene", { scenePrompt: "A courtyard" }, (data) => data.model === "demo" && data.objects.length > 0],
      ["/api/world/spawn-object", { objectPrompt: "Crystal", x: 2, z: 3 }, (data) => data.model === "demo" && data.object.x === 2 && data.object.z === 3],
    ];
    for (const [path, body, validate] of fixtures) {
      const response = await post(path, body);
      assert.equal(response.status, 200, path);
      assert.ok(validate(await response.json()), `${path} returned an unexpected fixture`);
    }
    const genie = await post("/api/genie/session", {});
    assert.equal(genie.status, 503);
    assert.match((await genie.json()).error, /demo mode/i);
    for (const path of ["/api/identify-portrait", "/api/character/respond", "/api/research-figure"]) {
      const response = await post(path, {});
      assert.equal(response.status, 503, path);
      assert.match((await response.json()).error, /demo mode/i);
    }
    for (const path of ["/ws/live", "/ws/museum"]) await checkDemoWebSocket(base, path);
    log("PASS six fixture APIs, Genie/museum demo responses, and both voice WebSocket handshakes/closures");
  } else {
    log("SKIP model calls and live sessions; use --demo against a demo server for fixture/WebSocket checks");
  }
  log("Production smoke checks passed. Camera, microphone, real model access, and WebRTC still need a browser rehearsal.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const unknown = args.filter((arg) => arg.startsWith("--") && arg !== "--demo");
  const urls = args.filter((arg) => !arg.startsWith("--"));
  if (unknown.length || urls.length > 1) {
    console.error("Usage: node scripts/smoke.mjs [http://localhost:3000] [--demo]");
    process.exitCode = 1;
  } else {
    await runSmoke(urls[0] ?? "http://localhost:3000", { expectDemo: args.includes("--demo") }).catch((error) => {
      console.error(`FAIL ${error.message}`);
      process.exitCode = 1;
    });
  }
}

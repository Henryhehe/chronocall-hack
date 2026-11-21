import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { createFaceTimeRouter, type FaceTimeServices } from "../../server/routes/facetime.ts";
import { normalizeHistoricalProfile } from "../../shared/facetime.ts";

test("FaceTime HTTP routes: validation, demo fixtures, and Veo media proxy", async () => {
  const demoApp = express();
  demoApp.use(express.json({ limit: "10mb" }));
  demoApp.use(createFaceTimeRouter(true));

  const server = createServer(demoApp);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const post = (path: string, body: unknown) =>
    fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  try {
    // Validation 400 checks
    assert.equal((await post("/api/facetime/resolve", {})).status, 400);
    assert.equal((await post("/api/facetime/identify", {})).status, 400);
    assert.equal((await post("/api/facetime/portrait", {})).status, 400);
    assert.equal((await post("/api/facetime/respond", {})).status, 400);

    // Resolve custom historical figure in demo mode
    const resolveRes = await post("/api/facetime/resolve", { query: "Nikola Tesla" });
    assert.equal(resolveRes.status, 200);
    const resolved = (await resolveRes.json()) as {
      profile: { name: string; sourceType: string };
      demoMode: boolean;
    };
    assert.equal(resolved.demoMode, true);
    assert.equal(resolved.profile.name, "Nikola Tesla");
    assert.equal(resolved.profile.sourceType, "search");

    // Identify scanned painting in demo mode
    const idRes = await post("/api/facetime/identify", {
      imageBase64: "data:image/jpeg;base64,abc123",
      mimeType: "image/jpeg",
    });
    assert.equal(idRes.status, 200);
    const identified = (await idRes.json()) as {
      detected: boolean;
      profile: { name: string } | null;
      demoMode: boolean;
    };
    assert.equal(identified.detected, true);
    assert.equal(identified.demoMode, true);
    assert.ok(identified.profile?.name);

    // Portrait generation in demo mode returns a valid SVG or image data URL
    const portraitRes = await post("/api/facetime/portrait", {
      profile: resolved.profile,
    });
    assert.equal(portraitRes.status, 200);
    const portrait = (await portraitRes.json()) as { imageDataUrl: string; model: string };
    assert.equal(portrait.model, "demo");
    assert.ok(portrait.imageDataUrl.startsWith("data:image/"));

    // Veo video endpoint returns 503 with clear explanation in demo mode
    const veoRes = await post("/api/facetime/video", {
      profile: resolved.profile,
      portraitDataUrl: portrait.imageDataUrl,
      mode: "listening",
    });
    assert.equal(veoRes.status, 503);

    // Text respond endpoint works in demo mode
    const respondRes = await post("/api/facetime/respond", {
      profile: resolved.profile,
      message: "What are you working on?",
    });
    assert.equal(respondRes.status, 200);
    const replied = (await respondRes.json()) as { reply: string; model: string };
    assert.equal(replied.model, "demo");
    assert.ok(replied.reply.length > 10);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("FaceTime live-mode Veo job start, poll, and binary media stream", async () => {
  const fakeMp4 = Buffer.from("FAKE_MP4_BYTES_FOR_TEST");
  const mockServices: FaceTimeServices = {
    resolveHistoricalFigure: async ({ query }) =>
      normalizeHistoricalProfile({ name: query }, "search"),
    identifyFigureFromImage: async () => ({
      detected: false,
      confidence: 0,
      artworkType: "unknown",
      artworkTitle: "",
      artist: "",
      year: "",
      profile: null,
    }),
    generateHistoricalPortrait: async () => ({
      imageDataUrl: "data:image/png;base64,AAAA",
      mimeType: "image/png",
      model: "mock-image",
      latencyMs: 5,
    }),
    generateHistoricalArtifact: async ({ title, description }) => ({
      title,
      description,
      imageDataUrl: "data:image/png;base64,BBBB",
      mimeType: "image/png",
      model: "mock-image",
      latencyMs: 6,
    }),
    startVeoPortraitVideo: async ({ mode }) => ({
      jobId: "job-123",
      status: "running",
      mode,
      model: "veo-test",
    }),
    pollVeoPortraitVideo: async (jobId) =>
      jobId === "job-123"
        ? {
            jobId,
            status: "ready",
            mode: "listening",
            model: "veo-test",
            videoUrl: `/api/facetime/video/${jobId}/media`,
          }
        : null,
    getVeoVideoMedia: async (jobId) =>
      jobId === "job-123" ? { buffer: fakeMp4, mimeType: "video/mp4" } : null,
    respondToFaceTimeText: async () => ({
      reply: "Hello from 1505!",
      latencyMs: 12,
      model: "mock-vision",
    }),
  };

  const liveApp = express();
  liveApp.use(express.json());
  liveApp.use(createFaceTimeRouter(false, mockServices));

  const server = createServer(liveApp);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    const startRes = await fetch(`${base}/api/facetime/video`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile: { name: "Leonardo da Vinci" },
        portraitDataUrl: "data:image/png;base64,AAAA",
        mode: "listening",
      }),
    });
    assert.equal(startRes.status, 200);
    const started = (await startRes.json()) as { jobId: string; status: string };
    assert.equal(started.jobId, "job-123");

    const pollRes = await fetch(`${base}/api/facetime/video/job-123`);
    assert.equal(pollRes.status, 200);
    const polled = (await pollRes.json()) as { status: string; videoUrl: string };
    assert.equal(polled.status, "ready");
    assert.equal(polled.videoUrl, "/api/facetime/video/job-123/media");

    const mediaRes = await fetch(`${base}${polled.videoUrl}`);
    assert.equal(mediaRes.status, 200);
    assert.equal(mediaRes.headers.get("content-type"), "video/mp4");
    const received = Buffer.from(await mediaRes.arrayBuffer());
    assert.deepEqual(received, fakeMp4);

    assert.equal((await fetch(`${base}/api/facetime/video/missing`)).status, 404);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

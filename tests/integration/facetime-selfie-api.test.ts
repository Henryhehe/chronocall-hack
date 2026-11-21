import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import {
  createFaceTimeRouter,
  type FaceTimeServices,
} from "../../server/routes/facetime.ts";
import {
  normalizeHistoricalProfile,
  type FaceTimeSelfieResult,
} from "../../shared/facetime.ts";

test("FaceTime Selfie API: validation and demo mode fixture", async () => {
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
    // 1. Missing profile -> 400
    const emptyRes = await post("/api/facetime/selfie", {});
    assert.equal(emptyRes.status, 400);
    const emptyJson = (await emptyRes.json()) as { error?: string };
    assert.ok(emptyJson.error?.includes("profile"));

    // 2. Profile with blank name -> 400
    const invalidProfileRes = await post("/api/facetime/selfie", {
      profile: { name: "   " },
    });
    assert.equal(invalidProfileRes.status, 400);

    // 3. Demo mode Chrono-Selfie generation
    const profile = normalizeHistoricalProfile({
      name: "Leonardo da Vinci",
      era: "1505 · Florence",
      location: "Florentine Workshop",
    });

    const selfieRes = await post("/api/facetime/selfie", {
      profile,
      callerImageBase64: "data:image/jpeg;base64,mockCallerFrame",
      figureImageBase64: "data:image/jpeg;base64,mockFigureFrame",
    });

    assert.equal(selfieRes.status, 200);
    const selfie = (await selfieRes.json()) as FaceTimeSelfieResult;

    assert.equal(selfie.demoMode, true);
    assert.equal(selfie.model, "demo");
    assert.equal(selfie.eraStamp, "1505 · Florence");
    assert.ok(selfie.caption.includes("Leonardo da Vinci"));
    assert.ok(selfie.imageDataUrl.startsWith("data:image/svg+xml;base64,"));

    // Verify SVG postcard contains key elements
    const svgBase64 = selfie.imageDataUrl.replace("data:image/svg+xml;base64,", "");
    const svgText = Buffer.from(svgBase64, "base64").toString("utf8");

    assert.ok(svgText.includes("<svg"), "Contains SVG root element");
    assert.ok(svgText.includes("Leonardo da Vinci"), "Contains figure name in postcard");
    assert.ok(svgText.includes("1505 · Florence"), "Contains era stamp in postcard");
    assert.ok(svgText.includes("CHRONO-SELFIE"), "Contains Chrono-Selfie badge");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("FaceTime Selfie API: live mode delegates to generateChronoSelfie and handles errors", async () => {
  let capturedParams: unknown = null;

  const mockServices = {
    resolveHistoricalFigure: async () => {
      throw new Error("not used");
    },
    identifyFigureFromImage: async () => {
      throw new Error("not used");
    },
    generateHistoricalPortrait: async () => {
      throw new Error("not used");
    },
    generateChronoSelfie: async (params: {
      profile: { name: string };
      callerImageBase64?: string;
      figureImageBase64?: string;
    }): Promise<FaceTimeSelfieResult> => {
      capturedParams = params;
      return {
        imageDataUrl: "data:image/png;base64,MOCK_LIVE_PNG_DATA",
        mimeType: "image/png",
        caption: `Time-travel selfie with ${params.profile.name} in Florence`,
        eraStamp: "1505 · Florence",
        model: "gemini-3.1-flash-lite-image",
        latencyMs: 350,
      };
    },
    startVeoPortraitVideo: async () => {
      throw new Error("not used");
    },
    pollVeoPortraitVideo: async () => null,
    getVeoVideoMedia: async () => null,
    respondToFaceTimeText: async () => {
      throw new Error("not used");
    },
  } as unknown as FaceTimeServices;

  const liveApp = express();
  liveApp.use(express.json({ limit: "10mb" }));
  liveApp.use(createFaceTimeRouter(false, mockServices));

  const server = createServer(liveApp);
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
    const profile = normalizeHistoricalProfile({
      name: "Leonardo da Vinci",
      era: "1505 · Florence",
      location: "Florentine Workshop",
    });

    const res = await post("/api/facetime/selfie", {
      profile,
      callerImageBase64: "data:image/jpeg;base64,CALLER_FACE",
      figureImageBase64: "data:image/jpeg;base64,FIGURE_PORTRAIT",
    });

    assert.equal(res.status, 200);
    const data = (await res.json()) as FaceTimeSelfieResult;

    assert.equal(data.model, "gemini-3.1-flash-lite-image");
    assert.equal(data.eraStamp, "1505 · Florence");
    assert.equal(data.imageDataUrl, "data:image/png;base64,MOCK_LIVE_PNG_DATA");
    assert.ok(capturedParams !== null);

    // Test error propagation from generateChronoSelfie
    const errorServices = {
      ...mockServices,
      generateChronoSelfie: async () => {
        throw new Error("Gemini image generation quota exceeded");
      },
    } as unknown as FaceTimeServices;

    const errorApp = express();
    errorApp.use(express.json({ limit: "10mb" }));
    errorApp.use(createFaceTimeRouter(false, errorServices));

    const errServer = createServer(errorApp);
    errServer.listen(0, "127.0.0.1");
    await once(errServer, "listening");
    const errBase = `http://127.0.0.1:${(errServer.address() as AddressInfo).port}`;

    try {
      const errRes = await fetch(errBase + "/api/facetime/selfie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      assert.equal(errRes.status, 500);
      const errJson = (await errRes.json()) as { error?: string };
      assert.ok(errJson.error?.includes("Gemini image generation quota exceeded"));
    } finally {
      await new Promise<void>((resolve) => errServer.close(() => resolve()));
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

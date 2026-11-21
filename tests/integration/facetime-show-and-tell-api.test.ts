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
  type FaceTimeArtifactResult,
} from "../../shared/facetime.ts";

test("POST /api/facetime/artifact: 400 validation for missing required fields", async () => {
  const app = express();
  app.use(express.json());
  app.use(createFaceTimeRouter(true));

  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const post = (body: unknown) =>
    fetch(`${base}/api/facetime/artifact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  try {
    // Missing body
    assert.equal((await post({})).status, 400);

    // Missing profile name
    assert.equal(
      (
        await post({
          profile: { era: "1505" },
          title: "Invention",
          description: "A sketch",
        })
      ).status,
      400
    );

    // Missing title
    assert.equal(
      (
        await post({
          profile: { name: "Leonardo da Vinci" },
          description: "A sketch",
        })
      ).status,
      400
    );

    // Missing description
    assert.equal(
      (
        await post({
          profile: { name: "Leonardo da Vinci" },
          title: "Aerial Screw",
        })
      ).status,
      400
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("POST /api/facetime/artifact: demo mode returns clean parchment SVG sketch keepsake", async () => {
  const app = express();
  app.use(express.json());
  app.use(createFaceTimeRouter(true));

  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    const res = await fetch(`${base}/api/facetime/artifact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile: {
          name: "Leonardo da Vinci",
          era: "1505 · Florence",
          location: "Florentine Bottega",
          initials: "LV",
        },
        title: "Study of an Aerial Screw",
        description: "Helical spiral blade apparatus demonstrating vertical air lift.",
        stylePrompt: "Sepia ink wash on aged parchment.",
      }),
    });

    assert.equal(res.status, 200);
    const data = (await res.json()) as FaceTimeArtifactResult;

    assert.equal(data.title, "Study of an Aerial Screw");
    assert.equal(data.description, "Helical spiral blade apparatus demonstrating vertical air lift.");
    assert.equal(data.model, "demo");
    assert.equal(data.demoMode, true);
    assert.equal(data.mimeType, "image/svg+xml");
    assert.ok(data.imageDataUrl.startsWith("data:image/svg+xml;base64,"));

    // Verify SVG contents decodable and contains historical hallmarks
    const base64Data = data.imageDataUrl.replace("data:image/svg+xml;base64,", "");
    const decodedSvg = Buffer.from(base64Data, "base64").toString("utf8");

    assert.ok(decodedSvg.includes("<svg"));
    assert.ok(decodedSvg.includes("Study of an Aerial Screw"));
    assert.ok(decodedSvg.includes("Leonardo da Vinci"));
    assert.ok(decodedSvg.includes("CHRONOCALL ARCHIVAL KEEPSAKE"));
    assert.ok(decodedSvg.includes("parchment"));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("POST /api/facetime/artifact: live mode invokes services.generateHistoricalArtifact", async () => {
  let invokedWithTitle = "";
  let invokedWithDescription = "";

  const mockServices: FaceTimeServices = {
    evaluateHistoricalTurnDecision: async () => { throw new Error("Unexpected evaluateHistoricalTurnDecision request"); },
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
      imageDataUrl: "data:image/png;base64,PORTRAIT",
      mimeType: "image/png",
      model: "mock-image",
      latencyMs: 5,
    }),
    generateHistoricalArtifact: async ({ title, description }) => {
      invokedWithTitle = title;
      invokedWithDescription = description;
      return {
        title,
        description,
        imageDataUrl: "data:image/png;base64,KEEPSAKE_PNG",
        mimeType: "image/png",
        model: "gemini-3.1-flash-lite-image",
        latencyMs: 24,
      };
    },
    startVeoPortraitVideo: async ({ mode }) => ({
      jobId: "veo-test",
      status: "running",
      mode,
      model: "veo-mock",
    }),
    pollVeoPortraitVideo: async () => null,
    getVeoVideoMedia: async () => null,
    respondToFaceTimeText: async () => ({
      reply: "Mock text reply",
      latencyMs: 10,
      model: "mock-model",
    }),
  };

  const app = express();
  app.use(express.json());
  app.use(createFaceTimeRouter(false, mockServices));

  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    const res = await fetch(`${base}/api/facetime/artifact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile: { name: "Marie Curie", era: "1902 · Paris" },
        title: "Pitchblende Radium Diagram",
        description: "Fractional crystallization laboratory schematic.",
      }),
    });

    assert.equal(res.status, 200);
    const data = (await res.json()) as FaceTimeArtifactResult;

    assert.equal(invokedWithTitle, "Pitchblende Radium Diagram");
    assert.equal(invokedWithDescription, "Fractional crystallization laboratory schematic.");
    assert.equal(data.title, "Pitchblende Radium Diagram");
    assert.equal(data.model, "gemini-3.1-flash-lite-image");
    assert.equal(data.imageDataUrl, "data:image/png;base64,KEEPSAKE_PNG");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { createFaceTimeRouter, type FaceTimeServices } from "../../server/routes/facetime.ts";
import { normalizeHistoricalProfile } from "../../shared/facetime.ts";

test("Online Artwork Search API: validation, demo auto-selection + alternatives, and safe proxy", async () => {
  const demoApp = express();
  demoApp.use(express.json({ limit: "10mb" }));
  demoApp.use(createFaceTimeRouter(true));

  const server = createServer(demoApp);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    // 400 validation checks
    assert.equal(
      (
        await fetch(`${base}/api/facetime/artwork-search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
      ).status,
      400
    );
    assert.equal(
      (
        await fetch(`${base}/api/facetime/artwork-fetch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
      ).status,
      400
    );
    assert.equal(
      (await fetch(`${base}/api/facetime/artwork-proxy?url=https://evil.example.com/a.jpg`))
        .status,
      400
    );

    // Demo mode auto-picks the most famous artwork and returns alternatives
    const searchRes = await fetch(`${base}/api/facetime/artwork-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "George Washington", mediumFilter: "all" }),
    });
    assert.equal(searchRes.status, 200);
    const data = (await searchRes.json()) as {
      selectedArtwork: { title: string; isMostFamous?: boolean; imageUrl: string } | null;
      alternatives: Array<{ id: string }>;
      profile: { name: string; artworkTitle?: string };
      demoMode: boolean;
    };
    assert.equal(data.demoMode, true);
    assert.ok(data.selectedArtwork);
    assert.equal(data.selectedArtwork.isMostFamous, true);
    assert.ok(data.alternatives.length >= 2);
    assert.equal(data.profile.artworkTitle, data.selectedArtwork.title);

    // Local /assets/ artwork passes through artwork-fetch cleanly
    const fetchRes = await fetch(`${base}/api/facetime/artwork-fetch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl: data.selectedArtwork.imageUrl }),
    });
    assert.equal(fetchRes.status, 200);
    const fetched = (await fetchRes.json()) as { imageDataUrl: string };
    assert.equal(fetched.imageDataUrl, data.selectedArtwork.imageUrl);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("Online Artwork Search API: live mode fetches allowlisted artwork and returns alternatives", async () => {
  const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  const mockServices: FaceTimeServices = {
    resolveHistoricalFigure: async ({ query }) =>
      normalizeHistoricalProfile({ name: query, era: "44 BC · Rome" }, "search"),
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
      model: "mock",
      latencyMs: 1,
    }),
    startVeoPortraitVideo: async ({ mode }) => ({
      jobId: "j1",
      status: "running",
      mode,
    }),
    pollVeoPortraitVideo: async () => null,
    getVeoVideoMedia: async () => null,
    respondToFaceTimeText: async () => ({
      reply: "Ave!",
      latencyMs: 1,
      model: "mock",
    }),
    searchOnlineArtworks: async () => ({
      selectedArtwork: {
        id: "wm-1",
        title: "Tusculum Portrait of Julius Caesar",
        artist: "Roman Sculptor",
        year: "c. 44 BC",
        medium: "sculpture",
        museum: "Museum of Antiquities, Turin",
        thumbnailUrl: "https://upload.wikimedia.org/caesar.jpg",
        imageUrl: "https://upload.wikimedia.org/caesar.jpg",
        pageUrl: "https://commons.wikimedia.org/caesar",
        isMostFamous: true,
        whyFamous: "Only surviving bust carved during Caesar's lifetime.",
      },
      alternatives: [
        {
          id: "met-2",
          title: "Bust of Gaius Julius Caesar",
          artist: "Classical Workshop",
          year: "1st c. AD",
          medium: "sculpture",
          museum: "The Metropolitan Museum of Art",
          thumbnailUrl: "https://images.metmuseum.org/caesar2.jpg",
          imageUrl: "https://images.metmuseum.org/caesar2.jpg",
          pageUrl: "https://www.metmuseum.org/caesar2",
        },
      ],
    }),
    fetchArtworkImage: async () => ({
      buffer: fakeJpeg,
      mimeType: "image/jpeg",
      dataUrl: `data:image/jpeg;base64,${fakeJpeg.toString("base64")}`,
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
    const res = await fetch(`${base}/api/facetime/artwork-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "Julius Caesar", mediumFilter: "sculpture" }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      selectedArtwork: { id: string; title: string };
      alternatives: Array<{ id: string }>;
      profile: { name: string; artworkTitle?: string };
    };
    assert.equal(body.selectedArtwork.id, "wm-1");
    assert.equal(body.alternatives.length, 1);
    assert.equal(body.profile.artworkTitle, "Tusculum Portrait of Julius Caesar");

    const fetchRes = await fetch(`${base}/api/facetime/artwork-fetch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl: "https://upload.wikimedia.org/caesar.jpg" }),
    });
    assert.equal(fetchRes.status, 200);
    const fetched = (await fetchRes.json()) as { imageDataUrl: string };
    assert.ok(fetched.imageDataUrl.startsWith("data:image/jpeg;base64,"));

    const proxyRes = await fetch(
      `${base}/api/facetime/artwork-proxy?url=${encodeURIComponent(
        "https://upload.wikimedia.org/caesar.jpg"
      )}`
    );
    assert.equal(proxyRes.status, 200);
    assert.equal(proxyRes.headers.get("content-type"), "image/jpeg");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

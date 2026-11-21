import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import { createFaceTimeRouter, type FaceTimeServices } from "../../server/routes/facetime.ts";
import { normalizeHistoricalProfile } from "../../shared/facetime.ts";

test("dial by name returns 422 with the reason when the name gate refuses", async () => {
  const services = {
    checkFigureName: async () => ({ allowed: false, kind: "living_person", confidence: 0.95, reason: "Not someone alive.", latencyMs: 1 }),
    resolveHistoricalFigure: async () => {
      throw new Error("must not build a persona for a refused name");
    },
  } as unknown as FaceTimeServices;
  const app = express().use(express.json()).use(createFaceTimeRouter(false, services));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as { port: number }).port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/facetime/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "a living celebrity" }),
    });
    assert.equal(res.status, 422);
    assert.equal((await res.json()).error, "Not someone alive.");
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test("dial by name works as before when the gate allows the name", async () => {
  const services = {
    checkFigureName: async () => ({ allowed: true, kind: "historical", confidence: 0.97, reason: "", latencyMs: 1 }),
    resolveHistoricalFigure: async ({ query }: { query: string }) => normalizeHistoricalProfile({ name: query }, "search"),
  } as unknown as FaceTimeServices;
  const app = express().use(express.json()).use(createFaceTimeRouter(false, services));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as { port: number }).port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/facetime/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "George Washington" }),
    });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).profile.name, "George Washington");
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { GoogleGenAI } from "@google/genai";
import { checkFigureName } from "../server/services/gemini/figureGate.ts";
import { createFaceTimeRouter, type FaceTimeServices } from "../server/routes/facetime.ts";
import { normalizeHistoricalProfile } from "../shared/facetime.ts";

const decisions = (choice: string, confidence: number) =>
  ({
    decisions: {
      create: async (req: Record<string, any>) => {
        assert.equal(req.api_version, "v1alpha");
        return { answers: { kind: { type: "choice", choice, confidence, probabilities: { [choice]: confidence } } } };
      },
    },
  }) as unknown as GoogleGenAI;

test("historical figures and figures from art are allowed", async () => {
  assert.equal((await checkFigureName(decisions("historical", 0.97), "George Washington")).allowed, true);
  assert.equal((await checkFigureName(decisions("art_or_legend", 0.9), "Girl with a Pearl Earring")).allowed, true);
});

test("living people are refused, with a reason the visitor can read", async () => {
  const r = await checkFigureName(decisions("living_person", 0.95), "a living celebrity");
  assert.equal(r.allowed, false);
  assert.match(r.reason, /alive today/);
});

test("an unsure answer is refused", async () => {
  assert.equal((await checkFigureName(decisions("historical", 0.4), "someone")).allowed, false);
});

test("dial by name returns 422 with the reason when the name gate refuses", async () => {
  const services = {
    checkFigureName: async () => ({ allowed: false, kind: "living_person", confidence: 0.95, reason: "Not someone alive.", latencyMs: 1 }),
    resolveHistoricalFigure: async () => {
      throw new Error("must not build a persona for a refused name");
    },
  } as unknown as FaceTimeServices;
  const app = express().use(express.json()).use(createFaceTimeRouter(false, services));
  const server = app.listen(0);
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
    server.close();
  }
});

test("dial by name works as before when the gate allows the name", async () => {
  const services = {
    checkFigureName: async () => ({ allowed: true, kind: "historical", confidence: 0.97, reason: "", latencyMs: 1 }),
    resolveHistoricalFigure: async ({ query }: { query: string }) => normalizeHistoricalProfile({ name: query }, "search"),
  } as unknown as FaceTimeServices;
  const app = express().use(express.json()).use(createFaceTimeRouter(false, services));
  const server = app.listen(0);
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
    server.close();
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import type { GoogleGenAI } from "@google/genai";
import { gateImage } from "../server/services/gemini/imageGate.ts";

// A stand-in for the Gemini client's Decisions API.
function fakeAi(kind: string, confidence: number, hasCharacter: number): GoogleGenAI {
  return {
    decisions: {
      create: async () => ({
        answers: {
          kind: { type: "choice", choice: kind, confidence, probabilities: { [kind]: confidence } },
          hasCharacter: { type: "noul", noul: hasCharacter, confidence: 0.9 },
        },
      }),
    },
  } as unknown as GoogleGenAI;
}

const img = { data: "AAAA", mimeType: "image/jpeg" };

test("a painting with a figure is allowed", async () => {
  const r = await gateImage(fakeAi("artwork_with_figure", 0.99, 0.85), img);
  assert.equal(r.allowed, true);
  assert.equal(r.reason, "");
});

test("a present-day person is never allowed, even if a figure is present", async () => {
  const r = await gateImage(fakeAi("living_person", 0.92, 0.95), img);
  assert.equal(r.allowed, false);
  assert.match(r.reason, /present-day person/);
});

test("an artwork with no one to talk to is refused (both questions must agree)", async () => {
  const r = await gateImage(fakeAi("artwork_with_figure", 0.95, 0.17), img);
  assert.equal(r.allowed, false);
});

test("a landscape is refused", async () => {
  const r = await gateImage(fakeAi("artwork_without_figure", 0.9, 0.1), img);
  assert.equal(r.allowed, false);
  assert.match(r.reason, /no person or animal/);
});

test("an unsure answer is refused with a hint to hold the camera steady", async () => {
  const r = await gateImage(fakeAi("historical_photo", 0.4, 0.9), img);
  assert.equal(r.allowed, false);
  assert.match(r.reason, /steady/);
});

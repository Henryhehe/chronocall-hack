import test from "node:test";
import assert from "node:assert/strict";
import type { GoogleGenAI } from "@google/genai";
import { checkFigureName } from "../server/services/gemini/figureGate.ts";

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

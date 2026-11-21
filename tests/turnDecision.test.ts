import test from "node:test";
import assert from "node:assert/strict";
import type { GoogleGenAI } from "@google/genai";
import { evaluateTurn, getTurnDecision } from "../server/services/gemini/turnDecision.ts";
import { REPLY_CHECKS } from "../server/services/gemini/replyChecks.ts";

// A stand-in for the Decisions API: yes/no answers from `flags`, plus a grounding choice and a score.
function fakeAi(flags: Record<string, number>, grounding = "verified", calls: Array<Record<string, any>> = []): GoogleGenAI {
  return {
    decisions: {
      create: async (req: Record<string, any>) => {
        calls.push(req);
        return {
          answers: {
            ...Object.fromEntries(REPLY_CHECKS.map((c) => [c.id, { type: "noul", noul: flags[c.id] ?? 0.01, confidence: 0.9 }])),
            historical_grounding: { type: "choice", choice: grounding, confidence: 0.82, probabilities: { [grounding]: 0.82 } },
            era_fidelity: { type: "score", confidence: 0.7, probabilities: { "2": 0.1, "3": 0.2, "4": 0.7 } },
          },
        };
      },
    },
  } as unknown as GoogleGenAI;
}

test("one Decisions API call gives both the reply checks and the telemetry verdict", async () => {
  const calls: Array<Record<string, any>> = [];
  const r = await evaluateTurn(fakeAi({}, "verified", calls), { utterance: "President? I know not this term." });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].api_version, "v1alpha");
  assert.equal(Object.keys(calls[0].questions).length, REPLY_CHECKS.length + 2);
  assert.equal(r.checks.passed, true);
  assert.equal(r.decision?.verdict, "verified");
  assert.equal(r.decision?.eraFidelityScore, 4);
  assert.equal(r.decision?.eraFidelityMax, 4);
});

test("a failed check is reported and the verdict can flag an anachronism", async () => {
  const r = await evaluateTurn(fakeAi({ hindsight: 0.9 }, "anachronism"), { utterance: "When I was President in 1789…" });
  assert.equal(r.checks.passed, false);
  assert.deepEqual(r.checks.failed, ["hindsight"]);
  assert.equal(r.decision?.verdict, "anachronism");
});

test("the latest result is kept so an HTTP route can reuse it instead of asking again", async () => {
  await evaluateTurn(fakeAi({}), { utterance: "The river is choked with ice." });
  assert.equal(getTurnDecision("  the river is choked   with ice. ")?.decision?.verdict, "verified");
});

test("if the Decisions API fails, the turn passes unchecked with the error reported", async () => {
  const broken = { decisions: { create: async () => { throw new Error("404"); } } } as unknown as GoogleGenAI;
  const r = await evaluateTurn(broken, { utterance: "Good day." });
  assert.equal(r.checks.passed, true);
  assert.equal(r.checks.error, "404");
  assert.equal(r.decision, null);
});

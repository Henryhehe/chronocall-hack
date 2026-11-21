import test from "node:test";
import assert from "node:assert/strict";
import type { GoogleGenAI } from "@google/genai";
import { evaluateTurn } from "../server/services/gemini/turnDecision.ts";
import { REPLY_CHECKS } from "../server/services/gemini/replyChecks.ts";

test("one turn evaluation supplies reply checks and the shared telemetry result", async () => {
  const requests: { questions: Record<string, unknown>; input: string }[] = [];
  const ai = { decisions: { create: async (request: typeof requests[number]) => {
    requests.push(request);
    return { answers: {
      ...Object.fromEntries(REPLY_CHECKS.map(check => [check.id, { noul: 0 }])),
      hindsight: { noul: 1 },
      historical_grounding: { choice: "anachronism", confidence: 0.95, probabilities: { anachronism: 0.95 } },
      era_fidelity: { probabilities: { "0": 0.9, "4": 0.1 } },
    } };
  } } } as unknown as GoogleGenAI;
  const result = await evaluateTurn(ai, { utterance: "I used a smartphone.", speaker: "George Washington", userPrompt: "How did you communicate?" });
  assert.equal(requests.length, 1);
  assert.equal(Object.keys(requests[0].questions).length, REPLY_CHECKS.length + 2);
  assert.match(requests[0].input, /George Washington/);
  assert.deepEqual(result.checks.failed, ["hindsight"]);
  assert.equal(result.decision?.verdict, "anachronism");
  assert.equal(result.decision?.eraFidelityScore, 0);
});

test("failed turn evaluation is unavailable, rather than a verified telemetry result", async () => {
  const ai = { decisions: { create: async () => { throw new Error("quota"); } } } as unknown as GoogleGenAI;
  const result = await evaluateTurn(ai, { utterance: "Good day." });
  assert.equal(result.decision, null);
  assert.equal(result.checks.error, "quota");
});

for (const choice of [undefined, 'unexpected']) {
  test(`missing or unknown grounding verdict (${choice}) never becomes verified`, async () => {
    const ai = { decisions: { create: async () => ({ answers: {
      historical_grounding: { choice, confidence: 0.9 },
    } }) } } as unknown as GoogleGenAI;
    const result = await evaluateTurn(ai, { utterance: 'Good day.' });
    assert.equal(result.decision?.verdict, 'unavailable');
    assert.equal(result.decision?.eraFidelityScore, null);
    assert.equal(result.checks.passed, false);
    assert.equal(result.checks.status, 'unavailable');
  });
}

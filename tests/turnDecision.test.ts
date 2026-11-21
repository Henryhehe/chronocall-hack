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


test("if the Decisions API fails, the turn is unavailable with the error reported", async () => {
  const broken = { decisions: { create: async () => { throw new Error("404"); } } } as unknown as GoogleGenAI;
  const r = await evaluateTurn(broken, { utterance: "Good day, stranger in the glass." });
  assert.equal(r.checks.passed, false);
  assert.equal(r.checks.status, "unavailable");
  assert.equal(r.checks.error, "404");
  assert.equal(r.decision, null);
});

test("the call bridge and the display share one Decisions API call for the same turn", async () => {
  const calls: Array<Record<string, any>> = [];
  const ai = fakeAi({}, "verified", calls);
  const [a, b] = await Promise.all([
    evaluateTurn(ai, { utterance: "The ice on the river grows thicker by the hour." }),
    evaluateTurn(ai, { utterance: "  The ice on the river   grows thicker by the hour. " }),
  ]);
  assert.equal(calls.length, 1);
  assert.equal(a, b);
});

test("the same words from different figures are evaluated separately", async () => {
  const calls: Array<Record<string, any>> = [];
  const ai = fakeAi({}, "verified", calls);
  await evaluateTurn(ai, { utterance: "Who goes there?", speaker: "George Washington (1776, Delaware)" });
  await evaluateTurn(ai, { utterance: "Who goes there?", speaker: "Frida Kahlo (1953, Coyoacán)" });
  await evaluateTurn(ai, { utterance: "Who goes there?", speaker: "George Washington (Commander, 1776, Delaware)" });
  assert.equal(calls.length, 3);
});

test("identical words with different instructions or visitor prompts are checked separately", async () => {
  const calls: Array<Record<string, any>> = [];
  const ai = fakeAi({}, "verified", calls);
  for (const p of [
    { instructions: 'You live in 1776.', userPrompt: 'What year is it?' },
    { instructions: 'You live in 1789.', userPrompt: 'What year is it?' },
    { instructions: 'You live in 1776.', userPrompt: 'When were you born?' },
  ]) await evaluateTurn(ai, { utterance: 'Seventeen seventy-six.', speaker: 'Washington', ...p });
  assert.equal(calls.length, 3);
});


test("different historical moments do not reuse a turn verdict", async () => {
  const calls: Array<Record<string, any>> = [];
  const ai = fakeAi({}, "verified", calls);
  for (const moment of ["1776", "1789"]) {
    await evaluateTurn(ai, { utterance: "I am leading this nation.", speaker: "Washington", moment });
  }
  assert.equal(calls.length, 2);
  assert.match(calls[0].input, /SPEAKER'S MOMENT: around 1776/);
  assert.match(calls[1].input, /SPEAKER'S MOMENT: around 1789/);
});

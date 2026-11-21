import test from "node:test";
import assert from "node:assert/strict";
import type { GoogleGenAI } from "@google/genai";
import { checkReply, correctionNote, REPLY_CHECKS, parseReplyChecks } from "../server/services/gemini/replyChecks.ts";

// A stand-in for the Gemini client: answers every Decisions API question with the given P(yes).
function fakeAi(p: Record<string, number>, calls: unknown[] = []): GoogleGenAI {
  return {
    decisions: {
      create: async (req: { questions: Record<string, unknown> }) => {
        calls.push(req);
        return {
          answers: Object.fromEntries(
            Object.keys(req.questions).map((id) => [id, { type: "noul", noul: p[id] ?? 0.01, confidence: 0.9 }]),
          ),
        };
      },
    },
  } as unknown as GoogleGenAI;
}

test("a clean reply passes every check in one Decisions API call", async () => {
  const calls: unknown[] = [];
  const result = await checkReply(fakeAi({}, calls), { reply: "Who are you, stranger, and are you a friend to the cause?" });
  assert.equal(result.passed, true);
  assert.deepEqual(result.failed, []);
  assert.equal(calls.length, 1);
  assert.equal(Object.keys((calls[0] as { questions: object }).questions).length, REPLY_CHECKS.length);
});

test("code decides: a check fails at its threshold, not below it", async () => {
  const result = await checkReply(fakeAi({ hindsight: 0.7, modernGuide: 0.74 }), { reply: "As president I…" });
  assert.equal(result.passed, false);
  assert.deepEqual(result.failed, ["hindsight"]);
});

test("if the Decisions API call fails, the reply goes through unchecked and the error is reported", async () => {
  const broken = { decisions: { create: async () => { throw new Error("quota"); } } } as unknown as GoogleGenAI;
  const result = await checkReply(broken, { reply: "Good day." });
  assert.equal(result.passed, false);
  assert.equal(result.status, "unavailable");
  assert.equal(result.error, "quota");
});

test("the correction note names only the failed checks", () => {
  const note = correctionNote(["advice"]);
  assert.match(note, /advice/);
  assert.doesNotMatch(note, /out of character/);
});

test('missing, nonfinite and out-of-range check scores cannot pass', () => {
  for (const bad of [undefined, NaN, Infinity, -0.1, 1.1, '0']) {
    const answers = Object.fromEntries(REPLY_CHECKS.map(c => [c.id, { noul: 0 }]));
    answers.hindsight = { noul: bad as number };
    const result = parseReplyChecks(answers, 1);
    assert.equal(result.passed, false);
    assert.equal(result.status, 'unavailable');
  }
});

// The evaluation judge: scores one reply from a historical figure with the Decisions API.
// It asks the five reply-check questions plus two the checks don't use (a grounding verdict and an
// era-fidelity score), so the judge isn't only grading the guard against itself.

import type { GoogleGenAI } from '@google/genai';
import { DECISION_MODEL, DECISIONS_API_VERSION, REPLY_CHECKS } from './replyChecks.ts';

export interface JudgeResult {
  /** P(yes) for each reply-check question (lower is better). */
  flags: Record<string, number>;
  /** verified / plausible_persona / anachronism / invented, with probabilities. */
  grounding: { choice: string; probabilities: Record<string, number> };
  /** Expected era-fidelity score, 0 (modern, out of character) to 4 (deeply authentic). */
  eraFidelity: number;
  latencyMs: number;
}

export async function judgeReply(
  ai: GoogleGenAI,
  p: { reply: string; instructions?: string; visitorMessage?: string; figure?: string },
): Promise<JudgeResult> {
  const t0 = Date.now();
  const input = [
    p.figure ? `SPEAKER: ${p.figure}` : '',
    p.instructions ? `INSTRUCTIONS GIVEN TO THE SPEAKER:\n${p.instructions}` : '',
    p.visitorMessage ? `VISITOR SAID:\n${p.visitorMessage}` : '',
    `REPLY:\n${p.reply}`,
  ]
    .filter(Boolean)
    .join('\n\n');
  const r = await ai.decisions.create({
    ...DECISIONS_API_VERSION,
    model: DECISION_MODEL,
    input,
    questions: {
      ...Object.fromEntries(REPLY_CHECKS.map((c) => [c.id, { type: 'noul' as const, instructions: c.question }])),
      grounding: {
        type: 'choice',
        instructions: "Judge the REPLY's historical content against what is documented about the SPEAKER.",
        criteria: {
          verified: 'States things consistent with documented history about the speaker and their time.',
          plausible_persona: 'In-character conversation or reaction with no checkable historical claims.',
          anachronism: 'Shows knowledge from after the speaker’s own time, or modern framing.',
          invented: 'States specific facts, names, dates or quotations that are not documented or are wrong.',
        },
      },
      eraFidelity: {
        type: 'score',
        instructions:
          'Rate how authentically the REPLY sounds like this person speaking from inside their own time, station and concerns.',
        criteria: [
          'Completely modern or out of character',
          'Mostly generic, little period grounding',
          'Passable period tone',
          'Strong, authentic period perspective',
          'Vivid, deeply grounded voice of this specific person in their time',
        ],
      },
    },
  });
  const flags: Record<string, number> = {};
  for (const c of REPLY_CHECKS) flags[c.id] = (r.answers?.[c.id] as { noul?: number } | undefined)?.noul ?? 0;
  const g = r.answers?.grounding as { choice?: string; probabilities?: Record<string, number> } | undefined;
  const s = r.answers?.eraFidelity as { probabilities?: Record<string, number> } | undefined;
  const probs = s?.probabilities ?? {};
  const eraFidelity = Object.entries(probs).reduce((sum, [k, v]) => sum + Number(k) * v, 0);
  return {
    flags,
    grounding: { choice: g?.choice ?? 'unknown', probabilities: g?.probabilities ?? {} },
    eraFidelity,
    latencyMs: Date.now() - t0,
  };
}

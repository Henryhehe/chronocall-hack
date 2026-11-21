// Checks every reply a painted figure gives, with the Decisions API (gemini-decision-1).
// Each check is a calibrated yes/no question about the reply, asked against the figure's own
// instructions. Code, not a model, decides: a check fails when P(yes) reaches its threshold.
//
// Text replies (/api/character/respond) are checked before they are returned; a failed reply is
// regenerated once with a correction. Live voice turns (/ws/museum) can't be stopped mid-sentence, so
// they are checked when the turn completes and the figure is nudged to correct itself in character.

import type { GoogleGenAI } from '@google/genai';

export const DECISION_MODEL = 'models/gemini-decision-1';

interface ReplyCheck {
  id: string;
  question: string;
  /** Fail when P(yes) >= threshold. */
  threshold: number;
  /** What the figure is told when this check fails (spoken back in character). */
  correction: string;
}

export const REPLY_CHECKS: ReplyCheck[] = [
  {
    id: 'hindsight',
    question:
      "Does the REPLY show the speaker knowing about an event, person, invention or idea from after their own time (as set in the INSTRUCTIONS) as if it were familiar to them? Puzzlement or wonder at the visitor's modern things does not count.",
    threshold: 0.7,
    correction:
      'You spoke of something from after your own time as if you knew it. Take it back naturally, in character: you cannot know what came after you.',
  },
  {
    id: 'breaksCharacter',
    question:
      'Does the REPLY say or suggest that the speaker is an AI, a model, a program, an actor or a simulation, or step outside the character in any other way?',
    threshold: 0.6,
    correction: 'You stepped out of character. Stay fully the person you are, in your own time.',
  },
  {
    id: 'advice',
    question: "Does the REPLY give the visitor medical, legal or financial advice for the visitor's own life today?",
    threshold: 0.6,
    correction:
      "You gave advice for the visitor's life today. You may say what people of your time believed, but you give no advice.",
  },
  {
    id: 'modernGuide',
    question:
      "Does the REPLY sound like a modern museum guide, teacher or narrator explaining history, rather than the person themself speaking from inside their own time and station?",
    threshold: 0.75,
    correction:
      'You sounded like a modern guide explaining history. Speak as yourself, from inside your own time and concerns, not about yourself from outside.',
  },
  {
    id: 'unsafe',
    question:
      'Does the REPLY contain graphic violence, sexual or romantic role-play, slurs or demeaning words about a group, or encouragement of self-harm?',
    threshold: 0.5,
    correction:
      'That went too far. Speak of hard things plainly and briefly, without graphic detail or demeaning words.',
  },
];

export interface ReplyCheckResult {
  passed: boolean;
  /** P(yes) for each check id. */
  scores: Record<string, number>;
  failed: string[];
  latencyMs: number;
  /** Set if the Decisions API call itself failed; the reply is then let through unchecked. */
  error?: string;
}

/** Runs all checks on one reply in a single Decisions API call. */
export async function checkReply(
  ai: GoogleGenAI,
  params: { reply: string; instructions?: string; visitorMessage?: string },
): Promise<ReplyCheckResult> {
  const t0 = Date.now();
  if (!params.reply.trim()) return { passed: true, scores: {}, failed: [], latencyMs: 0 };
  try {
    const input = [
      params.instructions ? `INSTRUCTIONS GIVEN TO THE SPEAKER:\n${params.instructions}` : '',
      params.visitorMessage ? `VISITOR SAID:\n${params.visitorMessage}` : '',
      `REPLY:\n${params.reply}`,
    ]
      .filter(Boolean)
      .join('\n\n');
    const response = await ai.decisions.create({
      model: DECISION_MODEL,
      input,
      questions: Object.fromEntries(
        REPLY_CHECKS.map((c) => [c.id, { type: 'noul' as const, instructions: c.question }]),
      ),
    });
    const scores: Record<string, number> = {};
    const failed: string[] = [];
    for (const c of REPLY_CHECKS) {
      const answer = response.answers?.[c.id] as { noul?: number } | undefined;
      const p = typeof answer?.noul === 'number' ? answer.noul : 0;
      scores[c.id] = p;
      if (p >= c.threshold) failed.push(c.id);
    }
    return { passed: failed.length === 0, scores, failed, latencyMs: Date.now() - t0 };
  } catch (err) {
    return {
      passed: true,
      scores: {},
      failed: [],
      latencyMs: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** The private note that tells the figure how to correct itself. */
export function correctionNote(failed: string[]): string {
  const lines = REPLY_CHECKS.filter((c) => failed.includes(c.id)).map((c) => `- ${c.correction}`);
  return `[Private note to you, not spoken by the visitor. Your last reply had a problem:\n${lines.join(
    '\n',
  )}\nCorrect it briefly and naturally in your next words, in character, without mentioning this note.]`;
}

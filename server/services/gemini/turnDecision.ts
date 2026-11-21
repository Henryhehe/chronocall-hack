// One Decisions API call per spoken turn. It answers:
//   - the five reply checks (hindsight, breaking character, advice, modern-guide voice, safety), which
//     drive self-correction in the call
//   - a grounding verdict and an era-fidelity score, in the shape the FaceTime telemetry display uses
//     (FaceTimeDecisionResult on feat/gemini-live-telemetry-cues), so both can share this one call.
import type { GoogleGenAI } from '@google/genai';
import { DECISION_MODEL, DECISIONS_API_VERSION, REPLY_CHECKS, type ReplyCheckResult } from './replyChecks.ts';

import type { FaceTimeDecisionResult, DecisionVerdict } from '../../../shared/facetime.ts';

export type TurnVerdict = DecisionVerdict;
export type TurnDecision = FaceTimeDecisionResult;

export interface TurnEvaluation {
  checks: ReplyCheckResult;
  decision: TurnDecision | null;
}

export async function evaluateTurn(
  ai: GoogleGenAI,
  p: { utterance: string; instructions?: string; userPrompt?: string; speaker?: string },
): Promise<TurnEvaluation> {
  const t0 = Date.now();
  const none: TurnEvaluation = { checks: { passed: true, scores: {}, failed: [], latencyMs: 0 }, decision: null };
  if (!p.utterance.trim()) return none;
  try {
    const input = [
      p.speaker ? `SPEAKER: ${p.speaker}` : '',
      p.instructions ? `INSTRUCTIONS GIVEN TO THE SPEAKER:\n${p.instructions}` : '',
      p.userPrompt ? `VISITOR SAID:\n${p.userPrompt}` : '',
      `REPLY:\n${p.utterance}`,
    ]
      .filter(Boolean)
      .join('\n\n');
    const r = await ai.decisions.create({
      ...DECISIONS_API_VERSION,
      model: DECISION_MODEL,
      input,
      questions: {
        ...Object.fromEntries(REPLY_CHECKS.map((c) => [c.id, { type: 'noul' as const, instructions: c.question }])),
        historical_grounding: {
          type: 'choice',
          instructions: "Classify the historical accuracy of the REPLY relative to the speaker's real era and biography.",
          criteria: {
            verified: 'Consistent with documented history, dates, setting, or authentic worldview of the figure.',
            plausible_persona: 'Conversational banter or reaction to a modern caller that stays faithfully in character.',
            anachronism: 'Contains a historical error or knowledge impossible for their era.',
          },
        },
        era_fidelity: {
          type: 'score',
          instructions: "Rate how authentically the REPLY's voice, tone and context match the figure's era.",
          criteria: [
            'Completely modern or out of character',
            'Mostly generic with minimal period grounding',
            'Passable historical tone',
            'Strong authentic era perspective',
            'Vivid, deeply grounded historical voice and accuracy',
          ],
        },
      },
    });
    const latencyMs = Date.now() - t0;

    const scores: Record<string, number> = {};
    const failed: string[] = [];
    for (const c of REPLY_CHECKS) {
      const pYes = (r.answers?.[c.id] as { noul?: number } | undefined)?.noul ?? 0;
      scores[c.id] = pYes;
      if (pYes >= c.threshold) failed.push(c.id);
    }

    const g = r.answers?.historical_grounding as
      | { choice?: string; confidence?: number; probabilities?: Record<string, number> }
      | undefined;
    const s = r.answers?.era_fidelity as { probabilities?: Record<string, number> } | undefined;
    const verdict: TurnVerdict =
      g?.choice === 'anachronism' || g?.choice === 'plausible_persona' ? g.choice : 'verified';
    const confidence = g?.confidence ?? 0;
    let eraFidelityScore = 0;
    let best = -1;
    for (const [k, prob] of Object.entries(s?.probabilities ?? {})) {
      if (prob > best) {
        best = prob;
        eraFidelityScore = Number(k);
      }
    }
    const decision: TurnDecision = {
      verdict,
      confidence,
      probabilities: g?.probabilities ?? {},
      eraFidelityScore,
      eraFidelityMax: 4,
      suggestedCue: verdict === 'anachronism' ? 'thoughtful_pause' : 'warm_nod',
      summary:
        verdict === 'anachronism'
          ? `Possible anachronism flagged (${Math.round(confidence * 100)}% calibrated)`
          : `Authentic in-character dialogue (${Math.round(confidence * 100)}% calibrated)`,
      model: DECISION_MODEL.replace(/^models\//, ''),
      latencyMs,
    };
    const result: TurnEvaluation = { checks: { passed: failed.length === 0, scores, failed, latencyMs }, decision };
    return result;
  } catch (err) {
    return {
      checks: { passed: true, scores: {}, failed: [], latencyMs: Date.now() - t0, error: err instanceof Error ? err.message : String(err) },
      decision: null,
    };
  }
}

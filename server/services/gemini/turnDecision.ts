// One Decisions API call per spoken turn. It answers:
//   - the five reply checks (hindsight, breaking character, advice, modern-guide voice, safety), which
//     drive self-correction in the call
//   - a grounding verdict and an era-fidelity score, in the shape the FaceTime telemetry display uses
//     (FaceTimeDecisionResult on feat/gemini-live-telemetry-cues), so both can share this one call.
import type { GoogleGenAI } from '@google/genai';
import { DECISION_MODEL, DECISIONS_API_VERSION, REPLY_CHECKS, parseReplyChecks, type ReplyCheckResult } from './replyChecks.ts';

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
  const none: TurnEvaluation = { checks: { passed: false, status: 'unavailable', scores: {}, failed: [], latencyMs: 0 }, decision: null };
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

    const checks = parseReplyChecks(r.answers, latencyMs);

    const g = r.answers?.historical_grounding as
      | { choice?: string; confidence?: number; probabilities?: Record<string, number> }
      | undefined;
    const s = r.answers?.era_fidelity as { probabilities?: Record<string, number> } | undefined;
    const verdict: TurnVerdict =
      checks.status !== 'unavailable' && ['anachronism', 'plausible_persona', 'verified'].includes(g?.choice ?? '') &&
      typeof g?.confidence === 'number' && Number.isFinite(g.confidence) && g.confidence >= 0 && g.confidence <= 1
        ? g!.choice as TurnVerdict : 'unavailable';
    const confidence = verdict === 'unavailable' ? 0 : g!.confidence!;
    let eraFidelityScore: number | null = null;
    let best = -1;
    for (const [k, prob] of Object.entries(s?.probabilities ?? {})) {
      if (Number.isInteger(Number(k)) && Number(k) >= 0 && Number(k) <= 4 && Number.isFinite(prob) && prob >= 0 && prob <= 1 && prob > best) {
        best = prob;
        eraFidelityScore = Number(k);
      }
    }
    const decision: TurnDecision = {
      verdict,
      confidence,
      probabilities: verdict === 'unavailable' ? {} : g?.probabilities ?? {},
      eraFidelityScore,
      eraFidelityMax: 4,
      suggestedCue: verdict === 'anachronism' ? 'thoughtful_pause' : 'warm_nod',
      summary:
        verdict === 'unavailable' ? 'Assessment unavailable: incomplete provider response.'
          : verdict === 'anachronism' ? 'Model flagged a possible anachronism; review the claim.'
          : 'Model-assessed era consistency; not independent source verification.',
      model: DECISION_MODEL.replace(/^models\//, ''),
      latencyMs,
    };
    const result: TurnEvaluation = { checks, decision };
    return result;
  } catch (err) {
    return {
      checks: { passed: false, status: 'unavailable', scores: {}, failed: [], latencyMs: Date.now() - t0, error: err instanceof Error ? err.message : String(err) },
      decision: null,
    };
  }
}

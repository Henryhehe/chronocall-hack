// The name gate: before a call is built from a typed name (dial by name, online artwork search), the
// Decisions API decides who the name refers to. Living people are never turned into a character: that
// prevents impersonating anyone alive, public or private. The camera path has its own image gate.

import type { GoogleGenAI } from '@google/genai';
import { DECISION_MODEL, DECISIONS_API_VERSION } from './replyChecks.ts';

export const NAME_KINDS = {
  historical: 'A real person from history who is no longer alive.',
  art_or_legend: 'A figure from art, myth, legend, scripture or literature, or an anonymous sitter in a painting.',
  living_person: 'A real person who is alive today, famous or not.',
  unclear: 'Not a person, or too unclear to tell who is meant.',
} as const;

export type NameKind = keyof typeof NAME_KINDS;

const ALLOWED: NameKind[] = ['historical', 'art_or_legend'];
const MIN_CONFIDENCE = 0.55;

const REASONS: Record<Exclude<NameKind, 'historical' | 'art_or_legend'> | 'unsure', string> = {
  living_person: 'Chronocall calls figures from history and art. It will not create a call with someone who is alive today.',
  unclear: 'Not sure who that is. Try a historical figure’s full name, or the title of a painting.',
  unsure: 'Not sure who that is. Try a historical figure’s full name, or the title of a painting.',
};

export interface NameGateResult {
  allowed: boolean;
  kind: NameKind | null;
  confidence: number;
  reason: string;
  latencyMs: number;
  error?: string;
}

export async function checkFigureName(ai: GoogleGenAI, query: string): Promise<NameGateResult> {
  const t0 = Date.now();
  try {
    const r = await ai.decisions.create({
      ...DECISIONS_API_VERSION,
      model: DECISION_MODEL,
      input: `A visitor wants to video-call this figure: "${query}"`,
      questions: {
        kind: {
          type: 'choice',
          instructions: 'Who does this name or description most likely refer to?',
          criteria: { ...NAME_KINDS },
        },
      },
    });
    const a = r.answers?.kind as { choice?: string; confidence?: number } | undefined;
    const kind = (a?.choice as NameKind | undefined) ?? null;
    const confidence = a?.confidence ?? 0;
    let reason = '';
    if (!kind || confidence < MIN_CONFIDENCE) reason = REASONS.unsure;
    else if (!ALLOWED.includes(kind)) reason = REASONS[kind as 'living_person' | 'unclear'];
    return { allowed: reason === '', kind, confidence, reason, latencyMs: Date.now() - t0 };
  } catch (err) {
    // If the Decisions API is unreachable, let the call through rather than block the demo.
    return { allowed: true, kind: null, confidence: 0, reason: '', latencyMs: Date.now() - t0, error: err instanceof Error ? err.message : String(err) };
  }
}

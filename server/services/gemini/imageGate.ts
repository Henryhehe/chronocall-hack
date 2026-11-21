// The image gate: before any figure comes to life, the Decisions API looks at the camera frame and
// answers two closed questions. Code then decides whether there is someone to talk to.
//
//  - What is this image? (one choice)  artwork with a figure / artwork without one (landscape,
//    still life, abstract) / historical photograph of a notable person / photo or live view of an
//    ordinary present-day person / no artwork at all.
//  - Is there a person or animal here that a visitor could talk to as a character? (yes/no)
//
// Only an artwork with a figure, or a historical photograph of a notable person, passes. An ordinary
// present-day person is never turned into a character: that protects privacy and stops the app being
// used to impersonate real people.

import type { GoogleGenAI } from '@google/genai';
import { DECISION_MODEL, DECISIONS_API_VERSION } from './replyChecks.ts';

export const IMAGE_KINDS = {
  artwork_with_figure:
    'A painting, drawing, print, mural, sculpture or other artwork (including a photo or screen showing one) that depicts at least one person or animal.',
  artwork_without_figure:
    'An artwork with no person or animal in it: a landscape, seascape, cityscape, still life, interior, pattern or abstract work.',
  historical_photo:
    'A historical photograph (old, archival or clearly from the past) of a notable historical person.',
  living_person:
    'A photograph or live camera view of an ordinary present-day person (for example a selfie, a visitor, a friend), not an artwork and not a historical figure.',
  no_artwork: 'Anything else: a room, an object, text, a blank wall, or a screen not showing an artwork.',
} as const;

export type ImageKind = keyof typeof IMAGE_KINDS;

const ALLOWED: ImageKind[] = ['artwork_with_figure', 'historical_photo'];
const MIN_KIND_CONFIDENCE = 0.6;
const MIN_CHARACTER_P = 0.6;

const REASONS: Record<ImageKind | 'no_character' | 'unsure', string> = {
  artwork_with_figure: '',
  historical_photo: '',
  artwork_without_figure: 'This artwork has no person or animal in it to talk to. Try a portrait or a scene with figures.',
  living_person: 'ChronoCall brings artworks and historical figures to life. It will not turn a photo of a real present-day person into a character.',
  no_artwork: 'No artwork found. Point the camera at a painting, sculpture or historical portrait.',
  no_character: 'No figure here that could speak. Try a portrait or a scene with people or animals.',
  unsure: 'Not sure what this is. Try holding the camera steady and closer to the artwork.',
};

export interface ImageGateResult {
  allowed: boolean;
  kind: ImageKind | null;
  /** Probability of each kind. */
  kinds: Record<string, number>;
  /** P(there is a figure a visitor could talk to). */
  hasCharacter: number;
  /** Shown to the visitor when not allowed. */
  reason: string;
  latencyMs: number;
  /** Set if the Decisions API call failed; identification is paused until the gate is available. */
  error?: string;
}

export async function gateImage(
  ai: GoogleGenAI,
  image: { data: string; mimeType?: string },
): Promise<ImageGateResult> {
  const t0 = Date.now();
  try {
    const response = await ai.decisions.create({
      ...DECISIONS_API_VERSION,
      model: DECISION_MODEL,
      input: [{ type: 'image', data: image.data, mime_type: image.mimeType ?? 'image/jpeg' }],
      questions: {
        kind: {
          type: 'choice',
          instructions: 'What does this camera frame mainly show?',
          criteria: { ...IMAGE_KINDS },
        },
        hasCharacter: {
          type: 'noul',
          instructions:
            'Is there a person or an animal in this image that a museum visitor could plausibly talk to as a character from an artwork or from history?',
        },
      },
    });
    const kindAnswer = response.answers?.kind as
      | { choice?: string; confidence?: number; probabilities?: Record<string, number> }
      | undefined;
    const charAnswer = response.answers?.hasCharacter as { noul?: number } | undefined;
    const kind = (kindAnswer?.choice as ImageKind | undefined) ?? null;
    const confidence = kindAnswer?.confidence ?? 0;
    const hasCharacter = charAnswer?.noul ?? 0;

    let reason = '';
    if (!kind || confidence < MIN_KIND_CONFIDENCE) reason = REASONS.unsure;
    else if (!ALLOWED.includes(kind)) reason = REASONS[kind];
    else if (hasCharacter < MIN_CHARACTER_P) reason = REASONS.no_character;

    return {
      allowed: reason === '',
      kind,
      kinds: kindAnswer?.probabilities ?? {},
      hasCharacter,
      reason,
      latencyMs: Date.now() - t0,
    };
  } catch (err) {
    return {
      allowed: false,
      kind: null,
      kinds: {},
      hasCharacter: 0,
      reason: 'Artwork check unavailable. Please try again.',
      latencyMs: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

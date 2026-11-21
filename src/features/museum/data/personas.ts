// Builds the `systemPersona` string the app already uses (PortraitArtwork.systemPersona, /ws/live,
// /api/character/respond) from the general character guide in fallbackPersona.ts.
// Live mode: nothing about a figure is pre-loaded. A figure starts on the guide alone, and
// /api/research-figure (src/features/museum/data/liveResearch.ts) upgrades it with checked live research.

import { buildFallbackPrompt, type SubjectKind } from './fallbackPersona';
import type { ARHotspot, PortraitArtwork } from '../types/portrait';

export interface ResolvedPersona {
  systemPersona: string;
  source: 'guide';
}

/**
 * Reads years from strings like "c. 1850 (depicting 1777)", "1503–1519", "30 BC".
 * `shown` is the moment the scene shows (the speaker lives there); `painted` is when it was made.
 */
export function parseYears(year?: string): { shown?: number; painted?: number } {
  if (!year) return {};
  const toNum = (m: RegExpMatchArray) => (/\bBC\b|\bBCE\b/i.test(m[0]) ? -Number(m[1]) : Number(m[1]));
  const depicting = year.match(/depict\w*\s+(?:c\.\s*)?(\d{1,4})(\s*(?:BC|BCE))?/i);
  const first = year.match(/(\d{1,4})(\s*(?:BC|BCE))?/i);
  const painted = first ? toNum(first) : undefined;
  const shown = depicting ? toNum(depicting) : painted;
  return { shown, painted };
}

/** The persona for the main figure of an identified or built-in artwork, before live research. */
export function resolvePersona(art: Partial<PortraitArtwork> & { characterName?: string }): ResolvedPersona {
  const { shown, painted } = parseYears(art.year);
  return {
    systemPersona: buildFallbackPrompt({
      kind: 'person',
      name: art.characterName,
      artworkTitle: art.title,
      artist: art.artist,
      year: shown,
      paintedYear: painted,
    }),
    source: 'guide',
  };
}

const CUE_KIND: Record<ARHotspot['animationCue'], SubjectKind> = {
  gaze: 'person',
  horse: 'animal',
  sword: 'object',
  uniform: 'object',
  horizon: 'place',
};

/**
 * The persona for a different part of the painting, when the visitor wants to talk to it
 * ("can I talk to the horse?"). Pass a hotspot, or a free description plus its kind.
 * To research that part live, send the same kind/subject to /api/research-figure.
 */
export function speakerPersona(
  art: PortraitArtwork,
  target: ARHotspot | { subject: string; kind: SubjectKind; name?: string },
): ResolvedPersona {
  const isHotspot = 'animationCue' in target;
  const kind = isHotspot ? CUE_KIND[target.animationCue] : target.kind;
  if (kind === 'person' && isHotspot) return resolvePersona(art);

  const { shown, painted } = parseYears(art.year);
  return {
    systemPersona: buildFallbackPrompt({
      kind,
      name: isHotspot ? undefined : target.name,
      subject: isHotspot ? `${target.label} in this painting (${target.eraDetail})` : target.subject,
      artworkTitle: art.title,
      artist: art.artist,
      year: shown,
      paintedYear: painted,
      alsoInScene: [art.characterName],
    }),
    source: 'guide',
  };
}

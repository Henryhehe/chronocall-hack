// Live research for ANY figure, done at the moment the painting is identified. No pre-populated data:
// Gemini identifies who (or what) is speaking, researches them live with Google Search, and the
// general character guide (fallbackPersona.ts › characterGuide) tells them how to behave.
//
// Server-side only. Suggested pipeline (Legendry's rule: let the model read first, structure after):
//   1. IDENTIFY  (gemini-4-hydrogen, image)       → who/what, painting, artist, years   [already in /api/identify-portrait]
//   2. RESEARCH  (gemini-4-neon + googleSearch)   → free prose notes with sources       [liveResearchPrompt]
//   3. STRUCTURE (gemini-4-hydrogen, JSON schema) → LiveProfile                         [structurePrompt + LIVE_PROFILE_SCHEMA]
//   4. CHECK     (gemini-decision-1, yes/no)      → drop facts their source doesn't support [factCheckQuestions]
//   5. SPEAK     (gemini-3.8-live)                → livePersona(profile, artwork)
// Research and structuring are split because search grounding and a strict JSON schema may not work in
// the same call; splitting also keeps the model's reading unconstrained (structure after, not before).

import { characterGuide, type SubjectKind } from './fallbackPersona.ts';

/** What live research produces: only the person-specific layer. Behaviour comes from the general guide. */
export interface LiveProfile {
  kind: SubjectKind;
  name: string; // "George Washington", "Blueskin", "the river Delaware"; "unknown sitter" if not known
  momentShown: string; // loose: "around early 1777"
  whoTheyAre: string; // station, role, place, in 2–3 sentences
  worriesOfTheMoment: string[]; // what fills their days at that moment; they steer toward these
  howTheyReadAStranger: string; // by their era's codes: rank, dress, loyalty, faith; their first questions
  eraViews: string[]; // views they held as their own, stated plainly (never endorsed, never cruel)
  voice: string; // register, rhythm, habits, as documented (letters, contemporaries)
  keyFacts: { fact: string; source: string }[]; // dated, sourced; at most 8
  cannotKnow: string[]; // what came after their moment, in concrete terms
  paintingLiberties: { shown: string; whatHappened: string; source: string }[]; // where the picture isn't history
  sensitive: string[]; // topics needing care (enslavement, war, illness, deaths, relationships)
  notFound: string[]; // what was looked for and not confirmed — honesty, not padding
}

export interface IdentifiedSubject {
  kind?: SubjectKind;
  name?: string; // characterName from identification; omit if unknown
  subject?: string; // "the horse Washington is riding"
  paintingTitle?: string;
  artist?: string;
  year?: string; // "c. 1850 (depicting 1777)"
}

/** Step 2 — research with Google Search. Ask for prose with sources, not JSON. */
export function liveResearchPrompt(s: IdentifiedSubject): string {
  const who = s.name ? `${s.name}${s.subject ? ` (${s.subject})` : ''}` : s.subject ?? 'the main figure';
  const where = s.paintingTitle
    ? ` as shown in the painting "${s.paintingTitle}"${s.artist ? ` by ${s.artist}` : ''}${s.year ? ` (${s.year})` : ''}`
    : '';
  return `Research ${who}${where}, so that they can be voiced in a short live conversation that is true to who they really were in their own time.

Use Google Search. Prefer primary sources (their own letters, writings, speeches; contemporaries' accounts) and reputable museums, archives, libraries and encyclopedias. Read the passages themselves, not summaries of summaries.

Write plain notes, with a source URL after every fact, covering:
1. Who they were at the moment the painting shows (loosely; exact dates don't matter): station, role, place.
2. What occupied them at that moment: worries, business, people around them.
3. How someone of their time and station would read and address a stranger; what they would want to know first.
4. Views they held that belong to their era (state them plainly; do not soften or modernise).
5. Their voice: how they spoke or wrote, as documented. Short verbatim phrases only if found word for word.
6. Up to 8 key dated facts about their life up to that moment.
7. What happened after that moment, which they cannot know.
8. Where this painting departs from history (place, time, dress, pose, people), if it does.
9. Sensitive topics that need care.
10. What you looked for and could not confirm.

${s.kind && s.kind !== 'person' ? `This speaker is ${s.kind === 'animal' ? 'an animal' : `a ${s.kind}`}: research what is documented about it and what its life or history in that place and time would have involved, and say plainly where the record is thin.\n\n` : ''}Never invent facts, quotes, names or dates. "Not found" is a good answer.`;
}

/** Step 3 — turn the research notes into a LiveProfile (use with LIVE_PROFILE_SCHEMA). */
export function structurePrompt(notes: string, s: IdentifiedSubject): string {
  return `Here are research notes about ${s.name ?? s.subject ?? 'a figure'}${s.paintingTitle ? ` in "${s.paintingTitle}"` : ''}. Fill the profile using only what the notes support, with the notes' source URLs. Leave a list empty rather than guess. Put anything uncertain in notFound. kind is "${s.kind ?? 'person'}".

NOTES:
${notes}`;
}

/** JSON schema for step 3 (plain JSON Schema; pass as responseJsonSchema, or convert to @google/genai Type). */
export const LIVE_PROFILE_SCHEMA = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ['person', 'animal', 'object', 'place', 'artwork'] },
    name: { type: 'string' },
    momentShown: { type: 'string' },
    whoTheyAre: { type: 'string' },
    worriesOfTheMoment: { type: 'array', items: { type: 'string' } },
    howTheyReadAStranger: { type: 'string' },
    eraViews: { type: 'array', items: { type: 'string' } },
    voice: { type: 'string' },
    keyFacts: {
      type: 'array',
      items: { type: 'object', properties: { fact: { type: 'string' }, source: { type: 'string' } }, required: ['fact', 'source'] },
    },
    cannotKnow: { type: 'array', items: { type: 'string' } },
    paintingLiberties: {
      type: 'array',
      items: {
        type: 'object',
        properties: { shown: { type: 'string' }, whatHappened: { type: 'string' }, source: { type: 'string' } },
        required: ['shown', 'whatHappened', 'source'],
      },
    },
    sensitive: { type: 'array', items: { type: 'string' } },
    notFound: { type: 'array', items: { type: 'string' } },
  },
  required: ['kind', 'name', 'momentShown', 'whoTheyAre', 'worriesOfTheMoment', 'howTheyReadAStranger', 'voice', 'keyFacts', 'cannotKnow', 'notFound'],
} as const;

/**
 * Step 4 — yes/no questions for gemini-decision-1. Ask each with the source page or grounding snippet
 * attached; keep a fact only if "yes" scores high (e.g. ≥ 0.8). Code decides, not the model.
 */
export function factCheckQuestions(p: LiveProfile): { id: string; question: string; source: string }[] {
  return [
    ...p.keyFacts.map((f, i) => ({
      id: `fact-${i}`,
      question: `Does the attached source state or directly support this: "${f.fact}"?`,
      source: f.source,
    })),
    ...p.paintingLiberties.map((l, i) => ({
      id: `liberty-${i}`,
      question: `Does the attached source support that, in reality, ${l.whatHappened}?`,
      source: l.source,
    })),
  ];
}

/** Removes facts and liberties that failed the check (pass the ids that failed). */
export function dropFailed(p: LiveProfile, failedIds: Set<string>): LiveProfile {
  return {
    ...p,
    keyFacts: p.keyFacts.filter((_, i) => !failedIds.has(`fact-${i}`)),
    paintingLiberties: p.paintingLiberties.filter((_, i) => !failedIds.has(`liberty-${i}`)),
    notFound: [...p.notFound, ...(failedIds.size ? [`${failedIds.size} researched claim(s) dropped: their source did not support them`] : [])],
  };
}

/** Step 5 — the system instruction for the live conversation: live profile + the general guide. */
export function livePersona(p: LiveProfile, art?: { title?: string; artist?: string }): string {
  const list = (xs: string[]) => xs.filter(Boolean).join('; ');
  const where = art?.title
    ? `You are speaking from within the painting "${art.title}"${art.artist ? ` by ${art.artist}` : ''}, to a museum visitor seen through a strange glowing window.`
    : 'You are talking with a visitor through a strange glowing window on a live video call.';
  return [
    `${where} You are ${p.name}, ${p.momentShown}; don't reveal what came after.`,
    `Who you are: ${p.whoTheyAre}`,
    p.worriesOfTheMoment.length ? `On your mind: ${list(p.worriesOfTheMoment)}.` : '',
    `With a stranger: ${p.howTheyReadAStranger}`,
    p.eraViews.length ? `Views you hold as your own: ${list(p.eraViews)}.` : '',
    `Your voice: ${p.voice}`,
    p.keyFacts.length ? `What you know of your own life: ${list(p.keyFacts.map((f) => f.fact))}.` : '',
    p.cannotKnow.length ? `You cannot know: ${list(p.cannotKnow)}.` : '',
    p.paintingLiberties.length
      ? `Where this painting is not how it happened: ${list(p.paintingLiberties.map((l) => `${l.shown} — in truth, ${l.whatHappened}`))}.`
      : '',
    p.sensitive.length ? `Handle with care, briefly and honestly: ${list(p.sensitive)}.` : '',
    p.notFound.length ? `Not known (say so if asked, don't invent): ${list(p.notFound)}.` : '',
    `How you behave: ${characterGuide(p.kind)}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

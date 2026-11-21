// Live research for any figure, shared by the museum route and the FaceTime call.
//
//   research  (Google Search grounding)  → notes with sources
//   structure (JSON schema)              → LiveProfile
//   check     (Decisions API, yes/no)    → drop facts the notes don't support
//
// Two speeds, two Gemini 4 models with clear jobs (measured 21 Nov 2026, effort LOW):
//   quick: gemini-4-hydrogen, short prompt  → about 20–25 s; upgrades a call early
//   deep:  gemini-4-neon,     full prompt   → about 30–80 s; upgrades the same call later, and is cached
// Neither blocks a call: the figure speaks on the general guide from the first second.

import { ThinkingLevel, type GoogleGenAI } from '@google/genai';
import {
  liveResearchPrompt,
  structurePrompt,
  LIVE_PROFILE_SCHEMA,
  factCheckQuestions,
  dropFailed,
  livePersona,
  type LiveProfile,
  type IdentifiedSubject,
  type ResearchDepth,
} from '../../../src/features/museum/data/liveResearch.ts';
import { DECISION_MODEL, DECISIONS_API_VERSION } from './replyChecks.ts';

export type ResearchStage = 'quick' | 'deep';

export interface ResearchOptions {
  model?: string;
  structureModel?: string;
  depth?: ResearchDepth;
  thinking?: 'LOW' | 'MEDIUM';
  timeoutMs?: number;
}

export const STAGE_DEFAULTS: Record<ResearchStage, Required<Omit<ResearchOptions, 'timeoutMs'>> & { timeoutMs: number }> = {
  quick: {
    model: process.env.QUICK_RESEARCH_MODEL || 'gemini-4-hydrogen',
    structureModel: 'gemini-4-hydrogen',
    depth: 'quick',
    thinking: 'LOW',
    timeoutMs: Number(process.env.QUICK_RESEARCH_TIMEOUT_MS) || 45_000,
  },
  deep: {
    model: process.env.DEEP_RESEARCH_MODEL || 'gemini-4-neon',
    structureModel: 'gemini-4-hydrogen',
    depth: 'full',
    thinking: 'LOW',
    timeoutMs: Number(process.env.DEEP_RESEARCH_TIMEOUT_MS) || 120_000,
  },
};

export interface ResearchResult {
  profile: LiveProfile;
  systemPersona: string;
  checks: Record<string, number>;
  dropped: string[];
  droppedClaims?: { id: string; question: string; source: string; score: number }[];
  cached?: boolean;
  sources: { title?: string; uri?: string }[];
  /** False when the search returned no sources: the facts may come from the model's memory alone. */
  grounded: boolean;
  timings: Record<string, number>;
  settings: { model: string; structureModel: string; depth: ResearchDepth; thinking: string };
}

const cache = new Map<string, Promise<ResearchResult>>();

export function researchKey(s: IdentifiedSubject, stage: string): string {
  return JSON.stringify([stage, s.kind, s.name, s.subject, s.paintingTitle]).toLowerCase();
}

/** Runs research for one subject. Results are cached per subject and stage, including in-flight calls. */
export function researchFigure(
  ai: GoogleGenAI,
  s: IdentifiedSubject,
  stage: ResearchStage | ResearchOptions = 'quick',
  opts: { noCache?: boolean } = {},
): Promise<ResearchResult> {
  const o = typeof stage === 'string' ? STAGE_DEFAULTS[stage] : { ...STAGE_DEFAULTS.quick, ...stage };
  const key = researchKey(s, JSON.stringify([o.model, o.depth, o.thinking]));
  if (!opts.noCache && cache.has(key)) return cache.get(key)!.then(result => ({ ...result, cached: true }));
  const job = run(ai, s, o).catch((err) => {
    cache.delete(key); // don't cache failures
    throw err;
  });
  cache.set(key, job);
  return job;
}

async function run(
  ai: GoogleGenAI,
  s: IdentifiedSubject,
  o: Required<ResearchOptions>,
): Promise<ResearchResult> {
  const t0 = Date.now();
  const timings: Record<string, number> = {};
  const label = `${s.name ?? s.subject} [${o.model}/${o.depth}]`;
  console.log(`[research] start ${label}`);

  const research = await ai.models.generateContent({
    model: o.model,
    contents: liveResearchPrompt(s, o.depth),
    config: {
      tools: [{ googleSearch: {} }],
      thinkingConfig: { thinkingLevel: ThinkingLevel[o.thinking] },
      abortSignal: AbortSignal.timeout(o.timeoutMs),
    },
  });
  const notes = research.text ?? '';
  const sources = (research.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [])
    .map((c) => ({ title: c.web?.title, uri: c.web?.uri }))
    .filter((c) => c.uri);
  timings.researchMs = Date.now() - t0;

  const structured = await ai.models.generateContent({
    model: o.structureModel,
    contents: structurePrompt(notes, s),
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseJsonSchema: LIVE_PROFILE_SCHEMA,
    },
  });
  let profile = JSON.parse((structured.text ?? '{}').trim()) as LiveProfile;
  profile.keyFacts ??= [];
  profile.paintingLiberties ??= [];
  profile.eraViews ??= [];
  profile.sensitive ??= [];
  profile.notFound ??= [];
  profile.cannotKnow ??= [];
  profile.worriesOfTheMoment ??= [];
  timings.structureMs = Date.now() - t0 - timings.researchMs;

  // Decisions API: every fact and painter's liberty must be supported by the notes (P(yes) >= 0.8).
  const checks: Record<string, number> = {};
  const qs = factCheckQuestions(profile);
  if (qs.length) {
    const t2 = Date.now();
    const decision = await ai.decisions.create({
      ...DECISIONS_API_VERSION,
      model: DECISION_MODEL,
      input: `RESEARCH NOTES WITH SOURCES:\n${notes}`,
      questions: Object.fromEntries(
        qs.map((q) => [
          q.id,
          {
            type: 'noul' as const,
            instructions: `${q.question.replace('the attached source', 'the research notes, citing ' + q.source)} Answer true only if the notes clearly support it.`,
          },
        ]),
      ),
    });
    for (const q of qs) {
      const a = decision.answers?.[q.id] as { noul?: number } | undefined;
      checks[q.id] = a?.noul ?? 0;
    }
    timings.checkMs = Date.now() - t2;
  }
  const failed = new Set(Object.entries(checks).filter(([, p]) => p < 0.8).map(([id]) => id));
  profile = dropFailed(profile, failed);

  // No sources means the search wasn't used: keep the profile, but flag every fact as unverified.
  const grounded = sources.length > 0;
  if (!grounded) {
    profile.notFound = [
      ...profile.notFound,
      'The live search returned no sources, so these facts are from memory and unverified; mention them only with care.',
    ];
  }

  timings.totalMs = Date.now() - t0;
  console.log(
    `[research] done ${label} in ${timings.totalMs} ms: ${profile.keyFacts.length} facts, ${sources.length} sources, ${failed.size} dropped`,
  );
  return {
    profile,
    systemPersona: livePersona(profile, { title: s.paintingTitle, artist: s.artist }),
    checks,
    dropped: [...failed],
    droppedClaims: qs.filter(q => failed.has(q.id)).map(q => ({ ...q, score: checks[q.id] })),
    cached: false,
    sources,
    grounded,
    timings,
    settings: { model: o.model, structureModel: o.structureModel, depth: o.depth, thinking: o.thinking },
  };
}

/**
 * The private note that hands research to a live call. It's added as context without asking the
 * figure to speak, so nothing is announced; the figure simply knows more from then on.
 */
export function researchNote(r: ResearchResult, stage: ResearchStage): string {
  const p = r.profile;
  const list = (xs: string[]) => xs.filter(Boolean).join('; ');
  return [
    `[Private notes for you, not said by the caller (${stage} research, ${r.grounded ? `${r.sources.length} sources` : 'unverified'}). Use them from now on, in character; never mention notes or research.`,
    p.worriesOfTheMoment.length ? `On your mind at this moment: ${list(p.worriesOfTheMoment)}.` : '',
    p.howTheyReadAStranger ? `With a stranger: ${p.howTheyReadAStranger}` : '',
    p.voice ? `Your voice: ${p.voice}` : '',
    p.keyFacts.length ? `What you know of your own life: ${list(p.keyFacts.map((f) => f.fact))}.` : '',
    p.cannotKnow.length ? `You cannot know: ${list(p.cannotKnow)}.` : '',
    p.paintingLiberties.length
      ? `Where the picture of you is not how it happened: ${list(p.paintingLiberties.map((l) => `${l.shown}, but in truth ${l.whatHappened}`))}.`
      : '',
    p.notFound.length ? `Not known (say so if asked): ${list(p.notFound)}.` : '',
    ']',
  ]
    .filter(Boolean)
    .join('\n');
}

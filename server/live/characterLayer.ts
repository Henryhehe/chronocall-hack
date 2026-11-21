// The character layer for a FaceTime call. Kept in its own file so the call bridge needs only three
// small hooks, away from the lines other FaceTime features edit:
//   1. observe(event)   inside sendSafe: reads transcripts and turn ends from events already sent
//   2. prepare(profile) after the profile is read: adds the general character guide to the persona
//   3. start()          after the greeting: starts background research (quick, then deep)
// Its own events go to the client directly, so shared/facetime.ts is unchanged; clients that don't
// know them ignore them.

import { WebSocket } from 'ws';
import { getGeminiClient } from '../services/gemini/client.ts';
import { researchFigure, researchNote, type ResearchStage } from '../services/gemini/research.ts';
import { correctionNote } from '../services/gemini/replyChecks.ts';
import { evaluateTurn, type TurnDecision } from '../services/gemini/turnDecision.ts';
import { characterGuide } from '../../src/features/museum/data/fallbackPersona.ts';
import type { HistoricalProfile } from '../../shared/facetime.ts';

/** Extra server events from the character layer (in addition to FaceTimeServerEvent). */
export type CharacterServerEvent =
  | { type: 'research'; stage: ResearchStage; facts: number; sources: number; grounded: boolean; dropped: number; ms: number }
  | { type: 'researchFailed'; stage: ResearchStage; message: string }
  | { type: 'replyCheck'; passed: boolean; failed: string[]; scores: Record<string, number>; latencyMs: number }
  | { type: 'turnDecision'; decision: TurnDecision };

interface LiveSessionLike {
  sendClientContent(params: { turns: { role: string; parts: { text: string }[] }[]; turnComplete: boolean }): void;
}

const GUIDE_MARK = 'How you behave:';

export function createCharacterLayer(opts: {
  clientWs: WebSocket;
  getSession: () => LiveSessionLike | null;
  isClosed: () => boolean;
}) {
  let profile: HistoricalProfile | null = null;
  let spoken = '';
  let heard = '';

  const send = (event: CharacterServerEvent) => {
    if (opts.clientWs.readyState === WebSocket.OPEN) opts.clientWs.send(JSON.stringify(event));
  };
  const note = (text: string, turnComplete: boolean) => {
    const session = opts.getSession();
    if (session && !opts.isClosed()) session.sendClientContent({ turns: [{ role: 'user', parts: [{ text }] }], turnComplete });
  };

  return {
    /** Adds the general character guide to the persona (once). */
    prepare(p: HistoricalProfile) {
      if (!p.systemPersona.includes(GUIDE_MARK)) {
        p.systemPersona = [
          p.systemPersona,
          `${GUIDE_MARK} ${characterGuide('person')}`,
          'This overrides any instruction to be warm or welcoming: meet the caller as you would meet a stranger in your own time. More about you may arrive during the call as private notes; use them quietly, never mention them.',
        ].join('\n\n');
      }
      profile = p;
    },

    /** Called with every event the bridge sends: collects transcripts and evaluates each finished turn. */
    observe(event: { type: string; text?: string }) {
      if (event.type === 'inputTranscript' && event.text) heard += event.text;
      else if (event.type === 'outputTranscript' && event.text) spoken += event.text;
      else if (event.type === 'turnComplete') {
        const utterance = spoken.trim();
        const userPrompt = heard.trim();
        spoken = '';
        heard = '';
        if (!utterance || !profile) return;
        void evaluateTurn(getGeminiClient(), {
          utterance,
          userPrompt,
          instructions: profile.systemPersona,
          speaker: `${profile.name} (${profile.title}, ${profile.era}, ${profile.location})`,
        }).then(({ checks, decision }) => {
          send({ type: 'replyCheck', passed: checks.passed, failed: checks.failed, scores: checks.scores, latencyMs: checks.latencyMs });
          if (decision) send({ type: 'turnDecision', decision });
          if (!checks.passed) note(correctionNote(checks.failed), true);
        });
      }
    },

    /** Starts quick (Hydrogen) and deep (Neon) research; each result is added to the call silently. */
    start() {
      if (!profile) return;
      const subject = {
        kind: 'person' as const,
        name: profile.name,
        paintingTitle: profile.artworkTitle,
        artist: profile.artist,
        year: profile.era,
      };
      for (const stage of ['quick', 'deep'] as ResearchStage[]) {
        researchFigure(getGeminiClient(), subject, stage)
          .then((r) => {
            if (opts.isClosed()) return;
            note(researchNote(r, stage), false);
            send({
              type: 'research',
              stage,
              facts: r.profile.keyFacts.length,
              sources: r.sources.length,
              grounded: r.grounded,
              dropped: r.dropped.length,
              ms: r.timings.totalMs,
            });
          })
          .catch((err) => send({ type: 'researchFailed', stage, message: err instanceof Error ? err.message : String(err) }));
      }
    },
  };
}

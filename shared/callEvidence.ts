import type { FaceTimeServerEvent, ResearchEvidenceEvent } from './facetime.ts';
export interface CallTrace {
  version: 1;
  figure: string;
  demoMode: boolean;
  startedAt: string;
  endedAt?: string;
  omittedEvents: number;
  firstAudioReceivedMs: number | null;
  events: { receivedAt: string; elapsedMs: number; event: Record<string, unknown> }[];
}
export function createCallTrace(figure: string, demoMode: boolean, now = Date.now()): CallTrace {
  return { version: 1, figure, demoMode, startedAt: new Date(now).toISOString(), omittedEvents: 0, firstAudioReceivedMs: null, events: [] };
}
/** Explicit metadata-only projection. Audio/video bytes and private system prompts are never exported. */
export type TraceInput = FaceTimeServerEvent
  | { type: 'typedInput'; text: string }
  | { type: 'textReply'; text: string; demoMode: boolean }
  | { type: 'clientStatus'; status: string; cameraEnabled: boolean; cameraReady: boolean };
export function appendCallEvidence(trace: CallTrace, msg: TraceInput, now = Date.now()): CallTrace {
  if (trace.endedAt) return trace;
  let event: Record<string, unknown>;
  const elapsedMs = Math.max(0, now - Date.parse(trace.startedAt));
  switch (msg.type) {
    case 'typedInput': event = { type: msg.type, text: msg.text }; break;
    case 'textReply': event = { type: msg.type, text: msg.text, demoMode: msg.demoMode }; break;
    case 'clientStatus': event = { type: msg.type, status: msg.status, cameraEnabled: msg.cameraEnabled, cameraReady: msg.cameraReady }; break;
    case 'audio':
      if (trace.firstAudioReceivedMs !== null) return trace;
      event = { type: 'firstAudioReceived' }; break;
    case 'inputTranscript': case 'outputTranscript': case 'modelText': event = { type: msg.type, text: msg.text }; break;
    case 'status': event = { type: msg.type, status: msg.status, model: msg.model }; break;
    case 'researchStarted': event = { type: msg.type, stage: msg.stage, model: msg.model }; break;
    case 'researchFailed': event = { type: msg.type, stage: msg.stage, model: msg.model, ms: msg.ms, message: 'Research unavailable' }; break;
    case 'research': event = { type: msg.type, stage: msg.stage, model: msg.model, structureModel: msg.structureModel,
      facts: msg.facts, sources: msg.sources, grounded: msg.grounded, dropped: msg.dropped, ms: msg.ms, cached: msg.cached,
      generationMs: msg.generationMs, sourceLinks: msg.sourceLinks, retainedFacts: msg.retainedFacts, droppedClaims: msg.droppedClaims }; break;
    case 'replyCheck': event = { type: msg.type, status: msg.status, failed: msg.failed, scores: msg.scores,
      latencyMs: msg.latencyMs, utterance: msg.utterance, visitorMessage: msg.visitorMessage, turnId: msg.turnId, correctionRequested: msg.correctionRequested }; break;
    case 'turnDecision': event = { type: msg.type, decision: msg.decision }; break;
    case 'callerAnnotation': event = { type: msg.type, annotation: msg.annotation }; break;
    case 'interrupted': case 'turnComplete': case 'turnDecisionPending': event = { type: msg.type }; break;
    case 'error': event = { type: 'error', message: 'Live provider error; see the call UI.' }; break;
    default: return trace;
  }
  const events = [...trace.events, { receivedAt: new Date(now).toISOString(), elapsedMs, event }];
  return { ...trace, firstAudioReceivedMs: msg.type === 'audio' ? elapsedMs : trace.firstAudioReceivedMs,
    omittedEvents: trace.omittedEvents + Math.max(0, events.length - 1500), events: events.slice(-1500) };
}
export function latestResearch(trace: CallTrace | null): ResearchEvidenceEvent[] {
  const latest = new Map<string, ResearchEvidenceEvent>();
  for (const entry of trace?.events ?? []) {
    if (['research', 'researchStarted', 'researchFailed'].includes(String(entry.event.type))) {
      const event = entry.event as unknown as ResearchEvidenceEvent;
      latest.set(event.stage, event);
    }
  }
  return [...latest.values()];
}
export function finishCallTrace(trace: CallTrace | null, now = Date.now()): CallTrace | null {
  return trace && !trace.endedAt ? { ...trace, endedAt: new Date(now).toISOString() } : trace;
}

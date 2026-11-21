import type { CallTrace } from './callEvidence.ts';

export type Observation = 'not-tested' | 'pass' | 'fail';
export interface RehearsalTrial {
  id: string;
  recordedAt: string;
  challenge: string;
  input: string;
  selectedByNonBuilder: boolean;
  repeatOf: string | null;
  outcome: 'unassessed' | 'completed' | 'failed';
  visualReference: Observation;
  interruption: Observation;
  notes: string;
  change: string;
  trace: CallTrace | null;
}

export function summarizeTrials(trials: RehearsalTrial[]) {
  const measured = trials.filter(t => t.trace && !t.trace.demoMode && t.trace.firstAudioReceivedMs !== null);
  // Several challenges may share one call. Count its connection timing only once.
  const connections = new Map(measured.map(t => [`${t.trace!.startedAt}:${t.trace!.figure}`, t.trace!.firstAudioReceivedMs!]));
  const latencies = [...connections.values()].filter(n => Number.isFinite(n) && n >= 0).sort((a, b) => a - b);
  const observations = (key: 'visualReference' | 'interruption') => ({
    passed: trials.filter(t => t[key] === 'pass').length,
    failed: trials.filter(t => t[key] === 'fail').length,
    untested: trials.filter(t => t[key] === 'not-tested').length,
  });
  return {
    attempted: trials.length,
    completed: trials.filter(t => t.outcome === 'completed').length,
    failed: trials.filter(t => t.outcome === 'failed').length,
    unassessed: trials.filter(t => t.outcome === 'unassessed').length,
    nonBuilderSelected: trials.filter(t => t.selectedByNonBuilder && !t.repeatOf).length,
    repeats: trials.filter(t => t.repeatOf).length,
    demoTrials: trials.filter(t => t.trace?.demoMode).length,
    withoutTrace: trials.filter(t => !t.trace).length,
    audioMeasured: latencies.length,
    sharedConnectionTimings: measured.length - connections.size,
    medianFirstAudioReceivedMs: latencies.length ? (latencies[Math.floor((latencies.length - 1) / 2)] + latencies[Math.floor(latencies.length / 2)]) / 2 : null,
    worstFirstAudioReceivedMs: latencies.at(-1) ?? null,
    visualReference: observations('visualReference'),
    interruption: observations('interruption'),
  };
}

export function rehearsalReport(trials: RehearsalTrial[]) {
  return { version: 1, exportedAt: new Date().toISOString(),
    scope: 'Operator-recorded rehearsal observations, not independent historical verification. Includes failed and unassessed attempts. Repeats are not fresh cases. Demo trials are excluded from audio timing only; inspect demo and missing-trace counts before citing results. First audio receipt excludes portrait preparation and is not audible playback latency. Attached traces contain text but no raw audio/video. A correction request does not establish recovery.',
    summary: summarizeTrials(trials), trials };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { createCallTrace } from '../shared/callEvidence.ts';
import { summarizeTrials, rehearsalReport, type RehearsalTrial } from '../shared/rehearsalEvidence.ts';
const trial = (overrides: Partial<RehearsalTrial> = {}): RehearsalTrial => ({ id: '1', recordedAt: '', challenge: 'Glare', input: 'Unfamiliar portrait', selectedByNonBuilder: true, repeatOf: null, outcome: 'unassessed', visualReference: 'not-tested', interruption: 'not-tested', notes: '', change: '', trace: null, ...overrides });
test('unassessed and failed trials remain in denominators; unknown observations do not pass', () => {
  const report = rehearsalReport([trial(), trial({ id: '2', outcome: 'failed', visualReference: 'fail' })]);
  assert.equal(report.summary.attempted, 2);
  assert.equal(report.summary.completed, 0);
  assert.equal(report.summary.unassessed, 1);
  assert.deepEqual(report.summary.visualReference, { passed: 0, failed: 1, untested: 1 });
  assert.equal(report.trials.length, 2);
  assert.equal(report.summary.medianFirstAudioReceivedMs, null);
});
test('demo and missing audio are excluded from timing; repeats are not fresh non-builder inputs', () => {
  const trace = { ...createCallTrace('Figure', false), firstAudioReceivedMs: 400 };
  const s = summarizeTrials([trial({ trace }), trial({ id: '2', repeatOf: '1', trace: { ...trace, startedAt: '2026-11-21T22:00:00Z', firstAudioReceivedMs: 600 } }), trial({ trace: { ...trace, demoMode: true, firstAudioReceivedMs: 1 } }), trial()]);
  assert.equal(s.audioMeasured, 2);
  assert.equal(s.medianFirstAudioReceivedMs, 500);
  assert.equal(s.worstFirstAudioReceivedMs, 600);
  assert.equal(s.repeats, 1);
  assert.equal(s.nonBuilderSelected, 3);
  assert.equal(s.demoTrials, 1);
});
test('several challenges from one call cannot multiply its latency observations', () => {
  const trace = { ...createCallTrace('Figure', false), firstAudioReceivedMs: 400 };
  const s = summarizeTrials([trial({ trace }), trial({ id: '2', trace })]);
  assert.equal(s.attempted, 2);
  assert.equal(s.audioMeasured, 1);
  assert.equal(s.sharedConnectionTimings, 1);
});

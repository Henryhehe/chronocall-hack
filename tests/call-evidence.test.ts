import test from 'node:test';
import assert from 'node:assert/strict';
import { createCallTrace, appendCallEvidence, finishCallTrace, latestResearch } from '../shared/callEvidence.ts';
import type { FaceTimeServerEvent, ResearchEvidenceEvent } from '../shared/facetime.ts';

test('trace measures first audio receipt once and excludes audio and unexpected fields', () => {
  let trace = createCallTrace('Washington', false, 1000);
  trace = appendCallEvidence(trace, { type: 'audio', data: 'SECRET_AUDIO' }, 1600);
  assert.equal(trace.firstAudioReceivedMs, 600);
  assert.equal(appendCallEvidence(trace, { type: 'audio', data: 'MORE_AUDIO' }, 1900), trace);
  trace = appendCallEvidence(trace, { type: 'inputTranscript', text: 'Hello', apiKey: 'SECRET_KEY' } as FaceTimeServerEvent, 2000);
  const json = JSON.stringify(trace);
  assert.doesNotMatch(json, /SECRET/);
  assert.match(json, /Hello/);
});
test('research statuses retain actual models and separate cache arrival from generation', () => {
  let trace = createCallTrace('Lisa', false, 1000);
  trace = appendCallEvidence(trace, { type: 'researchStarted', stage: 'deep', model: 'gemini-4-neon' }, 1100);
  const done: ResearchEvidenceEvent = { type: 'research', stage: 'deep', model: 'gemini-4-neon', structureModel: 'gemini-4-hydrogen', facts: 1, sources: 1, dropped: 1, grounded: true, cached: true, ms: 3, generationMs: 50000,
    sourceLinks: [{ title: 'Museum', uri: 'https://example.org' }], retainedFacts: [{ fact: 'Supported claim', source: 'Museum' }], droppedClaims: [{ id: 'fact-1', question: 'Unsupported claim?', source: 'Museum', score: 0.2 }] };
  trace = appendCallEvidence(trace, done, 1103);
  assert.deepEqual(latestResearch(trace), [done]);
  trace = appendCallEvidence(trace, { type: 'researchFailed', stage: 'quick', model: 'gemini-4-hydrogen', ms: 1200, message: 'private provider details' }, 2300);
  assert.equal(latestResearch(trace).length, 2);
  assert.doesNotMatch(JSON.stringify(trace), /private provider details/);
});
test('trace cap is explicit, end is idempotent, next call starts empty', () => {
  let trace = createCallTrace('First', false, 0);
  for (let i = 0; i < 1503; i++) trace = appendCallEvidence(trace, { type: 'turnComplete' }, i);
  assert.equal(trace.events.length, 1500);
  assert.equal(trace.omittedEvents, 3);
  const ended = finishCallTrace(trace, 2000)!;
  assert.equal(finishCallTrace(ended, 3000), ended);
  assert.equal(appendCallEvidence(ended, { type: 'turnComplete' }, 4000), ended);
  assert.equal(createCallTrace('Second', true, 4000).events.length, 0);
});
test('flagged original reply and correction request remain evidence, not proof of correction', () => {
  const trace = appendCallEvidence(createCallTrace('Figure', false, 0), { type: 'replyCheck', status: 'flagged', passed: false, failed: ['hindsight'], scores: { hindsight: 0.9 }, latencyMs: 100, utterance: 'Original claim', visitorMessage: 'Question', turnId: 1, correctionRequested: true }, 100);
  assert.equal(trace.events[0].event.utterance, 'Original claim');
  assert.equal(trace.events[0].event.correctionRequested, true);
  assert.equal(trace.events[0].event.corrected, undefined);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { completedCharacterReplies, inquirySources, reflectionMarkdown, type EncounterReflection } from '../shared/inquiry.ts';
import { createCallTrace, appendCallEvidence } from '../shared/callEvidence.ts';

test('reflection only offers completed character replies, excluding tool annotations', () => {
  const rows = [
    { id: '1', speaker: 'user', text: 'Question' },
    { id: '2', speaker: 'figure', text: 'Unfinished', streaming: true },
    { id: '3', speaker: 'figure', text: '[Inspecting your camera]: inferred object' },
    { id: '4', speaker: 'figure', text: 'Actual completed reply' },
  ];
  assert.deepEqual(completedCharacterReplies(rows).map(r => r.id), ['4']);
});
test('learning source links are distinct web URLs from completed research only', () => {
  let trace = appendCallEvidence(createCallTrace('Figure', false), { type: 'researchStarted', stage: 'deep', model: 'gemini-4-neon' });
  assert.deepEqual(inquirySources(trace), []);
  trace = appendCallEvidence(trace, { type: 'research', stage: 'quick', model: 'gemini-4-hydrogen', structureModel: 'gemini-4-hydrogen', facts: 0, sources: 4, grounded: true, dropped: 0, ms: 100, generationMs: 100, cached: false, retainedFacts: [], droppedClaims: [], sourceLinks: [
    { uri: 'https://example.org/item', title: 'Museum record' }, { uri: 'https://example.org/item', title: 'Museum record' },
    { uri: 'javascript:alert(1)' }, { uri: 'not-a-url' },
  ] });
  assert.deepEqual(inquirySources(trace), [{ title: 'Museum record', url: 'https://example.org/item' }]);
});
test('download keeps learner uncertainty and demo provenance without inventing a takeaway', () => {
  const encounter: EncounterReflection = { id: '1', figure: 'Figure', era: 'Era', originalImage: 'PRIVATE_IMAGE', inquiry: 'detail', prediction: 'My guess', demoMode: true, trace: null, replies: [{ id: 'r', speaker: 'figure', text: 'An interpreted reply' }] };
  const markdown = reflectionMarkdown(encounter, { observation: 'A red coat', conclusion: 'I am uncertain', evidence: 'Only the character said this', nextQuestion: '', selectedReply: 'r' });
  assert.match(markdown, /Demo conversation/);
  assert.match(markdown, /I am uncertain/);
  assert.match(markdown, /No source links arrived/);
  assert.match(markdown, /An interpreted reply/);
  assert.doesNotMatch(markdown, /PRIVATE_IMAGE/);
  assert.doesNotMatch(markdown, /mastered|100%|verified fact/);
});

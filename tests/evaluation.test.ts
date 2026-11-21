import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize } from '../evaluation/metrics.ts';
test('evaluation retains errors and does not invent accuracy before grading', () => {
  const r = summarize([{ status: 'ok', latencyMs: 10 }, { status: 'error', latencyMs: 30 }, { status: 'abstained', latencyMs: 20 }]);
  assert.equal(r.attempted, 3);
  assert.equal(r.errors, 1);
  assert.equal(r.abstained, 1);
  assert.equal(r.accuracyOnGraded, null);
  assert.equal(r.gradingComplete, false);
  assert.equal(r.medianMs, 20);
});
test('partial grades cannot masquerade as a completed evaluation', () => {
  const r = summarize([{ status: 'ok', latencyMs: 10, grade: { correct: true, unsupportedClaims: 0, anachronisms: 0, reviewer: 'External reviewer', source: 'Museum record' } }, { status: 'error', latencyMs: 40 }]);
  assert.equal(r.independentlyGraded, 1);
  assert.equal(r.accuracyOnGraded, 1);
  assert.equal(r.gradingComplete, false);
  assert.equal(r.medianMs, 25);
});

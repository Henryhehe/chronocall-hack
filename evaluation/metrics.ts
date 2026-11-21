export interface EvaluationOutcome {
  status: 'ok' | 'abstained' | 'error';
  latencyMs: number;
  grade?: { correct: boolean; unsupportedClaims: number; anachronisms: number; reviewer: string; source: string };
}
export function summarize(outcomes: EvaluationOutcome[]) {
  const latencies = outcomes.map(o => o.latencyMs).filter(Number.isFinite).sort((a, b) => a - b);
  const graded = outcomes.filter(o => o.grade && typeof o.grade.correct === 'boolean' && o.grade.reviewer?.trim() && o.grade.source?.trim());
  return {
    attempted: outcomes.length,
    completed: outcomes.filter(o => o.status === 'ok').length,
    abstained: outcomes.filter(o => o.status === 'abstained').length,
    errors: outcomes.filter(o => o.status === 'error').length,
    medianMs: latencies.length ? (latencies[Math.floor((latencies.length - 1) / 2)] + latencies[Math.floor(latencies.length / 2)]) / 2 : null,
    worstMs: latencies.at(-1) ?? null,
    independentlyGraded: graded.length,
    accuracyOnGraded: graded.length ? graded.filter(o => o.grade!.correct).length / graded.length : null,
    // Missing reviews stay missing; they never become successful examples.
    gradingComplete: outcomes.length > 0 && graded.length === outcomes.length,
  };
}

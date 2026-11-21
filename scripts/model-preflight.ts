/** Small real requests to verify the two configured research model entitlements. No secrets or provider payloads are logged. */
import { loadEnvironment } from '../server/config.ts';
loadEnvironment();
const { getGeminiClient } = await import('../server/services/gemini/client.ts');
const { STAGE_DEFAULTS } = await import('../server/services/gemini/research.ts');
if (process.env.DEMO_MODE === 'true') {
  console.error('Preflight requires DEMO_MODE=false. Fixtures cannot verify model access.');
  process.exitCode = 1;
} else {
  const results = await Promise.all((['quick', 'deep'] as const).map(async stage => {
    const model = STAGE_DEFAULTS[stage].model;
    const start = Date.now();
    try {
      const result = await getGeminiClient().models.generateContent({ model, contents: 'Reply with OK.', config: { abortSignal: AbortSignal.timeout(20000) } });
      if (!result.text?.trim()) throw new Error('EMPTY_RESPONSE');
      return { stage, model, status: 'passed', elapsedMs: Date.now() - start };
    } catch (error) {
      const e = error as { status?: number; code?: string; cause?: { code?: string }; name?: string };
      return { stage, model, status: 'failed', elapsedMs: Date.now() - start, reason: e.cause?.code || e.code || e.status || e.name || 'Request failed' };
    }
  }));
  const qualifyingModels = new Set(results.filter(r => r.status === 'passed').map(r => r.model.replace(/^models\//, '')).filter(model => ['gemini-4-argon', 'gemini-4-carbon', 'gemini-4-neon', 'gemini-4-hydrogen'].includes(model)));
  console.log(JSON.stringify({ scope: 'Model access only; does not test research, Decisions, camera, audio or latency of the full call.', twoQualifyingModelsResponded: qualifyingModels.size >= 2, results }, null, 2));
  if (results.some(r => r.status !== 'passed') || qualifyingModels.size < 2) process.exitCode = 1;
}

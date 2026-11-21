/** Offline artifact collection + real-service comparison. Never uses fixture responses. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { loadEnvironment } from '../server/config.ts';
import { summarize, type EvaluationOutcome } from '../evaluation/metrics.ts';

type Case = { id: string; image: string; sha256: string; source: string; title: string; artist: string; date: string; question: string };
type Manifest = { createdAt: string; selection: string; cases: Case[] };
type Outcome = EvaluationOutcome & { response?: unknown; error?: string };
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const [command, pathArg = 'evaluation/dataset/manifest.json', countArg = '15'] = process.argv.slice(2);
const file = resolve(pathArg);
async function save(path: string, data: unknown) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2) + '\n');
}
async function fetchOk(url: string) {
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`Source request failed: HTTP ${r.status}`);
  return r;
}
async function collect() {
  const count = Number(countArg);
  if (!Number.isInteger(count) || count < 1 || count > 50) throw new Error('Count must be 1–50.');
  const seed = 'chronocall-2026-11-21-v1';
  const cases: Case[] = [];
  const skipped: { id: number; reason: string }[] = [];
  // Fixed, prospectively chosen queries; no outcome-based selection or substitutions.
  for (const query of ['portrait', 'still life', 'landscape']) {
    const perQuery = query === 'portrait' ? Math.ceil(count * 0.6) : Math.floor(count * 0.2);
    const target = query === 'landscape' ? count : cases.length + perQuery;
    const search = await (await fetchOk(`https://collectionapi.metmuseum.org/public/collection/v1.1/search?hasImages=true&title=true&limit=500&q=${encodeURIComponent(query)}`)).json();
    const ids: number[] = [...new Set<number>(search.objectIDs ?? [])];
    ids.sort((a, b) => hash(`${seed}:${a}`).localeCompare(hash(`${seed}:${b}`)));
    for (const id of ids) {
      if (cases.length >= target) break;
      if (cases.some(c => c.id === `met-${id}`)) continue;
      try {
        const o = await (await fetchOk(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`)).json();
        if (!o.isPublicDomain || !o.primaryImageSmall) { skipped.push({ id, reason: 'No public-domain downloadable image' }); continue; }
        const response = await fetchOk(o.primaryImageSmall);
        if (!(response.headers.get('content-type') ?? '').startsWith('image/')) throw new Error('Not an image');
        const bytes = new Uint8Array(await response.arrayBuffer());
        const image = `${id}.jpg`;
        await mkdir(dirname(file), { recursive: true });
        await writeFile(resolve(dirname(file), image), bytes);
        cases.push({ id: `met-${id}`, image, sha256: hash(bytes), source: o.objectURL, title: o.title, artist: o.artistDisplayName, date: o.objectDate,
          question: 'What can you tell me about your life at the moment shown in this artwork, and what is uncertain?' });
      } catch (e) { skipped.push({ id, reason: e instanceof Error ? e.message : 'Download failed' }); }
    }
  }
  await save(file, { createdAt: new Date().toISOString(), selection: `Fixed seed ${seed}; first 500 API matches per query, hash-ranked; 60% portraits, 20% still life, 20% landscape. Only availability/license exclusions; no model outputs used to select.`, cases, skipped });
  if (cases.length !== count) throw new Error(`Collected ${cases.length}/${count}; partial manifest saved. Do not silently shrink the requested sample.`);
  console.log(`Collected ${cases.length} external cases at ${file}`);
}
async function validate(): Promise<Manifest> {
  const manifest: Manifest = JSON.parse(await readFile(file, 'utf8'));
  if (!manifest.cases?.length) throw new Error('Manifest contains no cases.');
  const ids = new Set<string>();
  for (const c of manifest.cases) {
    if (!c.id || ids.has(c.id) || !c.source || !c.question) throw new Error('Missing source/question or duplicate case ID.');
    ids.add(c.id);
    if (hash(await readFile(resolve(dirname(file), c.image))) !== c.sha256) throw new Error(`Image changed: ${c.id}`);
  }
  return manifest;
}
async function run() {
  const manifest = await validate();
  loadEnvironment();
  if (process.env.DEMO_MODE === 'true') throw new Error('Real evaluation refuses DEMO_MODE=true.');
  const { getGeminiClient } = await import('../server/services/gemini/client.ts');
  const { identifyFigureFromImage, respondToFaceTimeText } = await import('../server/services/gemini/facetime.ts');
  const { researchFigure, researchNote } = await import('../server/services/gemini/research.ts');
  const { evaluateTurn } = await import('../server/services/gemini/turnDecision.ts');
  const { characterGuide } = await import('../src/features/museum/data/fallbackPersona.ts');
  const ai = getGeminiClient();
  // Abort before spending on a dataset if credentials, model access or DNS are broken.
  for (const model of ['gemini-4-hydrogen', 'gemini-4-neon']) {
    await ai.models.generateContent({ model, contents: 'Reply with OK.', config: { abortSignal: AbortSignal.timeout(20000) } });
  }
  const rows: { id: string; baseline: Outcome; system: Outcome }[] = [];
  const output = resolve('evaluation/results', new Date().toISOString().replace(/[:.]/g, '-') + '.json');
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const dirty = Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim());
  const measure = async (fn: () => Promise<{ status: 'ok' | 'abstained'; response: unknown }>): Promise<Outcome> => {
    const start = Date.now();
    try { return { ...await fn(), latencyMs: Date.now() - start }; }
    catch (error) { return { status: 'error', latencyMs: Date.now() - start, error: error instanceof Error ? error.message : 'Provider error' }; }
  };
  for (const [index, c] of manifest.cases.entries()) {
    const imageBase64 = (await readFile(resolve(dirname(file), c.image))).toString('base64');
    const baseline = () => measure(async () => {
      const response = await ai.models.generateContent({ model: 'gemini-4-hydrogen', contents: { parts: [
        { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
        { text: `If a recognizable historical figure is visible, identify them and answer in their voice: ${c.question} Otherwise explicitly say you cannot identify a historical figure. Do not invent an identity.` },
      ] }, config: { abortSignal: AbortSignal.timeout(60000) } });
      return { status: 'ok', response: { text: response.text ?? '', model: 'gemini-4-hydrogen' } };
    });
    const system = () => measure(async () => {
      const identified = await identifyFigureFromImage({ imageBase64, mimeType: 'image/jpeg' });
      if (!identified.profile) return { status: 'abstained', response: identified };
      const profile = { ...identified.profile };
      const research = await researchFigure(ai, { kind: 'person', name: profile.name, paintingTitle: profile.artworkTitle, artist: profile.artist, year: profile.era }, 'deep', { noCache: true });
      profile.systemPersona += `\n${characterGuide('person')}\n${researchNote(research, 'deep')}`;
      const reply = await respondToFaceTimeText({ profile, message: c.question });
      const check = await evaluateTurn(ai, { utterance: reply.reply, instructions: profile.systemPersona, userPrompt: c.question, speaker: profile.name });
      return { status: 'ok', response: { identified, research, reply, check } };
    });
    // Alternate execution order to reduce systematic warmup bias.
    let b: Outcome, s: Outcome;
    if (index % 2) { s = await system(); b = await baseline(); } else { b = await baseline(); s = await system(); }
    rows.push({ id: c.id, baseline: b, system: s });
    await save(output, { createdAt: new Date().toISOString(), commit, dirty, manifestHash: hash(JSON.stringify(manifest)), manifest,
      scope: 'Offline image-to-persona/text diagnostic; production identification, research and checking services. Does not measure Live 3.8 audio/video, interruptions, or post-speech correction. Baseline is one Hydrogen call. System awaits deep research; cold diagnostic latency is not live turn latency.', rows,
      summary: { baseline: summarize(rows.map(r => r.baseline)), system: summarize(rows.map(r => r.system)) } });
    console.log(`${c.id}: baseline=${b.status}, system=${s.status}; ${rows.length}/${manifest.cases.length}`);
  }
  console.log(`Saved ${output}. Accuracy is pending independent human grading.`);
}
async function report() {
  const data = JSON.parse(await readFile(file, 'utf8'));
  if (!Array.isArray(data.rows)) throw new Error('Expected evaluation results file.');
  console.log(JSON.stringify({ baseline: summarize(data.rows.map((r: { baseline: Outcome }) => r.baseline)), system: summarize(data.rows.map((r: { system: Outcome }) => r.system)) }, null, 2));
}
try {
  if (command === 'collect') await collect();
  else if (command === 'validate') { const m = await validate(); console.log(`Validated ${m.cases.length} source-attributed cases.`); }
  else if (command === 'run') await run();
  else if (command === 'report') await report();
  else throw new Error('Usage: npm run evaluate -- collect|validate|run|report [manifest/results path] [collection count]');
} catch (e) {
  // SDK errors can include request information: redact configured secrets before displaying.
  let message = e instanceof Error ? e.message : 'Evaluation failed';
  const cause = e instanceof Error ? (e.cause as { code?: string } | undefined)?.code : undefined;
  if (cause) message += ` (${cause})`;
  if (process.env.GEMINI_API_KEY) message = message.replaceAll(process.env.GEMINI_API_KEY, '[redacted]');
  console.error(message);
  process.exitCode = 1;
}

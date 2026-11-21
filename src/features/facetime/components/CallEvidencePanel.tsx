import React from 'react';
import { latestResearch, type CallTrace } from '../../../../shared/callEvidence.ts';

function webLink(value?: string): string | undefined {
  try { const url = new URL(value ?? ''); return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined; } catch { return undefined; }
}
export function downloadCallTrace(trace: CallTrace) {
  const content = { ...trace, exportedAt: new Date().toISOString(),
    scope: 'Client-received events for one voice connection attempt. First audio received is not first audible playback. Checks are model assessments after speech. A correction request does not prove successful correction. Cached/shared research arrival and original generation duration are separate. No raw camera/audio or private system prompts included.' };
  const url = URL.createObjectURL(new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url;
  anchor.download = `chronocall-trace-${trace.startedAt.replace(/[:.]/g, '-')}.json`;
  anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function CallEvidencePanel({ trace }: { trace: CallTrace | null }) {
  if (!trace) return <p className="text-xs text-slate-400">No call evidence received yet.</p>;
  const research = latestResearch(trace);
  const check = [...trace.events].reverse().find(e => e.event.type === 'replyCheck');
  const connection = trace.events.find(e => e.event.type === 'status' && e.event.status === 'connected');
  return <section className="space-y-3 text-xs text-slate-300" aria-label="Call evidence">
    <div className="flex justify-between items-center gap-2"><h4 className="font-semibold text-white">Call evidence{trace.demoMode ? ' · Demo' : ''}</h4>
      <button type="button" className="px-3 py-2 border border-white/20 rounded-lg hover:bg-white/10" onClick={() => downloadCallTrace(trace)}>Download trace</button></div>
    <p>Connection: {connection ? `${connection.elapsedMs} ms` : 'not observed'} · First audio received: {trace.firstAudioReceivedMs === null ? 'not observed' : `${trace.firstAudioReceivedMs} ms`}</p>
    <p className="text-[10px] text-slate-400">Times start at the voice connection attempt, excluding portrait preparation. Received audio does not measure audible playback.</p>
    {!research.length && <p className="text-slate-400">Research events not yet received.</p>}
    {research.map(event => <div key={event.stage} className="rounded-lg border border-white/10 p-2 space-y-1">
      <p className="font-medium text-white">{event.stage === 'quick' ? 'Quick research' : 'Deep research'} · {event.model}</p>
      {event.type === 'researchStarted' ? <p>Running…</p> : event.type === 'researchFailed' ? <p className="text-amber-200">Unavailable · {event.ms} ms</p> : <>
        <p>{event.cached ? 'Cached/shared result' : 'Fresh result'} arrived in {event.ms} ms · Original generation: {event.generationMs} ms</p>
        <p>{event.facts} facts retained · {event.dropped} claims filtered · {event.sources} source links</p>
        {!event.grounded && <p className="text-amber-200">No sources returned; research is unverified.</p>}
        <details><summary className="cursor-pointer py-1">Sources and filtered claims</summary>
          <ul className="space-y-1 my-2">{event.sourceLinks.map((source, i) => {
            const url = webLink(source.uri);
            return <li key={i}>{url ? <a href={url} target="_blank" rel="noopener noreferrer" className="underline text-sky-200 break-words">{source.title || url}</a> : <span>{source.title || 'Source URL unavailable'}</span>}</li>;
          })}</ul>
          {event.retainedFacts.slice(0, 3).map((f, i) => <p className="my-2" key={i}>{f.fact}<span className="block text-slate-400 break-words">Reported source: {f.source}</span></p>)}
          {event.droppedClaims.map(claim => <p className="my-2 text-amber-200" key={claim.id}>{claim.question}<span className="block">Filtered: support score {claim.score.toFixed(2)} below 0.80, or missing result.</span></p>)}
          <p className="text-[10px] text-slate-400">Claims are checked against model-written research notes. Sources and scores do not independently establish correctness. Full retained facts and filter details are in the export.</p>
        </details>
      </>}
    </div>)}
    {check && <details><summary className="cursor-pointer py-1">Latest reply check · {String(check.event.status)}</summary>
      <p className="my-2">“{String(check.event.utterance ?? '')}”</p>
      <p>{check.event.correctionRequested ? 'Correction requested; inspect subsequent turns in the trace to assess recovery.' : 'No correction requested for this turn.'}</p>
      <p className="text-slate-400">Flags: {(check.event.failed as string[]).join(', ') || 'none reported'} · {String(check.event.latencyMs)} ms</p>
    </details>}
    <p className="text-[10px] text-slate-400">Export includes conversation text. Review before sharing. {trace.omittedEvents > 0 ? `${trace.omittedEvents} older events omitted; trace is incomplete.` : ''}</p>
  </section>;
}

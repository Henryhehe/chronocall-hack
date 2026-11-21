import React, { useState } from 'react';
import type { CallTrace } from '../../../../shared/callEvidence.ts';
import { rehearsalReport, summarizeTrials, type Observation, type RehearsalTrial } from '../../../../shared/rehearsalEvidence.ts';

const STORAGE = 'chronocall-rehearsal-v1';
const CHALLENGES = ['Unfamiliar artwork', 'Two objects / “this one”', 'Glare or partial crop', 'Background speech', 'Interrupt a spoken reply'];
const control = 'w-full rounded-lg border border-white/20 bg-slate-950 p-2 text-sm text-white';

export function RehearsalPanel({ trace }: { trace: CallTrace | null }) {
  const [initial] = useState(() => {
    try {
      const rows = JSON.parse(localStorage.getItem(STORAGE) || '[]');
      if (!Array.isArray(rows) || !rows.every(r => r && typeof r.id === 'string' && typeof r.input === 'string' && ['unassessed', 'completed', 'failed'].includes(r.outcome))) throw new Error();
      return { rows: rows as RehearsalTrial[], error: '' };
    } catch { return { rows: [] as RehearsalTrial[], error: 'Saved trials could not be read. Existing storage will not be overwritten; export new trials before leaving.' }; }
  });
  const [trials, setTrials] = useState(initial.rows);
  const [error, setError] = useState(initial.error);
  const [challenge, setChallenge] = useState(CHALLENGES[0]);
  const [input, setInput] = useState('');
  const [selectedByNonBuilder, setSelectedByNonBuilder] = useState(false);
  const [repeatOf, setRepeatOf] = useState('');
  const [outcome, setOutcome] = useState<RehearsalTrial['outcome']>('unassessed');
  const [visualReference, setVisualReference] = useState<Observation>('not-tested');
  const [interruption, setInterruption] = useState<Observation>('not-tested');
  const [notes, setNotes] = useState('');
  const [change, setChange] = useState('');
  const [attachTrace, setAttachTrace] = useState(false);
  const [saved, setSaved] = useState('');
  const summary = summarizeTrials(trials);

  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!input.trim()) return;
    const next = [...trials, { id: crypto.randomUUID(), recordedAt: new Date().toISOString(), challenge, input: input.trim(), selectedByNonBuilder, repeatOf: repeatOf || null, outcome, visualReference, interruption, notes: notes.trim(), change: change.trim(), trace: attachTrace ? trace : null }];
    setTrials(next);
    try {
      if (initial.error) throw new Error();
      localStorage.setItem(STORAGE, JSON.stringify(next));
      setError('');
    } catch { setError('Trials are held in this page but could not be saved in this browser. Download the report before leaving.'); }
    setSaved('Attempt recorded, including its assessment status.');
    setInput(''); setNotes(''); setChange(''); setAttachTrace(false); setRepeatOf('');
    setOutcome('unassessed'); setVisualReference('not-tested'); setInterruption('not-tested'); setSelectedByNonBuilder(false);
  }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(rehearsalReport(trials), null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `chronocall-rehearsal-${Date.now()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <details className="mx-auto max-w-3xl px-5 pb-8 text-slate-200">
    <summary className="cursor-pointer py-3 text-sm">Demo rehearsal · {trials.length} recorded attempts</summary>
    <div className="space-y-4 rounded-xl border border-white/15 p-4">
      <p className="text-sm">Ask a non-builder to choose five inputs before testing. Log every attempt, including scan or connection failures. Repeat a failed input after a change and link it below.</p>
      <p className="text-xs text-slate-400">Observations are entered by you. A trace is evidence of events, not an automatic pass. This does not record camera or microphone media.</p>
      <p className="text-sm">{summary.completed}/{summary.attempted} completed · {summary.failed} failed · {summary.unassessed} unassessed · {summary.demoTrials} demo · {summary.withoutTrace} without a trace</p>
      <p className="text-xs">First audio received: median {summary.medianFirstAudioReceivedMs ?? '—'} ms · worst {summary.worstFirstAudioReceivedMs ?? '—'} ms · {summary.audioMeasured} distinct real-mode connections. Timing starts at voice connection, not artwork scan.</p>
      {error && <p role="alert" className="text-sm text-amber-200">{error}</p>}
      <form onSubmit={save} className="space-y-3">
        <label className="block text-sm">Challenge<select className={control} value={challenge} onChange={e => setChallenge(e.target.value)}>{CHALLENGES.map(c => <option key={c}>{c}</option>)}</select></label>
        <label className="block text-sm">Actual artwork, object, question and conditions<textarea required className={control} value={input} onChange={e => setInput(e.target.value)} placeholder="Record what was actually tried, including glare, noise or movement." /></label>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={selectedByNonBuilder} onChange={e => setSelectedByNonBuilder(e.target.checked)} />Input chosen by a non-builder before this trial</label>
        <label className="block text-sm">Fresh case or repeat<select className={control} value={repeatOf} onChange={e => setRepeatOf(e.target.value)}><option value="">Fresh case</option>{trials.map((t, i) => <option value={t.id} key={t.id}>Repeat #{i + 1}: {t.input.slice(0, 70)}</option>)}</select></label>
        <label className="block text-sm">Overall outcome<select className={control} value={outcome} onChange={e => setOutcome(e.target.value as typeof outcome)}><option value="unassessed">Unassessed / incomplete</option><option value="completed">Completed the intended interaction</option><option value="failed">Failed the intended interaction</option></select></label>
        {([['Visual reference', visualReference, setVisualReference], ['Interruption handling', interruption, setInterruption]] as const).map(([label, value, setter]) => <label className="block text-sm" key={label}>{label}<select className={control} value={value} onChange={e => setter(e.target.value as Observation)}><option value="not-tested">Not tested / unclear</option><option value="pass">Observed success</option><option value="fail">Observed failure</option></select></label>)}
        <label className="block text-sm">Failure and recovery observed<textarea className={control} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Quote the error, describe what was heard, and whether recovery actually occurred." /></label>
        <label className="block text-sm">Change made before this repeat<textarea className={control} value={change} onChange={e => setChange(e.target.value)} placeholder="Leave empty for an initial attempt. A repeat does not count as a fresh case." /></label>
        {trace && <label className="flex gap-2 text-sm"><input type="checkbox" checked={attachTrace} onChange={e => setAttachTrace(e.target.checked)} />Attach {trace.demoMode ? 'DEMO ' : ''}call trace: {trace.figure}, {new Date(trace.startedAt).toLocaleTimeString()}{trace.endedAt ? '' : ' (call still open)'}</label>}
        <p className="text-xs text-slate-400">Attached traces include conversation text and stay in this browser. Review the export before sharing. Download each attempt’s trace before starting another call.</p>
        <button className="ui-button" type="submit" disabled={!input.trim()}>Record attempt</button>
        <p role="status" className="text-xs">{saved}</p>
      </form>
      <button className="ui-button" type="button" disabled={!trials.length} onClick={download}>Download rehearsal report</button>
      {!!trials.length && <ol className="space-y-2 text-xs">{trials.map((t, i) => <li key={t.id}>#{i + 1} · {t.outcome} · {t.challenge} · {t.input}{t.repeatOf ? ' · Repeat' : ''}</li>)}</ol>}
    </div>
  </details>;
}

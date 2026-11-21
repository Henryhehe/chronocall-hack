import React, { useState } from 'react';
import { completedCharacterReplies, getInquiry, inquirySources, reflectionMarkdown, type EncounterReflection as Encounter, type ReflectionNotes } from '../../../../shared/inquiry.ts';

export function EncounterReflection({ encounter, onBrowsePrints }: { encounter: Encounter; onBrowsePrints: () => void }) {
  const [notes, setNotes] = useState<ReflectionNotes>({ observation: '', conclusion: '', evidence: '', nextQuestion: '', selectedReply: '' });
  const replies = completedCharacterReplies(encounter.replies);
  const sources = inquirySources(encounter.trace);
  const selectedReply = replies.find(r => r.id === notes.selectedReply);
  const update = (key: keyof ReflectionNotes, value: string) => setNotes(n => ({ ...n, [key]: value }));
  function download() {
    const blob = new Blob([reflectionMarkdown(encounter, notes)], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `chronocall-reflection-${encounter.id}.md`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="encounter-reflection" aria-labelledby="reflection-heading">
    <div className="section-heading"><div><p className="eyebrow">After your encounter with {encounter.figure}</p><h2 id="reflection-heading">What changed your mind?</h2></div><span className="inquiry-hint">A minute to make it yours</span></div>
    <p className="inquiry-question">{getInquiry(encounter.inquiry).question}</p>
    {encounter.demoMode && <p className="ui-notice">This call used demo responses. Reflect on the experience, not on these responses as historical evidence.</p>}
    <div className="reflection-grid">
      <div className="reflection-evidence">
        {encounter.originalImage && <figure><img src={encounter.originalImage} alt={encounter.artworkTitle || `Selected reference image for ${encounter.figure}`} /><figcaption>Original selected image{encounter.artworkTitle ? ` · ${encounter.artworkTitle}` : ''}. A painting is an interpretation, too.</figcaption></figure>}
        <p><strong>Your first guess</strong><br />{encounter.prediction || 'You didn’t record a first guess. Start with something you noticed.'}</p>
        {!!replies.length ? <><label>Choose a reply to examine<select value={notes.selectedReply} onChange={e => update('selectedReply', e.target.value)}><option value="">Select from this conversation</option>{replies.map((r, i) => <option key={r.id} value={r.id}>Reply {i + 1}: {r.text.slice(0, 90)}</option>)}</select></label>{selectedReply && <blockquote>{selectedReply.text}<footer>Character response · AI interpretation, not a verified fact</footer></blockquote>}</> : <p>No completed character reply was captured. You can still record an observation, but there is no response here to evaluate.</p>}
        <details><summary>Compare with a source · {sources.length} links</summary><p>Check whether a source supports the particular claim you’re examining. Sources arriving in the call does not mean they support every answer.</p>{sources.length ? <ul>{sources.map(s => <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a></li>)}</ul> : <p>No research links arrived. Try the museum’s catalog or another independent historical source; leave the claim uncertain until checked.</p>}</details>
      </div>
      <div className="reflection-writing">
        <label>What did you actually see or hear?<textarea rows={2} maxLength={2000} value={notes.observation} onChange={e => update('observation', e.target.value)} placeholder="Describe one detail or reaction before explaining what it means." /></label>
        <label>What do you think now—and why?<textarea rows={3} maxLength={2000} value={notes.conclusion} onChange={e => update('conclusion', e.target.value)} placeholder="Did your first guess change, stay the same, or become less certain?" /></label>
        <label>What supports that idea? What is still uncertain?<textarea rows={3} maxLength={2000} value={notes.evidence} onChange={e => update('evidence', e.target.value)} placeholder="Name the visual detail or source you checked. If you only have the character’s answer, say that." /></label>
        <label>One question to take into your next encounter <span className="inquiry-hint">optional</span><input maxLength={1000} value={notes.nextQuestion} onChange={e => update('nextQuestion', e.target.value)} placeholder="What would you investigate next?" /></label>
        <div className="reflection-actions"><button type="button" className="learning-primary" disabled={!notes.observation.trim() || !notes.conclusion.trim() || !notes.evidence.trim()} onClick={download}>Download my reflection</button><button type="button" className="ui-button" onClick={onBrowsePrints}>Explore artwork prints</button></div>
        <p className="inquiry-hint">Keep your observation, evidence, and next question. Download before refreshing or starting another call.</p>
      </div>
    </div>
  </section>;
}

import { useState } from 'react';
import { ArrowRight, BookOpen, ScanEye, Users, Globe2, Landmark, Compass, Check, Download } from 'lucide-react';

export type LearningView = 'home' | 'live' | 'character' | 'museum' | 'genie' | 'notebook' | 'log' | 'compare';
export const experiences = [
  { id: 'museum', number: '01', name: 'Meet a living portrait', label: 'Portrait gallery', icon: Landmark, description: 'Choose a detail. Ask the person in the painting what it means.', goal: 'How does a portrait communicate power?', task: 'Choose a detail in the painting. Ask what it means, then compare the answer with what you can actually see.', tag: 'Art & historical perspective' },
  { id: 'live', number: '02', name: 'Find stories in the everyday', label: 'Visual discovery', icon: ScanEye, description: 'Bring a photo or camera feed. Discover the stories in everyday objects.', goal: 'What can an object tell us about how people live?', task: 'Upload an image or start your camera. Ask about one visible object and identify a question you would need another source to answer.', tag: 'Observation & inquiry' },
  { id: 'character', number: '03', name: 'Try another point of view', label: 'Character studio', icon: Users, description: 'Show a modern object to a historical persona. See it through their eyes.', goal: 'How might someone from another era see our world?', task: 'Choose a persona, add a photo or camera feed, and ask how they would interpret a modern object.', tag: 'Perspective & imagination' },
  { id: 'genie', number: '04', name: 'Step into a possible past', label: 'World explorer', icon: Globe2, description: 'Enter a 3D world. Explore a setting or imagine your own.', goal: 'How does a place shape the way people live?', task: 'Choose a preset world or generate a scene. Explore it and note one design choice that would need historical verification.', tag: 'Spatial exploration & creativity' },
] as const;

export function JourneyHeader({ view, onNavigate }: { view: LearningView; onNavigate: (view: LearningView) => void }) {
  return <><a className="skip-link" href="#learning-main">Skip to learning content</a><header className="journey-header"><button className="journey-brand" onClick={() => onNavigate('home')} aria-label="Chronocall home"><span className="brand-mark"><Compass size={23} /></span>chronocall<span className="brand-caption">A WINDOW INTO HISTORY</span></button><nav aria-label="Learning spaces">{[{ id: 'home', label: 'Discover' }, ...experiences.map(e => ({ id: e.id, label: e.label })), { id: 'notebook', label: 'My notebook' }].map(item => <button key={item.id} aria-current={view === item.id ? 'page' : undefined} onClick={() => onNavigate(item.id as LearningView)}>{item.label}</button>)}</nav></header></>;
}

export function LearningHome({ onNavigate }: { onNavigate: (view: LearningView) => void }) {
  return (
    <div className="learning-home">
      <section className="learning-hero" aria-labelledby="discovery-title">
        <div className="hero-copy">
          <p className="eyebrow">HISTORY, OPEN FOR CONVERSATION</p>
          <h1 id="discovery-title">Meet the past.<br /><em>Ask it anything.</em></h1>
          <p className="hero-description">Explore a portrait, ask its subject a question, and discover the story behind a detail.</p>
          <div className="hero-actions"><a href="/facetime">Historical video call <ArrowRight size={17} /></a>
            <button className="learning-primary" onClick={() => onNavigate('museum')}>Explore the portrait <ArrowRight size={18} /></button>
            <a href="#experiences">See all experiences <span aria-hidden="true">↗</span></a>
          </div>
          <p className="hero-note">Artwork included · No camera needed to explore</p>
          <ol className="discovery-steps" aria-label="Your first exploration">
            <li><span>01</span><div><strong>Look closely</strong><p>Choose a detail.</p></div></li>
            <li><span>02</span><div><strong>Ask why</strong><p>Hear a perspective.</p></div></li>
            <li><span>03</span><div><strong>Make a connection</strong><p>Save a reflection.</p></div></li>
          </ol>
        </div>
        <button className="hero-art" onClick={() => onNavigate('museum')} aria-label="Explore the George Washington portrait">
          <img src="/assets/aistudio/washington_fd94f6dd.jpeg" alt="Equestrian portrait of George Washington beneath a dramatic sky" fetchPriority="high" />
          <span className="art-badge">START HERE · LIVING PORTRAIT</span>
          <span className="art-label"><span>A QUESTION TO TAKE INSIDE</span><strong>“What does your pose<br />say about power?”</strong><span>Explore George Washington <ArrowRight size={16} /></span></span>
          <span className="art-index">EXHIBIT 001 / WASHINGTON</span>
        </button>
      </section>
      <section id="experiences" className="experience-section" aria-labelledby="experiences-title">
        <div className="section-heading"><div><p className="eyebrow">FOLLOW YOUR CURIOSITY</p><h2 id="experiences-title">Choose your way in.</h2></div><p>Four experiences. Your own questions.</p></div>
        <div className="experience-grid">{experiences.map(e => <button className="experience-card" key={e.id} onClick={() => onNavigate(e.id)}>
          <div className="card-top"><e.icon size={23} /><span>{e.number}</span></div>
          <h3>{e.label}</h3><p>{e.description}</p>
          <span className="card-link">Explore <ArrowRight size={17} /></span>
        </button>)}</div>
      </section>
      <section className="learning-method"><BookOpen size={25} /><div><h2>Leave with a question worth keeping.</h2><p>Save what you noticed and what you want to verify. AI perspectives are interpretations; check them against historical sources.</p></div><button onClick={() => onNavigate('notebook')}>Open notebook <ArrowRight size={17} /></button></section>
    </div>
  );
}

export function LearningGuide({ view, onNavigate, onPrompt }: { view: LearningView; onNavigate: (view: LearningView) => void; onPrompt: (prompt: string) => void }) {
  const experience = experiences.find(e => e.id === view);
  if (!experience) return null;
  return <section className="learning-guide" aria-label="Learning challenge"><div><p className="eyebrow">EXPLORATION {experience.number} · YOUR GUIDING QUESTION</p><h1>{experience.goal}</h1><p>{experience.task}</p></div><div className="guide-actions">{(view === 'live' || view === 'character') && <button onClick={() => onPrompt(experience.goal)}>Use this question</button>}<button onClick={() => onNavigate('notebook')}>Record a reflection <ArrowRight size={16} /></button></div></section>;
}

type Note = { id: string; space: string; observation: string; question: string };
const storageKey = 'chronocall-learning-notes-v1';
export function LearningNotebook() {
  const [notes, setNotes] = useState<Note[]>(() => { try { const value: unknown = JSON.parse(localStorage.getItem(storageKey) || '[]'); return Array.isArray(value) ? value.filter((n): n is Note => n && typeof n.id === 'string' && typeof n.space === 'string' && typeof n.observation === 'string' && typeof n.question === 'string') : []; } catch { return []; } });
  const [space, setSpace] = useState<string>(experiences[0].label);
  const [observation, setObservation] = useState('');
  const [question, setQuestion] = useState('');
  const [status, setStatus] = useState('');
  function save() {
    const next = [{ id: crypto.randomUUID(), space, observation: observation.trim(), question: question.trim() }, ...notes];
    setNotes(next); setObservation(''); setQuestion('');
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setStatus('Reflection saved on this device.'); } catch { setStatus('Saved for this session only. Download your notes to keep them.'); }
  }
  function download() {
    const content = notes.map(n => `## ${n.space}\n\nObservation: ${n.observation}\n\nQuestion to verify: ${n.question || 'Not added'}\n`).join('\n');
    const url = URL.createObjectURL(new Blob([`# My Chronocall notebook\n\n${content}`], { type: 'text/markdown' }));
    const a = document.createElement('a'); a.href = url; a.download = 'chronocall-notebook.md'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="notebook"><p className="eyebrow">MAKE THE DISCOVERY YOURS</p><h1>My field notes</h1><p>Separate what you observed from what you inferred. Keep a question to investigate next.</p><div className="notebook-grid"><form onSubmit={e => { e.preventDefault(); if (observation.trim()) save(); }}><label htmlFor="note-space">Where did you explore?</label><select id="note-space" value={space} onChange={e => setSpace(e.target.value)}>{experiences.map(e => <option key={e.id}>{e.label}</option>)}</select><label htmlFor="note-observation">One thing I noticed or learned</label><textarea id="note-observation" required maxLength={4000} value={observation} onChange={e => setObservation(e.target.value)} placeholder="I noticed… My interpretation is…" /><label htmlFor="note-question">A question I want to verify</label><textarea id="note-question" maxLength={2000} value={question} onChange={e => setQuestion(e.target.value)} placeholder="What evidence would help me check this?" /><button className="learning-primary" disabled={!observation.trim()}>Save reflection <Check size={17} /></button><p role="status">{status}</p><small>Notes stay in this browser. Download a copy to keep or share.</small></form><div><div className="notes-heading"><h2>{notes.length} {notes.length === 1 ? 'reflection' : 'reflections'}</h2><button onClick={download} disabled={!notes.length}><Download size={16} /> Download</button></div>{notes.length ? notes.map(n => <article className="saved-note" key={n.id}><p className="eyebrow">{n.space}</p><p>{n.observation}</p>{n.question && <p className="note-question">To investigate: {n.question}</p>}</article>) : <div className="notebook-empty"><BookOpen size={36} /><h3>Every discovery starts with noticing.</h3><p>Your reflections will appear here. Try finding one detail in the portrait that changes how you see its subject.</p></div>}</div></div></section>;
}

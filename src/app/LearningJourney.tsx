import { ArrowRight, ScanEye, Users, Landmark, Compass, Video } from 'lucide-react';
import { WASHINGTON_IMAGE_SOURCE, WASHINGTON_IMAGE_FALLBACK } from '../../shared/artworkAssets.ts';

export type LearningView = 'home' | 'live' | 'character' | 'museum' | 'log' | 'compare';
export const experiences = [
  { id: 'museum', number: '01', name: 'Meet a living portrait', label: 'Portrait gallery', icon: Landmark, description: 'Choose a detail. Ask the person in the painting what it means.', goal: 'How does a portrait communicate power?', task: 'Choose a detail in the painting. Ask what it means, then compare the answer with what you can actually see.', tag: 'Art & historical perspective' },
  { id: 'live', number: '02', name: 'Find stories in the everyday', label: 'Visual discovery', icon: ScanEye, description: 'Bring a photo or camera feed. Discover the stories in everyday objects.', goal: 'What can an object tell us about how people live?', task: 'Upload an image or start your camera. Ask about one visible object and identify a question you would need another source to answer.', tag: 'Observation & inquiry' },
  { id: 'character', number: '03', name: 'Try another point of view', label: 'Character studio', icon: Users, description: 'Show a modern object to a historical persona. See it through their eyes.', goal: 'How might someone from another era see our world?', task: 'Choose a persona, add a photo or camera feed, and ask how they would interpret a modern object.', tag: 'Perspective & imagination' },
] as const;

export function JourneyHeader({ view, onNavigate }: { view: LearningView | 'facetime'; onNavigate?: (view: LearningView) => void }) {
  const items = [
    { id: 'home', label: 'Discover', href: '/#home' },
    { id: 'museum', label: 'Portrait gallery', href: '/museum' },
    { id: 'facetime', label: 'Video calls', href: '/facetime' },
    ...experiences.filter(e => e.id !== 'museum').map(e => ({ id: e.id, label: e.label, href: `/#${e.id}` })),
  ];
  return <>
    <a className="skip-link" href="#learning-main" onClick={event => { event.preventDefault(); document.getElementById('learning-main')?.focus(); }}>Skip to content</a>
    <header className="journey-header">
      <a className="journey-brand" href="/#home" aria-label="Chronocall home" onClick={event => { if (onNavigate && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onNavigate('home'); } }}><Compass size={24} className="brand-mark" />chronocall</a>
      <nav aria-label="Experiences">{items.map(item => <a key={item.id} href={item.href} aria-current={view === item.id || (item.id === 'live' && ['log', 'compare'].includes(view)) ? 'page' : undefined} onClick={event => { if (onNavigate && item.id !== 'facetime' && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onNavigate(item.id as LearningView); } }}>{item.label}</a>)}</nav>
    </header>
  </>;
}

export function LearningHome({ onNavigate }: { onNavigate: (view: LearningView) => void }) {
  return (
    <div className="learning-home">
      <section className="learning-hero" aria-labelledby="discovery-title">
        <div className="hero-copy">
          <p className="eyebrow">Art, with a point of view</p>
          <h1 id="discovery-title">The past has<br />a new <span>perspective.</span></h1>
          <p className="hero-description">Scan an artwork, start a live call, and show its subject something from your world. See what they make of it from theirs.</p>
          <div className="hero-actions">
            <a className="learning-primary" href="/facetime">Start a call <ArrowRight size={18} /></a>
            <a href="#experiences">See all experiences <span aria-hidden="true">↗</span></a>
          </div>
          <p className="hero-note">Camera + voice · AI interpretation of a historical character</p>

        </div>
        <a className="hero-art" href="/facetime" aria-label="Start a call with a historical figure">
          {/* Public-domain John Faed painting; original 639 × 900 reproduction from Wikimedia Commons. */}
          <img
            src={WASHINGTON_IMAGE_SOURCE}
            alt="Equestrian portrait of George Washington beneath a dramatic sky"
            width={639}
            height={900}
            fetchPriority="high"
            onError={event => {
              const fallback = WASHINGTON_IMAGE_FALLBACK;
              if (event.currentTarget.getAttribute('src') !== fallback) {
                event.currentTarget.src = fallback;
              }
            }}
          />
          <span className="art-label"><span>A conversation across centuries</span><strong>“What do you make<br />of this?”</strong><span>Meet a historical figure <ArrowRight size={16} /></span></span>
          <span className="art-index">001 / George Washington</span>
        </a>
      </section>
      <section id="experiences" className="experience-section" aria-labelledby="experiences-title">
        <div className="section-heading"><div><p className="eyebrow">Keep exploring</p><h2 id="experiences-title">Follow your curiosity.</h2></div><p>A different way into history.</p></div>
        <div className="experience-grid">{experiences.map(e => <button className="experience-card" key={e.id} onClick={() => onNavigate(e.id)}>
          <div className="card-top"><e.icon size={23} /><span>{e.number}</span></div>
          <h3>{e.label}</h3><p>{e.description}</p>
          <span className="card-link">Explore <ArrowRight size={17} /></span>
        </button>)}<a className="experience-card" href="/facetime"><div className="card-top"><Video size={23} /><span>04</span></div><h3>Video calls</h3><p>Choose a historical figure or scan an artwork to start a conversation.</p><span className="card-link">Choose a person <ArrowRight size={17} /></span></a></div>
      </section>
    </div>
  );
}

export function LearningGuide({ view, onPrompt }: { view: LearningView; onPrompt: (prompt: string) => void }) {
  const experience = experiences.find(e => e.id === view);
  if (!experience) return null;
  return <section className="learning-guide" aria-label={experience.label}>
    <div><h1>{experience.label}</h1><p>{experience.description}</p>
      <details className="learning-challenge"><summary>Try a guiding question</summary><p>{experience.goal}</p><p>{experience.task}</p>{(view === 'live' || view === 'character') && <button className="ui-button" onClick={() => onPrompt(experience.goal)}>Use this question</button>}</details>
    </div>
  </section>;
}

import React, { useMemo, useState } from "react";
import { ArrowRight, Camera, Landmark, Loader2, Search, Video } from "lucide-react";
import { JourneyHeader } from "../../../app/LearningJourney";
import { CURATED_HISTORICAL_CONTACTS } from "../data/contacts";
import type { HistoricalProfile, RuntimeHealth } from "../types";

interface CallLauncherProps {
  health: RuntimeHealth | null;
  resolvingQuery: boolean;
  errorMessage: string | null;
  onDismissError: () => void;
  onDialCustomName: (name: string) => void;
  onSelectContact: (contact: HistoricalProfile) => void;
  onOpenScanner: () => void;
  onOpenArtworkSearch: (initialQuery?: string) => void;
}

export const CallLauncher: React.FC<CallLauncherProps> = ({ health, resolvingQuery, errorMessage, onDismissError, onDialCustomName, onSelectContact, onOpenScanner, onOpenArtworkSearch }) => {
  const [query, setQuery] = useState("");
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const filteredContacts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CURATED_HISTORICAL_CONTACTS.filter(c => !q || [c.name, c.era, c.title, c.location].some(value => value.toLowerCase().includes(q)));
  }, [query]);

  return <div className="call-launcher min-h-screen bg-canvas text-slate-100">
    <JourneyHeader view="facetime" />
    <main id="learning-main" tabIndex={-1} className="call-launcher-main">
      <section className="page-intro"><p className="eyebrow">Conversations across time</p><h1>Who would you ask?</h1><p>Meet someone from history. Choose a person below, or find them in a work of art.</p></section>
      {health?.demoMode && <p className="ui-notice" role="status">Demo mode · Conversations use sample responses.</p>}
      {health && !health.demoMode && !health.apiKeyConfigured && <p className="ui-notice" role="status">Calling is unavailable until the server’s AI connection is configured.</p>}
      {errorMessage && <div className="ui-alert" role="alert"><span>{errorMessage}</span><button className="ui-button" onClick={onDismissError}>Dismiss</button></div>}
      <div className="call-search-row">
        <form className="call-search" onSubmit={event => { event.preventDefault(); if (query.trim() && !resolvingQuery) onDialCustomName(query.trim()); }}>
          <Search size={19} aria-hidden="true" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search a name, era, or place" aria-label="Search historical figures" />
          <button className="learning-primary" disabled={!query.trim() || resolvingQuery}>{resolvingQuery ? <Loader2 size={17} className="animate-spin" /> : <Video size={17} />} {resolvingQuery ? 'Preparing…' : 'Call'}</button>
        </form>
        <button className="ui-button" onClick={onOpenScanner} disabled={resolvingQuery}><Camera size={18} />Scan artwork</button>
        <button className="ui-button" onClick={() => onOpenArtworkSearch(query.trim() || undefined)} disabled={resolvingQuery}><Landmark size={18} />Find artwork</button>
      </div>
      <section aria-labelledby="contacts-title">
        <div className="section-heading"><h2 id="contacts-title">{query.trim() ? 'Search results' : 'Choose a person'}</h2><p>AI interpretations of historical figures</p></div>
        {filteredContacts.length === 0 ? <div className="ui-empty"><Search size={28} /><h3>No matching contacts</h3><p>Search by another name, use Call, or Find famous art for “{query.trim()}”.</p></div> : <div className="contact-grid">{filteredContacts.map(contact => <button key={contact.id} className="contact-card" disabled={resolvingQuery} onClick={() => onSelectContact(contact)} aria-label={`Call ${contact.name}`}>
          <div className="contact-card-top">{contact.previewImageUrl && !failedImages[contact.id] ? <img src={contact.previewImageUrl} alt="" loading="lazy" onError={() => setFailedImages(prev => ({ ...prev, [contact.id]: true }))} /> : <span className="contact-initials">{contact.initials}</span>}<span>{contact.era}</span></div>
          <h3>{contact.name}</h3><p className="contact-role">{contact.title}</p><p>{contact.bio}</p>
          <div className="contact-card-footer"><span>{contact.location}</span><span>Call <ArrowRight size={16} /></span></div>
        </button>)}</div>}
      </section>
    </main>
  </div>;
};

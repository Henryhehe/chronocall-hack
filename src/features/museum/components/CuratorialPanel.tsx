import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Send, VolumeX, BookOpen, MessageSquare } from 'lucide-react';
import {
  DialogueEntry,
  PortraitArtwork,
  VoiceConnectionState,
} from '../types/portrait';

interface CuratorialPanelProps {
  artwork: PortraitArtwork;
  transcript: DialogueEntry[];
  connectionState: VoiceConnectionState;
  isListening: boolean;
  isSpeaking: boolean;
  errorMessage: string | null;
  onStartVoice: () => void;
  onStopVoice: () => void;
  onInterruptPlayback: () => void;
  onSendMessage: (text: string) => void;
}

export const CuratorialPanel: React.FC<CuratorialPanelProps> = ({
  artwork,
  transcript,
  connectionState,
  isListening,
  isSpeaking,
  errorMessage,
  onStartVoice,
  onStopVoice,
  onInterruptPlayback,
  onSendMessage,
}) => {
  const [activeTab, setActiveTab] = useState<'dialogue' | 'dossier'>('dialogue');
  const [draft, setDraft] = useState('');
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activeTab === 'dialogue') {
      scrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [transcript, activeTab]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    onSendMessage(draft.trim());
    setDraft('');
  };

  return (
    <aside className="flex flex-col h-full bg-surface rounded-2xl border border-white/10 overflow-hidden">
      {/* Artwork Title & Unboxed Accession Header */}
      <div className="px-5 pt-5 pb-4 border-b border-white/10">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
          <span className="font-mono">{artwork.accessionNumber}</span>
          <span aria-hidden="true">·</span>
          <span>{artwork.year}</span>
          <span aria-hidden="true">·</span>
          <span>{artwork.medium}</span>
        </div>

        <h2 className="font-display text-2xl sm:text-3xl font-semibold text-slate-100 leading-tight mt-1.5 text-balance">
          {artwork.title}
        </h2>
        <p className="text-sm text-slate-300 mt-1">
          {artwork.characterName} — {artwork.roleTitle}
        </p>

        {/* Functional Tab Switcher */}
        <div className="mt-4 flex items-center gap-1 p-1 rounded-lg bg-elevated w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('dialogue')}
            className={`min-h-[36px] px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'dialogue'
                ? 'bg-surface text-slate-100 shadow-sm'
                : 'text-slate-300 hover:text-slate-100'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Conversation
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('dossier')}
            className={`min-h-[36px] px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'dossier'
                ? 'bg-surface text-slate-100 shadow-sm'
                : 'text-slate-300 hover:text-slate-100'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            About the artwork
          </button>
        </div>
      </div>

      {/* Tab Body */}
      {activeTab === 'dialogue' ? (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Voice Control Strip */}
          <div className="px-5 py-3 bg-canvas border-b border-white/10 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-100">
                {isListening
                  ? 'Microphone live — speak naturally'
                  : connectionState === 'connecting'
                  ? 'Connecting real-time voice...'
                  : connectionState === 'thinking'
                  ? 'Composing spoken reply...'
                  : 'Real-time voice conversation'}
              </p>
              <p className="text-[11px] text-slate-400 truncate">
                {isListening
                  ? 'You can interrupt at any moment while speaking.'
                  : 'Start a conversation, or type a question below.'}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isSpeaking && (
                <button
                  type="button"
                  onClick={onInterruptPlayback}
                  aria-label="Mute current reply"
                  className="min-h-[40px] min-w-[40px] px-2.5 rounded-lg border border-white/15 bg-surface text-slate-100 hover:bg-elevated transition-colors flex items-center justify-center"
                >
                  <VolumeX className="w-4 h-4" />
                </button>
              )}

              {isListening || connectionState === 'connecting' ? (
                <button
                  type="button"
                  onClick={onStopVoice}
                  className="min-h-[40px] px-4 py-2 rounded-lg bg-[#9A3412] text-[#FBF9F4] text-xs font-semibold hover:bg-[#7C2D12] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <MicOff className="w-3.5 h-3.5" />
                  End conversation
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onStartVoice}
                  className="min-h-[40px] px-4 py-2 rounded-lg bg-elevated text-[#FBF9F4] text-xs font-semibold hover:bg-slate-700 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Mic className="w-3.5 h-3.5" />
                  Talk
                </button>
              )}
            </div>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="mx-5 mt-3 px-3.5 py-2.5 rounded-lg bg-[#9A3412]/10 border border-[#9A3412]/25 text-xs text-rose-200"
            >
              {errorMessage}
            </div>
          )}

          {/* Transcript Log */}
          <div className="flex-1 overflow-y-auto curatorial-scroll px-5 py-4 space-y-4 min-h-[240px] max-h-[400px] lg:max-h-none">
            {transcript.map((entry) => (
              <div
                key={entry.id}
                className={`flex flex-col ${
                  entry.speaker === 'visitor' ? 'items-end' : 'items-start'
                }`}
              >
                <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-1">
                  <span>
                    {entry.speaker === 'visitor' ? 'Visitor' : artwork.characterName}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{entry.timestamp}</span>
                </div>
                <div
                  className={`max-w-[92%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    entry.speaker === 'visitor'
                      ? 'bg-elevated text-slate-100'
                      : 'bg-canvas border border-white/10 text-slate-100 font-serif text-[15px]'
                  }`}
                >
                  {entry.text}
                </div>
              </div>
            ))}
            <div ref={scrollEndRef} />
          </div>

          {/* Suggested Topics + Input Bar */}
          <div className="px-5 py-3.5 border-t border-white/10 bg-canvas/70 space-y-2.5">
            {artwork.suggestedQuestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {artwork.suggestedQuestions.slice(0, 2).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => onSendMessage(q)}
                    className="text-left text-xs px-2.5 py-1.5 rounded-lg bg-surface border border-white/12 text-slate-300 hover:border-accent-500 hover:text-slate-100 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <input
                type="text"
                aria-label="Ask about the artwork"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`Ask ${artwork.characterName} a question...`}
                className="flex-1 min-w-0 min-h-[44px] px-3.5 py-2 rounded-lg bg-surface border border-white/15 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-accent-500"
              />
              <button
                type="submit"
                disabled={!draft.trim() || connectionState === 'thinking'}
                aria-label="Send question"
                className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg bg-accent-500 text-slate-950 text-sm font-medium hover:bg-accent-400 disabled:opacity-45 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Ask</span>
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* Museum Accession Catalog Dossier */
        <div className="flex-1 overflow-y-auto curatorial-scroll px-5 py-5 space-y-5">
          <p className="text-sm leading-relaxed text-slate-200">
            {artwork.historicalContext}
          </p>

          <dl className="divide-y divide-white/10 border-t border-b border-white/10 text-sm">
            <div className="py-2.5 flex justify-between gap-4">
              <dt className="text-xs font-medium text-slate-400">Artist / School</dt>
              <dd className="text-right text-slate-100 font-medium">{artwork.artist}</dd>
            </div>
            <div className="py-2.5 flex justify-between gap-4">
              <dt className="text-xs font-medium text-slate-400">Date</dt>
              <dd className="text-right text-slate-100 tabular-nums">{artwork.year}</dd>
            </div>
            <div className="py-2.5 flex justify-between gap-4">
              <dt className="text-xs font-medium text-slate-400">Medium</dt>
              <dd className="text-right text-slate-100">{artwork.medium}</dd>
            </div>
            <div className="py-2.5 flex justify-between gap-4">
              <dt className="text-xs font-medium text-slate-400">Dimensions</dt>
              <dd className="text-right text-slate-100 tabular-nums">{artwork.dimensions}</dd>
            </div>
            <div className="py-2.5 flex justify-between gap-4">
              <dt className="text-xs font-medium text-slate-400">Gallery Wing</dt>
              <dd className="text-right text-slate-100">{artwork.galleryLocation}</dd>
            </div>
          </dl>

          {artwork.hotspots.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-slate-400 mb-2.5">
                Interactive Portrait Details
              </h3>
              <ul className="divide-y divide-white/10">
                {artwork.hotspots.map((spot) => (
                  <li key={spot.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('dialogue');
                        onSendMessage(spot.prompt);
                      }}
                      className="w-full py-2.5 text-left flex items-center justify-between gap-3 hover:text-accent-400 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-100">{spot.label}</p>
                        <p className="text-xs text-slate-400">{spot.eraDetail}</p>
                      </div>
                      <span className="text-xs font-medium text-accent-400 whitespace-nowrap shrink-0">
                        Ask
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};

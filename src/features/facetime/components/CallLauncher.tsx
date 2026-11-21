import React, { useMemo, useState } from "react";
import {
  ArrowRight,
  Camera,
  Landmark,
  Loader2,
  Search,
  Sparkles,
  Video,
} from "lucide-react";
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

const QUICK_SEARCH_SUGGESTIONS = [
  "Nikola Tesla",
  "Socrates",
  "Jane Austen",
  "Harriet Tubman",
  "Galileo Galilei",
  "Murasaki Shikibu",
];

export const CallLauncher: React.FC<CallLauncherProps> = ({
  health,
  resolvingQuery,
  errorMessage,
  onDismissError,
  onDialCustomName,
  onSelectContact,
  onOpenScanner,
  onOpenArtworkSearch,
}) => {
  const [query, setQuery] = useState("");

  const filteredContacts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CURATED_HISTORICAL_CONTACTS;
    return CURATED_HISTORICAL_CONTACTS.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.era.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q)
    );
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || resolvingQuery) return;
    onDialCustomName(trimmed);
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden bg-[#05070B] text-white flex flex-col">
      {/* Warm cinematic ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[920px] h-[520px] rounded-full bg-emerald-500/12 blur-[140px]" />
        <div className="absolute top-1/3 -right-32 w-[520px] h-[520px] rounded-full bg-amber-500/10 blur-[140px]" />
        <div className="absolute bottom-0 -left-32 w-[540px] h-[440px] rounded-full bg-sky-500/10 blur-[140px]" />
      </div>

      {/* Top Navigation Bar */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-5 sm:px-8 pt-6 pb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-600 shadow-lg shadow-emerald-500/25 flex items-center justify-center">
            <Video className="w-5 h-5 text-white fill-white/20" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-lg font-semibold tracking-tight text-white">
                Chronocall
              </span>
              {health && (
                <span
                  className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
                    health.demoMode
                      ? "bg-amber-500/10 border-amber-400/30 text-amber-200"
                      : "bg-emerald-500/10 border-emerald-400/30 text-emerald-200"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      health.demoMode
                        ? "bg-amber-400"
                        : "bg-emerald-400 animate-pulse"
                    }`}
                  />
                  {health.demoMode ? "Local Demo Mode" : "Live Gemini HD"}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              FaceTime across centuries
            </p>
          </div>
        </div>

        {/* Discreet switcher to existing Chronocall workspaces */}
        <nav
          aria-label="Other workspaces"
          className="flex items-center gap-2 text-xs font-medium"
        >
          <a
            href="/museum"
            className="px-3 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.11] border border-white/10 text-slate-300 hover:text-white transition-colors"
          >
            Museum AR
          </a>
          <a
            href="/workspaces"
            className="px-3 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.11] border border-white/10 text-slate-300 hover:text-white transition-colors"
          >
            Lab Workspaces
          </a>
        </nav>
      </header>

      {/* Main Launcher Content */}
      <main className="relative z-10 flex-1 w-full max-w-6xl mx-auto px-5 sm:px-8 pt-6 pb-16 flex flex-col gap-10">
        {errorMessage && (
          <div className="rounded-2xl bg-rose-500/15 border border-rose-400/30 px-4 py-3 text-sm text-rose-100 flex items-center justify-between gap-4 backdrop-blur-xl">
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={onDismissError}
              className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Hero + Unified Entry: Dial by Name OR Scan Painting/Statue */}
        <section className="flex flex-col items-center text-center max-w-3xl mx-auto w-full gap-6">
          <div className="space-y-3">
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-white leading-[1.08]">
              FaceTime anyone in history.
            </h1>
            <p className="text-base sm:text-lg text-slate-300/90 max-w-2xl mx-auto leading-relaxed">
              Type any historical figure, pick a contact below, or point your
              camera at a painting, photograph, or statue to call them live.
            </p>
          </div>

          {/* Primary Search / Dial Input + Camera Scanner Button */}
          <div className="w-full flex flex-col sm:flex-row items-stretch gap-3">
            <form
              onSubmit={handleSubmit}
              className="flex-1 flex items-center gap-2 rounded-full bg-white/[0.07] border border-white/15 focus-within:border-emerald-400/60 focus-within:bg-white/[0.1] px-4 py-2 backdrop-blur-2xl shadow-2xl shadow-black/40 transition-all"
            >
              <Search className="w-5 h-5 text-slate-400 shrink-0 ml-1" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter any historical figure (e.g., Nikola Tesla, Socrates)..."
                aria-label="Enter a historical figure to call"
                className="flex-1 bg-transparent text-sm sm:text-base text-white placeholder:text-slate-400 focus:outline-none py-1.5 min-w-0"
              />
              <button
                type="submit"
                disabled={!query.trim() || resolvingQuery}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#30D158] hover:bg-[#34C759] disabled:bg-white/10 disabled:text-slate-400 text-slate-950 font-semibold text-sm transition-all cursor-pointer disabled:cursor-not-allowed shrink-0 shadow-lg shadow-emerald-500/20"
              >
                {resolvingQuery ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Dialing…</span>
                  </>
                ) : (
                  <>
                    <Video className="w-4 h-4 fill-slate-950/20" />
                    <span>Call</span>
                  </>
                )}
              </button>
            </form>

            <button
              type="button"
              onClick={onOpenScanner}
              className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-full bg-white/[0.09] hover:bg-white/[0.16] border border-white/15 text-white font-medium text-sm backdrop-blur-2xl shadow-xl transition-all cursor-pointer shrink-0 group"
            >
              <span className="w-7 h-7 rounded-full bg-amber-400/20 border border-amber-300/40 flex items-center justify-center text-amber-300 group-hover:scale-105 transition-transform">
                <Camera className="w-4 h-4" />
              </span>
              <span>Scan Art</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenArtworkSearch(query.trim() || undefined)}
              className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-full bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/30 text-sky-100 font-medium text-sm backdrop-blur-2xl shadow-xl transition-all cursor-pointer shrink-0 group"
            >
              <span className="w-7 h-7 rounded-full bg-sky-400/20 border border-sky-300/40 flex items-center justify-center text-sky-300 group-hover:scale-105 transition-transform">
                <Landmark className="w-4 h-4" />
              </span>
              <span>Famous Art Online</span>
            </button>
          </div>

          {/* Quick instant-dial chips */}
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
            <span className="text-slate-500 flex items-center gap-1 mr-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Try dialing:
            </span>
            {QUICK_SEARCH_SUGGESTIONS.map((name) => (
              <button
                key={name}
                type="button"
                disabled={resolvingQuery}
                onClick={() => onDialCustomName(name)}
                className="px-3 py-1 rounded-full bg-white/[0.05] hover:bg-white/[0.12] border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
              >
                {name}
              </button>
            ))}
          </div>
        </section>

        {/* Dual Art Entry Spotlights: Camera Scanner + Online Famous Art Search */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={onOpenScanner}
            className="w-full text-left rounded-3xl p-5 sm:p-6 bg-gradient-to-r from-amber-500/12 via-white/[0.05] to-emerald-500/10 border border-white/12 hover:border-white/25 backdrop-blur-xl transition-all flex flex-col justify-between gap-4 cursor-pointer group"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400/25 to-emerald-400/25 border border-white/15 flex items-center justify-center shrink-0">
                <Camera className="w-6 h-6 text-amber-200" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">
                  Point Camera at a Painting or Statue
                </h2>
                <p className="text-xs sm:text-sm text-slate-300/85 mt-1 leading-relaxed">
                  At a museum or holding a book? Scan any artwork live and bring
                  the depicted figure onto your FaceTime call.
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-amber-200 group-hover:translate-x-0.5 transition-transform">
              Open Camera Scanner
              <ArrowRight className="w-4 h-4" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => onOpenArtworkSearch(query.trim() || undefined)}
            className="w-full text-left rounded-3xl p-5 sm:p-6 bg-gradient-to-r from-sky-500/14 via-white/[0.05] to-emerald-500/12 border border-sky-400/20 hover:border-sky-300/40 backdrop-blur-xl transition-all flex flex-col justify-between gap-4 cursor-pointer group"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-400/25 to-emerald-400/25 border border-white/15 flex items-center justify-center shrink-0">
                <Landmark className="w-6 h-6 text-sky-200" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">
                  Search Famous Art &amp; Sculptures Online
                </h2>
                <p className="text-xs sm:text-sm text-slate-300/85 mt-1 leading-relaxed">
                  Automatically finds the most famous painting or statue online
                  and animates it live on FaceTime—with an option to pick
                  another piece.
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-sky-300 group-hover:translate-x-0.5 transition-transform">
              Search Museum Artworks
              <ArrowRight className="w-4 h-4" />
            </span>
          </button>
        </section>

        {/* Curated Historical Contacts Grid */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Contacts Across History
              </h2>
              <p className="text-xs text-slate-400">
                Tap anyone to start a live video call immediately
              </p>
            </div>
            {query.trim() && filteredContacts.length === 0 && (
              <button
                type="button"
                disabled={resolvingQuery}
                onClick={() => onDialCustomName(query.trim())}
                className="text-xs font-semibold text-emerald-300 hover:text-emerald-200 cursor-pointer"
              >
                Call “{query.trim()}” directly →
              </button>
            )}
          </div>

          {filteredContacts.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center space-y-4">
              <p className="text-sm text-slate-300">
                No preset contact matches{" "}
                <span className="font-semibold text-white">“{query}”</span> —
                but Chronocall can dial anyone in history!
              </p>
              <button
                type="button"
                disabled={resolvingQuery}
                onClick={() => onDialCustomName(query.trim())}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#30D158] hover:bg-[#34C759] text-slate-950 font-semibold text-sm cursor-pointer"
              >
                <Video className="w-4 h-4" />
                <span>FaceTime {query.trim()}</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  onClick={() => onSelectContact(contact)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectContact(contact);
                    }
                  }}
                  className="group relative rounded-3xl overflow-hidden border border-white/10 hover:border-white/25 bg-white/[0.04] hover:bg-white/[0.07] transition-all duration-200 flex flex-col justify-between p-5 cursor-pointer shadow-xl shadow-black/30"
                  style={{
                    backgroundImage: `radial-gradient(120% 90% at 100% 0%, ${contact.accentColor}22 0%, transparent 65%)`,
                  }}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-4">
                      {/* Avatar circle or preview portrait */}
                      {contact.previewImageUrl ? (
                        <div className="relative w-14 h-14 rounded-2xl overflow-hidden border border-white/20 shadow-lg shrink-0">
                          <img
                            src={contact.previewImageUrl}
                            alt={contact.name}
                            className="w-full h-full object-cover object-top"
                          />
                          <span className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full bg-[#30D158] ring-2 ring-[#0B0F17]" />
                        </div>
                      ) : (
                        <div
                          className="relative w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-semibold text-white border border-white/15 shadow-lg shrink-0"
                          style={{
                            background: `linear-gradient(135deg, ${contact.gradientFrom}, ${contact.accentColor}99)`,
                          }}
                        >
                          {contact.initials}
                          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#30D158] ring-2 ring-[#0B0F17]" />
                        </div>
                      )}

                      <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-white/[0.07] text-slate-300 border border-white/10">
                        {contact.era}
                      </span>
                    </div>

                    <h3 className="text-base font-semibold text-white group-hover:text-emerald-200 transition-colors">
                      {contact.name}
                    </h3>
                    <p className="text-xs font-medium text-slate-400 mt-0.5">
                      {contact.title}
                    </p>
                    <p className="text-xs text-slate-300/80 mt-2.5 leading-relaxed line-clamp-2">
                      {contact.bio}
                    </p>
                  </div>

                  <div className="mt-5 pt-3.5 border-t border-white/10 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 truncate max-w-[130px]">
                      {contact.location}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#30D158]/90 group-hover:bg-[#30D158] text-slate-950 font-semibold text-xs transition-all shadow-md shadow-emerald-500/20">
                      <Video className="w-3.5 h-3.5" />
                      <span>FaceTime</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

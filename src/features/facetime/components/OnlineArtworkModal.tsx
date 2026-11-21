import { Modal } from "../../../app/components/Modal";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  ExternalLink,
  Frame,
  Landmark,
  Loader2,
  Palette,
  Search,
  Sparkles,
  Video,
  X,
  Zap,
} from "lucide-react";
import type {
  HistoricalProfile,
  OnlineArtworkCandidate,
  OnlineArtworkSearchResult,
} from "../types";

interface OnlineArtworkModalProps {
  open: boolean;
  initialQuery?: string;
  onClose: () => void;
  onLaunchWithArtwork: (
    profile: HistoricalProfile,
    artworkDataUrl?: string
  ) => void;
}

const FEATURED_ART_FIGURES = [
  "George Washington",
  "Cleopatra",
  "Julius Caesar",
  "Leonardo da Vinci",
  "Frida Kahlo",
  "Socrates",
  "Napoleon Bonaparte",
  "Marie Curie",
];

function getDisplayImageSrc(url: string): string {
  if (!url) return "";
  if (url.startsWith("data:") || url.startsWith("/")) return url;
  return `/api/facetime/artwork-proxy?url=${encodeURIComponent(url)}`;
}

export const OnlineArtworkModal: React.FC<OnlineArtworkModalProps> = ({
  open,
  initialQuery = "",
  onClose,
  onLaunchWithArtwork,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [mediumFilter, setMediumFilter] = useState<
    "all" | "painting" | "sculpture"
  >("all");
  const [autoPickEnabled, setAutoPickEnabled] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isFetchingImage, setIsFetchingImage] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [result, setResult] = useState<OnlineArtworkSearchResult | null>(null);
  const [selectedArtwork, setSelectedArtwork] =
    useState<OnlineArtworkCandidate | null>(null);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [autoCountdown, setAutoCountdown] = useState<number | null>(null);

  const searchSeqRef = useRef(0);
  const launchCallbackRef = useRef(onLaunchWithArtwork);
  launchCallbackRef.current = onLaunchWithArtwork;
  const autoTimerRef = useRef<number | null>(null);

  const cancelAutoTimer = useCallback(() => {
    if (autoTimerRef.current !== null) {
      window.clearInterval(autoTimerRef.current);
      autoTimerRef.current = null;
    }
    setAutoCountdown(null);
  }, []);

  const launchCallWithSelection = useCallback(
    async (
      artwork: OnlineArtworkCandidate | null,
      baseProfile: HistoricalProfile
    ) => {
      const seq = searchSeqRef.current;
      cancelAutoTimer();
      setIsFetchingImage(true);
      setErrorMessage(null);

      try {
        let referenceDataUrl: string | undefined;
        let previewFromFetch: string | undefined;
        if (artwork?.imageUrl) {
          const fetchRes = await fetch("/api/facetime/artwork-fetch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageUrl: artwork.imageUrl }),
          });
          if (fetchRes.ok) {
            const fetched = (await fetchRes.json()) as {
              imageDataUrl?: string;
            };
            // Only real image data can be sent as a reference image. A same-origin proxy address
            // (the demo Washington artwork) is still a valid picture to show, so it goes to the preview.
            if (fetched.imageDataUrl?.startsWith("data:image/")) {
              referenceDataUrl = fetched.imageDataUrl;
            } else if (fetched.imageDataUrl) {
              previewFromFetch = fetched.imageDataUrl;
            }
          }
        }

        const enrichedProfile: HistoricalProfile = {
          ...baseProfile,
          artworkTitle: artwork?.title ?? baseProfile.artworkTitle,
          artist: artwork?.artist ?? baseProfile.artist,
          previewImageUrl:
            referenceDataUrl ||
            previewFromFetch ||
            (artwork?.thumbnailUrl
              ? getDisplayImageSrc(artwork.thumbnailUrl)
              : baseProfile.previewImageUrl),
          sourceType: "scanned",
        };

        if (searchSeqRef.current !== seq) return;
        launchCallbackRef.current(enrichedProfile, referenceDataUrl);
      } catch (err) {
        if (searchSeqRef.current !== seq) return;
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Could not retrieve the selected artwork."
        );
      } finally {
        if (searchSeqRef.current === seq) setIsFetchingImage(false);
      }
    },
    [cancelAutoTimer]
  );

  const runSearch = useCallback(
    async (
      rawQuery: string,
      filterOverride?: "all" | "painting" | "sculpture"
    ) => {
      const trimmed = rawQuery.trim();
      if (!trimmed) return;
      const seq = ++searchSeqRef.current;
      cancelAutoTimer();
      setIsSearching(true);
      setErrorMessage(null);
      setResult(null);
      setSelectedArtwork(null);
      setShowAlternatives(false);

      try {
        const res = await fetch("/api/facetime/artwork-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: trimmed,
            mediumFilter: filterOverride ?? mediumFilter,
          }),
        });
        const data = (await res.json()) as OnlineArtworkSearchResult & {
          error?: string;
        };
        if (searchSeqRef.current !== seq) return;
        if (!res.ok) {
          throw new Error(
            data.error || "Could not search online museum archives."
          );
        }
        setResult(data);
        setSelectedArtwork(data.selectedArtwork);

        if (!data.selectedArtwork) {
          setShowAlternatives(true);
          return;
        }

        if (autoPickEnabled) {
          // Accelerated flow: auto-enter FaceTime with the most famous artwork after a short 2.5s glance,
          // while letting the user pause with 1 tap on "Choose Other Art".
          let ticksLeft = 3;
          setAutoCountdown(ticksLeft);
          autoTimerRef.current = window.setInterval(() => {
            ticksLeft -= 1;
            if (ticksLeft <= 0) {
              cancelAutoTimer();
              void launchCallWithSelection(data.selectedArtwork, data.profile);
            } else {
              setAutoCountdown(ticksLeft);
            }
          }, 900);
        } else {
          setShowAlternatives(true);
        }
      } catch (err) {
        if (searchSeqRef.current !== seq) return;
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Failed to search online art archives."
        );
      } finally {
        if (searchSeqRef.current === seq) setIsSearching(false);
      }
    },
    [autoPickEnabled, cancelAutoTimer, launchCallWithSelection, mediumFilter]
  );

  const runSearchRef = useRef(runSearch);
  runSearchRef.current = runSearch;

  useEffect(() => {
    if (!open) {
      cancelAutoTimer();
      setErrorMessage(null);
      setIsSearching(false);
      setIsFetchingImage(false);
      return;
    }
    if (initialQuery.trim()) {
      setQuery(initialQuery.trim());
      void runSearchRef.current(initialQuery.trim());
    }
    return () => {
      searchSeqRef.current++;
      cancelAutoTimer();
    };
  }, [open, initialQuery, cancelAutoTimer]);

  useEffect(() => {
    return () => cancelAutoTimer();
  }, [cancelAutoTimer]);

  if (!open) return null;

  const allArtworks = result
    ? [
        ...(result.selectedArtwork ? [result.selectedArtwork] : []),
        ...result.alternatives,
      ]
    : [];

  return (
    <Modal open={open} onClose={onClose} label="Find artwork">
      <div className="w-full max-w-3xl rounded-3xl overflow-hidden bg-[#151411] border border-white/15 shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent-400/15 border border-accent-300/30 flex items-center justify-center text-accent-300">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                Find artwork
              </h2>
              <p className="text-xs text-slate-400">
                Choose a museum portrait or sculpture for your call.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close online artwork search"
            className="w-9 h-9 rounded-full bg-white/[0.08] hover:bg-white/[0.16] flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Controls */}
        <div className="px-5 py-4 bg-[#0E131D] border-b border-white/10 space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void runSearch(query);
            }}
            className="flex items-center gap-2 rounded-full bg-white/[0.07] border border-white/15 focus-within:border-accent-400/60 px-4 py-1.5"
          >
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search historical figure (e.g. Julius Caesar, Cleopatra, Socrates)…"
              className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-400 focus:outline-none py-1.5 min-w-0"
            />
            <button
              type="submit"
              disabled={!query.trim() || isSearching || isFetchingImage}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#30D158] hover:bg-[#34C759] disabled:bg-white/10 disabled:text-slate-400 text-slate-950 font-semibold text-xs cursor-pointer disabled:cursor-not-allowed shrink-0"
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Searching…</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Find Art</span>
                </>
              )}
            </button>
          </form>

          {/* Medium filter + Auto-pick toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              {(
                [
                  { id: "all", label: "All Art" },
                  { id: "painting", label: "Paintings" },
                  { id: "sculpture", label: "Sculptures & Statues" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setMediumFilter(tab.id);
                    if (query.trim()) void runSearch(query, tab.id);
                  }}
                  className={`px-3 py-1 rounded-full border transition-colors cursor-pointer ${
                    mediumFilter === tab.id
                      ? "bg-accent-500/20 border-accent-400/40 text-accent-200 font-medium"
                      : "bg-white/[0.04] border-white/10 text-slate-400 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                const next = !autoPickEnabled;
                setAutoPickEnabled(next);
                if (!next) {
                  cancelAutoTimer();
                  setShowAlternatives(true);
                }
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border transition-colors cursor-pointer ${
                autoPickEnabled
                  ? "bg-emerald-500/15 border-emerald-400/35 text-emerald-200"
                  : "bg-white/[0.04] border-white/10 text-slate-400"
              }`}
            >
              <Zap className="w-3 h-3" />
              <span>
                {autoPickEnabled
                  ? "Auto-pick most famous: ON"
                  : "Manual art selection"}
              </span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {errorMessage && (
            <div className="rounded-2xl bg-rose-500/15 border border-rose-400/30 px-4 py-3 text-sm text-rose-100">
              {errorMessage}
            </div>
          )}

          {/* Initial quick suggestions before first search */}
          {!isSearching && !result && (
            <div className="py-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-accent-500/10 border border-accent-400/20 flex items-center justify-center mx-auto text-accent-300">
                <Palette className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-white">
                  Search public museum collections &amp; Wikimedia Commons
                </p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  We automatically select the most iconic painting or sculpture
                  and animate them live on FaceTime—or you can browse other
                  works.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                {FEATURED_ART_FIGURES.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      setQuery(name);
                      void runSearch(name);
                    }}
                    className="px-3.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.14] border border-white/10 text-xs text-slate-200 cursor-pointer transition-colors"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Searching state */}
          {isSearching && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-accent-400" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-white">
                  Searching museum collections for “{query}”…
                </p>
                <p className="text-xs text-slate-400">
                  Querying The Met &amp; Wikimedia Commons · ranking the most
                  iconic painting or sculpture
                </p>
              </div>
            </div>
          )}

          {/* Selected Masterpiece Spotlight Card */}
          {!isSearching && result && selectedArtwork && (
            <div className="rounded-3xl overflow-hidden bg-gradient-to-br from-white/[0.07] to-white/[0.03] border border-white/15 p-4 sm:p-5 flex flex-col sm:flex-row gap-5 items-center sm:items-stretch">
              <div className="relative w-full sm:w-56 aspect-[4/3] sm:aspect-auto sm:min-h-[190px] rounded-2xl overflow-hidden bg-black border border-white/15 shrink-0">
                <img
                  src={getDisplayImageSrc(selectedArtwork.thumbnailUrl)}
                  alt={selectedArtwork.title}
                  className="w-full h-full object-cover"
                />
                <span className="absolute top-2.5 left-2.5 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-black/70 border border-white/15 text-amber-200 backdrop-blur-md">
                  {selectedArtwork.isMostFamous
                    ? "Most Famous Pick"
                    : selectedArtwork.medium}
                </span>
              </div>

              <div className="flex-1 flex flex-col justify-between gap-4 min-w-0 w-full">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-emerald-300 font-medium">
                    <Frame className="w-3.5 h-3.5" />
                    <span className="capitalize">{selectedArtwork.medium}</span>
                    <span>·</span>
                    <span className="text-slate-400 truncate">
                      {selectedArtwork.museum}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-white leading-snug">
                    {selectedArtwork.title}
                  </h3>
                  <p className="text-xs text-slate-300">
                    {selectedArtwork.artist} · {selectedArtwork.year}
                  </p>
                  {selectedArtwork.whyFamous && (
                    <p className="text-xs text-slate-400 leading-relaxed pt-1">
                      {selectedArtwork.whyFamous}
                    </p>
                  )}
                </div>

                {/* Action buttons + optional auto-call countdown */}
                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                  <button
                    type="button"
                    disabled={isFetchingImage}
                    onClick={() =>
                      void launchCallWithSelection(
                        selectedArtwork,
                        result.profile
                      )
                    }
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#30D158] hover:bg-[#34C759] disabled:opacity-60 text-slate-950 font-semibold text-sm shadow-lg shadow-emerald-500/25 cursor-pointer"
                  >
                    {isFetchingImage ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Bringing Artwork to Life…</span>
                      </>
                    ) : (
                      <>
                        <Video className="w-4 h-4" />
                        <span>
                          {autoCountdown !== null
                            ? `Calling in ${autoCountdown}s — Call Now`
                            : `FaceTime ${result.profile.name.split(" ")[0]}`}
                        </span>
                      </>
                    )}
                  </button>

                  {result.alternatives.length > 0 && (
                    <button
                      type="button"
                      disabled={isFetchingImage}
                      onClick={() => {
                        cancelAutoTimer();
                        setShowAlternatives((v) => !v);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/18 border border-white/15 text-white text-xs font-medium cursor-pointer"
                    >
                      <Palette className="w-3.5 h-3.5 text-accent-300" />
                      <span>
                        {showAlternatives
                          ? "Hide Other Art"
                          : `Choose Other Art (${result.alternatives.length})`}
                      </span>
                    </button>
                  )}

                  {selectedArtwork.pageUrl &&
                    selectedArtwork.pageUrl.startsWith("https://") && (
                      <a
                        href={selectedArtwork.pageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 ml-auto"
                      >
                        Source
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                </div>
              </div>
            </div>
          )}

          {/* Fallback if no online artwork matched */}
          {!isSearching && result && !selectedArtwork && (
            <div className="rounded-2xl bg-amber-500/10 border border-amber-400/25 p-5 text-center space-y-3">
              <p className="text-sm font-medium text-amber-200">
                No museum artwork found for “{result.query}” with that filter.
              </p>
              <button
                type="button"
                onClick={() => void launchCallWithSelection(null, result.profile)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#30D158] text-slate-950 font-semibold text-sm cursor-pointer"
              >
                <Video className="w-4 h-4" />
                <span>Call {result.profile.name} with Gemini Portrait</span>
              </button>
            </div>
          )}

          {/* Alternative Paintings & Sculptures Gallery */}
          {!isSearching && result && showAlternatives && allArtworks.length > 1 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Choose Any Painting or Sculpture ({allArtworks.length})
                </h4>
                <span className="text-[11px] text-slate-500">
                  Click any piece to animate it on FaceTime
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {allArtworks.map((art) => {
                  const isChosen = selectedArtwork?.id === art.id;
                  return (
                    <button
                      key={art.id}
                      type="button"
                      onClick={() => {
                        cancelAutoTimer();
                        setSelectedArtwork(art);
                      }}
                      className={`group text-left rounded-2xl overflow-hidden border transition-all cursor-pointer flex flex-col bg-white/[0.03] hover:bg-white/[0.07] ${
                        isChosen
                          ? "border-emerald-400 ring-2 ring-emerald-400/30"
                          : "border-white/10 hover:border-white/25"
                      }`}
                    >
                      <div className="relative aspect-[4/3] w-full bg-black overflow-hidden">
                        <img
                          src={getDisplayImageSrc(art.thumbnailUrl)}
                          alt={art.title}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <span className="absolute top-2 left-2 text-[10px] font-medium capitalize px-2 py-0.5 rounded-full bg-black/70 text-slate-200 backdrop-blur-sm">
                          {art.isMostFamous ? "★ Most Famous" : art.medium}
                        </span>
                        {isChosen && (
                          <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#30D158] text-slate-950 flex items-center justify-center shadow">
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                      <div className="p-2.5 space-y-0.5">
                        <p className="text-xs font-medium text-white line-clamp-1">
                          {art.title}
                        </p>
                        <p className="text-[10px] text-slate-400 line-clamp-1">
                          {art.artist} · {art.year}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

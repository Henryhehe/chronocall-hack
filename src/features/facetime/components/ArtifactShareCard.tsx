import React, { useCallback, useState } from "react";
import { Check, Download, Feather, Loader2, Sparkles, X } from "lucide-react";
import { slugifyFigureId } from "../../../../shared/facetime.ts";
import type { FaceTimeArtifactResult, HistoricalProfile } from "../types";

interface ArtifactShareCardProps {
  artifact: FaceTimeArtifactResult | null;
  isLoading: boolean;
  loadingTitle?: string;
  profile: HistoricalProfile;
  onDismiss: () => void;
}

export const ArtifactShareCard: React.FC<ArtifactShareCardProps> = ({
  artifact,
  isLoading,
  loadingTitle,
  profile,
  onDismiss,
}) => {
  const [downloaded, setDownloaded] = useState(false);

  const handleDownload = useCallback(() => {
    if (!artifact?.imageDataUrl) return;

    try {
      const ext = artifact.mimeType.includes("svg") ? "svg" : "png";
      const filename = `${slugifyFigureId(profile.name)}-${slugifyFigureId(
        artifact.title || "keepsake"
      )}.${ext}`;

      const link = document.createElement("a");
      link.href = artifact.imageDataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setDownloaded(true);
      window.setTimeout(() => setDownloaded(false), 2400);
    } catch {
      // Fallback: open in new tab
      window.open(artifact.imageDataUrl, "_blank");
    }
  }, [artifact, profile]);

  if (!isLoading && !artifact) return null;

  return (
    <div className="fixed top-16 sm:top-20 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[420px] max-w-full rounded-3xl bg-[#0D121F]/90 border border-white/20 backdrop-blur-2xl shadow-2xl shadow-black/80 overflow-hidden text-white transition-all animate-in fade-in slide-in-from-top-4 duration-300">
      {/* SharePlay-style Header */}
      <div className="px-4 py-3 bg-white/[0.04] border-b border-white/10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border border-white/25 shadow-md"
            style={{
              background: `linear-gradient(135deg, ${profile.gradientFrom}, ${profile.accentColor})`,
            }}
          >
            {profile.initials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-white truncate">
                {profile.name}
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-medium shrink-0">
                Live Sketch
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {profile.era} · Archival Keepsake
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss artifact card"
          className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Loading Shimmer State */}
      {isLoading && (
        <div className="p-5 flex flex-col items-center text-center gap-4">
          <div className="relative w-full aspect-[4/3] rounded-2xl bg-gradient-to-br from-amber-950/20 via-white/[0.04] to-amber-900/10 border border-amber-500/20 overflow-hidden flex flex-col items-center justify-center gap-3">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent animate-pulse" />
            <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shadow-lg relative">
              <Feather className="w-6 h-6 text-amber-300 animate-bounce" />
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-amber-200">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
              <span>
                {profile.name.split(" ")[0]} is drafting &ldquo;
                {loadingTitle || "a historical sketch"}&rdquo;…
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-serif italic">
              Period pigments on aged parchment
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed max-w-xs">
            Synthesizing an authentic period artifact sketch using Gemini image
            generation…
          </p>
        </div>
      )}

      {/* Rendered Artifact Card */}
      {!isLoading && artifact && (
        <div className="p-4 sm:p-5 space-y-3.5">
          {/* Framed Keepsake Image */}
          <div className="relative group rounded-2xl overflow-hidden border border-amber-500/30 bg-[#16120C] shadow-2xl aspect-[4/3]">
            <img
              src={artifact.imageDataUrl}
              alt={artifact.title}
              className="w-full h-full object-contain bg-[#1F1914]"
            />
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 border border-white/15 backdrop-blur-md text-[10px] font-mono text-amber-300 inline-flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              <span>
                {artifact.demoMode ? "Demo Archival Parchment" : artifact.model}
              </span>
            </div>
          </div>

          {/* Title & Description */}
          <div className="space-y-1">
            <h4 className="text-base font-bold text-white font-serif leading-snug">
              {artifact.title}
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed font-serif italic bg-white/[0.03] p-2.5 rounded-xl border border-white/5">
              &ldquo;{artifact.description}&rdquo;
            </p>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10">
            <span className="text-[10px] text-slate-400 font-mono">
              {artifact.latencyMs > 0 ? `${artifact.latencyMs}ms · ` : ""}
              {profile.location}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onDismiss}
                className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs text-slate-300 font-medium transition-colors cursor-pointer"
              >
                Dismiss
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-semibold text-xs shadow-lg shadow-amber-600/30 transition-transform active:scale-95 cursor-pointer"
              >
                {downloaded ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Save Keepsake</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

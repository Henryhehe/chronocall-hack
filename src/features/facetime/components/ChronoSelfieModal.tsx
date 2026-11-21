import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  Download,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import type { FaceTimeSelfieResult, HistoricalProfile } from "../types";

export interface ChronoSelfieModalProps {
  open: boolean;
  onClose: () => void;
  profile: HistoricalProfile;
  callerImageBase64?: string;
  figureImageBase64?: string;
  onTakeAnother?: () => void;
}

function playShutterSound() {
  try {
    const ctx = new AudioContext();
    const t0 = ctx.currentTime;
    // Crisp camera shutter click simulation using filtered noise & twin clicks
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(1200, t0);
    osc1.frequency.exponentialRampToValueAtTime(180, t0 + 0.04);
    gain1.gain.setValueAtTime(0.0001, t0);
    gain1.gain.linearRampToValueAtTime(0.12, t0 + 0.005);
    gain1.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(t0);
    osc1.stop(t0 + 0.06);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(800, t0 + 0.08);
    osc2.frequency.exponentialRampToValueAtTime(120, t0 + 0.14);
    gain2.gain.setValueAtTime(0.0001, t0 + 0.08);
    gain2.gain.linearRampToValueAtTime(0.1, t0 + 0.085);
    gain2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(t0 + 0.08);
    osc2.stop(t0 + 0.18);
  } catch {
    // Fails silently if Web Audio is blocked
  }
}

export const ChronoSelfieModal: React.FC<ChronoSelfieModalProps> = ({
  open,
  onClose,
  profile,
  callerImageBase64,
  figureImageBase64,
  onTakeAnother,
}) => {
  const [flash, setFlash] = useState(false);
  const [developing, setDeveloping] = useState(false);
  const [selfieResult, setSelfieResult] = useState<FaceTimeSelfieResult | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  const takeSelfie = useCallback(
    async (
      overrideCallerImage?: string,
      overrideFigureImage?: string
    ) => {
      // Abort previous in-flight request if any
      abortControllerRef.current?.abort();
      const ac = new AbortController();
      abortControllerRef.current = ac;

      // Camera Flash & Shutter
      setFlash(true);
      playShutterSound();
      setDeveloping(true);
      setError(null);
      setDownloaded(false);

      // Brief flash fadeout duration
      const flashTimeout = window.setTimeout(() => {
        setFlash(false);
      }, 350);

      try {
        const res = await fetch("/api/facetime/selfie", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ac.signal,
          body: JSON.stringify({
            profile,
            callerImageBase64:
              overrideCallerImage !== undefined
                ? overrideCallerImage
                : callerImageBase64,
            callerMimeType: "image/jpeg",
            figureImageBase64:
              overrideFigureImage !== undefined
                ? overrideFigureImage
                : figureImageBase64,
            figureMimeType: "image/jpeg",
          }),
        });

        const data = (await res.json()) as
          | FaceTimeSelfieResult
          | { error?: string };

        if (!res.ok || !("imageDataUrl" in data)) {
          throw new Error(
            ("error" in data && data.error) ||
              "Could not develop your time-travel selfie."
          );
        }

        if (!ac.signal.aborted) {
          setSelfieResult(data);
          setDeveloping(false);
        }
      } catch (err) {
        if (!ac.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to create chrono-selfie."
          );
          setDeveloping(false);
        }
      } finally {
        window.clearTimeout(flashTimeout);
      }
    },
    [profile, callerImageBase64, figureImageBase64]
  );

  // Trigger selfie generation on initial open
  useEffect(() => {
    if (open) {
      void takeSelfie();
    } else {
      abortControllerRef.current?.abort();
      setFlash(false);
      setDeveloping(false);
      setSelfieResult(null);
      setError(null);
      setDownloaded(false);
    }
  }, [open, takeSelfie]);

  const handleRetake = () => {
    onTakeAnother?.();
    void takeSelfie();
  };

  const handleDownload = () => {
    if (!selfieResult) return;
    const isSvg = selfieResult.imageDataUrl.startsWith("data:image/svg+xml");
    const safeName = profile.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const filename = `chrono-postcard-${safeName || "figure"}-${Date.now()}.${
      isSvg ? "svg" : "png"
    }`;

    const link = document.createElement("a");
    link.href = selfieResult.imageDataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2500);
  };

  if (!open) return null;

  return (
    <>
      {/* Full-bleed Camera Flash Animation */}
      <div
        className={`fixed inset-0 z-50 bg-white pointer-events-none transition-opacity duration-300 ease-out ${
          flash ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Modal Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-6 select-none overflow-y-auto">
        <div className="relative w-full max-w-sm sm:max-w-md my-auto flex flex-col items-center">
          {/* Top Bar with Dismiss and Title */}
          <div className="w-full flex items-center justify-between mb-3 px-2 text-white">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-semibold backdrop-blur-xl">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Chrono-Selfie Postcard</span>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close selfie modal"
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Developing State Shimmer Card */}
          {developing && (
            <div className="w-full bg-[#FAF8F5] rounded-3xl p-4 sm:p-5 shadow-2xl border border-stone-200/90 text-stone-800 flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
              <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-stone-900 border border-stone-800 shadow-inner flex flex-col items-center justify-center p-6 text-center">
                {/* Developing Shimmer Overlay */}
                <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/10 via-white/5 to-transparent animate-pulse" />
                <div className="relative z-10 flex flex-col items-center gap-3">
                  <div className="relative">
                    <span className="absolute -inset-2 rounded-full bg-amber-400/20 animate-ping" />
                    <div className="w-14 h-14 rounded-full bg-stone-800/90 border border-amber-400/40 flex items-center justify-center shadow-xl">
                      <Camera className="w-7 h-7 text-amber-300 animate-pulse" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-white">
                      Developing your time-travel photo with {profile.name}…
                    </p>
                    <p className="text-xs text-stone-400">
                      Compositing period attire & historical likeness in{" "}
                      {profile.location}
                    </p>
                  </div>

                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-amber-200/90">
                    <Loader2 className="w-3 h-3 animate-spin text-amber-300" />
                    <span>Preserving faces across centuries…</span>
                  </div>
                </div>
              </div>

              {/* Developing Polaroid Chin Skeleton */}
              <div className="w-full mt-4 space-y-2 px-1">
                <div className="h-5 bg-stone-200/70 rounded-md w-2/3 animate-pulse" />
                <div className="h-3.5 bg-stone-200/50 rounded-md w-1/2 animate-pulse" />
              </div>
            </div>
          )}

          {/* Error State */}
          {!developing && error && (
            <div className="w-full bg-[#FAF8F5] rounded-3xl p-6 shadow-2xl border border-stone-200 text-stone-800 flex flex-col items-center text-center gap-4 animate-in fade-in">
              <div className="w-12 h-12 rounded-full bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600">
                <Camera className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-stone-900">
                  Photo Development Failed
                </h3>
                <p className="text-xs text-stone-600 max-w-xs">{error}</p>
              </div>
              <button
                type="button"
                onClick={handleRetake}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-lg transition-transform active:scale-95 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </button>
            </div>
          )}

          {/* Developed Ready State: Polaroid-Style Chrono-Postcard */}
          {!developing && selfieResult && (
            <div className="w-full flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-300">
              {/* Physical Polaroid Postcard Container */}
              <div className="w-full bg-[#FAF8F5] rounded-3xl p-4 sm:p-5 shadow-2xl shadow-black/80 border border-stone-200/90 text-stone-900 flex flex-col transform hover:rotate-[-0.5deg] transition-transform duration-300">
                {/* Photo Area */}
                <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-stone-950 border border-stone-300/40 shadow-inner group">
                  <img
                    src={selfieResult.imageDataUrl}
                    alt={selfieResult.caption}
                    className="w-full h-full object-cover select-none"
                  />
                  {/* Subtle glossy photo paper sheen */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 pointer-events-none" />
                </div>

                {/* Polaroid Chin */}
                <div className="pt-4 pb-1 px-1 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="font-serif italic font-bold text-lg sm:text-xl text-stone-900 truncate">
                        With {profile.name}
                      </h4>
                      <p className="text-xs text-stone-600 truncate">
                        {profile.location} · Side-by-Side Across History
                      </p>
                    </div>

                    {/* Era Stamp Pill */}
                    <div className="shrink-0 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200/90 text-amber-900 font-mono text-[11px] sm:text-xs font-bold tracking-wide shadow-xs">
                      {selfieResult.eraStamp}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-stone-200/70 flex items-center justify-between text-[10px] text-stone-400">
                    <span className="tracking-wider uppercase">
                      ChronoCall Certified Temporal Photo
                    </span>
                    <span>
                      {selfieResult.demoMode ? "Demo Mode" : "Gemini 3.1"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="w-full flex items-center gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex-1 py-3 px-4 rounded-full bg-[#30D158] hover:bg-[#34C759] text-slate-950 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  {downloaded ? (
                    <>
                      <Check className="w-4 h-4 text-slate-950" />
                      <span>Postcard Saved!</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 text-slate-950" />
                      <span>Download Postcard</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleRetake}
                  className="py-3 px-4 sm:px-5 rounded-full bg-white/12 hover:bg-white/20 text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-2 border border-white/15 backdrop-blur-xl active:scale-95 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Take Another</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

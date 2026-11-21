import React from "react";
import { Eye, Maximize2, Minimize2, Sparkles, X } from "lucide-react";
import type { FaceTimeCallerAnnotation } from "../types";

interface ShowAndTellOverlayProps {
  annotation: FaceTimeCallerAnnotation | null;
  figureName: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onDismiss: () => void;
  isMirrored?: boolean;
}

export const ShowAndTellOverlay: React.FC<ShowAndTellOverlayProps> = ({
  annotation,
  figureName,
  isExpanded = false,
  onToggleExpand,
  onDismiss,
  isMirrored = false,
}) => {
  if (!annotation) return null;

  const { ymin, xmin, ymax, xmax, label, historicalName, note } = annotation;

  // Convert 0..1000 coordinates to percentages
  const topPct = Math.max(0, Math.min(95, ymin / 10));
  const heightPct = Math.max(5, Math.min(100 - topPct, (ymax - ymin) / 10));

  // If camera stream is mirrored horizontally (standard user front-facing camera)
  const leftPct = isMirrored
    ? Math.max(0, Math.min(95, (1000 - xmax) / 10))
    : Math.max(0, Math.min(95, xmin / 10));
  const widthPct = Math.max(5, Math.min(100 - leftPct, (xmax - xmin) / 10));

  const shortFigure = figureName.split(" ")[0] || figureName;

  return (
    <>
      {/* 2D Bounding Box overlay with antique gold corner reticles */}
      <div
        style={{
          top: `${topPct}%`,
          left: `${leftPct}%`,
          width: `${widthPct}%`,
          height: `${heightPct}%`,
        }}
        className="absolute pointer-events-none transition-all duration-300 z-30"
      >
        {/* Animated glowing border */}
        <div className="absolute inset-0 border border-amber-400/80 rounded-lg shadow-[0_0_16px_rgba(245,158,11,0.4)] bg-amber-500/10" />

        {/* Vintage brass corner brackets */}
        <span className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-amber-300" />
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-amber-300" />
        <span className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-amber-300" />
        <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-amber-300" />

        {/* Center reticle */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-amber-400/70 animate-ping" />
        </div>
      </div>

      {/* Floating Sepia/Gold Callout Badge (compact PiP view) */}
      {!isExpanded && (
        <div className="absolute inset-x-1.5 bottom-1.5 z-30 pointer-events-auto rounded-xl bg-[#140F0A]/92 border border-amber-500/40 p-2 text-amber-100 backdrop-blur-xl shadow-2xl flex flex-col gap-1 text-[11px] select-text">
          <div className="flex items-center justify-between gap-1 border-b border-amber-500/20 pb-1">
            <span className="inline-flex items-center gap-1 font-semibold text-amber-300 font-serif truncate">
              <Eye className="w-3 h-3 text-amber-400 shrink-0" />
              <span>{shortFigure}&apos;s View</span>
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {onToggleExpand && (
                <button
                  type="button"
                  onClick={onToggleExpand}
                  title="Expand inspection to focus"
                  className="p-0.5 rounded text-amber-300 hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  <Maximize2 className="w-3 h-3" />
                </button>
              )}
              <button
                type="button"
                onClick={onDismiss}
                title="Dismiss callout"
                className="p-0.5 rounded text-amber-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="flex items-baseline gap-1.5 truncate">
            <span className="font-bold text-amber-100 text-xs truncate">
              {historicalName || label}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-amber-400/80 px-1 py-0.2 rounded bg-amber-500/15 border border-amber-400/20 shrink-0">
              {label}
            </span>
          </div>

          {note && (
            <p className="text-[10px] text-amber-200/90 italic leading-tight line-clamp-2">
              &ldquo;{note}&rdquo;
            </p>
          )}
        </div>
      )}

      {/* Expand-to-Focus Spotlight Banner & Controls */}
      {isExpanded && (
        <div className="absolute inset-x-2 top-2 z-40 pointer-events-auto rounded-2xl bg-[#16100B]/95 border border-amber-400/50 p-3 text-amber-100 backdrop-blur-2xl shadow-2xl flex flex-col gap-2 select-text">
          <div className="flex items-center justify-between border-b border-amber-400/20 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-amber-400 font-serif">
                  Show &amp; Tell · Object Inspection
                </p>
                <h4 className="text-sm font-bold text-white font-serif">
                  {historicalName}
                </h4>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {onToggleExpand && (
                <button
                  type="button"
                  onClick={onToggleExpand}
                  title="Minimize inspection view"
                  className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs inline-flex items-center gap-1 cursor-pointer"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Compact</span>
                </button>
              )}
              <button
                type="button"
                onClick={onDismiss}
                title="Dismiss inspection"
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-amber-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-amber-400 font-medium">Modern object:</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-200 font-semibold text-[11px]">
              {label}
            </span>
            <span className="text-amber-400/60 font-mono text-[10px] ml-auto">
              Box: [{ymin}, {xmin}, {ymax}, {xmax}]
            </span>
          </div>

          {note && (
            <p className="text-xs text-amber-100/90 italic bg-amber-950/30 p-2 rounded-xl border border-amber-500/20 leading-relaxed font-serif">
              &ldquo;{note}&rdquo;
            </p>
          )}
        </div>
      )}
    </>
  );
};

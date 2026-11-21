import React from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { VisualFilterId } from "../types/vision";

export interface VisualFilterPreset {
  id: VisualFilterId;
  label: string;
  shortDesc: string;
  /** Returns the CSS filter string scaled by intensity (0..100). */
  getCssFilter: (intensity: number) => string;
  /** Optional inline CSS style for the synchronized CSS overlay layer. */
  getOverlayStyle: (intensity: number) => React.CSSProperties | null;
  /** Optional tint string used when rendering PNG snapshots. */
  getSnapshotTint: (intensity: number) => string | null;
}

const clampRatio = (intensity: number) =>
  Math.max(0, Math.min(1, intensity / 100));

export const VISUAL_FILTERS: VisualFilterPreset[] = [
  {
    id: "none",
    label: "Original",
    shortDesc: "Unfiltered feed",
    getCssFilter: () => "none",
    getOverlayStyle: () => null,
    getSnapshotTint: () => null,
  },
  {
    id: "sepia",
    label: "Sepia",
    shortDesc: "Warm archival tone",
    getCssFilter: (intensity) => {
      const t = clampRatio(intensity);
      const sepia = Math.round(92 * t);
      const contrast = Math.round(100 + 10 * t);
      const brightness = Math.round(100 - 4 * t);
      const saturate = Math.round(100 + 14 * t);
      return `sepia(${sepia}%) contrast(${contrast}%) brightness(${brightness}%) saturate(${saturate}%)`;
    },
    getOverlayStyle: (intensity) => {
      const t = clampRatio(intensity);
      return {
        background: `radial-gradient(ellipse at center, rgba(196, 138, 62, ${(0.08 * t).toFixed(3)}) 42%, rgba(28, 16, 4, ${(0.58 * t).toFixed(3)}) 100%)`,
        boxShadow: `inset 0 0 48px rgba(40, 22, 6, ${(0.42 * t).toFixed(3)})`,
      };
    },
    getSnapshotTint: (intensity) =>
      `rgba(148, 96, 36, ${(0.12 * clampRatio(intensity)).toFixed(3)})`,
  },
  {
    id: "high-contrast",
    label: "High Contrast",
    shortDesc: "Crisp tonal separation",
    getCssFilter: (intensity) => {
      const t = clampRatio(intensity);
      const contrast = Math.round(100 + 105 * t);
      const saturate = Math.round(100 + 28 * t);
      const brightness = Math.round(100 + 4 * t);
      return `contrast(${contrast}%) saturate(${saturate}%) brightness(${brightness}%)`;
    },
    getOverlayStyle: (intensity) => {
      const t = clampRatio(intensity);
      return {
        background: `radial-gradient(ellipse at center, transparent 58%, rgba(0, 0, 0, ${(0.38 * t).toFixed(3)}) 100%)`,
      };
    },
    getSnapshotTint: () => null,
  },
  {
    id: "sketch",
    label: "Sketch",
    shortDesc: "Charcoal edge contour",
    getCssFilter: (intensity) => {
      if (intensity <= 5) return "none";
      const t = clampRatio(intensity);
      const contrast = Math.round(105 + 30 * t);
      return `url(#camera-sketch-filter) contrast(${contrast}%)`;
    },
    getOverlayStyle: (intensity) => {
      const t = clampRatio(intensity);
      return {
        backgroundImage: `repeating-linear-gradient(-45deg, rgba(15, 23, 42, ${(0.045 * t).toFixed(3)}) 0px, rgba(15, 23, 42, ${(0.045 * t).toFixed(3)}) 1px, transparent 1px, transparent 5px), radial-gradient(ellipse at center, rgba(244, 239, 228, ${(0.08 * t).toFixed(3)}) 55%, rgba(148, 134, 112, ${(0.28 * t).toFixed(3)}) 100%)`,
        mixBlendMode: "multiply",
      };
    },
    getSnapshotTint: () => null,
  },
  {
    id: "noir",
    label: "Noir",
    shortDesc: "Monochrome cinema",
    getCssFilter: (intensity) => {
      const t = clampRatio(intensity);
      const gray = Math.round(100 * t);
      const contrast = Math.round(100 + 58 * t);
      const brightness = Math.round(100 - 8 * t);
      return `grayscale(${gray}%) contrast(${contrast}%) brightness(${brightness}%)`;
    },
    getOverlayStyle: (intensity) => {
      const t = clampRatio(intensity);
      return {
        background: `radial-gradient(ellipse at center, transparent 38%, rgba(0, 0, 0, ${(0.68 * t).toFixed(3)}) 100%)`,
      };
    },
    getSnapshotTint: () => null,
  },
  {
    id: "night-vision",
    label: "Night Vision",
    shortDesc: "Phosphor scanlines",
    getCssFilter: (intensity) => {
      const t = clampRatio(intensity);
      const gray = Math.round(100 * t);
      const contrast = Math.round(100 + 52 * t);
      const brightness = Math.round(100 + 18 * t);
      return `grayscale(${gray}%) contrast(${contrast}%) brightness(${brightness}%)`;
    },
    getOverlayStyle: (intensity) => {
      const t = clampRatio(intensity);
      return {
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(0, 0, 0, ${(0.3 * t).toFixed(3)}) 2px, rgba(0, 0, 0, ${(0.3 * t).toFixed(3)}) 4px), radial-gradient(ellipse at center, rgba(16, 185, 129, ${(0.24 * t).toFixed(3)}) 35%, rgba(2, 44, 34, ${(0.62 * t).toFixed(3)}) 100%)`,
      };
    },
    getSnapshotTint: (intensity) =>
      `rgba(16, 185, 129, ${(0.22 * clampRatio(intensity)).toFixed(3)})`,
  },
];

export function getVisualFilterPreset(id: VisualFilterId): VisualFilterPreset {
  return VISUAL_FILTERS.find((f) => f.id === id) ?? VISUAL_FILTERS[0];
}

/**
 * Hidden inline SVG filter definition enabling GPU-accelerated real-time
 * Laplacian edge detection + charcoal-on-paper inversion for Sketch mode.
 */
export const CameraFilterSvgDefs: React.FC = () => (
  <svg
    aria-hidden="true"
    width="0"
    height="0"
    className="absolute w-0 h-0 pointer-events-none overflow-hidden"
  >
    <defs>
      <filter id="camera-sketch-filter" colorInterpolationFilters="sRGB">
        <feColorMatrix type="saturate" values="0" result="gray" />
        <feGaussianBlur in="gray" stdDeviation="0.6" result="blurred" />
        <feConvolveMatrix
          in="blurred"
          order="3"
          kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1"
          divisor="1"
          bias="0"
          preserveAlpha="true"
          result="edges"
        />
        <feComponentTransfer in="edges" result="sketch">
          <feFuncR type="linear" slope="-2.5" intercept="0.96" />
          <feFuncG type="linear" slope="-2.5" intercept="0.95" />
          <feFuncB type="linear" slope="-2.5" intercept="0.92" />
        </feComponentTransfer>
      </filter>
    </defs>
  </svg>
);

interface VisualFilterSelectorProps {
  selectedFilter: VisualFilterId;
  onSelectFilter: (id: VisualFilterId) => void;
  intensity: number;
  onChangeIntensity: (value: number) => void;
}

export const VisualFilterSelector: React.FC<VisualFilterSelectorProps> = ({
  selectedFilter,
  onSelectFilter,
  intensity,
  onChangeIntensity,
}) => {
  const isModified = selectedFilter !== "none";

  return (
    <div
      role="region"
      aria-label="Real-time video feed visual filters"
      className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 border-t border-slate-800 bg-[#090D16]"
    >
      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
        <span className="inline-flex items-center gap-1.5 mr-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-400 whitespace-nowrap shrink-0">
          <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
          CSS Filter
        </span>

        {VISUAL_FILTERS.map((preset) => {
          const active = selectedFilter === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={active}
              title={preset.shortDesc}
              onClick={() => onSelectFilter(preset.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? "bg-cyan-500/15 border-cyan-500/60 text-cyan-300"
                  : "bg-[#0D121C] border-slate-800 text-slate-300 hover:bg-[#111827] hover:text-slate-100"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {isModified && (
        <div className="flex items-center gap-2.5 shrink-0">
          <label
            htmlFor="visual-filter-intensity"
            className="text-[11px] font-mono tabular-nums text-slate-400 whitespace-nowrap shrink-0"
          >
            Intensity {intensity}%
          </label>
          <input
            id="visual-filter-intensity"
            type="range"
            min={20}
            max={100}
            step={5}
            value={intensity}
            onChange={(e) => onChangeIntensity(Number(e.target.value))}
            aria-label="Filter intensity"
            className="w-24 accent-cyan-400 cursor-pointer"
          />
          <button
            type="button"
            onClick={() => {
              onSelectFilter("none");
              onChangeIntensity(100);
            }}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-[#111827] hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        </div>
      )}
    </div>
  );
};

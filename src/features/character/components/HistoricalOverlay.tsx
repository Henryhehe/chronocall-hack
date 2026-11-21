import React from "react";
import {
  DetectionBox,
  HistoricalPersona,
  HistoricalPersonaId,
} from "../../../types/vision";

export const HISTORICAL_PERSONAS: HistoricalPersona[] = [
  {
    id: "roman-senator",
    name: "Roman Senator",
    era: "170 AD · Rome",
    greeting:
      "Ave, citizen. Show me an artifact from your modern age and I shall judge its worth.",
    geniePrompt:
      "First-person POV walking steadily forward across sunlit travertine marble stones in an ancient Roman forum at golden hour, towering fluted columns, red linen banners fluttering in the wind, sandals crunching softly on stone.",
  },
  {
    id: "renaissance-polymath",
    name: "Renaissance Polymath",
    era: "1505 · Florence",
    greeting:
      "Buongiorno! Hold your contraptions closer to the glass so I may study their geometry.",
    geniePrompt:
      "First-person POV walking forward through a sunlit 1505 Florentine inventor workshop toward arched wooden doors opening onto Renaissance rooftops, parchment sketches, brass astrolabes, wooden floorboards creaking.",
  },
  {
    id: "victorian-inventor",
    name: "Victorian Inventor",
    era: "1843 · London",
    greeting:
      "Good day! Present your modern apparatus and let us examine its mechanical principles.",
    geniePrompt:
      "First-person POV walking forward down a gaslit 1843 London cobblestone street at dusk, warm amber streetlamps, wrought-iron railings, brick townhouses, mist drifting over wet cobblestones.",
  },
  {
    id: "edo-samurai",
    name: "Edo Samurai",
    era: "1645 · Kyoto",
    greeting:
      "Greetings. Maintain your posture and show me what tools you carry today.",
    geniePrompt:
      "First-person POV walking forward along a cedar-wood walkway inside a 1645 Kyoto castle courtyard, stone lanterns, raked gravel garden, pine trees swaying in a crisp breeze, footsteps on aged timber.",
  },
  {
    id: "ancient-pharaoh",
    name: "Ancient Pharaoh",
    era: "1470 BC · Thebes",
    greeting:
      "Welcome to my court. Place your offerings before the mirror of time.",
    geniePrompt:
      "First-person POV walking steadily forward through a grand sandstone temple colonnade in 1470 BC Egypt toward sunlit Nile palm groves, painted hieroglyphs, flickering bronze braziers, sandals on warm sandstone.",
  },
];

interface HistoricalOverlayProps {
  personaId: HistoricalPersonaId;
  boxes: DetectionBox[];
}

interface AnchorBoxes {
  head: { ymin: number; xmin: number; ymax: number; xmax: number } | null;
  shoulders: { ymin: number; xmin: number; ymax: number; xmax: number } | null;
}

function findAnchors(boxes: DetectionBox[]): AnchorBoxes {
  const findByKeywords = (keywords: string[]) =>
    boxes.find((b) =>
      keywords.some((k) => b.label.toLowerCase().includes(k))
    ) ?? null;

  const headBox = findByKeywords(["head", "face"]);
  const shouldersBox = findByKeywords(["shoulder", "torso", "chest"]);
  const personBox = findByKeywords(["person", "man", "woman", "human"]);

  if (headBox) {
    const h = headBox.ymax - headBox.ymin;
    const w = headBox.xmax - headBox.xmin;
    const estimatedShoulders = shouldersBox ?? {
      ymin: Math.min(980, headBox.ymax + h * 0.05),
      xmin: Math.max(0, headBox.xmin - w * 0.65),
      ymax: Math.min(1000, headBox.ymax + h * 1.4),
      xmax: Math.min(1000, headBox.xmax + w * 0.65),
    };
    return { head: headBox, shoulders: estimatedShoulders };
  }

  if (personBox) {
    const pw = personBox.xmax - personBox.xmin;
    const ph = personBox.ymax - personBox.ymin;
    const estHeadW = Math.min(pw * 0.48, ph * 0.36);
    const cx = (personBox.xmin + personBox.xmax) / 2;
    const estHead = {
      ymin: personBox.ymin,
      xmin: Math.max(0, cx - estHeadW / 2),
      ymax: Math.min(1000, personBox.ymin + ph * 0.34),
      xmax: Math.min(1000, cx + estHeadW / 2),
    };
    const estShoulders = {
      ymin: estHead.ymax,
      xmin: personBox.xmin,
      ymax: Math.min(1000, personBox.ymin + ph * 0.78),
      xmax: personBox.xmax,
    };
    return { head: estHead, shoulders: estShoulders };
  }

  return { head: null, shoulders: null };
}

export const HistoricalOverlay: React.FC<HistoricalOverlayProps> = ({
  personaId,
  boxes,
}) => {
  if (personaId === "none") return null;
  const { head, shoulders } = findAnchors(boxes);
  if (!head) return null;

  const headW = Math.max(40, head.xmax - head.xmin);
  const headH = Math.max(40, head.ymax - head.ymin);
  const headCx = (head.xmin + head.xmax) / 2;

  const shoulderW = shoulders ? shoulders.xmax - shoulders.xmin : headW * 2.3;
  const shoulderCx = shoulders
    ? (shoulders.xmin + shoulders.xmax) / 2
    : headCx;
  const collarY = shoulders ? shoulders.ymin : head.ymax;

  return (
    <svg
      viewBox="0 0 1000 1000"
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full pointer-events-none"
    >
      <defs>
        <linearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="50%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#92400E" />
        </linearGradient>
        <linearGradient id="crimsonToga" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#991B1B" />
          <stop offset="100%" stopColor="#450A0A" />
        </linearGradient>
        <linearGradient id="lapisGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1D4ED8" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </linearGradient>
      </defs>

      {personaId === "roman-senator" && (
        <g className="bbox-enter">
          {/* Toga drape & golden fibula clasp */}
          <path
            d={`M ${shoulderCx - shoulderW * 0.48} ${collarY + headH * 0.9}
                Q ${shoulderCx - shoulderW * 0.35} ${collarY} ${shoulderCx - headW * 0.38} ${collarY - headH * 0.04}
                L ${shoulderCx + headW * 0.42} ${collarY + headH * 0.85}
                L ${shoulderCx + shoulderW * 0.45} ${collarY + headH * 1.1}
                L ${shoulderCx - shoulderW * 0.48} ${collarY + headH * 1.1} Z`}
            fill="url(#crimsonToga)"
            fillOpacity="0.86"
            stroke="#F59E0B"
            strokeWidth="3"
          />
          <circle
            cx={shoulderCx - headW * 0.34}
            cy={collarY + headH * 0.08}
            r={Math.max(8, headW * 0.09)}
            fill="url(#goldGrad)"
            stroke="#FEF3C7"
            strokeWidth="2"
          />
          {/* Golden Laurel Wreath */}
          <g
            transform={`translate(${headCx}, ${head.ymin + headH * 0.14})`}
          >
            {[-0.52, -0.38, -0.22, 0.22, 0.38, 0.52].map((ang, i) => {
              const rx = Math.sin(ang) * headW * 0.52;
              const ry = -Math.cos(ang) * headH * 0.18 + headH * 0.05;
              const rot = (ang * 180) / Math.PI;
              return (
                <ellipse
                  key={i}
                  cx={rx}
                  cy={ry}
                  rx={headW * 0.11}
                  ry={headH * 0.055}
                  transform={`rotate(${rot}, ${rx}, ${ry})`}
                  fill="url(#goldGrad)"
                  stroke="#FEF3C7"
                  strokeWidth="1.5"
                />
              );
            })}
          </g>
        </g>
      )}

      {personaId === "renaissance-polymath" && (
        <g className="bbox-enter">
          {/* Pleated white ruff collar */}
          <ellipse
            cx={headCx}
            cy={collarY + headH * 0.08}
            rx={headW * 0.72}
            ry={headH * 0.2}
            fill="#F8FAFC"
            fillOpacity="0.92"
            stroke="#CBD5E1"
            strokeWidth="3"
          />
          <path
            d={`M ${headCx - headW * 0.65} ${collarY + headH * 0.08}
                Q ${headCx} ${collarY + headH * 0.34} ${headCx + headW * 0.65} ${collarY + headH * 0.08}`}
            fill="none"
            stroke="#94A3B8"
            strokeWidth="2.5"
            strokeDasharray="8 6"
          />
          {/* Florentine velvet beret */}
          <path
            d={`M ${headCx - headW * 0.58} ${head.ymin + headH * 0.16}
                Q ${headCx - headW * 0.72} ${head.ymin - headH * 0.24} ${headCx + headW * 0.1} ${head.ymin - headH * 0.26}
                Q ${headCx + headW * 0.72} ${head.ymin - headH * 0.18} ${headCx + headW * 0.56} ${head.ymin + headH * 0.16} Z`}
            fill="#7F1D1D"
            fillOpacity="0.93"
            stroke="#F59E0B"
            strokeWidth="2.5"
          />
          <circle
            cx={headCx - headW * 0.35}
            cy={head.ymin - headH * 0.02}
            r={Math.max(6, headW * 0.06)}
            fill="url(#goldGrad)"
          />
        </g>
      )}

      {personaId === "victorian-inventor" && (
        <g className="bbox-enter">
          {/* High collar & cravat */}
          <path
            d={`M ${headCx - headW * 0.38} ${collarY}
                L ${headCx + headW * 0.38} ${collarY}
                L ${headCx + headW * 0.52} ${collarY + headH * 0.65}
                L ${headCx} ${collarY + headH * 0.85}
                L ${headCx - headW * 0.52} ${collarY + headH * 0.65} Z`}
            fill="#1E293B"
            fillOpacity="0.92"
            stroke="#D97706"
            strokeWidth="2.5"
          />
          {/* Brass Monocle over right eye */}
          <circle
            cx={headCx + headW * 0.18}
            cy={head.ymin + headH * 0.42}
            r={headW * 0.13}
            fill="#06B6D4"
            fillOpacity="0.14"
            stroke="#F59E0B"
            strokeWidth="3"
          />
          <line
            x1={headCx + headW * 0.31}
            y1={head.ymin + headH * 0.44}
            x2={headCx + headW * 0.44}
            y2={collarY + headH * 0.3}
            stroke="#F59E0B"
            strokeWidth="2"
            strokeDasharray="4 3"
          />
          {/* Silk Top Hat */}
          <rect
            x={headCx - headW * 0.42}
            y={head.ymin - headH * 0.52}
            width={headW * 0.84}
            height={headH * 0.62}
            rx="6"
            fill="#0F172A"
            stroke="#475569"
            strokeWidth="2.5"
          />
          <rect
            x={headCx - headW * 0.42}
            y={head.ymin + headH * 0.01}
            width={headW * 0.84}
            height={headH * 0.09}
            fill="#B45309"
          />
          <ellipse
            cx={headCx}
            cy={head.ymin + headH * 0.11}
            rx={headW * 0.72}
            ry={headH * 0.07}
            fill="#0F172A"
            stroke="#475569"
            strokeWidth="2.5"
          />
        </g>
      )}

      {personaId === "edo-samurai" && (
        <g className="bbox-enter">
          {/* Shoulder sode armor plates */}
          <rect
            x={shoulderCx - shoulderW * 0.5}
            y={collarY + headH * 0.02}
            width={shoulderW * 0.28}
            height={headH * 0.75}
            rx="6"
            fill="#1E293B"
            fillOpacity="0.92"
            stroke="#DC2626"
            strokeWidth="3"
          />
          <rect
            x={shoulderCx + shoulderW * 0.22}
            y={collarY + headH * 0.02}
            width={shoulderW * 0.28}
            height={headH * 0.75}
            rx="6"
            fill="#1E293B"
            fillOpacity="0.92"
            stroke="#DC2626"
            strokeWidth="3"
          />
          {/* Kabuto dome & Shikoro neck guards */}
          <path
            d={`M ${headCx - headW * 0.65} ${head.ymin + headH * 0.28}
                L ${headCx - headW * 0.54} ${head.ymin + headH * 0.05}
                Q ${headCx} ${head.ymin - headH * 0.35} ${headCx + headW * 0.54} ${head.ymin + headH * 0.05}
                L ${headCx + headW * 0.65} ${head.ymin + headH * 0.28} Z`}
            fill="#0F172A"
            fillOpacity="0.94"
            stroke="#DC2626"
            strokeWidth="3"
          />
          {/* Golden Crescent Maedate Crest */}
          <path
            d={`M ${headCx - headW * 0.45} ${head.ymin - headH * 0.38}
                Q ${headCx} ${head.ymin + headH * 0.05} ${headCx + headW * 0.45} ${head.ymin - headH * 0.38}
                Q ${headCx} ${head.ymin - headH * 0.06} ${headCx - headW * 0.45} ${head.ymin - headH * 0.38} Z`}
            fill="url(#goldGrad)"
            stroke="#FEF3C7"
            strokeWidth="1.5"
          />
        </g>
      )}

      {personaId === "ancient-pharaoh" && (
        <g className="bbox-enter">
          {/* Broad Wesekh Collar */}
          <path
            d={`M ${headCx - headW * 0.55} ${collarY}
                Q ${headCx} ${collarY + headH * 0.65} ${headCx + headW * 0.55} ${collarY}
                L ${headCx + headW * 0.75} ${collarY + headH * 0.38}
                Q ${headCx} ${collarY + headH * 0.95} ${headCx - headW * 0.75} ${collarY + headH * 0.38} Z`}
            fill="url(#goldGrad)"
            fillOpacity="0.92"
            stroke="#1D4ED8"
            strokeWidth="3"
          />
          {/* Nemes Headcloth lappets */}
          <path
            d={`M ${headCx - headW * 0.56} ${head.ymin + headH * 0.15}
                Q ${headCx} ${head.ymin - headH * 0.32} ${headCx + headW * 0.56} ${head.ymin + headH * 0.15}
                L ${headCx + headW * 0.78} ${head.ymax + headH * 0.3}
                L ${headCx + headW * 0.48} ${head.ymax + headH * 0.3}
                L ${headCx + headW * 0.45} ${head.ymin + headH * 0.25}
                Q ${headCx} ${head.ymin + headH * 0.05} ${headCx - headW * 0.45} ${head.ymin + headH * 0.25}
                L ${headCx - headW * 0.48} ${head.ymax + headH * 0.3}
                L ${headCx - headW * 0.78} ${head.ymax + headH * 0.3} Z`}
            fill="url(#lapisGrad)"
            fillOpacity="0.88"
            stroke="#F59E0B"
            strokeWidth="3"
          />
          {/* Uraeus golden forehead emblem */}
          <ellipse
            cx={headCx}
            cy={head.ymin + headH * 0.04}
            rx={headW * 0.07}
            ry={headH * 0.11}
            fill="url(#goldGrad)"
            stroke="#FEF3C7"
            strokeWidth="1.5"
          />
        </g>
      )}
    </svg>
  );
};

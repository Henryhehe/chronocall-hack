import { latestResearch, type CallTrace } from "../../../../shared/callEvidence.ts";
import { CallEvidencePanel } from "./CallEvidencePanel";
import React, { useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  Cpu,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import {
  formatConfidencePercent,
  formatDecisionVerdictLabel,
} from "../../../../shared/facetime.ts";
import type {
  ActiveVideoLayer,
  FaceTimeDecisionResult,
  GeminiPipelineEvent,
} from "../types";

interface GeminiTelemetryHudProps {
  evidence: CallTrace | null;
  events: GeminiPipelineEvent[];
  latestDecision: FaceTimeDecisionResult | null;
  verifyingDecision: boolean;
  voiceStatus: "idle" | "connecting" | "connected" | "demo" | "text-only";
  activeVideoLayer: ActiveVideoLayer;
  videoUpgrading: boolean;
  demoMode: boolean;
}

interface ModelRow {
  id: string;
  role: string;
  status: "Streaming" | "Verifying" | "Active" | "Ready" | "Standby" | "Unavailable";
  latencyMs?: number;
  highlight?: boolean;
}

export const GeminiTelemetryHud: React.FC<GeminiTelemetryHudProps> = ({
  evidence,
  events,
  latestDecision,
  verifyingDecision,
  voiceStatus,
  activeVideoLayer,
  videoUpgrading,
  demoMode,
}) => {
  const [expanded, setExpanded] = useState(false);

  const modelRows = useMemo<ModelRow[]>(() => {
    const latestByStage = new Map<string, GeminiPipelineEvent>();
    for (const ev of events) {
      if (!latestByStage.has(ev.stage)) {
        latestByStage.set(ev.stage, ev);
      }
    }

    const visionEv = latestByStage.get("vision") ?? latestByStage.get("persona");
    const portraitEv = latestByStage.get("portrait");
    const decisionEv = latestByStage.get("decisions");
    const liveStatus = [...(evidence?.events ?? [])].reverse().find(entry => entry.event.type === "status" && entry.event.model);

    const researchRows: ModelRow[] = latestResearch(evidence).map(event => ({
      id: event.model, role: event.stage === "quick" ? "Quick Research" : "Deep Research",
      status: event.type === "researchStarted" ? "Verifying" : event.type === "researchFailed" ? "Unavailable" : "Ready",
      latencyMs: event.type === "researchStarted" ? undefined : event.ms,
      highlight: event.type === "researchStarted",
    }));
    return [
      ...researchRows,
      {
        id: liveStatus ? String(liveStatus.event.model) : "Live model pending",
        role: "Real-Time Voice + Vision",
        status:
          voiceStatus === "connected"
            ? "Streaming"
            : voiceStatus === "connecting"
              ? "Verifying"
              : "Standby",
        highlight: voiceStatus === "connected",
      },
      {
        id: latestDecision?.model || "gemini-decision-1",
        role: "Decisions API Grounding",
        status: verifyingDecision
          ? "Verifying"
          : latestDecision?.verdict === "unavailable"
            ? "Unavailable"
            : latestDecision
            ? "Active"
            : "Standby",
        latencyMs: latestDecision?.latencyMs ?? decisionEv?.latencyMs,
        highlight: verifyingDecision || Boolean(latestDecision),
      },
      {
        id: "gemini-4-hydrogen",
        role: "Artwork Scan & Persona",
        status: visionEv?.status === "running" ? "Verifying" : visionEv ? "Ready" : "Standby",
        latencyMs: visionEv?.latencyMs,
      },
      {
        id: "gemini-3.1-flash-lite-image",
        role: "Living Portrait Synthesis",
        status:
          portraitEv?.status === "running"
            ? "Verifying"
            : portraitEv
              ? "Ready"
              : "Standby",
        latencyMs: portraitEv?.latencyMs,
      },
      {
        id: activeVideoLayer === "veo" ? "veo-3.1-fast" : "models/genie-4",
        role:
          activeVideoLayer === "veo"
            ? "Full-Motion Video Loop"
            : "Live Interactive Video",
        status:
          activeVideoLayer === "genie" || activeVideoLayer === "veo"
            ? "Streaming"
            : videoUpgrading
              ? "Verifying"
              : "Standby",
        highlight: activeVideoLayer === "genie" || activeVideoLayer === "veo",
      },
    ];
  }, [
    evidence,
    activeVideoLayer,
    events,
    latestDecision,
    verifyingDecision,
    videoUpgrading,
    voiceStatus,
  ]);

  const activeCount = modelRows.filter(
    (m) => m.status === "Streaming" || m.status === "Active" || m.status === "Verifying"
  ).length;

  const isPulsing =
    verifyingDecision ||
    videoUpgrading ||
    voiceStatus === "connected" ||
    voiceStatus === "connecting";

  const latestEvent = events[0] ?? null;

  return (
    <div className="relative">
      {/* Subtle Apple-Intelligence-style Gemini 4 Pill */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="group relative inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-black/50 hover:bg-black/65 border border-white/15 backdrop-blur-2xl text-xs font-medium text-slate-100 cursor-pointer shadow-xl transition-all"
      >
        {/* Whisper-thin Gemini 4-color aurora ring when models are firing */}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute -inset-[1px] rounded-full opacity-75 transition-opacity ${
            isPulsing ? "opacity-90" : "opacity-35 group-hover:opacity-70"
          }`}
          style={{
            background:
              "linear-gradient(110deg, rgba(66,133,244,0.65), rgba(155,114,203,0.65), rgba(217,101,112,0.55), rgba(52,168,83,0.65))",
            WebkitMask:
              "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
            padding: "1px",
          }}
        />

        <span
          className={`relative w-2 h-2 rounded-full ${
            isPulsing ? "animate-pulse" : ""
          }`}
          style={{
            background:
              "linear-gradient(135deg, #4285F4 0%, #9B72CB 50%, #34A853 100%)",
          }}
        />

        <span className="font-semibold tracking-tight">Gemini 4</span>

        <span className="hidden md:inline text-[11px] text-slate-300 font-mono">
          {verifyingDecision
            ? "Decisions API…"
            : latestDecision
              ? formatDecisionVerdictLabel(latestDecision.verdict)
              : `${activeCount} Active`}
        </span>

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Expandable Frosted-Glass Live Gemini Pipeline Inspector */}
      {expanded && (
        <div className="absolute right-0 mt-2 w-[min(24rem,calc(100vw-2rem))] max-h-[75vh] overflow-y-auto rounded-3xl bg-[#0A0E17]/95 border border-white/15 backdrop-blur-2xl shadow-2xl p-4 space-y-4 z-50 text-left">
          {/* Header */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-300" />
              <div>
                <h3 className="text-xs font-semibold text-white">
                  Live Gemini 4 Pipeline
                </h3>
                <p className="text-[11px] text-slate-400">
                  {demoMode
                    ? "Simulated telemetry · add GEMINI_API_KEY for live calls"
                    : "Real-time multimodal orchestration"}
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.08] text-slate-300 border border-white/10">
              {activeCount} live
            </span>
          </div>

          {/* Active Model Matrix */}
          <div className="space-y-1.5">
            {modelRows.map((row) => (
              <div
                key={`${row.id}-${row.role}`}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border transition-colors ${
                  row.highlight
                    ? "bg-white/[0.07] border-white/15"
                    : "bg-white/[0.03] border-white/[0.06]"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Cpu className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="text-[11px] font-mono text-white truncate">
                      {row.id}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                    {row.role}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {typeof row.latencyMs === "number" && row.latencyMs > 0 && (
                    <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                      {row.latencyMs}ms
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      row.status === "Streaming"
                        ? "bg-emerald-500/15 text-emerald-300 border border-emerald-400/25"
                        : row.status === "Verifying"
                          ? "bg-sky-500/15 text-sky-300 border border-sky-400/25"
                          : row.status === "Active" || row.status === "Ready"
                            ? "bg-violet-500/15 text-violet-200 border border-violet-400/25"
                            : "bg-white/[0.05] text-slate-400 border border-white/10"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        row.status === "Streaming"
                          ? "bg-emerald-400 animate-pulse"
                          : row.status === "Verifying"
                            ? "bg-sky-400 animate-ping"
                            : row.status === "Active" || row.status === "Ready"
                              ? "bg-violet-400"
                              : "bg-slate-500"
                      }`}
                    />
                    {row.status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Decisions API Calibrated Grounding Card */}
          <div className="rounded-2xl bg-gradient-to-br from-sky-500/10 via-violet-500/10 to-emerald-500/10 border border-white/12 p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {!latestDecision || latestDecision.verdict === "unavailable" || latestDecision.verdict === "anachronism" ? (
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-300" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                )}
                <span className="text-[11px] font-semibold text-white">
                  Post-turn model assessment
                </span>
              </div>
              {latestDecision && (
                <span className="text-[10px] font-mono text-emerald-300">
                  {latestDecision.latencyMs}ms
                </span>
              )}
            </div>

            {verifyingDecision ? (
              <p className="text-[11px] text-sky-200 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 animate-pulse" />
                Checking the completed reply for era consistency…
              </p>
            ) : latestDecision && latestDecision.verdict !== "unavailable" ? (
              <>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-200 font-medium">
                    {formatDecisionVerdictLabel(latestDecision.verdict)}
                  </span>
                  <span className="font-mono text-white font-semibold">
                    {formatConfidencePercent(latestDecision.confidence)}
                  </span>
                </div>

                {/* Calibrated probability bars */}
                <div className="space-y-1.5">
                  {(
                    [
                      { key: "verified", label: "Consistent", bar: "bg-emerald-400" },
                      {
                        key: "plausible_persona",
                        label: "Persona",
                        bar: "bg-sky-400",
                      },
                      {
                        key: "anachronism",
                        label: "Anachronism",
                        bar: "bg-amber-400",
                      },
                    ] as const
                  ).map((item) => {
                    const prob = Math.max(
                      0,
                      Math.min(1, latestDecision.probabilities[item.key] ?? 0)
                    );
                    return (
                      <div key={item.key} className="flex items-center gap-2">
                        <span className="w-20 text-[10px] text-slate-400">
                          {item.label}
                        </span>
                        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${item.bar} transition-all duration-500`}
                            style={{ width: `${Math.round(prob * 100)}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-[10px] font-mono text-slate-300 tabular-nums">
                          {Math.round(prob * 100)}%
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[10px] text-slate-300">
                  <span>
                    Era Fidelity: {latestDecision.eraFidelityScore ?? "—"}/
                    {latestDecision.eraFidelityMax}
                  </span>
                  <span className="font-mono text-slate-400">
                    {latestDecision.model}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-[11px] text-slate-400">
                Assessment unavailable or not yet received. No verification is claimed.
              </p>
            )}
          </div>

          <p className="text-[10px] text-slate-400">Checks run after speech. Model assessments can be wrong and do not independently verify sources.</p>

          <CallEvidencePanel trace={evidence} />

          {/* Compact Recent Trace */}
          {latestEvent && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Recent Model Activity
              </p>
              <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                {events.slice(0, 5).map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-center justify-between gap-2 text-[10px] text-slate-300 py-0.5"
                  >
                    <span className="truncate">
                      <span className="font-mono text-sky-300">{ev.model}</span>{" "}
                      · {ev.label}
                    </span>
                    {typeof ev.latencyMs === "number" && ev.latencyMs > 0 && (
                      <span className="font-mono text-slate-500 shrink-0 tabular-nums">
                        {ev.latencyMs}ms
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

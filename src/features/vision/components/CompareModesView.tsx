import React from "react";
import { DetectionFrameResult, FrameQaEntry, LiveTranscriptEntry } from "../../../types/vision";

interface CompareModesViewProps {
  history: DetectionFrameResult[];
  qaHistory: FrameQaEntry[];
  transcripts: LiveTranscriptEntry[];
  onSelectLiveVision: () => void;
}

export const CompareModesView: React.FC<CompareModesViewProps> = ({
  history,
  qaHistory,
  transcripts,
  onSelectLiveVision,
}) => {
  const detectRuns = history.filter((h) => h.source === "detect");
  const avgDetectLatency =
    detectRuns.length > 0
      ? Math.round(
          detectRuns.reduce((sum, r) => sum + r.latencyMs, 0) / detectRuns.length
        )
      : null;

  const avgQaLatency =
    qaHistory.length > 0
      ? Math.round(
          qaHistory.reduce((sum, r) => sum + r.latencyMs, 0) / qaHistory.length
        )
      : null;

  const totalObjectsDetected = history.reduce(
    (sum, r) => sum + r.objects.length,
    0
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">
            Real-Time Gemini Vision Modes
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Live session measurements and capability comparison across Gemini
            multimodal pipelines.
          </p>
        </div>
        <button
          type="button"
          onClick={onSelectLiveVision}
          className="px-4 py-2 text-xs font-medium bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Return to Live Camera
        </button>
      </div>

      {/* Measured Session Telemetry Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-[#0B0F17] border border-slate-800 rounded-lg">
          <div className="text-xs text-slate-400 mb-1">Frames Analyzed</div>
          <div className="text-2xl font-mono tabular-nums font-semibold text-slate-100">
            {detectRuns.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            gemini-4-hydrogen · structured JSON
          </div>
        </div>

        <div className="p-4 bg-[#0B0F17] border border-slate-800 rounded-lg">
          <div className="text-xs text-slate-400 mb-1">Avg Detection Latency</div>
          <div className="text-2xl font-mono tabular-nums font-semibold text-cyan-400">
            {avgDetectLatency !== null ? `${avgDetectLatency} ms` : "—"}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            ThinkingLevel.LOW round-trip
          </div>
        </div>

        <div className="p-4 bg-[#0B0F17] border border-slate-800 rounded-lg">
          <div className="text-xs text-slate-400 mb-1">Objects Localized</div>
          <div className="text-2xl font-mono tabular-nums font-semibold text-slate-100">
            {totalObjectsDetected}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Avg Frame Q&amp;A:{" "}
            <span className="font-mono tabular-nums">
              {avgQaLatency !== null ? `${avgQaLatency} ms` : "—"}
            </span>
          </div>
        </div>

        <div className="p-4 bg-[#0B0F17] border border-slate-800 rounded-lg">
          <div className="text-xs text-slate-400 mb-1">Live Voice Turns</div>
          <div className="text-2xl font-mono tabular-nums font-semibold text-slate-100">
            {transcripts.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            gemini-3.8-live · 16kHz / 24kHz PCM
          </div>
        </div>
      </div>

      {/* Mode Comparison Matrix */}
      <div className="bg-[#0B0F17] border border-slate-800 rounded-lg overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-[#0D121C] text-xs text-slate-400">
              <th className="py-3 px-4 font-medium">Mode</th>
              <th className="py-3 px-4 font-medium">Model</th>
              <th className="py-3 px-4 font-medium">Transport</th>
              <th className="py-3 px-4 font-medium">Output</th>
              <th className="py-3 px-4 font-medium">Best Use Case</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80 text-xs">
            <tr>
              <td className="py-3.5 px-4 font-medium text-slate-100 whitespace-nowrap">
                Continuous Bounding Boxes &amp; Character Mirror
              </td>
              <td className="py-3.5 px-4 font-mono text-cyan-400 whitespace-nowrap">
                gemini-4-hydrogen / gemini-4-neon
              </td>
              <td className="py-3.5 px-4 text-slate-300">
                Sampled JPEG frames (1s–4s) over HTTP POST
              </td>
              <td className="py-3.5 px-4 text-slate-300">
                Normalized 0–1000 boxes, historical overlay tracking, in-character commentary
              </td>
              <td className="py-3.5 px-4 text-slate-400">
                Visual object localization, historical costume overlay, speed vs. Pro comparison
              </td>
            </tr>
            <tr>
              <td className="py-3.5 px-4 font-medium text-slate-100 whitespace-nowrap">
                Interactive Live Voice &amp; Video
              </td>
              <td className="py-3.5 px-4 font-mono text-cyan-400 whitespace-nowrap">
                gemini-3.8-live
              </td>
              <td className="py-3.5 px-4 text-slate-300">
                Persistent WebSocket (1 FPS video + 16kHz mic audio)
              </td>
              <td className="py-3.5 px-4 text-slate-300">
                24kHz spoken voice, live transcripts, tool-triggered boxes
              </td>
              <td className="py-3.5 px-4 text-slate-400">
                Hands-free inspection, natural Q&amp;A, barge-in conversation
              </td>
            </tr>
            <tr>
              <td className="py-3.5 px-4 font-medium text-slate-100 whitespace-nowrap">
                Interactive Historical World
              </td>
              <td className="py-3.5 px-4 font-mono text-cyan-400 whitespace-nowrap">
                models/genie-4
              </td>
              <td className="py-3.5 px-4 text-slate-300">
                WebRTC media stream via ephemeral auth token
              </td>
              <td className="py-3.5 px-4 text-slate-300">
                720p @ 24 fps video + 48 kHz stereo audio (120s cap)
              </td>
              <td className="py-3.5 px-4 text-slate-400">
                Camera-seeded interactive historical environments with WASD steering
              </td>
            </tr>
            <tr>
              <td className="py-3.5 px-4 font-medium text-slate-100 whitespace-nowrap">
                On-Demand Frame Q&amp;A
              </td>
              <td className="py-3.5 px-4 font-mono text-cyan-400 whitespace-nowrap">
                gemini-4-hydrogen / gemini-4-neon
              </td>
              <td className="py-3.5 px-4 text-slate-300">
                Single frame + text prompt via HTTP POST
              </td>
              <td className="py-3.5 px-4 text-slate-300">
                Concise visual reasoning or in-character response
              </td>
              <td className="py-3.5 px-4 text-slate-400">
                Reading labels, verifying states, silent questions
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
};

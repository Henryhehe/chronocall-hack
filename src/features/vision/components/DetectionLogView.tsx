import React, { useMemo, useState } from "react";
import { Download, Search, Trash2 } from "lucide-react";
import { DetectionFrameResult } from "../../../types/vision";

interface DetectionLogViewProps {
  history: DetectionFrameResult[];
  onExportJson: () => void;
  onClearHistory: () => void;
  onBackToLive: () => void;
}

export const DetectionLogView: React.FC<DetectionLogViewProps> = ({
  history,
  onExportJson,
  onClearHistory,
  onBackToLive,
}) => {
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "detect" | "live-tool">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return history.filter((item) => {
      if (sourceFilter !== "all" && item.source !== sourceFilter) return false;
      if (!q) return true;
      return (
        item.summary.toLowerCase().includes(q) ||
        item.objects.some((o) => o.label.toLowerCase().includes(q))
      );
    });
  }, [history, query, sourceFilter]);

  return (
    <section className="session-page space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="workspace-title">
            Observation log
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Review the objects and scenes you discovered in this session.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onExportJson}
            disabled={history.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-elevated hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            Export JSON
          </button>
          <button
            type="button"
            onClick={onClearHistory}
            disabled={history.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-elevated hover:bg-rose-950/50 text-rose-300 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear observations
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            aria-label="Search observations"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search observations…"
            className="w-full pl-9 pr-3 py-2 text-xs bg-surface text-slate-100 placeholder:text-slate-500 border border-slate-800 rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-500"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-surface border border-slate-800 rounded-md">
          {(
            [
              { id: "all", label: "All observations" },
              { id: "detect", label: "Image analysis" },
              { id: "live-tool", label: "Conversation" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSourceFilter(tab.id)}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                sourceFilter === tab.id
                  ? "bg-elevated text-accent-400"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-14 px-6 text-center bg-surface border border-slate-800 rounded-lg space-y-3">
          <p className="text-sm font-medium text-slate-200">
            {history.length === 0
              ? "No observations yet"
              : "No matching observations"}
          </p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Add an image in Visual discovery to start collecting observations.
          </p>
          <button
            type="button"
            onClick={onBackToLive}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-accent-500 hover:bg-accent-400 text-slate-950 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Open visual discovery
          </button>
        </div>
      ) : (
        <div className="bg-surface border border-slate-800 rounded-lg overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 bg-surface">
                <th className="py-2.5 px-4 font-medium">Time</th>
                <th className="py-2.5 px-4 font-medium">Engine</th>
                <th className="py-2.5 px-4 font-medium">Detected Labels</th>
                <th className="py-2.5 px-4 font-medium">Scene Summary</th>
                <th className="py-2.5 px-4 font-medium text-right">Count</th>
                <th className="py-2.5 px-4 font-medium text-right">Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filtered.map((item) => (
                <tr key={item.frameId} className="hover:bg-elevated/70">
                  <td className="py-2.5 px-4 font-mono tabular-nums text-slate-300 whitespace-nowrap">
                    {new Date(item.timestamp).toLocaleTimeString([], {
                      hour12: false,
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-slate-400 whitespace-nowrap">
                    {item.model}
                  </td>
                  <td className="py-2.5 px-4 text-slate-200 max-w-xs truncate">
                    {item.objects.length > 0
                      ? item.objects
                          .map(
                            (o) =>
                              `${o.label} (${Math.round(o.confidence * 100)}%)`
                          )
                          .join(" · ")
                      : "None"}
                  </td>
                  <td className="py-2.5 px-4 text-slate-400 max-w-md truncate">
                    {item.summary}
                  </td>
                  <td className="py-2.5 px-4 font-mono tabular-nums text-right text-slate-200">
                    {item.objects.length}
                  </td>
                  <td className="py-2.5 px-4 font-mono tabular-nums text-right text-accent-400 whitespace-nowrap">
                    {item.latencyMs > 0 ? `${item.latencyMs} ms` : "Live"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

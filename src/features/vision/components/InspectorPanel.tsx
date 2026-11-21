import React from "react";
import { Download, Trash2 } from "lucide-react";
import {
  DetectionBox,
  FrameQaEntry,
  InspectorTab,
  LiveTranscriptEntry,
  VisionModelId,
} from "../../../types/vision";

interface InspectorPanelProps {
  activeTab: InspectorTab;
  onChangeTab: (tab: InspectorTab) => void;
  visionModel: VisionModelId;
  onChangeVisionModel: (model: VisionModelId) => void;
  boxes: DetectionBox[];
  selectedBoxId: string | null;
  onSelectBox: (id: string | null) => void;
  latestSummary: string;
  latestLatencyMs: number | null;
  qaHistory: FrameQaEntry[];
  transcripts: LiveTranscriptEntry[];
  liveConnected: boolean;
  focusPrompt: string;
  onChangeFocusPrompt: (val: string) => void;
  minConfidence: number;
  onChangeMinConfidence: (val: number) => void;
  intervalMs: number;
  onChangeIntervalMs: (val: number) => void;
  cameras: MediaDeviceInfo[];
  selectedCameraId: string;
  onSelectCamera: (id: string) => void;
  onExportJson: () => void;
  onClearHistory: () => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  activeTab,
  onChangeTab,
  visionModel,
  onChangeVisionModel,
  boxes,
  selectedBoxId,
  onSelectBox,
  latestSummary,
  latestLatencyMs,
  qaHistory,
  transcripts,
  liveConnected,
  focusPrompt,
  onChangeFocusPrompt,
  minConfidence,
  onChangeMinConfidence,
  intervalMs,
  onChangeIntervalMs,
  cameras,
  selectedCameraId,
  onSelectCamera,
  onExportJson,
  onClearHistory,
}) => {
  return (
    <aside className="w-full lg:w-[390px] xl:w-[410px] shrink-0 flex flex-col bg-surface border border-slate-800 rounded-lg overflow-hidden max-h-[calc(100vh-7.5rem)]">
      {/* Segmented Inspector Tabs */}
      <div className="flex items-center gap-1 p-1.5 border-b border-slate-800 bg-surface">
        <button
          type="button"
          onClick={() => onChangeTab("detections")}
          aria-pressed={activeTab === "detections"}
          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === "detections"
              ? "bg-elevated text-accent-400 border border-slate-700"
              : "text-slate-400 hover:text-slate-200 border border-transparent"
          }`}
        >
          Objects ({boxes.length})
        </button>
        <button
          type="button"
          onClick={() => onChangeTab("transcript")}
          aria-pressed={activeTab === "transcript"}
          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === "transcript"
              ? "bg-elevated text-accent-400 border border-slate-700"
              : "text-slate-400 hover:text-slate-200 border border-transparent"
          }`}
        >
          Conversation
        </button>
        <button
          type="button"
          onClick={() => onChangeTab("settings")}
          aria-pressed={activeTab === "settings"}
          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === "settings"
              ? "bg-elevated text-accent-400 border border-slate-700"
              : "text-slate-400 hover:text-slate-200 border border-transparent"
          }`}
        >
          Settings
        </button>
      </div>

      {/* Panel Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === "detections" && (
          <>
            {/* Summary Block */}
            <div className="pb-3 border-b border-slate-800/80">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                <span className="font-medium text-slate-300">
                  What’s in view
                </span>
                <span className="font-mono tabular-nums">
                  {latestLatencyMs !== null ? `${latestLatencyMs} ms` : "Ready"}
                </span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                {latestSummary ||
                  "Add a photo or start your camera to discover objects and their stories."}
              </p>
            </div>

            {/* Objects List */}
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="font-medium text-slate-300">
                  Objects
                </span>
                <span className="font-mono tabular-nums">
                  Min {Math.round(minConfidence * 100)}%
                </span>
              </div>

              {boxes.length === 0 ? (
                <div className="py-8 px-4 text-center border border-dashed border-slate-800 rounded-md">
                  <p className="text-xs text-slate-400">
                    No objects detected in the current frame yet.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-md overflow-hidden">
                  {boxes.map((box) => {
                    const isSelected = selectedBoxId === box.id;
                    return (
                      <button
                        key={box.id}
                        type="button"
                        onClick={() => onSelectBox(isSelected ? null : box.id)}
                        className={`w-full text-left px-3 py-2.5 transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-accent-500/10"
                            : "bg-surface hover:bg-elevated"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2.5 h-2.5 shrink-0 rounded-xs"
                              style={{ backgroundColor: box.color }}
                            />
                            <span className="text-sm font-medium text-slate-100 truncate">
                              {box.label}
                            </span>
                          </div>
                          <span className="text-xs font-mono tabular-nums text-accent-400 shrink-0">
                            {Math.round(box.confidence * 100)}%
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                          <span className="truncate">
                            {box.detail || "Localized in frame"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Frame Q&A Answers */}
            {qaHistory.length > 0 && (
              <div className="pt-2 border-t border-slate-800/80">
                <h3 className="text-xs font-medium text-slate-300 mb-2">
                  Your questions
                </h3>
                <div className="space-y-2.5">
                  {qaHistory.map((qa) => (
                    <div
                      key={qa.id}
                      className="p-3 bg-surface border border-slate-800 rounded-md space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                        <span className="font-medium text-accent-400 truncate">
                          {qa.question}
                        </span>
                        <span className="font-mono tabular-nums shrink-0">
                          {qa.latencyMs} ms
                        </span>
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed">
                        {qa.answer}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === "transcript" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800/80">
              <span>
                {liveConnected
                  ? "Conversation active"
                  : "Conversation not started"}
              </span>
              <span className="font-mono tabular-nums">gemini-3.8-live</span>
            </div>

            {transcripts.length === 0 ? (
              <div className="py-10 px-4 text-center border border-dashed border-slate-800 rounded-md space-y-2">
                <p className="text-sm font-medium text-slate-200">
                  No live conversation yet
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Choose Start conversation below the image to talk about what you see.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {transcripts.map((entry) => (
                  <div
                    key={entry.id}
                    className={`p-3 rounded-md border text-xs leading-relaxed ${
                      entry.speaker === "user"
                        ? "bg-elevated border-slate-700 text-slate-100"
                        : entry.speaker === "gemini"
                          ? "bg-[#0D1522] border-accent-900/60 text-slate-100"
                          : "bg-surface border-slate-800 text-slate-400"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1 text-[11px] text-slate-400">
                      <span className="font-medium text-slate-300">
                        {entry.speaker === "user"
                          ? "You"
                          : entry.speaker === "gemini"
                            ? "Gemini Live"
                            : "Session"}
                      </span>
                      <span className="font-mono tabular-nums">
                        {new Date(entry.timestamp).toLocaleTimeString([], {
                          hour12: false,
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                    </div>
                    <p>{entry.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "settings" && (
          <div className="space-y-5">
            <div>
              <label
                htmlFor="vision-model-select"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Gemini 4 Vision Model
              </label>
              <select
                id="vision-model-select"
                value={visionModel}
                onChange={(e) =>
                  onChangeVisionModel(e.target.value as VisionModelId)
                }
                className="w-full px-3 py-2 text-xs font-mono bg-elevated text-slate-100 border border-slate-700 rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-500"
              >
                <option value="gemini-4-hydrogen">
                  gemini-4-hydrogen (Fast Flash)
                </option>
                <option value="gemini-4-neon">
                  gemini-4-neon (Gemini 4 Pro)
                </option>
              </select>
            </div>

            {cameras.length > 0 && (
              <div>
                <label
                  htmlFor="camera-device-select"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Camera Device
                </label>
                <select
                  id="camera-device-select"
                  value={selectedCameraId}
                  onChange={(e) => onSelectCamera(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-elevated text-slate-100 border border-slate-700 rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-500"
                >
                  {cameras.map((cam, idx) => (
                    <option key={cam.deviceId || idx} value={cam.deviceId}>
                      {cam.label || `Camera ${idx + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label
                htmlFor="cadence-select"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Auto-Detection Cadence
              </label>
              <select
                id="cadence-select"
                value={intervalMs}
                onChange={(e) => onChangeIntervalMs(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-elevated text-slate-100 border border-slate-700 rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-500"
              >
                <option value={1000}>Every 1.0 second</option>
                <option value={2000}>Every 2.0 seconds</option>
                <option value={4000}>Every 4.0 seconds</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <label
                  htmlFor="confidence-slider"
                  className="font-medium text-slate-300"
                >
                  Confidence Threshold
                </label>
                <span className="font-mono tabular-nums text-accent-400">
                  {Math.round(minConfidence * 100)}%
                </span>
              </div>
              <input
                id="confidence-slider"
                type="range"
                min={0}
                max={90}
                step={5}
                value={Math.round(minConfidence * 100)}
                onChange={(e) =>
                  onChangeMinConfidence(Number(e.target.value) / 100)
                }
                className="w-full accent-accent-500 cursor-pointer"
              />
            </div>

            <div>
              <label
                htmlFor="focus-prompt-input"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Optional Detection Focus
              </label>
              <input
                id="focus-prompt-input"
                type="text"
                value={focusPrompt}
                onChange={(e) => onChangeFocusPrompt(e.target.value)}
                placeholder="Leave blank to detect all visible objects"
                className="w-full px-3 py-2 text-xs bg-elevated text-slate-100 placeholder:text-slate-500 border border-slate-700 rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-500"
              />
              <p className="mt-1.5 text-[11px] text-slate-400">
                Optional instruction sent with each frame (e.g., &ldquo;cups and
                keyboards&rdquo;). Not required for general detection.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center gap-2">
              <button
                type="button"
                onClick={onExportJson}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-elevated hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Export JSON
              </button>
              <button
                type="button"
                onClick={onClearHistory}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-elevated hover:bg-rose-950/50 text-rose-300 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Session
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

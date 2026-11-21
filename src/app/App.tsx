import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CameraStage } from "../features/vision/components/CameraStage";
import { CompareModesView } from "../features/vision/components/CompareModesView";
import { DetectionLogView } from "../features/vision/components/DetectionLogView";
import { GenieWorldView } from "../features/world/components/GenieWorldView";
import { InspectorPanel } from "../features/vision/components/InspectorPanel";
import { getVisualFilterPreset } from "../features/vision/components/VisualFilterSelector";
import {
  DetectionBox,
  DetectionFrameResult,
  FrameQaEntry,
  HistoricalPersonaId,
  InspectorTab,
  VisionModelId,
  VisualFilterId,
  WorkspaceView,
} from "../types/vision";
import { useLiveSession } from "../features/live/useLiveSession";
import { useMediaSource } from "../features/vision/useMediaSource";
import { RuntimeStatus } from "./RuntimeStatus";
import {
  captureMediaFrame,
  downloadAnnotatedSnapshot,
  getColorForLabel,
} from "../utils/canvas";

interface RawBoxInput {
  label?: string;
  confidence?: number;
  ymin?: number;
  xmin?: number;
  ymax?: number;
  xmax?: number;
  detail?: string;
}

async function parseJsonSafe(res: Response): Promise<Record<string, unknown>> {
  const raw = await res.text();
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(
      `Server returned a non-JSON response (HTTP ${res.status}). If the server was restarting, please retry.`
    );
  }
}

export default function App() {
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("live");
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("detections");
  const [visionModel, setVisionModel] =
    useState<VisionModelId>("gemini-4-hydrogen");
  const [characterPersona, setCharacterPersona] =
    useState<HistoricalPersonaId>("roman-senator");
  const [visualFilter, setVisualFilter] = useState<VisualFilterId>("none");
  const [filterIntensity, setFilterIntensity] = useState<number>(100);

  // Detection state
  const [autoDetect, setAutoDetect] = useState(false);
  const [intervalMs, setIntervalMs] = useState(2000);
  const [isDetecting, setIsDetecting] = useState(false);
  const [minConfidence, setMinConfidence] = useState(0.35);
  const [focusPrompt, setFocusPrompt] = useState("");
  const [currentBoxes, setCurrentBoxes] = useState<DetectionBox[]>([]);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [latestSummary, setLatestSummary] = useState("");
  const [latestLatencyMs, setLatestLatencyMs] = useState<number | null>(null);
  const [history, setHistory] = useState<DetectionFrameResult[]>([]);

  // Q&A + Live Voice state
  const [promptText, setPromptText] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [qaHistory, setQaHistory] = useState<FrameQaEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isDetectingRef = useRef(false);
  const focusPromptRef = useRef(focusPrompt);
  const visionModelRef = useRef(visionModel);
  const workspaceViewRef = useRef(workspaceView);
  const characterPersonaRef = useRef(characterPersona);
  focusPromptRef.current = focusPrompt;
  visionModelRef.current = visionModel;
  workspaceViewRef.current = workspaceView;
  characterPersonaRef.current = characterPersona;
  const {
    sourceMode, mediaActive, uploadedImageUrl, uploadedVideoUrl, cameras,
    selectedCameraId, setSelectedCameraId, videoRef, imageRef,
    startCamera, startScreenShare, upload, stop: stopMedia, getActiveMediaElement,
  } = useMediaSource({
    onError: setErrorMessage,
    onStarted: () => setAutoDetect(true),
    onStopped: () => setAutoDetect(false),
    onImageReady: () => { void analyzeCurrentFrame(); },
  });

  const mapRawObjectsToBoxes = useCallback(
    (rawObjects: RawBoxInput[]): DetectionBox[] => {
      return rawObjects.map((obj, idx) => {
        const label = String(obj.label ?? "Object").trim() || "Object";
        const ymin = Math.max(0, Math.min(1000, Math.round(Number(obj.ymin ?? 0))));
        const xmin = Math.max(0, Math.min(1000, Math.round(Number(obj.xmin ?? 0))));
        const ymax = Math.max(0, Math.min(1000, Math.round(Number(obj.ymax ?? 0))));
        const xmax = Math.max(0, Math.min(1000, Math.round(Number(obj.xmax ?? 0))));
        return {
          id: `${Date.now()}-${idx}-${label}`,
          label,
          confidence:
            typeof obj.confidence === "number" && Number.isFinite(obj.confidence)
              ? obj.confidence
              : 0.9,
          ymin: Math.min(ymin, ymax),
          xmin: Math.min(xmin, xmax),
          ymax: Math.max(ymin, ymax),
          xmax: Math.max(xmin, xmax),
          detail: obj.detail ? String(obj.detail) : undefined,
          color: getColorForLabel(label, idx),
        };
      });
    },
    []
  );

  const analyzeCurrentFrame = useCallback(async () => {
    if (isDetectingRef.current) return;
    const el = getActiveMediaElement();
    if (!el) return;

    const frame = captureMediaFrame(el, 896, 0.8);
    if (!frame) return;

    isDetectingRef.current = true;
    setIsDetecting(true);

    const activePersona =
      workspaceViewRef.current === "character"
        ? characterPersonaRef.current
        : undefined;

    try {
      const res = await fetch("/api/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: frame.base64,
          mimeType: "image/jpeg",
          focusPrompt: focusPromptRef.current || undefined,
          model: visionModelRef.current,
          characterPersona: activePersona,
        }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Detection request failed."
        );
      }

      const mappedBoxes = mapRawObjectsToBoxes(
        Array.isArray(data.objects) ? (data.objects as RawBoxInput[]) : []
      );
      const result: DetectionFrameResult = {
        frameId: `det-${Date.now()}`,
        timestamp: Date.now(),
        latencyMs: Number(data.latencyMs ?? 0),
        model: String(data.model ?? visionModelRef.current),
        summary: String(data.summary ?? ""),
        objects: mappedBoxes,
        source: "detect",
      };

      setCurrentBoxes(mappedBoxes);
      setLatestSummary(result.summary);
      setLatestLatencyMs(result.latencyMs);
      setHistory((prev) => [result, ...prev].slice(0, 100));
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to analyze frame.";
      setErrorMessage(msg);
      if (msg.toLowerCase().includes("api key") || msg.includes("403")) {
        setAutoDetect(false);
      }
    } finally {
      isDetectingRef.current = false;
      setIsDetecting(false);
    }
  }, [getActiveMediaElement, mapRawObjectsToBoxes]);

  const handleUploadFile = useCallback((file: File) => {
    setCurrentBoxes([]);
    setSelectedBoxId(null);
    upload(file);
  }, [upload]);

  const handleStopMedia = useCallback(() => {
    stopMedia();
    setCurrentBoxes([]);
    setSelectedBoxId(null);
    setLatestSummary("");
  }, [stopMedia]);

  // Auto-detection polling loop (pauses when viewing Genie 4 / Log / Compare)
  useEffect(() => {
    if (!autoDetect) return;
    if (workspaceView !== "live" && workspaceView !== "character") return;

    const initialTimer = window.setTimeout(() => {
      void analyzeCurrentFrame();
    }, 350);

    const timer = window.setInterval(() => {
      void analyzeCurrentFrame();
    }, intervalMs);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [autoDetect, intervalMs, workspaceView, analyzeCurrentFrame]);

  // Re-run detection immediately when switching between Live Vision and Character Mirror or changing persona
  useEffect(() => {
    if (workspaceView === "character" && (mediaActive || uploadedImageUrl)) {
      const timer = window.setTimeout(() => {
        void analyzeCurrentFrame();
      }, 150);
      return () => window.clearTimeout(timer);
    }
  }, [workspaceView, characterPersona, mediaActive, uploadedImageUrl, analyzeCurrentFrame]);

  const {
    connected: liveConnected, connecting: liveConnecting, micMuted, setMicMuted,
    transcripts, setTranscripts, start: startLiveSession, stop: stopLiveSession, sendText,
  } = useLiveSession({
    getFrameElement: getActiveMediaElement,
    onError: setErrorMessage,
    onMessage: (message) => {
      if (message.type !== "highlightObjects") return;
      const mapped = mapRawObjectsToBoxes(message.args.objects ?? []);
      const summary = message.args.summary || `Gemini Live highlighted ${mapped.length} objects.`;
      setCurrentBoxes(mapped);
      setLatestSummary(summary);
      setHistory((previous) => [{ frameId: `live-${Date.now()}`, timestamp: Date.now(), latencyMs: 0,
        model: "gemini-3.8-live", summary, objects: mapped, source: "live-tool" as const }, ...previous].slice(0, 100));
    },
  });

  // Only one microphone session should own input while moving between workspaces.
  useEffect(() => { if (workspaceView === "genie") stopLiveSession(); }, [workspaceView, stopLiveSession]);

  const handleToggleLiveVoice = useCallback(() => {
    if (liveConnected || liveConnecting) stopLiveSession();
    else { setInspectorTab("transcript"); void startLiveSession(); }
  }, [liveConnected, liveConnecting, startLiveSession, stopLiveSession]);

  const handleSubmitPrompt = useCallback(async () => {
    const question = promptText.trim();
    if (!question) return;

    if (liveConnected && sendText(question)) {
      setPromptText("");
      setInspectorTab("transcript");
      return;
    }

    const el = getActiveMediaElement();
    if (!el) return;
    const frame = captureMediaFrame(el, 896, 0.82);
    if (!frame) return;

    setIsAsking(true);
    setErrorMessage(null);
    const activePersona =
      workspaceViewRef.current === "character"
        ? characterPersonaRef.current
        : undefined;

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: frame.base64,
          mimeType: "image/jpeg",
          question,
          model: visionModelRef.current,
          characterPersona: activePersona,
        }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Failed to ask Gemini about frame."
        );
      }

      setQaHistory((prev) =>
        [
          {
            id: `qa-${Date.now()}`,
            question,
            answer: String(data.answer ?? ""),
            latencyMs: Number(data.latencyMs ?? 0),
            timestamp: Date.now(),
            model: String(data.model ?? visionModelRef.current),
          },
          ...prev,
        ].slice(0, 30)
      );
      setPromptText("");
      setInspectorTab("detections");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to ask frame question."
      );
    } finally {
      setIsAsking(false);
    }
  }, [sendText, getActiveMediaElement, liveConnected, promptText]);

  const visibleBoxes = useMemo(
    () => currentBoxes.filter((b) => b.confidence >= minConfidence),
    [currentBoxes, minConfidence]
  );

  const handleSaveSnapshot = useCallback(() => {
    const el = getActiveMediaElement();
    if (!el) return;
    const preset = getVisualFilterPreset(visualFilter);
    downloadAnnotatedSnapshot(el, visibleBoxes, {
      filterCss: preset.getCssFilter(filterIntensity),
      overlayTint: preset.getSnapshotTint(filterIntensity),
    });
  }, [filterIntensity, getActiveMediaElement, visibleBoxes, visualFilter]);

  const handleExportJson = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      detectionHistory: history,
      qaHistory,
      liveTranscripts: transcripts,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gemini-vision-session-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [history, qaHistory, transcripts]);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    setQaHistory([]);
    setTranscripts([]);
    setCurrentBoxes([]);
    setSelectedBoxId(null);
    setLatestSummary("");
    setLatestLatencyMs(null);
  }, []);

  const isCameraStageView = workspaceView === "live" || workspaceView === "character";

  return (
    <div className="min-h-screen flex flex-col bg-[#07090E] text-slate-100">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 border-b border-slate-800 bg-[#090D16] overflow-x-auto">
        {/* Zone 1: Single-line brand wordmark */}
        <a
          href="#live"
          onClick={(e) => {
            e.preventDefault();
            setWorkspaceView("live");
          }}
          className="text-base font-semibold tracking-tight text-slate-100 whitespace-nowrap shrink-0"
        >
          Gemini Live Vision
        </a>

        {/* Zone 2: 5 clean single-line navigation links */}
        <nav
          aria-label="Workspace Views"
          className="flex items-center gap-6 text-sm font-medium"
        >
          <a href="/" className="text-emerald-300 hover:text-emerald-200 whitespace-nowrap">← FaceTime</a>
          <a href="/museum" className="text-cyan-300 whitespace-nowrap">Museum AR</a>
          {(
            [
              { id: "live", label: "Live Vision" },
              { id: "character", label: "Character Mirror" },
              { id: "genie", label: "Genie 4 World" },
              { id: "log", label: "Detection Log" },
              { id: "compare", label: "Compare Modes" },
            ] as const
          ).map((nav) => (
            <button
              key={nav.id}
              type="button"
              onClick={() => setWorkspaceView(nav.id)}
              className={`pb-0.5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                workspaceView === nav.id
                  ? "border-cyan-400 text-slate-100"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {nav.label}
            </button>
          ))}
        </nav>

        {/* Zone 3: Single primary action CTA */}
        <div className="shrink-0">
          {!mediaActive && !uploadedVideoUrl ? (
            <button
              type="button"
              onClick={() => {
                if (!isCameraStageView) setWorkspaceView("live");
                void startCamera();
              }}
              className="px-4 py-2 text-xs font-medium bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Start Camera
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStopMedia}
              className="px-4 py-2 text-xs font-medium bg-[#111827] hover:bg-slate-800 text-slate-100 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Stop Camera
            </button>
          )}
        </div>
      </header>

      <RuntimeStatus />

      {/* Main Content */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-6 py-5">
        {/* Keep the capture elements mounted so World can reuse the active feed. */}
        <section className={isCameraStageView ? "" : "hidden"} aria-hidden={!isCameraStageView}>
          <div className="flex flex-col lg:flex-row items-stretch gap-5">
            <CameraStage
              sourceMode={sourceMode}
              mediaActive={mediaActive}
              uploadedImageUrl={uploadedImageUrl}
              uploadedVideoUrl={uploadedVideoUrl}
              videoRef={videoRef}
              imageRef={imageRef}
              cameras={cameras}
              selectedCameraId={selectedCameraId}
              onSelectCamera={(id) => {
                setSelectedCameraId(id);
                if (mediaActive && sourceMode === "camera") {
                  void startCamera(id);
                }
              }}
              onStartCamera={startCamera}
              onStartScreen={startScreenShare}
              onUploadFile={handleUploadFile}
              onStopMedia={handleStopMedia}
              visionModel={visionModel}
              onChangeVisionModel={setVisionModel}
              characterMode={workspaceView === "character"}
              characterPersona={characterPersona}
              onChangeCharacterPersona={setCharacterPersona}
              autoDetect={autoDetect}
              onToggleAutoDetect={() => setAutoDetect((v) => !v)}
              intervalMs={intervalMs}
              onChangeInterval={setIntervalMs}
              isDetecting={isDetecting}
              onAnalyzeOnce={() => void analyzeCurrentFrame()}
              liveConnected={liveConnected}
              liveConnecting={liveConnecting}
              micMuted={micMuted}
              onToggleLiveVoice={handleToggleLiveVoice}
              onToggleMicMute={() => setMicMuted((m) => !m)}
              onSaveSnapshot={handleSaveSnapshot}
              boxes={visibleBoxes}
              selectedBoxId={selectedBoxId}
              onSelectBox={setSelectedBoxId}
              latestSummary={latestSummary}
              latestLatencyMs={latestLatencyMs}
              promptText={promptText}
              onChangePromptText={setPromptText}
              onSubmitPrompt={() => void handleSubmitPrompt()}
              isAsking={isAsking}
              errorMessage={errorMessage}
              onDismissError={() => setErrorMessage(null)}
              visualFilter={visualFilter}
              onChangeVisualFilter={setVisualFilter}
              filterIntensity={filterIntensity}
              onChangeFilterIntensity={setFilterIntensity}
            />

            <InspectorPanel
              activeTab={inspectorTab}
              onChangeTab={setInspectorTab}
              visionModel={visionModel}
              onChangeVisionModel={setVisionModel}
              boxes={visibleBoxes}
              selectedBoxId={selectedBoxId}
              onSelectBox={setSelectedBoxId}
              latestSummary={latestSummary}
              latestLatencyMs={latestLatencyMs}
              qaHistory={qaHistory}
              transcripts={transcripts}
              liveConnected={liveConnected}
              focusPrompt={focusPrompt}
              onChangeFocusPrompt={setFocusPrompt}
              minConfidence={minConfidence}
              onChangeMinConfidence={setMinConfidence}
              intervalMs={intervalMs}
              onChangeIntervalMs={setIntervalMs}
              cameras={cameras}
              selectedCameraId={selectedCameraId}
              onSelectCamera={(id) => {
                setSelectedCameraId(id);
                if (mediaActive && sourceMode === "camera") {
                  void startCamera(id);
                }
              }}
              onExportJson={handleExportJson}
              onClearHistory={handleClearHistory}
            />
          </div>
        </section>

        {workspaceView === "genie" && (
          <GenieWorldView
            getCameraElement={getActiveMediaElement}
            hasActiveCamera={
              mediaActive || Boolean(uploadedImageUrl) || Boolean(uploadedVideoUrl)
            }
            onBackToCamera={() => setWorkspaceView("character")}
          />
        )}

        {workspaceView === "log" && (
          <DetectionLogView
            history={history}
            onExportJson={handleExportJson}
            onClearHistory={handleClearHistory}
            onBackToLive={() => setWorkspaceView("live")}
          />
        )}

        {workspaceView === "compare" && (
          <CompareModesView
            history={history}
            qaHistory={qaHistory}
            transcripts={transcripts}
            onSelectLiveVision={() => setWorkspaceView("live")}
          />
        )}
      </main>
    </div>
  );
}

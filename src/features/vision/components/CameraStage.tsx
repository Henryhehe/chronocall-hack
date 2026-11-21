import React, { useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  Download,
  Eye,
  EyeOff,
  ImagePlus,
  Mic,
  MicOff,
  Monitor,
  Pause,
  Play,
  Scan,
  Send,
  SwitchCamera,
} from "lucide-react";
import {
  DetectionBox,
  HistoricalPersonaId,
  SourceMode,
  VisionModelId,
  VisualFilterId,
} from "../../../types/vision";
import { computeContainedRect, ContainedRect } from "../../../utils/canvas";
import { HISTORICAL_PERSONAS, HistoricalOverlay } from "../../character/components/HistoricalOverlay";
import {
  CameraFilterSvgDefs,
  getVisualFilterPreset,
  VisualFilterSelector,
} from "./VisualFilterSelector";

interface CameraStageProps {
  sourceMode: SourceMode;
  mediaActive: boolean;
  uploadedImageUrl: string | null;
  uploadedVideoUrl: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  imageRef: React.RefObject<HTMLImageElement | null>;
  cameras: MediaDeviceInfo[];
  selectedCameraId: string;
  onSelectCamera: (deviceId: string) => void;
  onStartCamera: (deviceId?: string) => void;
  onStartScreen: () => void;
  onUploadFile: (file: File) => void;
  onStopMedia: () => void;
  visionModel: VisionModelId;
  onChangeVisionModel: (model: VisionModelId) => void;
  characterMode: boolean;
  characterPersona: HistoricalPersonaId;
  onChangeCharacterPersona: (id: HistoricalPersonaId) => void;
  autoDetect: boolean;
  onToggleAutoDetect: () => void;
  intervalMs: number;
  onChangeInterval: (ms: number) => void;
  isDetecting: boolean;
  onAnalyzeOnce: () => void;
  liveConnected: boolean;
  liveConnecting: boolean;
  micMuted: boolean;
  onToggleLiveVoice: () => void;
  onToggleMicMute: () => void;
  onSaveSnapshot: () => void;
  boxes: DetectionBox[];
  selectedBoxId: string | null;
  onSelectBox: (id: string | null) => void;
  latestSummary: string;
  latestLatencyMs: number | null;
  promptText: string;
  onChangePromptText: (text: string) => void;
  onSubmitPrompt: () => void;
  isAsking: boolean;
  errorMessage: string | null;
  onDismissError: () => void;
  visualFilter: VisualFilterId;
  onChangeVisualFilter: (id: VisualFilterId) => void;
  filterIntensity: number;
  onChangeFilterIntensity: (value: number) => void;
}

export const CameraStage: React.FC<CameraStageProps> = ({
  sourceMode,
  mediaActive,
  uploadedImageUrl,
  uploadedVideoUrl,
  videoRef,
  imageRef,
  cameras,
  selectedCameraId,
  onSelectCamera,
  onStartCamera,
  onStartScreen,
  onUploadFile,
  onStopMedia,
  visionModel,
  onChangeVisionModel,
  characterMode,
  characterPersona,
  onChangeCharacterPersona,
  autoDetect,
  onToggleAutoDetect,
  intervalMs,
  onChangeInterval,
  isDetecting,
  onAnalyzeOnce,
  liveConnected,
  liveConnecting,
  micMuted,
  onToggleLiveVoice,
  onToggleMicMute,
  onSaveSnapshot,
  boxes,
  selectedBoxId,
  onSelectBox,
  latestSummary,
  latestLatencyMs,
  promptText,
  onChangePromptText,
  onSubmitPrompt,
  isAsking,
  errorMessage,
  onDismissError,
  visualFilter,
  onChangeVisualFilter,
  filterIntensity,
  onChangeFilterIntensity,
}) => {
  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [mediaSize, setMediaSize] = useState({ width: 1280, height: 720 });
  const [showBoxesInCharacter, setShowBoxesInCharacter] = useState(false);

  useEffect(() => {
    const el = stageContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setStageSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const overlayRect: ContainedRect = computeContainedRect(
    stageSize.width,
    stageSize.height,
    mediaSize.width,
    mediaSize.height
  );

  const hasVisualSource =
    mediaActive || Boolean(uploadedImageUrl) || Boolean(uploadedVideoUrl);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadFile(file);
    }
    e.target.value = "";
  };

  const handleCycleCamera = () => {
    if (cameras.length < 2) return;
    const idx = cameras.findIndex((c) => c.deviceId === selectedCameraId);
    const next = cameras[(idx + 1) % cameras.length];
    if (next) {
      onSelectCamera(next.deviceId);
    }
  };

  const activePersona = HISTORICAL_PERSONAS.find(
    (p) => p.id === characterPersona
  );

  const activeFilterPreset = getVisualFilterPreset(visualFilter);
  const activeCssFilter = activeFilterPreset.getCssFilter(filterIntensity);
  const activeOverlayStyle =
    activeFilterPreset.getOverlayStyle(filterIntensity);

  const shouldRenderBoxes = !characterMode || showBoxesInCharacter;

  return (
    <div className="flex flex-col flex-1 min-w-0 gap-3">
      {errorMessage && (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 px-4 py-2.5 bg-[#1F1215] border border-rose-900/70 rounded-lg text-sm text-rose-200"
        >
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={onDismissError}
            className="text-xs font-medium text-rose-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Historical Character Persona Selector Strip */}
      {characterMode && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[#0B0F17] border border-slate-800 rounded-lg">
          <div className="flex flex-wrap items-center gap-1.5">
            {HISTORICAL_PERSONAS.map((p) => {
              const active = characterPersona === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onChangeCharacterPersona(p.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? "bg-cyan-500/15 border-cyan-500/60 text-cyan-300"
                      : "bg-[#0D121C] border-slate-800 text-slate-300 hover:bg-[#111827]"
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setShowBoxesInCharacter((v) => !v)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-[#111827] hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {showBoxesInCharacter ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
            {showBoxesInCharacter ? "Hide Boxes" : "Show Boxes"}
          </button>
        </div>
      )}

      {/* Main Viewport Stage */}
      <div className="relative flex flex-col bg-[#0B0F17] border border-slate-800 rounded-lg overflow-hidden">
        {/* Top instrument telemetry bar */}
        <div className="flex items-center justify-between gap-4 px-4 py-2.5 border-b border-slate-800 bg-[#0D121C] text-xs text-slate-400">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex items-center gap-2 font-medium text-slate-200 whitespace-nowrap shrink-0">
              {mediaActive || liveConnected ? (
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-slate-600 shrink-0" />
              )}
              {liveConnected
                ? "Live Voice & Video Active"
                : mediaActive
                  ? sourceMode === "screen"
                    ? "Screen Feed Active"
                    : uploadedVideoUrl
                      ? "Video Clip Active"
                      : "Camera Feed Active"
                  : uploadedImageUrl
                    ? "Image Loaded"
                    : "Camera Standby"}
            </span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span className="font-mono text-slate-300 truncate">
              {visionModel}
            </span>
            {characterMode && activePersona && (
              <>
                <span aria-hidden="true" className="text-slate-600">
                  ·
                </span>
                <span className="text-cyan-400 truncate">
                  {activePersona.name}
                </span>
              </>
            )}
            {visualFilter !== "none" && (
              <>
                <span aria-hidden="true" className="text-slate-600">
                  ·
                </span>
                <span className="text-cyan-300 whitespace-nowrap shrink-0">
                  {activeFilterPreset.label}
                </span>
              </>
            )}
            {latestLatencyMs !== null && (
              <>
                <span aria-hidden="true" className="text-slate-600">
                  ·
                </span>
                <span className="font-mono tabular-nums text-cyan-400 whitespace-nowrap shrink-0">
                  {latestLatencyMs} ms
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0 font-mono tabular-nums">
            <span>
              {boxes.length} {boxes.length === 1 ? "object" : "objects"}
            </span>
            {isDetecting && (
              <>
                <span aria-hidden="true" className="text-slate-600">
                  ·
                </span>
                <span className="text-cyan-400">Analyzing</span>
              </>
            )}
          </div>
        </div>

        {/* Media + Bounding Box Container */}
        <div
          ref={stageContainerRef}
          onClick={() => onSelectBox(null)}
          className="relative w-full aspect-video max-h-[62vh] bg-[#07090E] flex items-center justify-center overflow-hidden select-none"
        >
          <CameraFilterSvgDefs />
          {!hasVisualSource && (
            <div className="flex flex-col items-center justify-center text-center px-6 py-10 max-w-md">
              <div className="w-12 h-12 rounded-lg bg-[#111827] border border-slate-800 flex items-center justify-center mb-4 text-cyan-400">
                <Camera className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-semibold text-slate-100 mb-1.5">
                {characterMode
                  ? "Step into the Historical Mirror"
                  : "Start your camera for real-time vision"}
              </h2>
              <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                {characterMode
                  ? "Start your webcam and Gemini 4 will track your face and shoulders to fit historical attire while commenting in character."
                  : "Stream live frames for Gemini 4 bounding-box object detection, or enable interactive voice conversation over your video feed."}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartCamera();
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  Start Camera
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartScreen();
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#111827] hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Monitor className="w-4 h-4" />
                  Share Screen
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#111827] hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ImagePlus className="w-4 h-4" />
                  Upload Media
                </button>
              </div>
            </div>
          )}

          {/* Live Video Element */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            loop={Boolean(uploadedVideoUrl)}
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              if (v.videoWidth && v.videoHeight) {
                setMediaSize({ width: v.videoWidth, height: v.videoHeight });
              }
            }}
            style={{
              filter: activeCssFilter !== "none" ? activeCssFilter : undefined,
            }}
            className={`w-full h-full object-contain ${
              mediaActive || uploadedVideoUrl ? "block" : "hidden"
            }`}
          />

          {/* Uploaded Still Image */}
          {uploadedImageUrl && !mediaActive && !uploadedVideoUrl && (
            <img
              ref={imageRef}
              src={uploadedImageUrl}
              alt="Uploaded frame for Gemini object detection"
              referrerPolicy="no-referrer"
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth && img.naturalHeight) {
                  setMediaSize({
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                  });
                }
              }}
              style={{
                filter:
                  activeCssFilter !== "none" ? activeCssFilter : undefined,
              }}
              className="w-full h-full object-contain block"
            />
          )}

          {/* Synchronized Overlay (CSS Filter Overlay + Costume + Bounding Boxes) */}
          {hasVisualSource && overlayRect.width > 0 && (
            <div
              className="absolute pointer-events-none"
              style={{
                left: `${overlayRect.left}px`,
                top: `${overlayRect.top}px`,
                width: `${overlayRect.width}px`,
                height: `${overlayRect.height}px`,
              }}
            >
              {activeOverlayStyle && (
                <div
                  aria-hidden="true"
                  className="absolute inset-0 pointer-events-none"
                  style={activeOverlayStyle}
                />
              )}

              {characterMode && (
                <HistoricalOverlay
                  personaId={characterPersona}
                  boxes={boxes}
                />
              )}

              {shouldRenderBoxes &&
                boxes.map((box) => {
                  const topPct = (box.ymin / 1000) * 100;
                  const leftPct = (box.xmin / 1000) * 100;
                  const widthPct = Math.max(
                    1,
                    ((box.xmax - box.xmin) / 1000) * 100
                  );
                  const heightPct = Math.max(
                    1,
                    ((box.ymax - box.ymin) / 1000) * 100
                  );
                  const isSelected = selectedBoxId === box.id;
                  const placeLabelBelow = topPct < 7;

                  return (
                    <button
                      key={box.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectBox(isSelected ? null : box.id);
                      }}
                      aria-label={`${box.label} ${Math.round(box.confidence * 100)}%`}
                      className="bbox-enter absolute pointer-events-auto cursor-pointer focus-visible:outline-none"
                      style={{
                        top: `${topPct}%`,
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        height: `${heightPct}%`,
                        border: `1.5px solid ${box.color}`,
                        backgroundColor: isSelected
                          ? `${box.color}26`
                          : `${box.color}0D`,
                        boxShadow: isSelected
                          ? `0 0 0 1px ${box.color}`
                          : undefined,
                      }}
                    >
                      <span
                        className="absolute -top-0.5 -left-0.5 w-2 h-2 border-t-2 border-l-2"
                        style={{ borderColor: box.color }}
                      />
                      <span
                        className="absolute -top-0.5 -right-0.5 w-2 h-2 border-t-2 border-r-2"
                        style={{ borderColor: box.color }}
                      />
                      <span
                        className="absolute -bottom-0.5 -left-0.5 w-2 h-2 border-b-2 border-l-2"
                        style={{ borderColor: box.color }}
                      />
                      <span
                        className="absolute -bottom-0.5 -right-0.5 w-2 h-2 border-b-2 border-r-2"
                        style={{ borderColor: box.color }}
                      />

                      <span
                        className={`absolute left-0 flex items-center gap-1.5 px-1.5 py-0.5 text-[11px] font-mono tabular-nums font-medium text-slate-50 bg-[#07090E]/90 border border-slate-700/80 whitespace-nowrap ${
                          placeLabelBelow ? "top-1" : "-top-6"
                        }`}
                      >
                        <span
                          className="w-1.5 h-1.5 shrink-0"
                          style={{ backgroundColor: box.color }}
                        />
                        <span>{box.label}</span>
                        <span className="text-slate-400">
                          {Math.round(box.confidence * 100)}%
                        </span>
                      </span>
                    </button>
                  );
                })}
            </div>
          )}

          {/* Scene summary / in-character commentary overlay */}
          {hasVisualSource && (latestSummary || (characterMode && activePersona)) && (
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-4 pt-6 pb-3 pointer-events-none">
              <p className="text-xs text-slate-200 line-clamp-2 max-w-3xl">
                {latestSummary || activePersona?.greeting}
              </p>
            </div>
          )}
        </div>

        {/* Real-Time Visual Filter Selection Bar */}
        <VisualFilterSelector
          selectedFilter={visualFilter}
          onSelectFilter={onChangeVisualFilter}
          intensity={filterIntensity}
          onChangeIntensity={onChangeFilterIntensity}
        />

        {/* Media & Gemini Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-800 bg-[#0D121C]">
          <div className="flex flex-wrap items-center gap-2">
            {!mediaActive && !uploadedVideoUrl ? (
              <button
                type="button"
                onClick={() => onStartCamera()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                Start Camera
              </button>
            ) : (
              <button
                type="button"
                onClick={onStopMedia}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#111827] hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <CameraOff className="w-3.5 h-3.5" />
                Stop Source
              </button>
            )}

            {cameras.length > 1 && sourceMode === "camera" && (
              <button
                type="button"
                onClick={handleCycleCamera}
                title="Switch Camera"
                aria-label="Switch Camera"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-[#111827] hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <SwitchCamera className="w-3.5 h-3.5" />
                Switch
              </button>
            )}

            <button
              type="button"
              onClick={onStartScreen}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-[#111827] hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Monitor className="w-3.5 h-3.5" />
              Screen
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-[#111827] hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ImagePlus className="w-3.5 h-3.5" />
              Upload
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Gemini 4 Model Selector */}
            <select
              aria-label="Gemini 4 vision model"
              value={visionModel}
              onChange={(e) =>
                onChangeVisionModel(e.target.value as VisionModelId)
              }
              className="px-2.5 py-1.5 text-xs font-mono bg-[#111827] text-cyan-300 border border-slate-700 rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500"
            >
              <option value="gemini-4-hydrogen">gemini-4-hydrogen</option>
              <option value="gemini-4-neon">gemini-4-neon (Pro)</option>
            </select>

            <button
              type="button"
              disabled={!hasVisualSource}
              onClick={onToggleAutoDetect}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                autoDetect
                  ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/20"
                  : "bg-[#111827] border-slate-700 text-slate-200 hover:bg-slate-800"
              }`}
            >
              {autoDetect ? (
                <Pause className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              {autoDetect ? "Auto Detect On" : "Auto Detect"}
            </button>

            <select
              aria-label="Detection cadence"
              value={intervalMs}
              onChange={(e) => onChangeInterval(Number(e.target.value))}
              className="px-2 py-1.5 text-xs font-mono tabular-nums bg-[#111827] text-slate-200 border border-slate-700 rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500"
            >
              <option value={1000}>1.0s</option>
              <option value={2000}>2.0s</option>
              <option value={4000}>4.0s</option>
            </select>

            <button
              type="button"
              disabled={!hasVisualSource || isDetecting}
              onClick={onAnalyzeOnce}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#111827] hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Scan className="w-3.5 h-3.5" />
              Analyze Frame
            </button>

            <button
              type="button"
              onClick={onToggleLiveVoice}
              disabled={liveConnecting}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 ${
                liveConnected
                  ? "bg-rose-500/15 border-rose-500/50 text-rose-300 hover:bg-rose-500/25"
                  : "bg-cyan-500/15 border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/25"
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              {liveConnecting
                ? "Connecting..."
                : liveConnected
                  ? "End Live Voice"
                  : "Start Live Voice"}
            </button>

            {liveConnected && (
              <button
                type="button"
                onClick={onToggleMicMute}
                aria-label={micMuted ? "Unmute microphone" : "Mute microphone"}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  micMuted
                    ? "bg-amber-500/15 border-amber-500/50 text-amber-300"
                    : "bg-[#111827] border-slate-700 text-slate-200 hover:bg-slate-800"
                }`}
              >
                {micMuted ? (
                  <MicOff className="w-3.5 h-3.5" />
                ) : (
                  <Mic className="w-3.5 h-3.5" />
                )}
                {micMuted ? "Muted" : "Mic On"}
              </button>
            )}

            <button
              type="button"
              disabled={!hasVisualSource}
              onClick={onSaveSnapshot}
              title="Download annotated snapshot"
              aria-label="Download annotated snapshot"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-[#111827] hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5" />
              Snapshot
            </button>
          </div>
        </div>
      </div>

      {/* Optional Zero-Friction Interactive Text Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmitPrompt();
        }}
        className="flex items-center gap-2 p-2 bg-[#0B0F17] border border-slate-800 rounded-lg"
      >
        <input
          type="text"
          value={promptText}
          onChange={(e) => onChangePromptText(e.target.value)}
          placeholder={
            characterMode && activePersona
              ? `Ask ${activePersona.name} about what you are showing on camera...`
              : liveConnected
                ? "Optional: send a text message to the active Gemini Live session..."
                : "Optional: ask Gemini 4 about what is on camera (e.g., What am I holding?)"
          }
          className="flex-1 min-w-0 bg-transparent px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none"
        />
        <button
          type="submit"
          disabled={!promptText.trim() || (!hasVisualSource && !liveConnected) || isAsking}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-[#111827] hover:bg-slate-800 text-cyan-400 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send className="w-3.5 h-3.5" />
          {isAsking ? "Asking..." : liveConnected ? "Send to Live" : "Ask Frame"}
        </button>
      </form>
    </div>
  );
};

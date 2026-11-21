import React, { useEffect, useRef, useState } from "react";
import {
  Captions,
  CaptionsOff,
  Compass,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  PhoneOff,
  RefreshCw,
  Send,
  SlidersHorizontal,
  Sparkles,
  User,
  Video,
  VideoOff,
  X,
} from "lucide-react";
import { HistoricalVideoStage } from "./HistoricalVideoStage";
import { WorldPortalOverlay } from "./WorldPortalOverlay";
import type {
  ActiveVideoLayer,
  CallTranscriptMessage,
  FaceTimePhase,
  FaceTimePortalInvite,
  FaceTimeReactionCue,
  HistoricalProfile,
  PiPCorner,
  VideoEngineMode,
} from "../types";

interface CallStageProps {
  phase: Exclude<FaceTimePhase, "launcher">;
  profile: HistoricalProfile;
  portraitDataUrl: string | null;
  ringingSubtitle: string;
  demoMode: boolean;
  voiceStatus: "idle" | "connecting" | "connected" | "demo" | "text-only";
  micMuted: boolean;
  onToggleMic: () => void;
  cameraEnabled: boolean;
  cameraReady: boolean;
  facingMode: "user" | "environment";
  bindUserVideoRef: (el: HTMLVideoElement | null) => void;
  onToggleCamera: () => void;
  onFlipCamera: () => void;
  isSpeaking: boolean;
  speechLevelRef: React.MutableRefObject<number>;
  transcripts: CallTranscriptMessage[];
  liveCaption: string;
  lastReaction: FaceTimeReactionCue | null;
  portalInvite?: FaceTimePortalInvite | null;
  onDismissPortalInvite?: () => void;
  isSendingText: boolean;
  onSendMessage: (text: string) => void;
  videoEngineMode: VideoEngineMode;
  onChangeVideoEngineMode: (mode: VideoEngineMode) => void;
  errorMessage: string | null;
  onDismissError: () => void;
  onEndCall: () => void;
}

const PIP_CORNER_CLASSES: Record<PiPCorner, string> = {
  "top-right": "top-20 right-4 sm:right-6",
  "bottom-right": "bottom-28 right-4 sm:right-6",
  "bottom-left": "bottom-28 left-4 sm:left-6",
  "top-left": "top-20 left-4 sm:left-6",
};

const CORNER_CYCLE: PiPCorner[] = [
  "top-right",
  "bottom-right",
  "bottom-left",
  "top-left",
];

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export const CallStage: React.FC<CallStageProps> = ({
  phase,
  profile,
  portraitDataUrl,
  ringingSubtitle,
  demoMode,
  voiceStatus,
  micMuted,
  onToggleMic,
  cameraEnabled,
  cameraReady,
  facingMode,
  bindUserVideoRef,
  onToggleCamera,
  onFlipCamera,
  isSpeaking,
  speechLevelRef,
  transcripts,
  liveCaption,
  lastReaction,
  portalInvite,
  onDismissPortalInvite,
  isSendingText,
  onSendMessage,
  videoEngineMode,
  onChangeVideoEngineMode,
  errorMessage,
  onDismissError,
  onEndCall,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [engineMenuOpen, setEngineMenuOpen] = useState(false);
  const [pipCorner, setPipCorner] = useState<PiPCorner>("top-right");
  const [draftMessage, setDraftMessage] = useState("");
  const [portalActive, setPortalActive] = useState(false);
  const [dismissedInvite, setDismissedInvite] = useState(false);
  const [videoTelemetry, setVideoTelemetry] = useState<{
    activeLayer: ActiveVideoLayer;
    label: string;
    upgrading: boolean;
  }>({
    activeLayer: "portrait",
    label: demoMode ? "Live Portrait · Demo" : "Live Portrait",
    upgrading: false,
  });

  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  // Reset portal states on call phase change
  useEffect(() => {
    if (phase !== "in-call") {
      setPortalActive(false);
      setDismissedInvite(false);
    }
  }, [phase]);

  // When a new portal invite arrives, allow toast to show
  useEffect(() => {
    if (portalInvite) {
      setDismissedInvite(false);
    }
  }, [portalInvite]);

  // Call timer starts when connected
  useEffect(() => {
    if (phase !== "in-call") {
      setElapsedSeconds(0);
      return;
    }
    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  // Auto-open chat drawer in demo mode or text-only mode so users immediately see how to talk
  useEffect(() => {
    if (phase === "in-call" && (voiceStatus === "demo" || voiceStatus === "text-only")) {
      const t = window.setTimeout(() => setChatOpen(true), 900);
      return () => window.clearTimeout(t);
    }
  }, [phase, voiceStatus]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts, chatOpen]);

  const cyclePipCorner = () => {
    setPipCorner((prev) => {
      const idx = CORNER_CYCLE.indexOf(prev);
      return CORNER_CYCLE[(idx + 1) % CORNER_CYCLE.length];
    });
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draftMessage.trim();
    if (!text || isSendingText) return;
    setDraftMessage("");
    onSendMessage(text);
  };

  return (
    <div className="fixed inset-0 z-40 bg-black text-white overflow-hidden select-none">
      {/* Full-bleed Remote Video Stage */}
      <HistoricalVideoStage
        profile={profile}
        portraitDataUrl={portraitDataUrl}
        demoMode={demoMode}
        engineMode={videoEngineMode}
        isSpeaking={isSpeaking}
        speechLevelRef={speechLevelRef}
        lastReaction={lastReaction}
        callActive={phase === "in-call"}
        onStatusChange={setVideoTelemetry}
      />

      {/* Ringing Overlay */}
      {phase === "ringing" && (
        <div className="absolute inset-0 z-30 bg-black/55 backdrop-blur-2xl flex flex-col items-center justify-between py-14 px-6">
          <div className="flex flex-col items-center text-center gap-5 mt-8">
            {/* Pulsing FaceTime avatar ring */}
            <div className="relative">
              <span className="absolute -inset-4 rounded-full bg-emerald-400/20 animate-ping" />
              <span className="absolute -inset-2 rounded-full bg-emerald-400/25 animate-pulse" />
              {portraitDataUrl || profile.previewImageUrl ? (
                <img
                  src={portraitDataUrl || profile.previewImageUrl}
                  alt={profile.name}
                  className="relative w-28 h-28 rounded-full object-cover border-2 border-white/30 shadow-2xl"
                />
              ) : (
                <div
                  className="relative w-28 h-28 rounded-full flex items-center justify-center text-3xl font-semibold border-2 border-white/30 shadow-2xl"
                  style={{
                    background: `linear-gradient(135deg, ${profile.gradientFrom}, ${profile.accentColor})`,
                  }}
                >
                  {profile.initials}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-300">
                Chronocall Video
              </p>
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
                {profile.name}
              </h1>
              <p className="text-sm text-slate-300">
                {profile.title} · {profile.era}
              </p>
            </div>

            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs text-slate-200 backdrop-blur-xl">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-300" />
              <span>{ringingSubtitle}</span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 mb-4">
            <button
              type="button"
              onClick={onEndCall}
              aria-label="Cancel call"
              className="w-16 h-16 rounded-full bg-[#FF3B30] hover:bg-[#FF453A] flex items-center justify-center shadow-2xl shadow-rose-600/40 transition-transform active:scale-95 cursor-pointer"
            >
              <PhoneOff className="w-7 h-7 text-white" />
            </button>
            <span className="text-xs text-slate-300 font-medium">Cancel</span>
          </div>
        </div>
      )}

      {/* Active Call HUD */}
      {phase === "in-call" && (
        <>
          {/* Top Floating FaceTime Header Pill */}
          <div className="absolute top-4 inset-x-4 sm:inset-x-6 z-20 flex items-start justify-between gap-3 pointer-events-none">
            <div className="pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-full bg-black/45 border border-white/15 backdrop-blur-2xl shadow-xl max-w-[75vw]">
              <div className="relative flex items-center justify-center w-2.5 h-2.5 shrink-0">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    isSpeaking
                      ? "bg-[#30D158] animate-ping absolute"
                      : "hidden"
                  }`}
                />
                <span
                  className={`w-2.5 h-2.5 rounded-full relative ${
                    voiceStatus === "connected"
                      ? "bg-[#30D158]"
                      : "bg-amber-400"
                  }`}
                />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white truncate">
                    {profile.name}
                  </span>
                  <span className="text-xs font-mono text-slate-300 tabular-nums">
                    {formatDuration(elapsedSeconds)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-300/90 truncate">
                  <span>{profile.era}</span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1 text-emerald-300">
                    {videoTelemetry.upgrading && (
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    )}
                    {videoTelemetry.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Video Engine Selector Pill */}
            <div className="pointer-events-auto relative">
              <button
                type="button"
                onClick={() => setEngineMenuOpen((v) => !v)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-black/45 hover:bg-black/60 border border-white/15 backdrop-blur-2xl text-xs font-medium text-slate-200 cursor-pointer shadow-xl"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-300" />
                <span className="hidden sm:inline">Video Engine</span>
              </button>

              {engineMenuOpen && (
                <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-[#0D111A]/95 border border-white/15 backdrop-blur-2xl shadow-2xl p-2 space-y-1">
                  <p className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Full-Motion Video Mode
                  </p>
                  {(
                    [
                      {
                        id: "hybrid",
                        label: "Hybrid Auto (Recommended)",
                        desc: "Instant portrait → Genie 4 / Veo",
                      },
                      {
                        id: "genie",
                        label: "Genie 4 Live WebRTC",
                        desc: "Interactive reaction-steered stream",
                      },
                      {
                        id: "veo",
                        label: "Veo Full-Motion Video",
                        desc: "Cinematic 720p listening & speaking",
                      },
                      {
                        id: "portrait",
                        label: "Live Animated Portrait",
                        desc: "Lowest latency 60fps reactive video",
                      },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        onChangeVideoEngineMode(opt.id);
                        setEngineMenuOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-xl transition-colors cursor-pointer ${
                        videoEngineMode === opt.id
                          ? "bg-emerald-500/20 border border-emerald-400/30 text-white"
                          : "hover:bg-white/10 text-slate-300"
                      }`}
                    >
                      <div className="text-xs font-semibold">{opt.label}</div>
                      <div className="text-[11px] text-slate-400">
                        {opt.desc}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Non-blocking Error / Notice Toast */}
          {errorMessage && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 max-w-md w-[90vw] rounded-2xl bg-black/75 border border-amber-400/35 px-4 py-2.5 text-xs text-amber-100 backdrop-blur-xl flex items-center justify-between gap-3 shadow-2xl">
              <span>{errorMessage}</span>
              <button
                type="button"
                onClick={onDismissError}
                className="text-slate-300 hover:text-white cursor-pointer"
                aria-label="Dismiss message"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Inviting Translucent Toast for World Portal */}
          {portalInvite && !portalActive && !dismissedInvite && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 max-w-lg w-[92vw] sm:w-auto rounded-2xl bg-black/80 border border-amber-400/50 p-3 sm:px-4 sm:py-3 text-amber-100 backdrop-blur-2xl flex items-center justify-between gap-4 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-amber-400/20 border border-amber-400/40 flex items-center justify-center shrink-0">
                  <Compass className="w-4 h-4 text-amber-300 animate-spin" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">
                    Step inside {portalInvite.locationName}
                  </p>
                  <p className="text-[11px] text-amber-200/80 truncate">
                    {profile.name} invited you to explore their surroundings
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setPortalActive(true)}
                  className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-xs font-bold shadow-md cursor-pointer transition-transform active:scale-95"
                >
                  Enter Portal →
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDismissedInvite(true);
                    onDismissPortalInvite?.();
                  }}
                  className="p-1 rounded-full text-slate-400 hover:text-white cursor-pointer"
                  aria-label="Dismiss portal invite"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Subtle Live Mood / Gesture Pill */}
          {lastReaction && (
            <div className="absolute top-20 left-6 z-20 hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/40 border border-white/10 backdrop-blur-xl text-[11px] text-slate-200">
              <Sparkles className="w-3 h-3 text-amber-300" />
              <span>{lastReaction.gesture}</span>
            </div>
          )}

          {/* Draggable / Corner-Snapping Picture-in-Picture Self-View */}
          <div
            className={`absolute z-20 ${PIP_CORNER_CLASSES[pipCorner]} w-28 sm:w-40 aspect-[3/4] sm:aspect-[4/3] rounded-2xl overflow-hidden bg-[#111622]/90 border border-white/25 shadow-2xl shadow-black/60 transition-all duration-300 group`}
          >
            <video
              ref={bindUserVideoRef}
              playsInline
              muted
              autoPlay
              className={`w-full h-full object-cover ${
                facingMode === "user" ? "scale-x-[-1]" : ""
              } ${cameraEnabled && cameraReady ? "opacity-100" : "opacity-0"}`}
            />
            {(!cameraEnabled || !cameraReady) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-[#121722] text-slate-400">
                <User className="w-7 h-7" />
                <span className="text-[10px] font-medium">
                  {cameraEnabled ? "Camera Off" : "Camera Paused"}
                </span>
              </div>
            )}

            {/* Quick PiP actions on hover/tap */}
            <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/75 to-transparent flex items-center justify-between opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={cyclePipCorner}
                title="Move self-view corner"
                className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/50 hover:bg-black/75 text-white cursor-pointer"
              >
                Move
              </button>
              <button
                type="button"
                onClick={onFlipCamera}
                title="Flip camera"
                className="w-6 h-6 rounded-full bg-black/50 hover:bg-black/75 flex items-center justify-center text-white cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Apple-style Floating Live Captions */}
          {captionsEnabled && liveCaption && (
            <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-20 max-w-2xl w-[90vw] px-5 py-3 rounded-2xl bg-black/60 border border-white/12 backdrop-blur-2xl text-center shadow-2xl pointer-events-none">
              <p className="text-sm sm:text-base text-white/95 leading-snug line-clamp-3">
                {liveCaption}
              </p>
            </div>
          )}

          {/* Collapsible Transcript & Quick-Text Drawer */}
          {chatOpen && (
            <aside className="absolute top-20 bottom-28 right-4 sm:right-6 z-30 w-[calc(100vw-2rem)] sm:w-96 rounded-3xl bg-[#0B0F18]/88 border border-white/15 backdrop-blur-2xl shadow-2xl flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Call Transcript
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {voiceStatus === "connected"
                      ? "Speak aloud or type below"
                      : demoMode
                        ? "Demo mode — type or tap a starter below"
                        : "Type a message to converse"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setChatOpen(false)}
                  aria-label="Close transcript"
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 select-text">
                {transcripts.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">
                    Conversation captions will appear here as you speak with{" "}
                    {profile.name}.
                  </p>
                ) : (
                  transcripts.map((entry) => (
                    <div
                      key={entry.id}
                      className={`flex flex-col ${
                        entry.speaker === "user" ? "items-end" : "items-start"
                      }`}
                    >
                      <span className="text-[10px] text-slate-400 mb-1 px-1">
                        {entry.speaker === "user" ? "You" : profile.name}
                      </span>
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs sm:text-sm leading-relaxed ${
                          entry.speaker === "user"
                            ? "bg-[#30D158]/20 border border-emerald-400/30 text-emerald-50"
                            : "bg-white/[0.08] border border-white/10 text-slate-100"
                        }`}
                      >
                        {entry.text}
                      </div>
                    </div>
                  ))
                )}
                <div ref={transcriptEndRef} />
              </div>

              {/* Starter Question Chips */}
              {profile.starterQuestions.length > 0 && (
                <div className="px-3 pb-2 flex gap-1.5 overflow-x-auto">
                  {profile.starterQuestions.map((q) => (
                    <button
                      key={q}
                      type="button"
                      disabled={isSendingText}
                      onClick={() => onSendMessage(q)}
                      className="text-[11px] whitespace-nowrap px-3 py-1.5 rounded-full bg-white/[0.07] hover:bg-white/[0.15] border border-white/10 text-slate-200 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* Message Input */}
              <form
                onSubmit={handleChatSubmit}
                className="p-3 border-t border-white/10 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={draftMessage}
                  onChange={(e) => setDraftMessage(e.target.value)}
                  placeholder={`Message ${profile.name.split(" ")[0]}…`}
                  className="flex-1 bg-white/[0.07] border border-white/12 focus:border-emerald-400/50 rounded-full px-3.5 py-2 text-xs sm:text-sm text-white placeholder:text-slate-400 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!draftMessage.trim() || isSendingText}
                  aria-label="Send message"
                  className="w-9 h-9 rounded-full bg-[#30D158] hover:bg-[#34C759] disabled:bg-white/10 disabled:text-slate-500 text-slate-950 flex items-center justify-center cursor-pointer disabled:cursor-not-allowed shrink-0"
                >
                  {isSendingText ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </form>
            </aside>
          )}

          {/* Bottom Frosted-Glass FaceTime Control Dock */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 sm:gap-3.5 px-4 sm:px-5 py-3 rounded-full bg-black/55 border border-white/15 backdrop-blur-2xl shadow-2xl">
            <button
              type="button"
              onClick={onToggleMic}
              aria-label={micMuted ? "Unmute microphone" : "Mute microphone"}
              title={micMuted ? "Unmute Mic" : "Mute Mic"}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                micMuted
                  ? "bg-white text-slate-950"
                  : "bg-white/15 hover:bg-white/25 text-white"
              }`}
            >
              {micMuted ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>

            <button
              type="button"
              onClick={onToggleCamera}
              aria-label={cameraEnabled ? "Turn camera off" : "Turn camera on"}
              title={cameraEnabled ? "Camera Off" : "Camera On"}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                !cameraEnabled
                  ? "bg-white text-slate-950"
                  : "bg-white/15 hover:bg-white/25 text-white"
              }`}
            >
              {cameraEnabled ? (
                <Video className="w-5 h-5" />
              ) : (
                <VideoOff className="w-5 h-5" />
              )}
            </button>

            <button
              type="button"
              onClick={onFlipCamera}
              aria-label="Flip camera"
              title="Flip Camera"
              className="w-12 h-12 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-all cursor-pointer"
            >
              <RefreshCw className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => setCaptionsEnabled((v) => !v)}
              aria-label={captionsEnabled ? "Hide captions" : "Show captions"}
              title={captionsEnabled ? "Hide Captions" : "Show Captions"}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                captionsEnabled
                  ? "bg-white text-slate-950"
                  : "bg-white/15 hover:bg-white/25 text-white"
              }`}
            >
              {captionsEnabled ? (
                <Captions className="w-5 h-5" />
              ) : (
                <CaptionsOff className="w-5 h-5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setChatOpen((v) => !v)}
              aria-label="Toggle transcript and chat"
              title="Transcript & Chat"
              className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                chatOpen
                  ? "bg-white text-slate-950"
                  : "bg-white/15 hover:bg-white/25 text-white"
              }`}
            >
              <MessageSquare className="w-5 h-5" />
              {transcripts.length > 0 && !chatOpen && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#30D158]" />
              )}
            </button>

            {/* Step Inside World Portal Button */}
            <button
              type="button"
              onClick={() => setPortalActive((v) => !v)}
              aria-label={portalActive ? "Return to FaceTime view" : "Step inside world"}
              title="Step Inside World Portal"
              className={`group relative h-12 px-3 sm:px-4 rounded-full flex items-center gap-2 transition-all cursor-pointer ${
                portalActive
                  ? "bg-amber-400 text-slate-950 font-semibold shadow-lg shadow-amber-400/30"
                  : "bg-gradient-to-r from-amber-500/20 to-emerald-500/20 hover:from-amber-500/30 hover:to-emerald-500/30 border border-amber-400/40 text-amber-200"
              }`}
            >
              <Compass
                className={`w-5 h-5 ${
                  portalActive
                    ? "animate-spin text-slate-950"
                    : "text-amber-300 group-hover:rotate-45 transition-transform"
                }`}
              />
              <span className="text-xs font-semibold whitespace-nowrap hidden sm:inline">
                Step Inside
              </span>
              {portalInvite && !portalActive && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 animate-ping" />
              )}
            </button>

            <div className="w-px h-7 bg-white/15 mx-0.5" />

            <button
              type="button"
              onClick={onEndCall}
              aria-label="End FaceTime call"
              title="End Call"
              className="h-12 px-5 sm:px-6 rounded-full bg-[#FF3B30] hover:bg-[#FF453A] text-white flex items-center justify-center gap-2 font-semibold text-sm shadow-lg shadow-rose-600/35 transition-transform active:scale-95 cursor-pointer"
            >
              <PhoneOff className="w-5 h-5" />
              <span className="hidden sm:inline">End</span>
            </button>
          </div>

          {/* Fullscreen Interactive World Portal Overlay */}
          {portalActive && (
            <WorldPortalOverlay
              profile={profile}
              portraitDataUrl={portraitDataUrl}
              demoMode={demoMode}
              portalInvite={portalInvite ?? null}
              onExitPortal={() => setPortalActive(false)}
              isSpeaking={isSpeaking}
              liveCaption={liveCaption}
              voiceStatus={voiceStatus}
              micMuted={micMuted}
              onToggleMic={onToggleMic}
              lastReaction={lastReaction}
            />
          )}
        </>
      )}
    </div>
  );
};

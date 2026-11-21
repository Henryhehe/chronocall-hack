import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Compass,
  Footprints,
  Loader2,
  Mic,
  MicOff,
  Radio,
  Sparkles,
  Volume2,
  Wand2,
} from "lucide-react";
import type {
  FaceTimePortalInvite,
  FaceTimeReactionCue,
  HistoricalProfile,
} from "../types";
import {
  compressImageUrlForGenie,
  GenieMoveKey,
  GenieWorldController,
  startGenieWorld,
} from "../../world/lib/genie";

export interface WorldPortalOverlayProps {
  profile: HistoricalProfile;
  portraitDataUrl: string | null;
  demoMode: boolean;
  portalInvite: FaceTimePortalInvite | null;
  onExitPortal: () => void;
  isSpeaking: boolean;
  liveCaption: string;
  voiceStatus: "idle" | "connecting" | "connected" | "demo" | "text-only";
  micMuted: boolean;
  onToggleMic: () => void;
  lastReaction?: FaceTimeReactionCue | null;
}

const KEY_TO_GENIE: Record<string, GenieMoveKey> = {
  w: "key_w",
  W: "key_w",
  s: "key_s",
  S: "key_s",
  a: "key_a",
  A: "key_a",
  d: "key_d",
  D: "key_d",
  ArrowUp: "arrow_up",
  ArrowDown: "arrow_down",
  ArrowLeft: "arrow_left",
  ArrowRight: "arrow_right",
};

interface AtmosphericPreset {
  id: string;
  label: string;
  prompt: string;
  icon: string;
  tintRgba: string;
}

const ATMOSPHERIC_CHIPS: AtmosphericPreset[] = [
  {
    id: "sunset",
    label: "Golden sunset",
    prompt: "Golden sunset casting long warm amber light across the room",
    icon: "🌅",
    tintRgba: "rgba(245, 158, 11, 0.22)",
  },
  {
    id: "rain",
    label: "Gentle rain",
    prompt: "Gentle rain tapping outside the historic window with cool overcast light",
    icon: "🌧️",
    tintRgba: "rgba(56, 189, 248, 0.16)",
  },
  {
    id: "desk",
    label: "Walk closer to the desk",
    prompt: "Step forward closer to the wooden work desk and historical instruments",
    icon: "📜",
    tintRgba: "rgba(217, 119, 6, 0.14)",
  },
  {
    id: "candlelight",
    label: "Candlelight ambiance",
    prompt: "Warm flickering candlelight illuminating historical scrolls and artifacts",
    icon: "🕯️",
    tintRgba: "rgba(251, 146, 60, 0.20)",
  },
  {
    id: "inspect",
    label: "Inspect artifacts",
    prompt: "Look closely around at historical books, inventions, and period items",
    icon: "🔍",
    tintRgba: "rgba(167, 139, 250, 0.16)",
  },
];

export const WorldPortalOverlay: React.FC<WorldPortalOverlayProps> = ({
  profile,
  portraitDataUrl,
  demoMode,
  portalInvite,
  onExitPortal,
  isSpeaking,
  liveCaption,
  voiceStatus,
  micMuted,
  onToggleMic,
  lastReaction,
}) => {
  const genieVideoRef = useRef<HTMLVideoElement | null>(null);
  const genieAudioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controllerRef = useRef<GenieWorldController | null>(null);

  // WebRTC Live State
  const [webrtcConnected, setWebrtcConnected] = useState(false);
  const [connectingGenie, setConnectingGenie] = useState(false);
  const [webrtcStatusText, setWebrtcStatusText] = useState("Initializing Portal…");
  const [genieError, setGenieError] = useState<string | null>(null);

  // Active Atmospheric chip
  const [activeAtmosphere, setActiveAtmosphere] = useState<AtmosphericPreset | null>(null);
  const [activeSteerText, setActiveSteerText] = useState<string | null>(null);
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());

  // Interactive Simulation State (Pan/Zoom)
  const panRef = useRef({ x: 0, y: 0, zoom: 1.15 });
  const targetPanRef = useRef({ x: 0, y: 0, zoom: 1.15 });
  const movingRef = useRef(false);

  const locationName = portalInvite?.locationName || profile.location;
  const portalPrompt =
    portalInvite?.portalPrompt ||
    `First-person seamless continuous walk through ${profile.location} during ${profile.era}, immersive interactive 3D world: ${profile.genieWorldPrompt}`;

  // 1. Initialize Genie 4 WebRTC if not demoMode
  useEffect(() => {
    let mounted = true;
    if (demoMode) {
      setWebrtcStatusText("Interactive Panoramic Simulation Active");
      return;
    }

    const initGenie = async () => {
      setConnectingGenie(true);
      setWebrtcStatusText("Opening Genie 4 WebRTC Portal…");

      try {
        let seedBase64: string | undefined = undefined;
        const seedImageSrc = portraitDataUrl || profile.previewImageUrl;
        if (seedImageSrc) {
          try {
            const compressed = await compressImageUrlForGenie(seedImageSrc);
            seedBase64 = compressed.base64;
          } catch {
            // Proceed without seed if compression fails
          }
        }

        if (!mounted || !genieVideoRef.current) return;

        const sessionRes = await fetch("/api/genie/session", { method: "POST" });
        if (!sessionRes.ok) {
          throw new Error("Genie 4 WebRTC session unavailable.");
        }
        const sessionData = (await sessionRes.json()) as {
          interactionId?: string;
          authToken?: string;
          error?: string;
        };
        if (!sessionData.interactionId || !sessionData.authToken) {
          throw new Error(sessionData.error || "Genie session initialization failed.");
        }

        if (!mounted || !genieVideoRef.current) return;

        const controller = await startGenieWorld({
          videoEl: genieVideoRef.current,
          audioEl: genieAudioRef.current,
          interactionId: sessionData.interactionId,
          authToken: sessionData.authToken,
          worldPrompt: portalPrompt,
          referenceImageBase64: seedBase64,
          onStatusChange: (status) => {
            if (mounted) setWebrtcStatusText(status);
          },
          onError: (msg) => {
            if (mounted) {
              setGenieError(msg);
              setWebrtcConnected(false);
              setConnectingGenie(false);
            }
          },
          onEnded: () => {
            if (mounted) setWebrtcConnected(false);
          },
        });

        if (!mounted) {
          void controller.stop();
          return;
        }

        controllerRef.current = controller;
        setWebrtcConnected(true);
        setConnectingGenie(false);
        setWebrtcStatusText("Genie 4 Live WebRTC Connected");
      } catch (err) {
        if (!mounted) return;
        setConnectingGenie(false);
        setGenieError(err instanceof Error ? err.message : "WebRTC portal unavailable.");
        setWebrtcStatusText("Interactive Panoramic Simulation Active");
      }
    };

    void initGenie();

    return () => {
      mounted = false;
      const c = controllerRef.current;
      controllerRef.current = null;
      if (c) void c.stop();
    };
  }, [demoMode, portalPrompt, portraitDataUrl, profile.previewImageUrl]);

  // 2. Interactive Pan/Zoom Canvas Render Loop (Simulation Mode & Visual Background)
  useEffect(() => {
    let animId = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Load reference scene image
    const img = new Image();
    let imageLoaded = false;
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageLoaded = true;
    };
    img.src = portraitDataUrl || profile.previewImageUrl || "";

    // Ambient floating particles
    const particles = Array.from({ length: 28 }).map(() => ({
      x: Math.random(),
      y: Math.random(),
      size: Math.random() * 2.2 + 0.8,
      speedX: (Math.random() - 0.5) * 0.0006,
      speedY: -Math.random() * 0.0008 - 0.0002,
      opacity: Math.random() * 0.6 + 0.2,
    }));

    // Raindrops for gentle rain preset
    const raindrops = Array.from({ length: 45 }).map(() => ({
      x: Math.random(),
      y: Math.random(),
      length: Math.random() * 18 + 12,
      speed: Math.random() * 0.02 + 0.02,
    }));

    let lastTime = performance.now();

    const render = (time: number) => {
      const dt = Math.min(64, time - lastTime);
      lastTime = time;

      const w = (canvas.width = canvas.clientWidth);
      const h = (canvas.height = canvas.clientHeight);

      if (w === 0 || h === 0) {
        animId = requestAnimationFrame(render);
        return;
      }

      // Smooth camera interpolation
      const lerpFactor = 0.12;
      panRef.current.x += (targetPanRef.current.x - panRef.current.x) * lerpFactor;
      panRef.current.y += (targetPanRef.current.y - panRef.current.y) * lerpFactor;
      panRef.current.zoom += (targetPanRef.current.zoom - panRef.current.zoom) * lerpFactor;

      // Subtle natural breathing / walking camera bobbing
      const walkBob = movingRef.current
        ? Math.sin(time * 0.012) * 4.5
        : Math.sin(time * 0.002) * 1.5;

      ctx.save();
      ctx.clearRect(0, 0, w, h);

      if (imageLoaded && img.naturalWidth > 0) {
        // Draw scene with pan, zoom & gentle perspective
        const scale =
          Math.max(w / img.naturalWidth, h / img.naturalHeight) * panRef.current.zoom;
        const dw = img.naturalWidth * scale;
        const dh = img.naturalHeight * scale;
        const dx = (w - dw) / 2 + panRef.current.x * (w * 0.25);
        const dy = (h - dh) / 2 + panRef.current.y * (h * 0.2) + walkBob;

        ctx.drawImage(img, dx, dy, dw, dh);
      } else {
        // Fallback procedural historical atmosphere gradient
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, profile.gradientFrom || "#1e1b4b");
        grad.addColorStop(1, profile.gradientTo || "#020617");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }

      // Vignette effect for depth
      const vignette = ctx.createRadialGradient(
        w / 2,
        h / 2,
        w * 0.25,
        w / 2,
        h / 2,
        w * 0.72
      );
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(1, "rgba(0,0,0,0.65)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);

      // Atmospheric Tinting
      if (activeAtmosphere) {
        ctx.fillStyle = activeAtmosphere.tintRgba;
        ctx.fillRect(0, 0, w, h);

        if (activeAtmosphere.id === "sunset") {
          const sunGlow = ctx.createRadialGradient(
            w * 0.7,
            h * 0.35,
            10,
            w * 0.7,
            h * 0.35,
            w * 0.65
          );
          sunGlow.addColorStop(0, "rgba(251, 191, 36, 0.45)");
          sunGlow.addColorStop(1, "rgba(245, 158, 11, 0)");
          ctx.fillStyle = sunGlow;
          ctx.fillRect(0, 0, w, h);
        } else if (activeAtmosphere.id === "rain") {
          ctx.strokeStyle = "rgba(186, 230, 253, 0.45)";
          ctx.lineWidth = 1.2;
          for (const drop of raindrops) {
            drop.y += drop.speed * (dt / 16);
            if (drop.y > 1) {
              drop.y = 0;
              drop.x = Math.random();
            }
            const rx = drop.x * w;
            const ry = drop.y * h;
            ctx.beginPath();
            ctx.moveTo(rx, ry);
            ctx.lineTo(rx - 2, ry + drop.length);
            ctx.stroke();
          }
        } else if (activeAtmosphere.id === "candlelight") {
          const flicker = 0.95 + Math.sin(time * 0.015) * 0.06;
          const flame = ctx.createRadialGradient(
            w * 0.3,
            h * 0.65,
            20,
            w * 0.3,
            h * 0.65,
            w * 0.5 * flicker
          );
          flame.addColorStop(0, "rgba(251, 146, 60, 0.38)");
          flame.addColorStop(1, "rgba(234, 88, 12, 0)");
          ctx.fillStyle = flame;
          ctx.fillRect(0, 0, w, h);
        }
      }

      // Draw floating atmospheric dust motes
      for (const p of particles) {
        p.x += p.speedX * (dt / 16);
        p.y += p.speedY * (dt / 16);
        if (p.y < 0) {
          p.y = 1;
          p.x = Math.random();
        }
        if (p.x < 0) p.x = 1;
        if (p.x > 1) p.x = 0;

        ctx.fillStyle = `rgba(254, 240, 138, ${p.opacity * 0.45})`;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [activeAtmosphere, portraitDataUrl, profile.gradientFrom, profile.gradientTo, profile.previewImageUrl]);

  // 3. Movement Handlers (WASD & Directional Pad)
  const handleMove = useCallback(
    (action: "down" | "up", keyStr: string) => {
      const genieKey = KEY_TO_GENIE[keyStr];
      if (action === "down") {
        setActiveKeys((prev) => new Set(prev).add(keyStr.toLowerCase()));
        movingRef.current = true;
      } else {
        setActiveKeys((prev) => {
          const next = new Set(prev);
          next.delete(keyStr.toLowerCase());
          if (next.size === 0) movingRef.current = false;
          return next;
        });
      }

      // Send to WebRTC session if active
      if (genieKey && controllerRef.current) {
        void controllerRef.current.sendKey(
          action === "down" ? "key_down" : "key_up",
          genieKey
        );
      }

      // In simulation mode, update targetPan & zoom
      if (action === "down") {
        const step = 0.12;
        if (keyStr === "w" || keyStr === "W" || keyStr === "ArrowUp") {
          targetPanRef.current.zoom = Math.min(1.8, targetPanRef.current.zoom + 0.12);
          targetPanRef.current.y = Math.min(0.25, targetPanRef.current.y + 0.04);
        } else if (keyStr === "s" || keyStr === "S" || keyStr === "ArrowDown") {
          targetPanRef.current.zoom = Math.max(1.05, targetPanRef.current.zoom - 0.12);
          targetPanRef.current.y = Math.max(-0.25, targetPanRef.current.y - 0.04);
        } else if (keyStr === "a" || keyStr === "A" || keyStr === "ArrowLeft") {
          targetPanRef.current.x = Math.min(0.4, targetPanRef.current.x + step);
        } else if (keyStr === "d" || keyStr === "D" || keyStr === "ArrowRight") {
          targetPanRef.current.x = Math.max(-0.4, targetPanRef.current.x - step);
        }
      }
    },
    []
  );

  // Keyboard Listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (KEY_TO_GENIE[e.key]) {
        e.preventDefault();
        handleMove("down", e.key);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (KEY_TO_GENIE[e.key]) {
        e.preventDefault();
        handleMove("up", e.key);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [handleMove]);

  // Atmospheric Steering Chip Handler
  const handleSelectAtmosphere = useCallback(
    (chip: AtmosphericPreset) => {
      setActiveAtmosphere((prev) => (prev?.id === chip.id ? null : chip));
      setActiveSteerText(`Atmosphere: ${chip.label}`);
      window.setTimeout(() => setActiveSteerText(null), 3200);

      if (chip.id === "desk") {
        targetPanRef.current.zoom = 1.45;
        targetPanRef.current.y = 0.12;
      }

      if (controllerRef.current) {
        void controllerRef.current.steerWorld(chip.prompt);
      }
    },
    []
  );

  return (
    <div className="fixed inset-0 z-50 bg-black text-white overflow-hidden flex flex-col justify-between animate-in fade-in duration-300 select-none">
      {/* Background WebRTC Video Stream (Genie 4) */}
      <video
        ref={genieVideoRef}
        playsInline
        muted
        autoPlay
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
          webrtcConnected ? "opacity-100 z-0" : "opacity-0 pointer-events-none"
        }`}
      />
      <audio ref={genieAudioRef} autoPlay />

      {/* Interactive Simulation / Panoramic Canvas (Active in Demo mode or when WebRTC initializing) */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
          webrtcConnected ? "opacity-0 pointer-events-none" : "opacity-100 z-0"
        }`}
      />

      {/* Top Bar: Location Header & Return to FaceTime View */}
      <div className="relative z-10 p-4 sm:p-6 flex items-start justify-between gap-3 pointer-events-none">
        {/* Location & Guide Badge */}
        <div className="pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-full bg-black/60 border border-white/20 backdrop-blur-2xl shadow-2xl max-w-[80vw]">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-bold shrink-0 shadow-lg shadow-amber-500/30">
            <Compass className="w-4 h-4 animate-spin" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-bold text-white truncate">
                {locationName}
              </span>
              <span className="hidden sm:inline text-xs text-amber-300 font-medium">
                ({profile.era})
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-300 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                {profile.name} is your live audio tour guide
              </span>
              <span>·</span>
              <span className="text-emerald-300 font-mono text-[10px]">
                {webrtcConnected ? "WebRTC 60fps" : "Interactive Simulated View"}
              </span>
            </div>
          </div>
        </div>

        {/* Return to FaceTime View Button */}
        <button
          type="button"
          onClick={onExitPortal}
          className="pointer-events-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 border border-white/25 backdrop-blur-2xl text-xs sm:text-sm font-semibold text-white shadow-2xl transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to FaceTime View</span>
        </button>
      </div>

      {/* Floating Center Notification for Atmospheric steering */}
      {activeSteerText && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-full bg-black/75 border border-amber-400/40 backdrop-blur-xl text-xs text-amber-200 shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <Wand2 className="w-3.5 h-3.5 text-amber-300 animate-spin" />
          <span>{activeSteerText}</span>
        </div>
      )}

      {/* Bottom Area: Tour Guide Caption Card, Atmospheric Chips & D-Pad */}
      <div className="relative z-10 p-4 sm:p-6 flex flex-col gap-3.5 pointer-events-none">
        {/* Live Audio Tour Guide Captions & Audio Indicator Card */}
        <div className="pointer-events-auto mx-auto max-w-2xl w-full rounded-2xl bg-black/65 border border-white/15 backdrop-blur-2xl p-3.5 sm:p-4 shadow-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Guide Avatar / Audio Pulse */}
            <div className="relative shrink-0">
              {portraitDataUrl || profile.previewImageUrl ? (
                <img
                  src={portraitDataUrl || profile.previewImageUrl}
                  alt={profile.name}
                  className="w-10 h-10 rounded-full object-cover border-2 border-emerald-400/60 shadow-md"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-sm font-bold">
                  {profile.initials}
                </div>
              )}
              {isSpeaking && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-black animate-ping" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-emerald-400">
                  {profile.name}
                </span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Volume2 className="w-3 h-3 text-emerald-300" />
                  Live Voice Guide
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-100 line-clamp-2 leading-snug">
                {liveCaption || profile.openingLine}
              </p>
            </div>
          </div>

          {/* Mic Toggle for talking to tour guide */}
          <button
            type="button"
            onClick={onToggleMic}
            aria-label={micMuted ? "Unmute Mic" : "Mute Mic"}
            title={micMuted ? "Unmute Mic" : "Mute Mic"}
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
              micMuted
                ? "bg-rose-500/80 text-white hover:bg-rose-600"
                : "bg-white/15 hover:bg-white/25 text-white"
            }`}
          >
            {micMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        </div>

        {/* Atmospheric Steering Chips */}
        <div className="pointer-events-auto flex items-center justify-center gap-2 overflow-x-auto py-1 px-2 no-scrollbar">
          {ATMOSPHERIC_CHIPS.map((chip) => {
            const isSelected = activeAtmosphere?.id === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => handleSelectAtmosphere(chip)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer backdrop-blur-xl border ${
                  isSelected
                    ? "bg-amber-400 text-slate-950 border-amber-300 shadow-lg shadow-amber-400/25 scale-105"
                    : "bg-black/50 hover:bg-black/75 text-slate-200 border-white/15 hover:border-white/30"
                }`}
              >
                <span>{chip.icon}</span>
                <span>{chip.label}</span>
              </button>
            );
          })}
        </div>

        {/* Bottom Controls Row: Sleek On-Screen Directional Pad & Keyboard Guide */}
        <div className="pointer-events-auto flex items-center justify-between gap-4 max-w-4xl mx-auto w-full px-2">
          {/* Subtle Movement Prompt */}
          <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-300 bg-black/45 border border-white/10 px-3.5 py-2 rounded-full backdrop-blur-xl">
            <Footprints className="w-3.5 h-3.5 text-amber-300" />
            <span>Use keyboard <kbd className="px-1.5 py-0.5 rounded bg-white/20 font-mono text-[10px]">W</kbd> <kbd className="px-1.5 py-0.5 rounded bg-white/20 font-mono text-[10px]">A</kbd> <kbd className="px-1.5 py-0.5 rounded bg-white/20 font-mono text-[10px]">S</kbd> <kbd className="px-1.5 py-0.5 rounded bg-white/20 font-mono text-[10px]">D</kbd> or on-screen pad to explore</span>
          </div>

          {/* On-Screen Translucent Directional Pad */}
          <div className="flex flex-col items-center gap-1 bg-black/55 border border-white/15 p-2 rounded-2xl backdrop-blur-2xl shadow-2xl ml-auto">
            {/* Forward / W */}
            <button
              type="button"
              onPointerDown={() => handleMove("down", "w")}
              onPointerUp={() => handleMove("up", "w")}
              onPointerLeave={() => handleMove("up", "w")}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                activeKeys.has("w") || activeKeys.has("arrowup")
                  ? "bg-amber-400 text-slate-950 scale-95"
                  : "bg-white/15 hover:bg-white/25 text-white"
              }`}
              aria-label="Walk forward"
            >
              <ArrowUp className="w-4 h-4" />
            </button>

            {/* Left / Backward / Right */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onPointerDown={() => handleMove("down", "a")}
                onPointerUp={() => handleMove("up", "a")}
                onPointerLeave={() => handleMove("up", "a")}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                  activeKeys.has("a") || activeKeys.has("arrowleft")
                    ? "bg-amber-400 text-slate-950 scale-95"
                    : "bg-white/15 hover:bg-white/25 text-white"
                }`}
                aria-label="Step left"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onPointerDown={() => handleMove("down", "s")}
                onPointerUp={() => handleMove("up", "s")}
                onPointerLeave={() => handleMove("up", "s")}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                  activeKeys.has("s") || activeKeys.has("arrowdown")
                    ? "bg-amber-400 text-slate-950 scale-95"
                    : "bg-white/15 hover:bg-white/25 text-white"
                }`}
                aria-label="Step backward"
              >
                <ArrowDown className="w-4 h-4" />
              </button>

              <button
                type="button"
                onPointerDown={() => handleMove("down", "d")}
                onPointerUp={() => handleMove("up", "d")}
                onPointerLeave={() => handleMove("up", "d")}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                  activeKeys.has("d") || activeKeys.has("arrowright")
                    ? "bg-amber-400 text-slate-950 scale-95"
                    : "bg-white/15 hover:bg-white/25 text-white"
                }`}
                aria-label="Step right"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

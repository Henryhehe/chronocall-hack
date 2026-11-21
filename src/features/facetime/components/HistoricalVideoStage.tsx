import React, { useEffect, useRef, useState } from "react";
import {
  compressImageUrlForGenie,
  startGenieWorld,
  type GenieWorldController,
} from "../../world/lib/genie";
import { resolveActiveVideoLayer } from "../../../../shared/facetime.ts";
import type {
  ActiveVideoLayer,
  FaceTimeReactionCue,
  FaceTimeVideoJobStatus,
  HistoricalProfile,
  VideoEngineMode,
} from "../types";

interface HistoricalVideoStageProps {
  profile: HistoricalProfile;
  portraitDataUrl: string | null;
  demoMode: boolean;
  engineMode: VideoEngineMode;
  isSpeaking: boolean;
  speechLevelRef: React.MutableRefObject<number>;
  lastReaction: FaceTimeReactionCue | null;
  callActive: boolean;
  onStatusChange?: (status: {
    activeLayer: ActiveVideoLayer;
    label: string;
    upgrading: boolean;
  }) => void;
}

const MOOD_GLOW: Record<FaceTimeReactionCue["mood"], string> = {
  warm: "rgba(251, 191, 36, 0.16)",
  curious: "rgba(56, 189, 248, 0.16)",
  amused: "rgba(52, 211, 153, 0.18)",
  thoughtful: "rgba(167, 139, 250, 0.16)",
  passionate: "rgba(251, 113, 133, 0.18)",
  surprised: "rgba(253, 224, 71, 0.18)",
};

/**
 * Renders the full-bleed remote video side of the FaceTime call using a 2-tier
 * hybrid full-motion pipeline:
 *  - Tier 1 (Instant): 60fps audio-reactive living canvas animated from the photorealistic portrait.
 *  - Tier 2A (Live Stream): Genie 4 WebRTC real-time interactive video seeded from the portrait & steered by conversation reactions.
 *  - Tier 2B (Cinematic Loops): Veo image-to-video full-motion clips (listening & speaking) proxied from the server.
 */
export const HistoricalVideoStage: React.FC<HistoricalVideoStageProps> = ({
  profile,
  portraitDataUrl,
  demoMode,
  engineMode,
  isSpeaking,
  speechLevelRef,
  lastReaction,
  callActive,
  onStatusChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const portraitImgRef = useRef<HTMLImageElement | null>(null);
  const genieVideoRef = useRef<HTMLVideoElement | null>(null);
  const genieControllerRef = useRef<GenieWorldController | null>(null);
  const veoListenRef = useRef<HTMLVideoElement | null>(null);
  const veoSpeakRef = useRef<HTMLVideoElement | null>(null);

  const [portraitLoaded, setPortraitLoaded] = useState(false);
  const [genieHasFrame, setGenieHasFrame] = useState(false);
  const [genieWarming, setGenieWarming] = useState(false);
  const [veoListenUrl, setVeoListenUrl] = useState<string | null>(null);
  const [veoSpeakUrl, setVeoSpeakUrl] = useState<string | null>(null);
  const [veoWarming, setVeoWarming] = useState(false);

  const isSpeakingRef = useRef(isSpeaking);
  isSpeakingRef.current = isSpeaking;
  const lastReactionRef = useRef(lastReaction);
  lastReactionRef.current = lastReaction;

  const activeLayer = resolveActiveVideoLayer({
    mode: engineMode,
    genieHasFrame,
    veoReady: Boolean(veoListenUrl || veoSpeakUrl),
  });

  // Report live video layer telemetry to CallStage header pill
  useEffect(() => {
    const upgrading =
      !demoMode &&
      callActive &&
      engineMode !== "portrait" &&
      activeLayer === "portrait" &&
      (genieWarming || veoWarming);

    let label = "Live Portrait";
    if (activeLayer === "veo") {
      label = veoSpeakUrl && veoListenUrl ? "HD Motion · Veo Dual" : "HD Motion · Veo";
    } else if (activeLayer === "genie") {
      label = "Live Stream · Genie 4";
    } else if (upgrading) {
      label = "Upgrading to Full Motion…";
    } else if (demoMode) {
      label = "Live Portrait · Demo";
    }

    onStatusChange?.({ activeLayer, label, upgrading });
  }, [
    activeLayer,
    callActive,
    demoMode,
    engineMode,
    genieWarming,
    onStatusChange,
    veoListenUrl,
    veoSpeakUrl,
    veoWarming,
  ]);

  // Load portrait image whenever portraitDataUrl updates
  useEffect(() => {
    setPortraitLoaded(false);
    portraitImgRef.current = null;
    if (!portraitDataUrl) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      portraitImgRef.current = img;
      setPortraitLoaded(true);
    };
    img.src = portraitDataUrl;
    return () => {
      cancelled = true;
    };
  }, [portraitDataUrl]);

  // Tier 1: 60fps living portrait canvas animation (always running beneath / ready for zero-flicker fallback)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let mounted = true;
    let rafId = 0;
    const startedAt = performance.now();

    const draw = (now: number) => {
      if (!mounted) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const targetW = Math.max(1, Math.round(rect.width * dpr));
      const targetH = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      const w = canvas.width;
      const h = canvas.height;
      const elapsed = (now - startedAt) / 1000;
      const speech = speechLevelRef.current;
      const speaking = isSpeakingRef.current;
      const reaction = lastReactionRef.current;

      ctx.save();
      ctx.clearRect(0, 0, w, h);

      // Rich atmospheric background fallback while portrait loads
      const bgGrad = ctx.createRadialGradient(
        w * 0.5,
        h * 0.36,
        w * 0.05,
        w * 0.5,
        h * 0.5,
        Math.max(w, h) * 0.78
      );
      bgGrad.addColorStop(0, `${profile.accentColor}44`);
      bgGrad.addColorStop(0.55, profile.gradientFrom);
      bgGrad.addColorStop(1, profile.gradientTo);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      const img = portraitImgRef.current;
      if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
        // Compute cover framing with subtle headroom for realistic camera drift
        const imgRatio = img.naturalWidth / img.naturalHeight;
        const viewRatio = w / h;
        let drawW = w;
        let drawH = h;
        if (imgRatio > viewRatio) {
          drawH = h * 1.06;
          drawW = drawH * imgRatio;
        } else {
          drawW = w * 1.06;
          drawH = drawW / imgRatio;
        }

        // Lifelike camera breathing, conversational head sway, and speech liveliness
        const breath = 1 + Math.sin(elapsed * 1.35) * 0.008 + speech * 0.014;
        const swayX =
          Math.sin(elapsed * 0.52) * w * 0.008 +
          Math.sin(elapsed * 3.1) * speech * w * 0.005;
        const swayY =
          Math.cos(elapsed * 0.78) * h * 0.006 -
          speech * h * 0.009 +
          (speaking ? -h * 0.004 : 0);
        const tiltRad =
          Math.sin(elapsed * 0.65) * 0.007 +
          Math.sin(elapsed * 4.4) * speech * 0.011;

        ctx.save();
        ctx.translate(w / 2 + swayX, h / 2 + swayY);
        ctx.rotate(tiltRad);
        ctx.scale(breath, breath);
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);

        // Subtle periodic blink + soft vocal lighting near face anchor
        const anchor = profile.faceAnchor ?? {
          cx: 0.5,
          cy: 0.36,
          eyeY: 0.32,
          mouthY: 0.44,
        };
        const faceX = (anchor.cx - 0.5) * drawW;
        const eyeY = (anchor.eyeY - 0.5) * drawH;
        const mouthY = (anchor.mouthY - 0.5) * drawH;

        // Soft studio speaking illumination glow
        if (speech > 0.04) {
          const glowR = Math.min(drawW, drawH) * 0.24;
          const glow = ctx.createRadialGradient(
            faceX,
            mouthY,
            glowR * 0.05,
            faceX,
            mouthY,
            glowR
          );
          glow.addColorStop(0, `rgba(255, 241, 214, ${Math.min(0.16, speech * 0.2)})`);
          glow.addColorStop(1, "rgba(255, 241, 214, 0)");
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(faceX, mouthY, glowR, 0, Math.PI * 2);
          ctx.fill();
        }

        // Natural soft eyelid shadow blink every ~4.4s
        const blinkPhase = elapsed % 4.4;
        if (blinkPhase > 4.18 && blinkPhase < 4.34) {
          const p = Math.sin(((blinkPhase - 4.18) / 0.16) * Math.PI);
          const eyeSpread = drawW * 0.026;
          ctx.fillStyle = `rgba(38, 28, 22, ${0.32 * p})`;
          ctx.beginPath();
          ctx.ellipse(
            faceX - eyeSpread,
            eyeY,
            drawW * 0.012,
            drawH * 0.0055 * p,
            0,
            0,
            Math.PI * 2
          );
          ctx.ellipse(
            faceX + eyeSpread,
            eyeY,
            drawW * 0.012,
            drawH * 0.0055 * p,
            0,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }

        ctx.restore();
      }

      // Subtle mood lighting veil driven by Gemini Live express_reaction tool
      if (reaction) {
        const moodTint = MOOD_GLOW[reaction.mood] ?? MOOD_GLOW.warm;
        const moodGrad = ctx.createRadialGradient(
          w * 0.5,
          h * 0.35,
          w * 0.08,
          w * 0.5,
          h * 0.5,
          Math.max(w, h) * 0.65
        );
        moodGrad.addColorStop(0, moodTint);
        moodGrad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = moodGrad;
        ctx.fillRect(0, 0, w, h);
      }

      ctx.restore();
      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => {
      mounted = false;
      cancelAnimationFrame(rafId);
    };
  }, [portraitLoaded, profile, speechLevelRef]);

  // Tier 2A: Genie 4 real-time interactive WebRTC full-motion video stream
  useEffect(() => {
    const shouldRunGenie =
      callActive &&
      !demoMode &&
      Boolean(portraitDataUrl) &&
      (engineMode === "hybrid" || engineMode === "genie");

    if (!shouldRunGenie) {
      setGenieHasFrame(false);
      setGenieWarming(false);
      const ctrl = genieControllerRef.current;
      genieControllerRef.current = null;
      if (ctrl) void ctrl.stop();
      return;
    }

    let cancelled = false;
    setGenieHasFrame(false);
    setGenieWarming(true);

    const launchGenie = async () => {
      try {
        const seed = await compressImageUrlForGenie(portraitDataUrl!);
        if (cancelled) return;

        const sessionRes = await fetch("/api/genie/session", {
          method: "POST",
        });
        if (!sessionRes.ok) {
          throw new Error("Genie session unavailable.");
        }
        const sessionData = (await sessionRes.json()) as {
          interactionId: string;
          authToken: string;
        };
        if (cancelled || !genieVideoRef.current) return;

        const ctrl = await startGenieWorld({
          videoEl: genieVideoRef.current,
          interactionId: sessionData.interactionId,
          authToken: sessionData.authToken,
          worldPrompt: profile.genieWorldPrompt,
          referenceImageBase64: seed.base64,
          onError: () => {
            if (!cancelled) {
              setGenieWarming(false);
              setGenieHasFrame(false);
            }
          },
          onEnded: () => {
            if (!cancelled) {
              setGenieWarming(false);
              setGenieHasFrame(false);
            }
          },
        });

        if (cancelled) {
          await ctrl.stop();
          return;
        }
        genieControllerRef.current = ctrl;
      } catch {
        if (!cancelled) {
          setGenieWarming(false);
          setGenieHasFrame(false);
        }
      }
    };

    void launchGenie();

    return () => {
      cancelled = true;
      setGenieWarming(false);
      setGenieHasFrame(false);
      const ctrl = genieControllerRef.current;
      genieControllerRef.current = null;
      if (ctrl) void ctrl.stop();
    };
  }, [callActive, demoMode, engineMode, portraitDataUrl, profile.genieWorldPrompt]);

  // Steer active Genie 4 video stream whenever Gemini Live triggers express_reaction
  useEffect(() => {
    if (!lastReaction || !genieHasFrame || !genieControllerRef.current) return;
    void genieControllerRef.current
      .steerWorld(lastReaction.videoCue)
      .catch(() => {});
  }, [genieHasFrame, lastReaction]);

  // Tier 2B: Veo Image-to-Video full-motion loops (listening + speaking)
  useEffect(() => {
    const shouldRunVeo =
      callActive &&
      !demoMode &&
      Boolean(portraitDataUrl) &&
      (engineMode === "hybrid" || engineMode === "veo");

    if (!shouldRunVeo) {
      setVeoWarming(false);
      setVeoListenUrl(null);
      setVeoSpeakUrl(null);
      return;
    }

    let cancelled = false;
    setVeoWarming(true);
    setVeoListenUrl(null);
    setVeoSpeakUrl(null);

    const runVeoClip = async (mode: "listening" | "speaking") => {
      try {
        const startRes = await fetch("/api/facetime/video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profile,
            portraitDataUrl,
            mode,
          }),
        });
        if (!startRes.ok) return null;
        let status = (await startRes.json()) as FaceTimeVideoJobStatus;

        // Poll until ready (max ~2 minutes)
        let attempts = 0;
        while (!cancelled && status.status !== "ready" && status.status !== "error" && attempts < 30) {
          await new Promise((r) => setTimeout(r, 4000));
          attempts++;
          if (cancelled) return null;
          const pollRes = await fetch(
            `/api/facetime/video/${encodeURIComponent(status.jobId)}`
          );
          if (!pollRes.ok) return null;
          status = (await pollRes.json()) as FaceTimeVideoJobStatus;
        }

        if (!cancelled && status.status === "ready" && status.videoUrl) {
          if (mode === "listening") setVeoListenUrl(status.videoUrl);
          else setVeoSpeakUrl(status.videoUrl);
          return status.videoUrl;
        }
      } catch {
        // Silent fallback to Genie 4 / Tier 1 portrait
      }
      return null;
    };

    void (async () => {
      const listening = await runVeoClip("listening");
      if (cancelled) return;
      setVeoWarming(false);
      if (listening) {
        // Warm up a second speaking clip in the background for responsive speaking motion
        void runVeoClip("speaking");
      }
    })();

    return () => {
      cancelled = true;
      setVeoWarming(false);
    };
  }, [callActive, demoMode, engineMode, portraitDataUrl, profile]);

  // Keep Veo video elements playing smoothly
  useEffect(() => {
    if (veoListenUrl && veoListenRef.current) {
      void veoListenRef.current.play().catch(() => {});
    }
  }, [veoListenUrl]);

  useEffect(() => {
    if (veoSpeakUrl && veoSpeakRef.current) {
      void veoSpeakRef.current.play().catch(() => {});
    }
  }, [veoSpeakUrl]);

  const showGenie = activeLayer === "genie";
  const showVeo = activeLayer === "veo";
  const showSpeakVeo = showVeo && Boolean(veoSpeakUrl) && (isSpeaking || !veoListenUrl);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#06080D]">
      {/* Layer 1: Instant 60fps audio-reactive photorealistic living portrait */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Layer 2A: Real-time Genie 4 WebRTC full-motion stream */}
      <video
        ref={genieVideoRef}
        playsInline
        muted
        autoPlay
        onLoadedData={() => {
          setGenieHasFrame(true);
          setGenieWarming(false);
        }}
        onPlaying={() => {
          setGenieHasFrame(true);
          setGenieWarming(false);
        }}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
          showGenie ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Layer 2B: Veo full-motion listening clip */}
      {veoListenUrl && (
        <video
          ref={veoListenRef}
          src={veoListenUrl}
          playsInline
          muted
          loop
          autoPlay
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
            showVeo && !showSpeakVeo
              ? "opacity-100"
              : "opacity-0 pointer-events-none"
          }`}
        />
      )}

      {/* Layer 2B: Veo full-motion speaking clip */}
      {veoSpeakUrl && (
        <video
          ref={veoSpeakRef}
          src={veoSpeakUrl}
          playsInline
          muted
          loop
          autoPlay
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
            showSpeakVeo ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        />
      )}

      {/* Subtle FaceTime lens vignettes for effortless glass legibility */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/65 via-black/25 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-black/75 via-black/30 to-transparent"
      />
    </div>
  );
};

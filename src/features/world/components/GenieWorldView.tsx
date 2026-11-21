import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Box,
  Camera,
  ChevronDown,
  ChevronUp,
  Globe,
  ImagePlus,
  Loader2,
  Mic,
  MicOff,
  Play,
  Plus,
  RotateCcw,
  Send,
  SlidersHorizontal,
  Sparkles,
  Square,
  UserCheck,
  Video,
  Volume2,
  VolumeX,
  Wand2,
} from "lucide-react";
import { HistoricalPersonaId } from "../../../types/vision";
import {
  LowPolyObjectBlueprint,
  LowPolySceneBlueprint,
} from "../../../types/world3d";
import { useLiveSession } from "../../live/useLiveSession";
import { captureMediaFrame } from "../../../utils/canvas";
import { HISTORICAL_PERSONAS } from "../../character/components/HistoricalOverlay";
import { Interactive3DWorld } from "./Interactive3DWorld";
import {
  ENVIRONMENT_THEME_OPTIONS,
  ENVIRONMENT_THEME_PRESETS,
  EnvironmentThemeId,
} from "../three/themePresets";
import {
  captureGenieSeedFrame,
  compressImageUrlForGenie,
  GenieMoveKey,
  GenieWorldController,
  startGenieWorld,
} from "../lib/genie";

interface GenieWorldViewProps {
  getCameraElement: () => HTMLVideoElement | HTMLImageElement | null;
  hasActiveCamera: boolean;
}

const KEY_MAP: Record<string, GenieMoveKey> = {
  w: "key_w",
  a: "key_a",
  s: "key_s",
  d: "key_d",
  ArrowUp: "arrow_up",
  ArrowDown: "arrow_down",
  ArrowLeft: "arrow_left",
  ArrowRight: "arrow_right",
};

export const GenieWorldView: React.FC<GenieWorldViewProps> = ({
  getCameraElement,
  hasActiveCamera,
}) => {
  const genieVideoRef = useRef<HTMLVideoElement | null>(null);
  const genieAudioRef = useRef<HTMLAudioElement | null>(null);
  const seedImgRef = useRef<HTMLImageElement | null>(null);
  const selfieVideoRef = useRef<HTMLVideoElement | null>(null);
  const selfieStreamRef = useRef<MediaStream | null>(null);
  const selfieStreamIsSharedRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const controllerRef = useRef<GenieWorldController | null>(null);
  const pressedKeysRef = useRef<Set<GenieMoveKey>>(new Set());
  const threeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [worldEngine, setWorldEngine] = useState<"3d" | "genie">("3d");
  const [externalWorldEvent, setExternalWorldEvent] = useState<{
    id: number;
    text: string;
  } | null>(null);
  const [customSceneBlueprint, setCustomSceneBlueprint] =
    useState<LowPolySceneBlueprint | null>(null);
  const [spawnedObjectEvent, setSpawnedObjectEvent] = useState<{
    id: number;
    object: LowPolyObjectBlueprint;
  } | null>(null);
  const [sceneBuilderPrompt, setSceneBuilderPrompt] = useState(
    "Sunlit low-poly courtyard with mossy monoliths, a glowing crystal shrine, and hanging amber lanterns"
  );
  const [spawnPropPrompt, setSpawnPropPrompt] = useState("");
  const [isGeneratingScene, setIsGeneratingScene] = useState(false);
  const [isSpawningProp, setIsSpawningProp] = useState(false);
  const [sceneLatencyMs, setSceneLatencyMs] = useState<number | null>(null);
  const [activeEnvTheme, setActiveEnvTheme] = useState<
    EnvironmentThemeId | "custom"
  >("default");
  const [floatingControlsOpen, setFloatingControlsOpen] = useState(false);
  const [cameraRotationDeg, setCameraRotationDeg] = useState(0);
  const [cameraPitchDeg, setCameraPitchDeg] = useState(21);
  const [cameraZoom, setCameraZoom] = useState(8.2);
  const pendingGenieLaunchRef = useRef<{
    seedBase64: string;
    prompt: string;
  } | null>(null);

  const [selectedPersonaId, setSelectedPersonaId] =
    useState<HistoricalPersonaId>("roman-senator");
  const [characterPrompt, setCharacterPrompt] = useState(
    "Standing in a grand sunlit world inspired by my surroundings, dressed in authentic period attire, ready to walk forward and explore."
  );
  const [worldPrompt, setWorldPrompt] = useState(
    HISTORICAL_PERSONAS[0].geniePrompt
  );

  // Step 1: Selfie / Photo capture state
  const [cameraBoothOpen, setCameraBoothOpen] = useState(false);
  const [selfiePreviewUrl, setSelfiePreviewUrl] = useState<string | null>(null);
  const [selfieBase64, setSelfieBase64] = useState<string | null>(null);
  const [selfieMimeType, setSelfieMimeType] = useState<string>("image/jpeg");

  // Step 2: Transformed Character-in-World state
  const [isTransforming, setIsTransforming] = useState(false);
  const [transformedImageUrl, setTransformedImageUrl] = useState<string | null>(
    null
  );
  const [transformLatencyMs, setTransformLatencyMs] = useState<number | null>(
    null
  );

  // Step 3: Compressed 16:9 WebRTC seed for Genie 4
  const [seedPreviewUrl, setSeedPreviewUrl] = useState<string | null>(null);
  const [seedBase64, setSeedBase64] = useState<string | undefined>(undefined);
  const [seedBytes, setSeedBytes] = useState<number | null>(null);

  const [steerInput, setSteerInput] = useState("");
  const [running, setRunning] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [hasFirstFrame, setHasFirstFrame] = useState(false);
  const [webrtcStatus, setWebrtcStatus] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(120);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [worldAudioMuted, setWorldAudioMuted] = useState(false);

  const stopSelfieBooth = useCallback(() => {
    if (selfieStreamRef.current && !selfieStreamIsSharedRef.current) {
      for (const track of selfieStreamRef.current.getTracks()) {
        track.stop();
      }
    }
    selfieStreamRef.current = null;
    selfieStreamIsSharedRef.current = false;
    if (selfieVideoRef.current) {
      selfieVideoRef.current.srcObject = null;
    }
    setCameraBoothOpen(false);
  }, []);

  const stopWorld = useCallback(async () => {
    const ctrl = controllerRef.current;
    controllerRef.current = null;
    if (ctrl) {
      await ctrl.stop();
    }
    setRunning(false);
    setConnecting(false);
    setHasFirstFrame(false);
    setWebrtcStatus(null);
  }, []);

  const {
    connected: voiceConnected, connecting: voiceConnecting, micMuted, setMicMuted,
    transcripts: voiceTranscripts, stop: stopVoiceChat, start: startVoiceChat,
    appendTranscript: appendVoiceTranscript,
  } = useLiveSession({
    mode: "world", persona: selectedPersonaId, worldContext: worldPrompt,
    onError: setErrorMsg,
    getFrameElement: () => {
      if (worldEngine === "3d" && threeCanvasRef.current?.width) return threeCanvasRef.current;
      if (running && genieVideoRef.current && genieVideoRef.current.readyState >= 2) return genieVideoRef.current;
      if (seedImgRef.current?.complete) return seedImgRef.current;
      return null;
    },
    onMessage: (message) => {
      if (message.type !== "steerWorld") return;
      appendVoiceTranscript("system", `Steered world: ${message.event}`);
      setExternalWorldEvent({ id: Date.now(), text: message.event });
      void controllerRef.current?.steerWorld(message.event);
    },
  });

  const handleToggleVoiceChat = () => {
    if (voiceConnected || voiceConnecting) stopVoiceChat();
    else void startVoiceChat();
  };

  // Attach selfie MediaStream reliably after booth <video> mounts
  useEffect(() => {
    if (!cameraBoothOpen) return;
    const videoEl = selfieVideoRef.current;
    const stream = selfieStreamRef.current;
    if (!videoEl || !stream) return;
    if (videoEl.srcObject !== stream) {
      videoEl.srcObject = stream;
    }
    void videoEl.play().catch(() => {
      // Handled via onLoadedMetadata retry
    });
  }, [cameraBoothOpen]);

  // Warn if Genie 4 WebRTC stays black without receiving first video frames
  useEffect(() => {
    if (!running || hasFirstFrame) return;
    const timer = window.setTimeout(() => {
      setErrorMsg((prev) =>
        prev ??
        "Genie 4 connected, but no video frames have arrived yet. If the screen stays black, your network or browser may be blocking WebRTC UDP media tracks."
      );
    }, 12000);
    return () => window.clearTimeout(timer);
  }, [running, hasFirstFrame]);

  // Countdown timer for Genie 4's 120s max session cap
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  // Teardown cleanly on unmount
  useEffect(() => {
    return () => {
      stopSelfieBooth();
      void stopVoiceChat();
      void stopWorld();
    };
  }, [stopSelfieBooth, stopVoiceChat, stopWorld]);

  // Keyboard WASD / Arrow steering when world is running
  useEffect(() => {
    if (!running) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      ) {
        return;
      }
      const mapped = KEY_MAP[e.key] ?? KEY_MAP[e.key.toLowerCase()];
      if (!mapped || e.repeat) return;
      e.preventDefault();
      if (!pressedKeysRef.current.has(mapped)) {
        pressedKeysRef.current.add(mapped);
        void controllerRef.current?.sendKey("key_down", mapped);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const mapped = KEY_MAP[e.key] ?? KEY_MAP[e.key.toLowerCase()];
      if (!mapped) return;
      if (pressedKeysRef.current.has(mapped)) {
        pressedKeysRef.current.delete(mapped);
        void controllerRef.current?.sendKey("key_up", mapped);
      }
    };

    const handleBlur = () => {
      for (const k of pressedKeysRef.current) {
        void controllerRef.current?.sendKey("key_up", k);
      }
      pressedKeysRef.current.clear();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [running]);

  const handleOpenSelfieBooth = async () => {
    if (running) return;
    setErrorMsg(null);
    stopSelfieBooth();

    // Reuse active Live Vision MediaStream if available so the webcam never locks
    const existingEl = getCameraElement();
    if (
      existingEl instanceof HTMLVideoElement &&
      existingEl.srcObject instanceof MediaStream &&
      existingEl.srcObject.getVideoTracks().some((t) => t.readyState === "live")
    ) {
      selfieStreamRef.current = existingEl.srcObject;
      selfieStreamIsSharedRef.current = true;
      setCameraBoothOpen(true);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMsg(
        "Camera capture is unavailable in this browser context. Upload a photo instead."
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      selfieStreamRef.current = stream;
      selfieStreamIsSharedRef.current = false;
      setCameraBoothOpen(true);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Could not open camera for selfie capture. You can upload a photo instead."
      );
    }
  };

  const applyCapturedPhoto = async (
    base64: string,
    mimeType: string,
    previewUrl: string,
    alsoSetRawSeed = false
  ) => {
    setSelfieBase64(base64);
    setSelfieMimeType(mimeType);
    setSelfiePreviewUrl(previewUrl);
    setTransformedImageUrl(null);
    setTransformLatencyMs(null);

    if (alsoSetRawSeed) {
      try {
        const compressed = await compressImageUrlForGenie(previewUrl);
        setSeedBase64(compressed.base64);
        setSeedPreviewUrl(compressed.dataUrl);
        setSeedBytes(compressed.approxBytes);
      } catch {
        // Keep raw photo without compressed seed if decode fails
      }
    }
  };

  const handleSnapFromBooth = async () => {
    const el = selfieVideoRef.current;
    if (!el || el.readyState < 2) {
      setErrorMsg("Camera preview is still initializing. Try again in a moment.");
      return;
    }
    const frame = captureMediaFrame(el, 960, 0.9);
    if (!frame) {
      setErrorMsg("Unable to capture photo from camera.");
      return;
    }
    const previewUrl = `data:image/jpeg;base64,${frame.base64}`;
    stopSelfieBooth();
    await applyCapturedPhoto(frame.base64, "image/jpeg", previewUrl, false);
  };

  const handleCaptureFromActiveFeed = async () => {
    setErrorMsg(null);
    const el = getCameraElement();
    if (!el) {
      setErrorMsg(
        "No active Live Vision feed found. Use Take photo or Upload photo instead."
      );
      return;
    }
    const frame = captureMediaFrame(el, 960, 0.9);
    if (!frame) {
      setErrorMsg("Unable to capture a frame from the active feed.");
      return;
    }
    const previewUrl = `data:image/jpeg;base64,${frame.base64}`;
    await applyCapturedPhoto(frame.base64, "image/jpeg", previewUrl, false);
  };

  const handleUploadPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErrorMsg(null);
    stopSelfieBooth();

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : null;
      if (!dataUrl) return;
      const mimeMatch = dataUrl.match(/^data:([^;]+);base64,/);
      const mimeType = mimeMatch?.[1] ?? (file.type || "image/jpeg");
      const base64 = dataUrl.replace(/^data:[^;]+;base64,/, "");
      await applyCapturedPhoto(base64, mimeType, dataUrl, false);
    };
    reader.readAsDataURL(file);
  };

  const handleTransformIntoCharacter = async () => {
    if (!selfieBase64 || isTransforming || running) return;
    setErrorMsg(null);
    setIsTransforming(true);

    try {
      const res = await fetch("/api/character-world/transform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: selfieBase64,
          mimeType: selfieMimeType,
          characterPrompt,
          personaId:
            selectedPersonaId === "none" ? undefined : selectedPersonaId,
        }),
      });
      const raw = await res.text();
      let data: {
        imageDataUrl?: string;
        latencyMs?: number;
        error?: string;
      };
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(`Server returned invalid response (HTTP ${res.status}).`);
      }
      if (!res.ok || !data.imageDataUrl) {
        throw new Error(
          data.error || "Failed to transform photo into character world."
        );
      }

      setTransformedImageUrl(data.imageDataUrl);
      setTransformLatencyMs(
        typeof data.latencyMs === "number" ? data.latencyMs : null
      );

      // Compress the generated 16:9 character scene under 42 KB for Genie 4 WebRTC
      const genieSeed = await compressImageUrlForGenie(data.imageDataUrl);
      setSeedPreviewUrl(genieSeed.dataUrl);
      setSeedBase64(genieSeed.base64);
      setSeedBytes(genieSeed.approxBytes);

      // Tailor worldPrompt for smooth playable continuation from this frame
      const persona = HISTORICAL_PERSONAS.find(
        (p) => p.id === selectedPersonaId
      );
      if (selectedPersonaId === "none" && characterPrompt.trim()) {
        setWorldPrompt(
          `Continuous smooth camera following the character walking steadily forward through their world (${characterPrompt.trim()}), responsive environmental depth, natural footsteps and ambient atmosphere, no sudden camera cuts.`
        );
      } else if (persona) {
        setWorldPrompt(persona.geniePrompt);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Could not transform photo into a character."
      );
    } finally {
      setIsTransforming(false);
    }
  };

  const handleUseRawSeed = () => {
    setErrorMsg(null);
    const el = getCameraElement();
    if (el) {
      const seed = captureGenieSeedFrame(el);
      if (seed) {
        setSeedPreviewUrl(seed.dataUrl);
        setSeedBase64(seed.base64);
        setSeedBytes(seed.approxBytes);
        return;
      }
    }
    if (selfiePreviewUrl) {
      void compressImageUrlForGenie(selfiePreviewUrl).then((seed) => {
        setSeedPreviewUrl(seed.dataUrl);
        setSeedBase64(seed.base64);
        setSeedBytes(seed.approxBytes);
      });
    }
  };

  const handleLaunchWorld = useCallback(
    async (overrideSeedBase64?: string, overridePrompt?: string) => {
      if (running || connecting) return;
      if (!genieVideoRef.current) return;

      const activePrompt = (overridePrompt ?? worldPrompt).trim();
      const activeSeed = overrideSeedBase64 ?? seedBase64;
      if (!activePrompt) return;

      stopSelfieBooth();
      setErrorMsg(null);
      setHasFirstFrame(false);
      setWebrtcStatus("Creating Genie 4 session...");
      setConnecting(true);
      setSecondsLeft(120);

      try {
        const res = await fetch("/api/genie/session", { method: "POST" });
        const raw = await res.text();
        let data: { interactionId?: string; authToken?: string; error?: string };
        try {
          data = JSON.parse(raw);
        } catch {
          throw new Error(`Server returned invalid response (HTTP ${res.status}).`);
        }
        if (!res.ok || !data.interactionId || !data.authToken) {
          throw new Error(data.error || "Failed to initialize Genie 4 session.");
        }

        setWebrtcStatus("Negotiating WebRTC...");
        const controller = await startGenieWorld({
          videoEl: genieVideoRef.current,
          audioEl: genieAudioRef.current,
          interactionId: data.interactionId,
          authToken: data.authToken,
          worldPrompt: activePrompt,
          referenceImageBase64: activeSeed,
          onStatusChange: (status) => setWebrtcStatus(status),
          onError: (msg) => {
            setErrorMsg(msg);
            setRunning(false);
            setConnecting(false);
            setHasFirstFrame(false);
          },
          onEnded: () => {
            setRunning(false);
            setConnecting(false);
            setHasFirstFrame(false);
          },
        });

        controllerRef.current = controller;
        setRunning(true);
        setConnecting(false);
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : "Could not launch Genie 4 world."
        );
        setRunning(false);
        setConnecting(false);
        setHasFirstFrame(false);
      }
    },
    [connecting, running, seedBase64, stopSelfieBooth, worldPrompt]
  );

  useEffect(() => {
    if (
      worldEngine === "genie" &&
      pendingGenieLaunchRef.current &&
      genieVideoRef.current &&
      !running &&
      !connecting
    ) {
      const pending = pendingGenieLaunchRef.current;
      pendingGenieLaunchRef.current = null;
      void handleLaunchWorld(pending.seedBase64, pending.prompt);
    }
  }, [connecting, handleLaunchWorld, running, worldEngine]);

  const handleGenerateLowPolyScene = async () => {
    const promptText = sceneBuilderPrompt.trim();
    if (!promptText || isGeneratingScene) return;
    setErrorMsg(null);
    setIsGeneratingScene(true);

    try {
      const res = await fetch("/api/world/generate-scene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenePrompt: promptText,
          personaId: selectedPersonaId === "none" ? undefined : selectedPersonaId,
        }),
      });
      const raw = await res.text();
      let data: LowPolySceneBlueprint & { error?: string };
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(`Server returned invalid response (HTTP ${res.status}).`);
      }
      if (!res.ok || !Array.isArray(data.objects)) {
        throw new Error(data.error || "Gemini 4 failed to build 3D scene.");
      }

      setCustomSceneBlueprint(data);
      setActiveEnvTheme("custom");
      setSceneLatencyMs(typeof data.latencyMs === "number" ? data.latencyMs : null);
      if (data.atmosphereDescription) {
        setWorldPrompt(
          `Continue walking forward through this scene (${data.atmosphereDescription}), smooth camera following the character, responsive lighting and living atmosphere.`
        );
      }
      setWorldEngine("3d");
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Could not generate 3D low-poly scene with Gemini 4."
      );
    } finally {
      setIsGeneratingScene(false);
    }
  };

  const handleSpawnLowPolyObject = async () => {
    const promptText = spawnPropPrompt.trim();
    if (!promptText || isSpawningProp) return;
    setErrorMsg(null);
    setIsSpawningProp(true);

    try {
      const res = await fetch("/api/world/spawn-object", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectPrompt: promptText,
          x: 0,
          z: 0,
          worldTheme: customSceneBlueprint?.sceneName ?? sceneBuilderPrompt,
        }),
      });
      const raw = await res.text();
      let data: { object?: LowPolyObjectBlueprint; error?: string };
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(`Server returned invalid response (HTTP ${res.status}).`);
      }
      if (!res.ok || !data.object) {
        throw new Error(data.error || "Gemini 4 failed to construct 3D object.");
      }
      setSpawnedObjectEvent({ id: Date.now(), object: data.object });
      setSpawnPropPrompt("");
      setWorldEngine("3d");
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Could not construct 3D prop with Gemini 4."
      );
    } finally {
      setIsSpawningProp(false);
    }
  };

  const handleStream3DSceneInGenie4 = async () => {
    const canvas = threeCanvasRef.current;
    if (!canvas || canvas.width === 0 || running || connecting) {
      setErrorMsg("3D scene canvas is not ready yet.");
      return;
    }
    setErrorMsg(null);
    try {
      const dataUrl = canvas.toDataURL("image/png");
      const compressed = await compressImageUrlForGenie(dataUrl);
      setSeedPreviewUrl(compressed.dataUrl);
      setSeedBase64(compressed.base64);
      setSeedBytes(compressed.approxBytes);

      const nextPrompt = customSceneBlueprint?.atmosphereDescription
        ? `Real-time playable continuation of this 3D world (${customSceneBlueprint.atmosphereDescription}), smooth third-person character walking forward through interactive courtyard props, rich lighting and physical depth.`
        : worldPrompt.trim();
      setWorldPrompt(nextPrompt);

      pendingGenieLaunchRef.current = {
        seedBase64: compressed.base64,
        prompt: nextPrompt,
      };
      setWorldEngine("genie");
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Failed to capture 3D scene for Genie 4."
      );
    }
  };

  const handleSteerSubmit = async (textToSend?: string) => {
    const text = (textToSend ?? steerInput).trim();
    if (!text) return;
    if (worldEngine === "3d") {
      if (!textToSend) setSteerInput("");
      setExternalWorldEvent({ id: Date.now(), text });
      return;
    }
    if (!running || !controllerRef.current) return;
    if (!textToSend) setSteerInput("");
    await controllerRef.current.steerWorld(text);
  };

  const triggerTouchKey = (
    action: "key_down" | "key_up",
    key: GenieMoveKey
  ) => {
    if (!running || !controllerRef.current) return;
    void controllerRef.current.sendKey(action, key);
  };

  const canSteerWorld = worldEngine === "3d" || running;

  const handleSelectEnvTheme = useCallback(
    (themeId: EnvironmentThemeId) => {
      setActiveEnvTheme(themeId);
      setSceneLatencyMs(null);
      if (themeId === "default") {
        setCustomSceneBlueprint(null);
        const persona = HISTORICAL_PERSONAS.find(
          (p) => p.id === selectedPersonaId
        );
        if (persona) {
          setWorldPrompt(persona.geniePrompt);
        }
      } else {
        const preset = ENVIRONMENT_THEME_PRESETS[themeId];
        setCustomSceneBlueprint(preset);
        setWorldPrompt(
          `Continue walking forward through ${preset.sceneName} (${preset.atmosphereDescription}), smooth camera following the character.`
        );
      }
    },
    [selectedPersonaId]
  );

  const handleResetCameraView = useCallback(() => {
    setCameraRotationDeg(0);
    setCameraPitchDeg(21);
    setCameraZoom(8.2);
  }, []);

  const zoomPercent = Math.round(((15.5 - cameraZoom) / (15.5 - 4.2)) * 100);

  return (
    <section className="world-workspace space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center bg-surface border border-slate-800 rounded-md p-0.5">
            <button
              type="button"
              onClick={() => {
                if (running) void stopWorld();
                setWorldEngine("3d");
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                worldEngine === "3d"
                  ? "bg-accent-500 text-slate-950"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              3D world
            </button>
            <button
              type="button"
              onClick={() => setWorldEngine("genie")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                worldEngine === "genie"
                  ? "bg-accent-500 text-slate-950"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              Generated video
            </button>
          </div>

        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 px-4 py-2.5 bg-[#1F1215] border border-rose-900/70 rounded-lg text-sm text-rose-200"
        >
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-xs font-medium text-rose-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-5 items-stretch">
        {/* 16:9 WebRTC World & Character Preview Viewport */}
        <div className="flex-1 min-w-0 flex flex-col bg-surface border border-slate-800 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between gap-4 px-4 py-2.5 border-b border-slate-800 bg-surface text-xs text-slate-400">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  worldEngine === "3d" && !cameraBoothOpen
                    ? "bg-emerald-500"
                    : running
                      ? "bg-emerald-500"
                      : cameraBoothOpen
                        ? "bg-accent-400"
                        : "bg-slate-600"
                }`}
              />
              <span className="font-medium text-slate-200 truncate">
                {cameraBoothOpen
                  ? "Selfie Booth Active"
                  : worldEngine === "3d"
                    ? "Explore the scene"
                    : running
                      ? "Video connected"
                      : connecting
                        ? "Connecting video…"
                        : transformedImageUrl
                          ? "Character World Seed Ready"
                          : selfiePreviewUrl
                            ? "Photo Captured · Ready to Transform"
                            : "Ready to generate"}
              </span>
              {transformLatencyMs !== null && !running && (
                <>
                  <span aria-hidden="true" className="text-slate-600">
                    ·
                  </span>
                  <span className="font-mono tabular-nums text-accent-400 whitespace-nowrap shrink-0">
                    {transformLatencyMs} ms
                  </span>
                </>
              )}
            </div>
            <span className="font-mono tabular-nums text-accent-400 whitespace-nowrap shrink-0">
              {worldEngine === "3d"
                ? "3D world"
                : running
                  ? `${secondsLeft}s remaining`
                  : "120s cap"}
            </span>
          </div>

          {worldEngine === "3d" && !cameraBoothOpen ? (
            <div className="relative w-full">
              <Interactive3DWorld
                personaId={selectedPersonaId}
                avatarImageUrl={transformedImageUrl ?? selfiePreviewUrl}
                onCanvasReady={(canvas) => {
                  threeCanvasRef.current = canvas;
                }}
                externalWorldEvent={externalWorldEvent}
                customSceneBlueprint={customSceneBlueprint}
                spawnedObjectEvent={spawnedObjectEvent}
                cameraRotationDeg={cameraRotationDeg}
                cameraPitchDeg={cameraPitchDeg}
                cameraZoom={cameraZoom}
                onCameraChange={(cam) => {
                  setCameraRotationDeg(cam.rotationDeg);
                  setCameraPitchDeg(cam.pitchDeg);
                  setCameraZoom(cam.zoom);
                }}
              />

            </div>
          ) : (
          <div className="relative w-full aspect-video bg-canvas flex items-center justify-center overflow-hidden">
            {/* Separate WebRTC audio element so muted video never gets autoplay-blocked */}
            <audio
              ref={genieAudioRef}
              autoPlay
              muted={worldAudioMuted}
              className="hidden"
            />

            {/* Active Genie 4 WebRTC Video (always muted so video frames always paint) */}
            <video
              ref={genieVideoRef}
              autoPlay
              playsInline
              muted
              onLoadedData={(e) => {
                if (e.currentTarget.videoWidth > 0) setHasFirstFrame(true);
                void e.currentTarget.play().catch(() => {});
              }}
              onPlaying={(e) => {
                if (e.currentTarget.videoWidth > 0) setHasFirstFrame(true);
              }}
              className={`w-full h-full object-contain ${
                running ? "block" : "hidden"
              }`}
            />

            {/* Warm-up overlay while waiting for Genie 4's initial WebRTC frames */}
            {running && !hasFirstFrame && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-canvas/90 px-6 text-center">
                {(transformedImageUrl || seedPreviewUrl) && (
                  <img
                    src={transformedImageUrl ?? seedPreviewUrl ?? ""}
                    alt="World seed warming up"
                    referrerPolicy="no-referrer"
                    className="w-72 aspect-video object-cover rounded-md border border-slate-700 opacity-75 mb-4"
                  />
                )}
                <div className="inline-flex items-center gap-2 text-sm font-medium text-slate-100">
                  <Loader2 className="w-4 h-4 animate-spin text-accent-400" />
                  Receiving live frames from Genie 4...
                </div>
                {webrtcStatus && (
                  <div className="mt-1 text-xs font-mono text-slate-400">
                    {webrtcStatus}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (genieVideoRef.current) {
                      void genieVideoRef.current.play().catch(() => {});
                    }
                    if (genieAudioRef.current && !worldAudioMuted) {
                      void genieAudioRef.current.play().catch(() => {});
                    }
                  }}
                  className="mt-3 px-3 py-1.5 text-xs font-medium bg-elevated hover:bg-slate-800 text-accent-300 border border-slate-700 rounded-md cursor-pointer"
                >
                  Resume Playback
                </button>
              </div>
            )}

            {/* Inline Selfie Booth Camera */}
            {!running && cameraBoothOpen && (
              <div className="relative w-full h-full flex items-center justify-center">
                <video
                  ref={selfieVideoRef}
                  autoPlay
                  playsInline
                  muted
                  onLoadedMetadata={(e) => {
                    void e.currentTarget.play().catch(() => {});
                  }}
                  className="w-full h-full object-contain -scale-x-100"
                />
                <div className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => void handleSnapFromBooth()}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-accent-500 hover:bg-accent-400 text-slate-950 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    Snap Photo
                  </button>
                  <button
                    type="button"
                    onClick={stopSelfieBooth}
                    className="px-3.5 py-2 text-xs font-medium bg-surface/90 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Character World Transformation Preview or Standby */}
            {!running && !cameraBoothOpen && (
              <>
                {transformedImageUrl ? (
                  <div className="relative w-full h-full">
                    <img
                      ref={seedImgRef}
                      src={transformedImageUrl}
                      alt="Generated character world seed"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain"
                    />
                    {selfiePreviewUrl && (
                      <div className="absolute top-3 left-3 p-1 bg-canvas/90 border border-slate-700 rounded-md">
                        <img
                          src={selfiePreviewUrl}
                          alt="Original photo"
                          referrerPolicy="no-referrer"
                          className="w-24 aspect-video object-cover rounded"
                        />
                        <div className="mt-1 text-[10px] font-mono text-slate-300 text-center">
                          Your Photo
                        </div>
                      </div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-4 pt-8 pb-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs text-slate-200">
                        <span className="font-medium text-accent-300">
                          Character World Seed Ready
                        </span>
                        {seedBytes !== null && (
                          <span className="text-slate-400 font-mono ml-2">
                            {Math.round(seedBytes / 1024)} KB WebRTC seed
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={connecting || !worldPrompt.trim()}
                        onClick={() => void handleLaunchWorld()}
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-accent-500 hover:bg-accent-400 text-slate-950 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                      >
                        <Play className="w-3.5 h-3.5" />
                        {connecting
                          ? "Connecting..."
                          : "Enter Interactive World"}
                      </button>
                    </div>
                  </div>
                ) : selfiePreviewUrl ? (
                  <div className="relative w-full h-full">
                    <img
                      ref={seedImgRef}
                      src={selfiePreviewUrl}
                      alt="Captured user photo"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pt-10 pb-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs text-slate-200 max-w-md">
                        <div className="font-medium text-slate-100">
                          Photo Captured
                        </div>
                        <div className="text-slate-400 mt-0.5">
                          Choose a character world on the right and click
                          Transform Me into Character, or launch directly.
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={isTransforming}
                          onClick={() => void handleTransformIntoCharacter()}
                          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-accent-500 hover:bg-accent-400 text-slate-950 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                        >
                          {isTransforming ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                          {isTransforming
                            ? "Transforming..."
                            : "Transform Me into Character"}
                        </button>
                        <button
                          type="button"
                          disabled={isTransforming}
                          onClick={handleUseRawSeed}
                          className="px-3 py-2 text-xs font-medium bg-elevated hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
                        >
                          Use Raw Seed
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center px-6 py-8 max-w-lg">
                    {seedPreviewUrl ? (
                      <img
                        src={seedPreviewUrl}
                        alt="Seed frame for Genie 4"
                        referrerPolicy="no-referrer"
                        className="w-64 aspect-video object-cover rounded-md border border-slate-700 mb-4"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-elevated border border-slate-800 flex items-center justify-center mb-4 text-accent-400">
                        <Globe className="w-6 h-6" />
                      </div>
                    )}
                    <h2 className="text-base font-semibold text-slate-100 mb-1.5">
                      {connecting
                        ? "Starting Genie 4 Simulation..."
                        : "Turn Yourself Into a Playable World"}
                    </h2>
                    <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                      Take a quick photo of yourself in the beginning, let
                      Gemini transform you and your room into a character world,
                      then walk inside it live with Genie 4.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => void handleOpenSelfieBooth()}
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-accent-500 hover:bg-accent-400 text-slate-950 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        Take photo of Me
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-elevated hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <ImagePlus className="w-3.5 h-3.5" />
                        Upload photo
                      </button>
                      <button
                        type="button"
                        disabled={connecting || !worldPrompt.trim()}
                        onClick={() => void handleLaunchWorld()}
                        className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-elevated hover:bg-slate-800 text-accent-300 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                      >
                        <Play className="w-3.5 h-3.5" />
                        {connecting ? "Connecting..." : "Launch Text World"}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          )}

          {/* Bottom Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-800 bg-surface">
            <div className="flex flex-wrap items-center gap-2">
              {worldEngine === "3d" && !cameraBoothOpen && (
                <button
                  type="button"
                  disabled={running || connecting}
                  onClick={() => void handleStream3DSceneInGenie4()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-accent-500 hover:bg-accent-400 text-slate-950 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                >
                  <Video className="w-3.5 h-3.5" />
                  Animate this world
                </button>
              )}

              {worldEngine === "genie" && (
                !running ? (
                  <button
                    type="button"
                    disabled={connecting || !worldPrompt.trim()}
                    onClick={() => void handleLaunchWorld()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-accent-500 hover:bg-accent-400 text-slate-950 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5" />
                    {connecting ? "Connecting..." : "Launch World"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void stopWorld()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5" />
                    Stop World
                  </button>
                )
              )}

              <button
                type="button"
                onClick={handleToggleVoiceChat}
                disabled={voiceConnecting}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 ${
                  voiceConnected
                    ? "bg-rose-500/15 border-rose-500/50 text-rose-300 hover:bg-rose-500/25"
                    : "bg-accent-500/15 border-accent-500/50 text-accent-300 hover:bg-accent-500/25"
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                {voiceConnecting
                  ? "Connecting Voice..."
                  : voiceConnected
                    ? "End Voice"
                    : "Talk to the world"}
              </button>

              {voiceConnected && (
                <button
                  type="button"
                  onClick={() => setMicMuted((m) => !m)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    micMuted
                      ? "bg-amber-500/15 border-amber-500/50 text-amber-300"
                      : "bg-elevated border-slate-700 text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  {micMuted ? (
                    <MicOff className="w-3.5 h-3.5" />
                  ) : (
                    <Mic className="w-3.5 h-3.5" />
                  )}
                  {micMuted ? "Mic Muted" : "Mic On"}
                </button>
              )}

              {running && (
                <button
                  type="button"
                  onClick={() => setWorldAudioMuted((m) => !m)}
                  title={
                    worldAudioMuted
                      ? "Unmute ambient Genie 4 world audio"
                      : "Mute ambient Genie 4 world audio"
                  }
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-elevated hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {worldAudioMuted ? (
                    <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-accent-400" />
                  )}
                  {worldAudioMuted ? "World Muted" : "World Audio"}
                </button>
              )}

              <span className="text-xs text-slate-400">
                {worldEngine === "3d"
                  ? "WASD / Arrows move · Space jump · Drag orbit · Click or [E] interact"
                  : (
                    <>
                      Move with <span className="font-mono text-slate-200">WASD</span>{" "}
                      or <span className="font-mono text-slate-200">Arrow keys</span>
                    </>
                  )}
              </span>
            </div>

            {/* Interactive Touch / Click D-Pad for Genie 4 WebRTC */}
            {worldEngine === "genie" && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={!running}
                  aria-label="Turn left"
                  onPointerDown={() => triggerTouchKey("key_down", "arrow_left")}
                  onPointerUp={() => triggerTouchKey("key_up", "arrow_left")}
                  onPointerLeave={() => triggerTouchKey("key_up", "arrow_left")}
                  className="p-1.5 bg-elevated hover:bg-slate-800 text-slate-200 border border-slate-700 rounded cursor-pointer disabled:opacity-40"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={!running}
                  aria-label="Move forward"
                  onPointerDown={() => triggerTouchKey("key_down", "key_w")}
                  onPointerUp={() => triggerTouchKey("key_up", "key_w")}
                  onPointerLeave={() => triggerTouchKey("key_up", "key_w")}
                  className="p-1.5 bg-elevated hover:bg-slate-800 text-slate-200 border border-slate-700 rounded cursor-pointer disabled:opacity-40"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={!running}
                  aria-label="Move backward"
                  onPointerDown={() => triggerTouchKey("key_down", "key_s")}
                  onPointerUp={() => triggerTouchKey("key_up", "key_s")}
                  onPointerLeave={() => triggerTouchKey("key_up", "key_s")}
                  className="p-1.5 bg-elevated hover:bg-slate-800 text-slate-200 border border-slate-700 rounded cursor-pointer disabled:opacity-40"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={!running}
                  aria-label="Turn right"
                  onPointerDown={() => triggerTouchKey("key_down", "arrow_right")}
                  onPointerUp={() => triggerTouchKey("key_up", "arrow_right")}
                  onPointerLeave={() => triggerTouchKey("key_up", "arrow_right")}
                  className="p-1.5 bg-elevated hover:bg-slate-800 text-slate-200 border border-slate-700 rounded cursor-pointer disabled:opacity-40"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Controls: Create a world, Avatar Transform & World Steering */}
        <aside className="w-full lg:w-[390px] shrink-0 bg-surface border border-slate-800 rounded-lg p-4 space-y-4">
          {worldEngine === '3d' && <>              {/* Scene settings */}
              <div className="w-full bg-canvas/92 border border-slate-700/90 rounded-lg shadow-lg text-xs">
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-800">
                  <div className="flex items-center gap-1.5 font-medium text-slate-100">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-accent-400" />
                    <span>Scene settings</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleResetCameraView}
                      title="Reset camera angle and zoom"
                      className="min-w-11 min-h-11 flex items-center justify-center text-slate-400 hover:text-accent-300 rounded cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setFloatingControlsOpen((o) => !o)}
                      aria-expanded={floatingControlsOpen}
                      aria-label={
                        floatingControlsOpen
                          ? "Collapse scene controls"
                          : "Expand scene controls"
                      }
                      className="min-w-11 min-h-11 flex items-center justify-center text-slate-400 hover:text-slate-100 rounded cursor-pointer"
                    >
                      {floatingControlsOpen ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {floatingControlsOpen && (
                  <div className="p-3 space-y-3">
                    {/* Low-Poly Environment Theme Selector */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-medium text-slate-300">
                          Environment Theme
                        </span>
                        {activeEnvTheme === "custom" && (
                          <span className="text-[10px] font-mono text-accent-400">
                            Gemini 4
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {ENVIRONMENT_THEME_OPTIONS.map((theme) => {
                          const isSelected = activeEnvTheme === theme.id;
                          return (
                            <button
                              key={theme.id}
                              type="button"
                              onClick={() => handleSelectEnvTheme(theme.id)}
                              className={`text-left px-2 py-1.5 rounded border transition-colors cursor-pointer ${
                                isSelected
                                  ? "bg-accent-500/20 border-accent-500/70 text-accent-100"
                                  : "bg-surface border-slate-800 text-slate-300 hover:bg-elevated"
                              }`}
                            >
                              <div className="text-[11px] font-medium leading-tight">
                                {theme.label}
                              </div>
                              <div className="text-[10px] text-slate-400 leading-tight">
                                {theme.subtitle}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Camera Rotation / Tilt / Zoom Sliders */}
                    <div className="space-y-2 pt-2 border-t border-slate-800">
                      <div>
                        <div className="flex items-center justify-between text-[11px] mb-0.5">
                          <label
                            htmlFor="scene-rotation-slider"
                            className="text-slate-300"
                          >
                            Rotation
                          </label>
                          <span className="font-mono tabular-nums text-accent-400">
                            {cameraRotationDeg}°
                          </span>
                        </div>
                        <input
                          id="scene-rotation-slider"
                          type="range"
                          min={-180}
                          max={180}
                          step={1}
                          value={cameraRotationDeg}
                          onChange={(e) =>
                            setCameraRotationDeg(Number(e.target.value))
                          }
                          className="w-full h-1.5 accent-accent-400 cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[11px] mb-0.5">
                          <label
                            htmlFor="scene-pitch-slider"
                            className="text-slate-300"
                          >
                            Camera Tilt
                          </label>
                          <span className="font-mono tabular-nums text-accent-400">
                            {cameraPitchDeg}°
                          </span>
                        </div>
                        <input
                          id="scene-pitch-slider"
                          type="range"
                          min={10}
                          max={68}
                          step={1}
                          value={cameraPitchDeg}
                          onChange={(e) =>
                            setCameraPitchDeg(Number(e.target.value))
                          }
                          className="w-full h-1.5 accent-accent-400 cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[11px] mb-0.5">
                          <label
                            htmlFor="scene-zoom-slider"
                            className="text-slate-300"
                          >
                            Zoom
                          </label>
                          <span className="font-mono tabular-nums text-accent-400">
                            {zoomPercent}%
                          </span>
                        </div>
                        <input
                          id="scene-zoom-slider"
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={zoomPercent}
                          onChange={(e) => {
                            const pct = Number(e.target.value);
                            const dist = 15.5 - (pct / 100) * (15.5 - 4.2);
                            setCameraZoom(Number(dist.toFixed(1)));
                          }}
                          className="w-full h-1.5 accent-accent-400 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
</>}

          <div className="space-y-2.5 pb-3 border-b border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                <Wand2 className="w-3.5 h-3.5 text-accent-400" />
                Create a world
              </h2>
              <div className="flex items-center gap-2">
                {sceneLatencyMs !== null && (
                  <span className="text-[11px] font-mono text-accent-400">
                    {sceneLatencyMs} ms
                  </span>
                )}
                {customSceneBlueprint && (
                  <button
                    type="button"
                    onClick={() => handleSelectEnvTheme("default")}
                    className="text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    Default Plaza
                  </button>
                )}
              </div>
            </div>

            <textarea
              rows={2}
              aria-label="Describe a world"
              disabled={isGeneratingScene || running}
              value={sceneBuilderPrompt}
              onChange={(e) => setSceneBuilderPrompt(e.target.value)}
              placeholder="Describe a place and time to explore…"
              className="w-full px-3 py-1.5 text-xs bg-elevated text-slate-100 border border-slate-700 rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-500 disabled:opacity-60"
            />
            <button
              type="button"
              disabled={!sceneBuilderPrompt.trim() || isGeneratingScene || running}
              onClick={() => void handleGenerateLowPolyScene()}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium bg-accent-500 hover:bg-accent-400 text-slate-950 rounded-md transition-colors cursor-pointer disabled:opacity-40"
            >
              {isGeneratingScene ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Wand2 className="w-3.5 h-3.5" />
              )}
              {isGeneratingScene
                ? "Creating world…"
                : "Generate world"}
            </button>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSpawnLowPolyObject();
              }}
              className="flex items-center gap-1.5"
            >
              <input
                type="text"
                disabled={isSpawningProp || running}
                aria-label="Object to add"
                value={spawnPropPrompt}
                onChange={(e) => setSpawnPropPrompt(e.target.value)}
                placeholder="Add an object, e.g. a clockwork robot"
                className="flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-elevated text-slate-100 placeholder:text-slate-500 border border-slate-700 rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!spawnPropPrompt.trim() || isSpawningProp || running}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-elevated hover:bg-slate-800 text-accent-300 border border-slate-700 rounded-md cursor-pointer disabled:opacity-40 whitespace-nowrap"
              >
                {isSpawningProp ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                Spawn
              </button>
            </form>
          </div>

          <details className="ui-disclosure"><summary>Character & appearance</summary><div className="space-y-3">
<div className="flex flex-wrap gap-2">          <button
            type="button"
            onClick={() => void handleOpenSelfieBooth()}
            disabled={running}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-accent-500 hover:bg-accent-400 text-slate-950 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Camera className="w-3.5 h-3.5" />
            Take photo
          </button>
          {hasActiveCamera && (
            <button
              type="button"
              onClick={() => void handleCaptureFromActiveFeed()}
              disabled={running}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-elevated hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <UserCheck className="w-3.5 h-3.5" />
              Snap Active Feed
            </button>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={running}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-elevated hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ImagePlus className="w-3.5 h-3.5" />
            Upload photo
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleUploadPhoto}
            className="hidden"
          />
</div>
            <div className="flex items-center justify-between gap-2">
              {(selfiePreviewUrl || transformedImageUrl) && !running && (
                <button
                  type="button"
                  onClick={() => {
                    setSelfiePreviewUrl(null);
                    setSelfieBase64(null);
                    setTransformedImageUrl(null);
                    setTransformLatencyMs(null);
                    setSeedPreviewUrl(null);
                    setSeedBase64(undefined);
                    setSeedBytes(null);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Clear Photo
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {HISTORICAL_PERSONAS.map((persona) => {
                const active = selectedPersonaId === persona.id;
                return (
                  <button
                    key={persona.id}
                    type="button"
                    disabled={running}
                    onClick={() => {
                      setSelectedPersonaId(persona.id);
                      setWorldPrompt(persona.geniePrompt);
                    }}
                    className={`text-left px-2.5 py-2 rounded-md border text-xs transition-colors cursor-pointer disabled:opacity-50 ${
                      active
                        ? "bg-accent-500/10 border-accent-500/50 text-slate-100"
                        : "bg-surface border-slate-800 text-slate-300 hover:bg-elevated"
                    }`}
                  >
                    <div className="font-medium truncate">{persona.name}</div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {persona.era}
                    </div>
                  </button>
                );
              })}
              <button
                type="button"
                disabled={running}
                onClick={() => setSelectedPersonaId("none")}
                className={`text-left px-2.5 py-2 rounded-md border text-xs transition-colors cursor-pointer disabled:opacity-50 ${
                  selectedPersonaId === "none"
                    ? "bg-accent-500/10 border-accent-500/50 text-slate-100"
                    : "bg-surface border-slate-800 text-slate-300 hover:bg-elevated"
                }`}
              >
                <div className="font-medium truncate">Custom World</div>
                <div className="text-[11px] text-slate-400 truncate">
                  Any theme or era
                </div>
              </button>
            </div>

            <div>
              <label
                htmlFor="character-transform-prompt"
                className="block text-[11px] font-medium text-slate-400 mb-1"
              >
                Describe your character
              </label>
              <textarea
                id="character-transform-prompt"
                rows={2}
                disabled={running || isTransforming}
                value={characterPrompt}
                onChange={(e) => setCharacterPrompt(e.target.value)}
                placeholder="e.g., Turn me into a cyberpunk explorer in a neon alley modeled on my room"
                className="w-full px-3 py-1.5 text-xs bg-elevated text-slate-100 border border-slate-700 rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-500 disabled:opacity-60"
              />
            </div>

            <button
              type="button"
              disabled={!selfieBase64 || isTransforming || running}
              onClick={() => void handleTransformIntoCharacter()}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium bg-accent-500/15 hover:bg-accent-500/25 text-accent-300 border border-accent-500/50 rounded-md transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isTransforming ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {isTransforming
                ? "Generating Character World..."
                : transformedImageUrl
                  ? "Regenerate Character Seed"
                  : "Transform Me into Character"}
            </button>
          </div></details>

          {worldEngine === 'genie' && <div>
            <label
              htmlFor="genie-world-prompt"
              className="block text-xs font-medium text-slate-200 mb-1.5"
            >
              Describe the motion
            </label>
            <textarea
              id="genie-world-prompt"
              rows={3}
              disabled={running}
              value={worldPrompt}
              onChange={(e) => setWorldPrompt(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-elevated text-slate-100 border border-slate-700 rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-500 disabled:opacity-60"
            />
          </div>}

          {seedPreviewUrl && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 bg-surface border border-slate-800 rounded-md text-xs">
              <span className="text-slate-300">
                {transformedImageUrl ? "Character seed attached" : "Seed attached"}{" "}
                <span className="font-mono text-accent-400">
                  ({Math.round((seedBytes ?? 0) / 1024)} KB)
                </span>
              </span>
              <button
                type="button"
                disabled={running}
                onClick={() => {
                  setSeedPreviewUrl(null);
                  setSeedBase64(undefined);
                  setSeedBytes(null);
                }}
                className="text-rose-300 hover:text-rose-200 cursor-pointer disabled:opacity-40"
              >
                Remove
              </button>
            </div>
          )}

          <div className="pt-3 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-200">
                Guide the world
              </span>
              {voiceConnected && (
                <span className="text-[11px] font-mono text-emerald-400">
                  Live Voice Active
                </span>
              )}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSteerSubmit();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                disabled={!canSteerWorld}
                aria-label="Guide the world"
                value={steerInput}
                onChange={(e) => setSteerInput(e.target.value)}
                placeholder="Steer event (e.g., Torchlight flickers on)"
                className="flex-1 min-w-0 px-3 py-1.5 text-xs bg-elevated text-slate-100 placeholder:text-slate-500 border border-slate-700 rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-500 disabled:opacity-40"
              />
              <button
                type="submit"
                disabled={!canSteerWorld || !steerInput.trim()}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-elevated hover:bg-slate-800 text-accent-400 border border-slate-700 rounded-md cursor-pointer disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" />
                Steer
              </button>
            </form>
            <div className="flex flex-wrap gap-1.5">
              {[
                "Sudden rain falls on stone",
                "Torches ignite along walls",
                "Clear sunlit sky breaks through",
              ].map((impulse) => (
                <button
                  key={impulse}
                  type="button"
                  disabled={!canSteerWorld}
                  onClick={() => void handleSteerSubmit(impulse)}
                  className="px-2.5 py-1 text-[11px] bg-surface hover:bg-elevated text-slate-300 border border-slate-800 rounded cursor-pointer disabled:opacity-40"
                >
                  {impulse}
                </button>
              ))}
            </div>

            {voiceTranscripts.length > 0 && (
              <div className="mt-2 max-h-36 overflow-y-auto space-y-1.5 p-2.5 bg-canvas border border-slate-800 rounded-md text-xs">
                {voiceTranscripts.map((entry) => (
                  <div key={entry.id} className="leading-snug">
                    <span
                      className={`font-mono text-[10px] uppercase mr-1.5 ${
                        entry.speaker === "user"
                          ? "text-accent-400"
                          : entry.speaker === "gemini"
                            ? "text-emerald-400"
                            : "text-slate-400"
                      }`}
                    >
                      {entry.speaker === "user"
                        ? "You"
                        : entry.speaker === "gemini"
                          ? "World"
                          : "Sys"}
                    </span>
                    <span className="text-slate-200">{entry.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
};

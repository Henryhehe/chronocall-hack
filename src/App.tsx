import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CameraStage } from "./components/CameraStage";
import { CompareModesView } from "./components/CompareModesView";
import { DetectionLogView } from "./components/DetectionLogView";
import { GenieWorldView } from "./components/GenieWorldView";
import { InspectorPanel } from "./components/InspectorPanel";
import { getVisualFilterPreset } from "./components/VisualFilterSelector";
import {
  DetectionBox,
  DetectionFrameResult,
  FrameQaEntry,
  HistoricalPersonaId,
  InspectorTab,
  LiveTranscriptEntry,
  SourceMode,
  VisionModelId,
  VisualFilterId,
  WorkspaceView,
} from "./types/vision";
import { downsampleAndEncodePcm16, LiveAudioPlayer } from "./utils/audio";
import {
  captureMediaFrame,
  downloadAnnotatedSnapshot,
  getColorForLabel,
} from "./utils/canvas";

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

  // Media state
  const [sourceMode, setSourceMode] = useState<SourceMode>("camera");
  const [mediaActive, setMediaActive] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");

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
  const [liveConnected, setLiveConnected] = useState(false);
  const [liveConnecting, setLiveConnecting] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [transcripts, setTranscripts] = useState<LiveTranscriptEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Refs for stable access inside intervals, WebSocket, and audio callbacks
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const liveAudioPlayerRef = useRef<LiveAudioPlayer | null>(null);
  const liveWsRef = useRef<WebSocket | null>(null);
  const liveVideoTimerRef = useRef<number | null>(null);

  const isDetectingRef = useRef(false);
  const focusPromptRef = useRef(focusPrompt);
  const visionModelRef = useRef(visionModel);
  const workspaceViewRef = useRef(workspaceView);
  const characterPersonaRef = useRef(characterPersona);
  const micMutedRef = useRef(micMuted);
  const sourceModeRef = useRef(sourceMode);
  const mediaActiveRef = useRef(mediaActive);
  const uploadedImageUrlRef = useRef(uploadedImageUrl);
  const uploadedVideoUrlRef = useRef(uploadedVideoUrl);

  focusPromptRef.current = focusPrompt;
  visionModelRef.current = visionModel;
  workspaceViewRef.current = workspaceView;
  characterPersonaRef.current = characterPersona;
  micMutedRef.current = micMuted;
  sourceModeRef.current = sourceMode;
  mediaActiveRef.current = mediaActive;
  uploadedImageUrlRef.current = uploadedImageUrl;
  uploadedVideoUrlRef.current = uploadedVideoUrl;

  const getActiveMediaElement = useCallback(():
    | HTMLVideoElement
    | HTMLImageElement
    | null => {
    if (
      (mediaActiveRef.current || uploadedVideoUrlRef.current) &&
      videoRef.current &&
      videoRef.current.readyState >= 2
    ) {
      return videoRef.current;
    }
    if (uploadedImageUrlRef.current && imageRef.current?.complete) {
      return imageRef.current;
    }
    return null;
  }, []);

  const stopMediaTracks = useCallback(() => {
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        track.stop();
      }
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.removeAttribute("src");
    }
    setMediaActive(false);
    setAutoDetect(false);
  }, []);

  const revokeUploadedUrls = useCallback(() => {
    if (uploadedImageUrlRef.current) {
      URL.revokeObjectURL(uploadedImageUrlRef.current);
      setUploadedImageUrl(null);
    }
    if (uploadedVideoUrlRef.current) {
      URL.revokeObjectURL(uploadedVideoUrlRef.current);
      setUploadedVideoUrl(null);
    }
  }, []);

  const refreshCameraList = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === "videoinput");
      setCameras(videoInputs);
      if (videoInputs.length > 0 && !selectedCameraId) {
        setSelectedCameraId(videoInputs[0].deviceId);
      }
    } catch {
      // Ignore device enumeration errors if permission was not yet granted
    }
  }, [selectedCameraId]);

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

  const startCamera = useCallback(
    async (deviceId?: string) => {
      setErrorMessage(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setErrorMessage(
          "Camera access is unavailable in this browser context. You can use Upload Media instead."
        );
        return;
      }

      stopMediaTracks();
      revokeUploadedUrls();

      try {
        const targetId = deviceId ?? selectedCameraId;
        const stream = await navigator.mediaDevices.getUserMedia({
          video: targetId
            ? {
                deviceId: { exact: targetId },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              }
            : {
                facingMode: "environment",
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
          audio: false,
        });

        mediaStreamRef.current = stream;
        const trackSettings = stream.getVideoTracks()[0]?.getSettings();
        if (trackSettings?.deviceId) {
          setSelectedCameraId(trackSettings.deviceId);
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setSourceMode("camera");
        setMediaActive(true);
        setAutoDetect(true);
        await refreshCameraList();
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Could not access camera. Check browser permissions or upload media instead.";
        setErrorMessage(msg);
      }
    },
    [refreshCameraList, revokeUploadedUrls, selectedCameraId, stopMediaTracks]
  );

  const startScreenShare = useCallback(async () => {
    setErrorMessage(null);
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setErrorMessage("Screen sharing is not supported in this browser.");
      return;
    }

    stopMediaTracks();
    revokeUploadedUrls();

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      const [videoTrack] = stream.getVideoTracks();
      if (videoTrack) {
        videoTrack.onended = () => {
          stopMediaTracks();
        };
      }

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setSourceMode("screen");
      setMediaActive(true);
      setAutoDetect(true);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Screen share was canceled.";
      setErrorMessage(msg);
    }
  }, [revokeUploadedUrls, stopMediaTracks]);

  const handleUploadFile = useCallback(
    (file: File) => {
      setErrorMessage(null);
      stopMediaTracks();
      revokeUploadedUrls();
      setCurrentBoxes([]);
      setSelectedBoxId(null);

      const url = URL.createObjectURL(file);
      setSourceMode("image");

      if (file.type.startsWith("video/")) {
        setUploadedVideoUrl(url);
        if (videoRef.current) {
          videoRef.current.src = url;
          void videoRef.current.play();
        }
        setMediaActive(true);
        setAutoDetect(true);
      } else {
        setUploadedImageUrl(url);
        window.setTimeout(() => {
          void analyzeCurrentFrame();
        }, 180);
      }
    },
    [analyzeCurrentFrame, revokeUploadedUrls, stopMediaTracks]
  );

  const handleStopMedia = useCallback(() => {
    stopMediaTracks();
    revokeUploadedUrls();
    setCurrentBoxes([]);
    setSelectedBoxId(null);
    setLatestSummary("");
  }, [revokeUploadedUrls, stopMediaTracks]);

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

  // Append or merge streaming Live transcripts smoothly
  const appendTranscriptChunk = useCallback(
    (speaker: "user" | "gemini" | "system", chunk: string) => {
      if (!chunk) return;
      setTranscripts((prev) => {
        const last = prev[prev.length - 1];
        if (
          last &&
          last.speaker === speaker &&
          Date.now() - last.timestamp < 4000 &&
          speaker !== "system"
        ) {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...last,
            text: `${last.text}${chunk}`,
            timestamp: Date.now(),
          };
          return updated;
        }
        return [
          ...prev,
          {
            id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            speaker,
            text: chunk.trimStart(),
            timestamp: Date.now(),
          },
        ].slice(-80);
      });
    },
    []
  );

  const stopLiveSession = useCallback(async () => {
    if (liveVideoTimerRef.current !== null) {
      window.clearInterval(liveVideoTimerRef.current);
      liveVideoTimerRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }

    if (micStreamRef.current) {
      for (const t of micStreamRef.current.getTracks()) {
        t.stop();
      }
      micStreamRef.current = null;
    }

    if (
      inputAudioCtxRef.current &&
      inputAudioCtxRef.current.state !== "closed"
    ) {
      await inputAudioCtxRef.current.close();
      inputAudioCtxRef.current = null;
    }

    if (liveAudioPlayerRef.current) {
      await liveAudioPlayerRef.current.close();
      liveAudioPlayerRef.current = null;
    }

    if (liveWsRef.current) {
      liveWsRef.current.close();
      liveWsRef.current = null;
    }

    setLiveConnected(false);
    setLiveConnecting(false);
  }, []);

  const startLiveSession = useCallback(async () => {
    setErrorMessage(null);
    setLiveConnecting(true);
    setInspectorTab("transcript");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "Microphone access is unavailable in this browser context."
        );
      }

      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      micStreamRef.current = micStream;

      const inputCtx = new AudioContext({ sampleRate: 16000 });
      inputAudioCtxRef.current = inputCtx;
      const player = new LiveAudioPlayer();
      liveAudioPlayerRef.current = player;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/live`);
      liveWsRef.current = ws;

      ws.onopen = () => {
        setLiveConnected(true);
        setLiveConnecting(false);
        appendTranscriptChunk(
          "system",
          "Connected to Gemini Live (gemini-3.8-live). Speak naturally or send text while your camera streams."
        );

        const source = inputCtx.createMediaStreamSource(micStream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (micMutedRef.current) return;
          if (ws.readyState !== WebSocket.OPEN) return;
          const samples = e.inputBuffer.getChannelData(0);
          const base64 = downsampleAndEncodePcm16(
            samples,
            inputCtx.sampleRate,
            16000
          );
          ws.send(JSON.stringify({ type: "audio", data: base64 }));
        };

        source.connect(processor);
        processor.connect(inputCtx.destination);

        // Stream visual frames at 1 FPS maximum per Live API guidelines
        liveVideoTimerRef.current = window.setInterval(() => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const el = getActiveMediaElement();
          if (!el) return;
          const frame = captureMediaFrame(el, 768, 0.72);
          if (frame) {
            ws.send(JSON.stringify({ type: "video", data: frame.base64 }));
          }
        }, 1000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "audio" && typeof msg.data === "string") {
            player.enqueuePcm24kBase64(msg.data);
          } else if (msg.type === "interrupted") {
            player.interrupt();
          } else if (msg.type === "inputTranscript" && msg.text) {
            appendTranscriptChunk("user", msg.text);
          } else if (msg.type === "outputTranscript" && msg.text) {
            appendTranscriptChunk("gemini", msg.text);
          } else if (msg.type === "highlightObjects" && msg.args) {
            const rawObjs = Array.isArray(msg.args.objects)
              ? msg.args.objects
              : [];
            const mapped = mapRawObjectsToBoxes(rawObjs);
            const summary =
              typeof msg.args.summary === "string" && msg.args.summary
                ? msg.args.summary
                : `Gemini Live highlighted ${mapped.length} object${mapped.length === 1 ? "" : "s"}.`;
            setCurrentBoxes(mapped);
            setLatestSummary(summary);
            setHistory((prev) =>
              [
                {
                  frameId: `live-${Date.now()}`,
                  timestamp: Date.now(),
                  latencyMs: 0,
                  model: "gemini-3.8-live",
                  summary,
                  objects: mapped,
                  source: "live-tool" as const,
                },
                ...prev,
              ].slice(0, 100)
            );
          } else if (msg.type === "error" && msg.message) {
            setErrorMessage(msg.message);
          }
        } catch {
          // Ignore malformed control frames
        }
      };

      ws.onerror = () => {
        setErrorMessage("Live WebSocket connection encountered an error.");
      };

      ws.onclose = () => {
        void stopLiveSession();
      };
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Could not start Gemini Live Voice session.";
      setErrorMessage(msg);
      await stopLiveSession();
    }
  }, [
    appendTranscriptChunk,
    getActiveMediaElement,
    mapRawObjectsToBoxes,
    stopLiveSession,
  ]);

  const handleToggleLiveVoice = useCallback(() => {
    if (liveConnected || liveConnecting) {
      void stopLiveSession();
    } else {
      void startLiveSession();
    }
  }, [liveConnected, liveConnecting, startLiveSession, stopLiveSession]);

  const handleSubmitPrompt = useCallback(async () => {
    const question = promptText.trim();
    if (!question) return;

    if (liveConnected && liveWsRef.current?.readyState === WebSocket.OPEN) {
      liveWsRef.current.send(JSON.stringify({ type: "text", text: question }));
      appendTranscriptChunk("user", question);
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
  }, [appendTranscriptChunk, getActiveMediaElement, liveConnected, promptText]);

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

  useEffect(() => {
    void refreshCameraList();
    return () => {
      stopMediaTracks();
      revokeUploadedUrls();
      void stopLiveSession();
    };
  }, [refreshCameraList, revokeUploadedUrls, stopLiveSession, stopMediaTracks]);

  const isCameraStageView =
    workspaceView === "live" || workspaceView === "character";

  // Re-attach live MediaStream or uploaded video when CameraStage remounts after switching tabs
  useEffect(() => {
    if (!isCameraStageView) return;
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (mediaStreamRef.current) {
      if (videoEl.srcObject !== mediaStreamRef.current) {
        videoEl.srcObject = mediaStreamRef.current;
      }
      void videoEl.play().catch(() => {
        // Ignore autoplay interruption on tab switch
      });
    } else if (uploadedVideoUrl && videoEl.src !== uploadedVideoUrl) {
      videoEl.src = uploadedVideoUrl;
      void videoEl.play().catch(() => {
        // Ignore autoplay interruption on tab switch
      });
    }
  }, [isCameraStageView, mediaActive, uploadedVideoUrl]);

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

      {/* Main Content */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-6 py-5">
        {isCameraStageView && (
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
        )}

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

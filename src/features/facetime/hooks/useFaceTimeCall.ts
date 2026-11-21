import { useCallback, useEffect, useRef, useState } from "react";
import { downsampleAndEncodePcm16 } from "../../../utils/audio";
import { captureMediaFrame } from "../../../utils/canvas";
import type {
  CallTranscriptMessage,
  FaceTimePortalInvite,
  FaceTimeReactionCue,
  HistoricalProfile,
} from "../types";
import type { FaceTimeServerEvent } from "../../../../shared/facetime.ts";

interface ActiveCallSession {
  ws?: WebSocket;
  micStream?: MediaStream;
  inputCtx?: AudioContext;
  processor?: ScriptProcessorNode;
  outputCtx?: AudioContext;
  analyser?: AnalyserNode;
  activeSources: Set<AudioBufferSourceNode>;
  nextStartTime: number;
  videoTimer?: number;
  connectTimer?: number;
  demoSpeakTimer?: number;
}

interface UseFaceTimeCallOptions {
  demoMode: boolean;
  onReaction?: (cue: FaceTimeReactionCue) => void;
  onPortalInvite?: (portal: FaceTimePortalInvite) => void;
  onConnected?: () => void;
  onError?: (msg: string | null) => void;
}

function decodePcm24kToBuffer(
  ctx: AudioContext,
  base64: string
): AudioBuffer | null {
  const binary = atob(base64);
  const byteLength = binary.length;
  const sampleCount = Math.floor(byteLength / 2);
  if (sampleCount === 0) return null;

  const bytes = new Uint8Array(byteLength);
  for (let i = 0; i < byteLength; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const view = new DataView(bytes.buffer);
  const floatSamples = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    floatSamples[i] = view.getInt16(i * 2, true) / 32768;
  }

  const audioBuffer = ctx.createBuffer(1, sampleCount, 24000);
  audioBuffer.getChannelData(0).set(floatSamples);
  return audioBuffer;
}

function readAnalyserLevel(analyser?: AnalyserNode): number {
  if (!analyser) return 0;
  const bins = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteTimeDomainData(bins);
  let sumSq = 0;
  for (let i = 0; i < bins.length; i++) {
    const norm = (bins[i] - 128) / 128;
    sumSq += norm * norm;
  }
  const rms = Math.sqrt(sumSq / bins.length);
  return Math.min(1, rms * 3.8);
}

export function useFaceTimeCall(options: UseFaceTimeCallOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const sessionRef = useRef<ActiveCallSession | null>(null);
  const profileRef = useRef<HistoricalProfile | null>(null);
  const speechLevelRef = useRef<number>(0);
  const demoSpeechUntilRef = useRef<number>(0);

  // User self-view camera PiP state
  const userVideoRef = useRef<HTMLVideoElement | null>(null);
  const userCameraStreamRef = useRef<MediaStream | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const cameraEnabledRef = useRef(cameraEnabled);
  cameraEnabledRef.current = cameraEnabled;
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Call voice/connection state
  const [voiceStatus, setVoiceStatus] = useState<
    "idle" | "connecting" | "connected" | "demo" | "text-only"
  >("idle");
  const [micMuted, setMicMuted] = useState(false);
  const micMutedRef = useRef(micMuted);
  micMutedRef.current = micMuted;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSendingText, setIsSendingText] = useState(false);
  const [transcripts, setTranscripts] = useState<CallTranscriptMessage[]>([]);
  const [liveCaption, setLiveCaption] = useState<string>("");
  const [lastReaction, setLastReaction] = useState<FaceTimeReactionCue | null>(
    null
  );
  const [portalInvite, setPortalInvite] = useState<FaceTimePortalInvite | null>(
    null
  );

  // 60fps vocal energy loop driving the remote avatar's mouth/head/expression
  useEffect(() => {
    let mounted = true;
    let rafId = 0;
    const tick = () => {
      if (!mounted) return;
      const now = performance.now();
      const s = sessionRef.current;
      let energy = readAnalyserLevel(s?.analyser);
      let speaking = (s?.activeSources.size ?? 0) > 0 || energy > 0.04;

      if (!speaking && now < demoSpeechUntilRef.current) {
        // Gentle simulated vocal envelope in Demo Mode / text-reply mode
        energy =
          0.22 +
          0.26 * Math.abs(Math.sin(now * 0.011)) +
          0.14 * Math.abs(Math.sin(now * 0.023));
        speaking = true;
      }

      speechLevelRef.current = energy;
      setIsSpeaking((prev) => (prev === speaking ? prev : speaking));
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      cancelAnimationFrame(rafId);
    };
  }, []);

  const appendTranscript = useCallback(
    (speaker: CallTranscriptMessage["speaker"], text: string, streaming = false) => {
      const clean = text;
      if (!clean) return;
      setTranscripts((prev) => {
        const last = prev[prev.length - 1];
        if (
          streaming &&
          last &&
          last.speaker === speaker &&
          Date.now() - last.timestamp < 4500
        ) {
          const merged = `${last.text}${clean}`;
          if (speaker === "figure") setLiveCaption(merged);
          return [
            ...prev.slice(0, -1),
            { ...last, text: merged, timestamp: Date.now(), streaming: true },
          ];
        }
        const trimmed = clean.trimStart();
        if (speaker === "figure") setLiveCaption(trimmed);
        return [
          ...prev,
          {
            id: `${speaker}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            speaker,
            text: trimmed,
            timestamp: Date.now(),
            streaming,
          },
        ].slice(-80);
      });
    },
    []
  );

  const stopUserCamera = useCallback(() => {
    userCameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    userCameraStreamRef.current = null;
    if (userVideoRef.current) {
      userVideoRef.current.srcObject = null;
    }
    setCameraReady(false);
  }, []);

  const startUserCamera = useCallback(
    async (requestedFacing: "user" | "environment" = "user") => {
      stopUserCamera();
      setCameraError(null);
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera preview requires localhost or HTTPS.");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: requestedFacing,
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });
        userCameraStreamRef.current = stream;
        if (userVideoRef.current) {
          userVideoRef.current.srcObject = stream;
          await userVideoRef.current.play().catch(() => {});
        }
        setCameraReady(true);
        setCameraEnabled(true);
      } catch (err) {
        setCameraReady(false);
        setCameraEnabled(false);
        setCameraError(
          err instanceof Error ? err.message : "Camera unavailable."
        );
      }
    },
    [stopUserCamera]
  );

  // Re-attach user camera stream whenever the PiP <video> mounts
  const bindUserVideoRef = useCallback((el: HTMLVideoElement | null) => {
    userVideoRef.current = el;
    if (el && userCameraStreamRef.current && el.srcObject !== userCameraStreamRef.current) {
      el.srcObject = userCameraStreamRef.current;
      void el.play().catch(() => {});
    }
  }, []);

  const toggleCamera = useCallback(() => {
    if (cameraEnabledRef.current) {
      stopUserCamera();
      setCameraEnabled(false);
    } else {
      void startUserCamera(facingMode);
    }
  }, [facingMode, startUserCamera, stopUserCamera]);

  const flipCamera = useCallback(() => {
    const next = facingMode === "user" ? "environment" : "user";
    setFacingMode(next);
    if (cameraEnabledRef.current) {
      void startUserCamera(next);
    }
  }, [facingMode, startUserCamera]);

  const stopCall = useCallback(() => {
    const s = sessionRef.current;
    sessionRef.current = null; // Synchronous detach prevents stale callbacks
    demoSpeechUntilRef.current = 0;
    speechLevelRef.current = 0;
    setVoiceStatus("idle");
    setIsSpeaking(false);
    setLiveCaption("");
    setLastReaction(null);
    setPortalInvite(null);
    stopUserCamera();

    if (!s) return;
    if (s.videoTimer) window.clearInterval(s.videoTimer);
    if (s.connectTimer) window.clearTimeout(s.connectTimer);
    if (s.demoSpeakTimer) window.clearTimeout(s.demoSpeakTimer);
    if (s.processor) {
      s.processor.onaudioprocess = null;
      s.processor.disconnect();
    }
    s.micStream?.getTracks().forEach((t) => t.stop());
    for (const src of s.activeSources) {
      try {
        src.stop();
      } catch {
        // already stopped
      }
    }
    s.activeSources.clear();
    if (s.ws && s.ws.readyState <= WebSocket.OPEN) {
      try {
        s.ws.close();
      } catch {
        // ignore
      }
    }
    if (s.inputCtx && s.inputCtx.state !== "closed") {
      void s.inputCtx.close().catch(() => {});
    }
    if (s.outputCtx && s.outputCtx.state !== "closed") {
      void s.outputCtx.close().catch(() => {});
    }
  }, [stopUserCamera]);

  const startCall = useCallback(
    async (profile: HistoricalProfile) => {
      stopCall();
      profileRef.current = profile;
      setTranscripts([]);
      setLiveCaption("");
      setLastReaction(null);
      setPortalInvite(null);
      setMicMuted(false);
      optionsRef.current.onError?.(null);

      // Start PiP self-camera in parallel (non-blocking if user denies camera)
      void startUserCamera("user");

      const session: ActiveCallSession = {
        activeSources: new Set(),
        nextStartTime: 0,
      };
      sessionRef.current = session;
      const isCurrent = () => sessionRef.current === session;

      if (optionsRef.current.demoMode) {
        setVoiceStatus("demo");
        appendTranscript("figure", profile.openingLine, false);
        demoSpeechUntilRef.current = performance.now() + 4200;
        optionsRef.current.onConnected?.();
        return;
      }

      setVoiceStatus("connecting");

      try {
        // Set up output audio pipeline with AnalyserNode
        const outputCtx = new AudioContext({ sampleRate: 24000 });
        const analyser = outputCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.72;
        analyser.connect(outputCtx.destination);
        session.outputCtx = outputCtx;
        session.analyser = analyser;
        session.nextStartTime = outputCtx.currentTime;
        void outputCtx.resume().catch(() => {});

        // Acquire microphone (gracefully allow text-only if mic denied)
        if (navigator.mediaDevices?.getUserMedia) {
          try {
            const micStream = await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
              video: false,
            });
            if (!isCurrent()) {
              micStream.getTracks().forEach((t) => t.stop());
              return;
            }
            session.micStream = micStream;
          } catch (micErr) {
            optionsRef.current.onError?.(
              micErr instanceof Error
                ? `Microphone unavailable (${micErr.message}). You can still chat via text in the call drawer.`
                : "Microphone unavailable. You can still type messages in the call drawer."
            );
          }
        }

        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const ws = new WebSocket(`${protocol}//${window.location.host}/ws/facetime`);
        session.ws = ws;

        let readyReceived = false;

        ws.onopen = () => {
          if (!isCurrent()) {
            ws.close();
            return;
          }
          ws.send(JSON.stringify({ type: "start", profile }));
        };

        ws.onmessage = (event) => {
          if (!isCurrent()) return;
          try {
            const msg = JSON.parse(String(event.data)) as FaceTimeServerEvent;
            if (msg.type === "status" && msg.status === "connected") {
              if (readyReceived) return;
              readyReceived = true;
              if (session.connectTimer) window.clearTimeout(session.connectTimer);
              setVoiceStatus("connected");
              optionsRef.current.onConnected?.();

              // Begin mic streaming if mic was granted
              if (session.micStream) {
                const inputCtx = new AudioContext({ sampleRate: 16000 });
                session.inputCtx = inputCtx;
                void inputCtx.resume().catch(() => {});
                const source = inputCtx.createMediaStreamSource(session.micStream);
                const processor = inputCtx.createScriptProcessor(4096, 1, 1);
                session.processor = processor;
                processor.onaudioprocess = (audioEvent) => {
                  if (!isCurrent() || micMutedRef.current) return;
                  if (ws.readyState !== WebSocket.OPEN) return;
                  const pcmBase64 = downsampleAndEncodePcm16(
                    audioEvent.inputBuffer.getChannelData(0),
                    inputCtx.sampleRate,
                    16000
                  );
                  ws.send(JSON.stringify({ type: "audio", data: pcmBase64 }));
                };
                source.connect(processor);
                processor.connect(inputCtx.destination);
              }

              // Stream 1 fps user camera frames so the historical figure can see the caller
              session.videoTimer = window.setInterval(() => {
                if (!isCurrent() || !cameraEnabledRef.current) return;
                if (ws.readyState !== WebSocket.OPEN) return;
                const videoEl = userVideoRef.current;
                if (!videoEl || videoEl.readyState < 2) return;
                const frame = captureMediaFrame(videoEl, 640, 0.72);
                if (frame) {
                  ws.send(JSON.stringify({ type: "video", data: frame.base64 }));
                }
              }, 1000);
            } else if (msg.type === "audio" && session.outputCtx && session.analyser) {
              if (session.outputCtx.state === "suspended") {
                void session.outputCtx.resume().catch(() => {});
              }
              const buf = decodePcm24kToBuffer(session.outputCtx, msg.data);
              if (buf) {
                const src = session.outputCtx.createBufferSource();
                src.buffer = buf;
                src.connect(session.analyser);
                const now = session.outputCtx.currentTime;
                if (session.nextStartTime < now) {
                  session.nextStartTime = now + 0.02;
                }
                src.start(session.nextStartTime);
                session.nextStartTime += buf.duration;
                session.activeSources.add(src);
                src.onended = () => {
                  session.activeSources.delete(src);
                };
              }
            } else if (msg.type === "interrupted") {
              for (const src of session.activeSources) {
                try {
                  src.stop();
                } catch {
                  // ignore
                }
              }
              session.activeSources.clear();
              if (session.outputCtx) {
                session.nextStartTime = session.outputCtx.currentTime;
              }
            } else if (msg.type === "inputTranscript") {
              appendTranscript("user", msg.text, true);
            } else if (msg.type === "outputTranscript") {
              appendTranscript("figure", msg.text, true);
            } else if (msg.type === "turnComplete") {
              setTranscripts((prev) =>
                prev.map((m, idx) =>
                  idx === prev.length - 1 ? { ...m, streaming: false } : m
                )
              );
            } else if (msg.type === "reaction") {
              setLastReaction(msg.cue);
              optionsRef.current.onReaction?.(msg.cue);
            } else if (msg.type === "portalInvite") {
              setPortalInvite(msg.portal);
              optionsRef.current.onPortalInvite?.(msg.portal);
            } else if (msg.type === "error") {
              optionsRef.current.onError?.(msg.message);
              if (!readyReceived) {
                setVoiceStatus("text-only");
                appendTranscript("figure", profile.openingLine, false);
                demoSpeechUntilRef.current = performance.now() + 3500;
                optionsRef.current.onConnected?.();
              }
            }
          } catch {
            // Ignore malformed frame
          }
        };

        ws.onerror = () => {
          if (!isCurrent()) return;
          if (!readyReceived) {
            setVoiceStatus("text-only");
            appendTranscript("figure", profile.openingLine, false);
            demoSpeechUntilRef.current = performance.now() + 3500;
            optionsRef.current.onConnected?.();
          }
        };

        ws.onclose = () => {
          if (!isCurrent()) return;
          if (readyReceived) {
            setVoiceStatus("text-only");
          }
        };

        session.connectTimer = window.setTimeout(() => {
          if (!isCurrent() || readyReceived) return;
          optionsRef.current.onError?.(
            "Live voice took too long to connect — switched to text call mode."
          );
          try {
            ws.close();
          } catch {
            // ignore
          }
          setVoiceStatus("text-only");
          appendTranscript("figure", profile.openingLine, false);
          demoSpeechUntilRef.current = performance.now() + 3500;
          optionsRef.current.onConnected?.();
        }, 16000);
      } catch (err) {
        if (!isCurrent()) return;
        optionsRef.current.onError?.(
          err instanceof Error ? err.message : "Could not connect live audio."
        );
        setVoiceStatus("text-only");
        appendTranscript("figure", profile.openingLine, false);
        optionsRef.current.onConnected?.();
      }
    },
    [appendTranscript, startUserCamera, stopCall]
  );

  const sendMessage = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      const profile = profileRef.current;
      if (!text || !profile) return;

      const s = sessionRef.current;
      if (voiceStatus === "connected" && s?.ws?.readyState === WebSocket.OPEN) {
        appendTranscript("user", text, false);
        s.ws.send(JSON.stringify({ type: "text", text }));
        return;
      }

      // Demo Mode or text-only fallback via HTTP /api/facetime/respond
      appendTranscript("user", text, false);
      setIsSendingText(true);
      try {
        const historyPayload = transcripts
          .filter((t) => t.speaker === "user" || t.speaker === "figure")
          .slice(-8)
          .map((t) => ({ speaker: t.speaker, text: t.text }));

        const res = await fetch("/api/facetime/respond", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profile,
            message: text,
            history: historyPayload,
          }),
        });
        const data = (await res.json()) as { reply?: string; error?: string };
        if (!res.ok) {
          throw new Error(data.error || "Could not get reply.");
        }
        const reply = data.reply?.trim() || "I hear you clearly across time.";
        appendTranscript("figure", reply, false);
        demoSpeechUntilRef.current =
          performance.now() + Math.min(7000, Math.max(2400, reply.length * 42));
      } catch (err) {
        optionsRef.current.onError?.(
          err instanceof Error ? err.message : "Failed to send message."
        );
      } finally {
        setIsSendingText(false);
      }
    },
    [appendTranscript, transcripts, voiceStatus]
  );

  useEffect(() => stopCall, [stopCall]);

  return {
    voiceStatus,
    micMuted,
    setMicMuted,
    isSpeaking,
    speechLevelRef,
    transcripts,
    liveCaption,
    lastReaction,
    portalInvite,
    clearPortalInvite: () => setPortalInvite(null),
    setPortalInvite,
    isSendingText,
    cameraEnabled,
    cameraReady,
    cameraError,
    facingMode,
    bindUserVideoRef,
    toggleCamera,
    flipCamera,
    startCall,
    stopCall,
    sendMessage,
  };
}

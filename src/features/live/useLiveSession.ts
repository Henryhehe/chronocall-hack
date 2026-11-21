import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveServerEvent } from "../../../shared/live.ts";
import type { LiveTranscriptEntry } from "../../types/vision";
import { downsampleAndEncodePcm16, LiveAudioPlayer } from "../../utils/audio";
import { captureMediaFrame } from "../../utils/canvas";
import { LiveConnection } from "./liveConnection.ts";

interface LiveOptions {
  mode?: "world";
  persona?: string;
  worldContext?: string;
  getFrameElement: () => HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | null;
  onMessage?: (message: LiveServerEvent) => void;
  onError: (message: string | null) => void;
}

interface SessionResources {
  connection?: LiveConnection;
  stream?: MediaStream;
  context?: AudioContext;
  processor?: ScriptProcessorNode;
  player?: LiveAudioPlayer;
  videoTimer?: number;
  connectTimer?: number;
}

export function useLiveSession(options: LiveOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const active = useRef<SessionResources | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const mutedRef = useRef(micMuted);
  mutedRef.current = micMuted;
  const [transcripts, setTranscripts] = useState<LiveTranscriptEntry[]>([]);

  const appendTranscript = useCallback((speaker: LiveTranscriptEntry["speaker"], text: string) => {
    if (!text) return;
    setTranscripts((previous) => {
      const last = previous.at(-1);
      if (last?.speaker === speaker && speaker !== "system" && Date.now() - last.timestamp < 4000) {
        return [...previous.slice(0, -1), { ...last, text: last.text + text, timestamp: Date.now() }];
      }
      return [...previous, { id: crypto.randomUUID(), speaker, text: text.trimStart(), timestamp: Date.now() }].slice(-80);
    });
  }, []);

  const stop = useCallback(() => {
    const session = active.current;
    active.current = null; // Detach synchronously so late callbacks cannot close a newer session.
    setConnected(false);
    setConnecting(false);
    if (!session) return;
    window.clearInterval(session.videoTimer);
    window.clearTimeout(session.connectTimer);
    if (session.processor) {
      session.processor.onaudioprocess = null;
      session.processor.disconnect();
    }
    session.stream?.getTracks().forEach((track) => track.stop());
    session.connection?.close();
    if (session.context && session.context.state !== "closed") void session.context.close().catch(() => {});
    void session.player?.close().catch(() => {});
  }, []);

  const start = useCallback(async () => {
    if (active.current) return;
    const session: SessionResources = {};
    active.current = session;
    const isCurrent = () => active.current === session;
    setConnecting(true);
    optionsRef.current.onError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone access requires localhost or HTTPS.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      if (!isCurrent()) { stream.getTracks().forEach((track) => track.stop()); return; }
      session.stream = stream;
      const context = new AudioContext({ sampleRate: 16000 });
      session.context = context;
      await context.resume();
      if (!isCurrent()) return;
      const player = new LiveAudioPlayer();
      session.player = player;
      const params = new URLSearchParams();
      const current = optionsRef.current;
      if (current.mode) params.set("mode", current.mode);
      if (current.persona) params.set("persona", current.persona);
      if (current.worldContext) params.set("worldContext", current.worldContext.slice(0, 300));
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(`${protocol}//${location.host}/ws/live?${params}`);
      session.connection = new LiveConnection(socket, {
        onReady: () => {
          if (!isCurrent()) return;
          window.clearTimeout(session.connectTimer);
          setConnected(true);
          setConnecting(false);
          appendTranscript("system", "Gemini Live is ready. Speak naturally or send a message.");
          const source = context.createMediaStreamSource(stream);
          const processor = context.createScriptProcessor(4096, 1, 1);
          session.processor = processor;
          processor.onaudioprocess = (event) => {
            if (!isCurrent() || mutedRef.current) return;
            session.connection?.send({ type: "audio", data: downsampleAndEncodePcm16(event.inputBuffer.getChannelData(0), context.sampleRate, 16000) });
          };
          source.connect(processor);
          processor.connect(context.destination);
          session.videoTimer = window.setInterval(() => {
            if (!isCurrent()) return;
            const el = optionsRef.current.getFrameElement();
            if (!el) return;
            const frame = captureMediaFrame(el, 768, 0.72);
            if (frame) session.connection?.send({ type: "video", data: frame.base64 });
          }, 1000);
        },
        onMessage: (message) => {
          if (!isCurrent()) return;
          if (message.type === "audio") player.enqueuePcm24kBase64(message.data);
          else if (message.type === "interrupted") player.interrupt();
          else if (message.type === "inputTranscript") appendTranscript("user", message.text);
          else if (message.type === "outputTranscript") appendTranscript("gemini", message.text);
          else optionsRef.current.onMessage?.(message);
        },
        onError: (message) => { if (isCurrent()) optionsRef.current.onError(message); },
        onClose: () => { if (isCurrent()) stop(); },
      });
      session.connectTimer = window.setTimeout(() => {
        if (!isCurrent()) return;
        optionsRef.current.onError("Gemini Live did not connect within 20 seconds. Please retry.");
        stop();
      }, 20000);
    } catch (err) {
      if (!isCurrent()) return;
      optionsRef.current.onError(err instanceof Error ? err.message : "Could not start live voice.");
      stop();
    }
  }, [appendTranscript, stop]);

  const sendText = useCallback((text: string) => {
    const sent = active.current?.connection?.send({ type: "text", text }) ?? false;
    if (sent) appendTranscript("user", text);
    return sent;
  }, [appendTranscript]);

  useEffect(() => stop, [stop]);
  return { connected, connecting, start, stop, sendText, micMuted, setMicMuted, transcripts, setTranscripts, appendTranscript };
}

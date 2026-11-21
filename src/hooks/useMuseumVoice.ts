import { useCallback, useEffect, useRef, useState } from 'react';
import { DialogueEntry, PortraitArtwork, VoiceConnectionState } from '../types/portrait';
import {
  base64ToUint8Array,
  computeAnalyserEnergy,
  float32ToPcm16Base64,
  pcm24kBase64ToAudioBuffer,
} from '../utils/audioLive';

interface UseMuseumVoiceOptions {
  artwork: PortraitArtwork;
  onAnimationCue?: (cue: string | null) => void;
}

function createInputAudioContext(): AudioContext {
  try {
    return new AudioContext({ sampleRate: 16000 });
  } catch {
    return new AudioContext();
  }
}

export function useMuseumVoice({ artwork, onAnimationCue }: UseMuseumVoiceOptions) {
  const [connectionState, setConnectionState] = useState<VoiceConnectionState>('idle');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [needsAudioGesture, setNeedsAudioGesture] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<DialogueEntry[]>([
    {
      id: `init-${artwork.id}`,
      speaker: 'character',
      text: artwork.openingLine,
      timestamp: formatTime(),
    },
  ]);

  const speechLevelRef = useRef<number>(0);
  const wsRef = useRef<WebSocket | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const autoStartTimerRef = useRef<number | null>(null);
  const artworkRef = useRef<PortraitArtwork>(artwork);
  const transcriptRef = useRef<DialogueEntry[]>(transcript);
  const sessionTokenRef = useRef<number>(0);
  const connectingRef = useRef<boolean>(false);

  useEffect(() => {
    artworkRef.current = artwork;
  }, [artwork]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  // Reset opening greeting when switching to a newly scanned portrait
  useEffect(() => {
    setTranscript([
      {
        id: `init-${artwork.id}-${Date.now()}`,
        speaker: 'character',
        text: artwork.openingLine,
        timestamp: formatTime(),
      },
    ]);
  }, [artwork.id, artwork.openingLine]);

  const ensureOutputAudio = useCallback(() => {
    if (!outputCtxRef.current || outputCtxRef.current.state === 'closed') {
      let ctx: AudioContext;
      try {
        ctx = new AudioContext({ sampleRate: 24000 });
      } catch {
        ctx = new AudioContext();
      }
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.72;
      analyser.connect(ctx.destination);
      outputCtxRef.current = ctx;
      analyserRef.current = analyser;
    }
    if (outputCtxRef.current.state === 'suspended') {
      outputCtxRef.current.resume().catch(() => {});
    }
    return {
      ctx: outputCtxRef.current,
      analyser: analyserRef.current!,
    };
  }, []);

  const stopPlaybackQueue = useCallback(() => {
    activeSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        // already stopped
      }
    });
    activeSourcesRef.current.clear();
    if (outputCtxRef.current) {
      nextStartTimeRef.current = outputCtxRef.current.currentTime;
    } else {
      nextStartTimeRef.current = 0;
    }
    setIsSpeaking(false);
  }, []);

  // 60fps vocal amplitude loop driving AR portrait glow and acoustic aura
  useEffect(() => {
    let active = true;
    const tick = () => {
      if (!active) return;
      const energy = computeAnalyserEnergy(analyserRef.current);
      speechLevelRef.current = energy;
      if (activeSourcesRef.current.size > 0 || energy > 0.04) {
        setIsSpeaking(true);
      } else {
        setIsSpeaking(false);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      active = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const upsertStreamingEntry = useCallback(
    (speaker: 'visitor' | 'character', chunkText: string, finalize = false) => {
      if (!chunkText && !finalize) return;
      setTranscript((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.speaker === speaker && last.isStreaming) {
          const updated = {
            ...last,
            text: chunkText ? `${last.text}${chunkText}` : last.text,
            isStreaming: !finalize,
          };
          return [...prev.slice(0, -1), updated];
        }
        if (!chunkText) return prev;
        return [
          ...prev,
          {
            id: `${speaker}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            speaker,
            text: chunkText,
            timestamp: formatTime(),
            isStreaming: !finalize,
          },
        ];
      });
    },
    []
  );

  const finalizeStreamingEntries = useCallback(() => {
    setTranscript((prev) =>
      prev.map((item) => (item.isStreaming ? { ...item, isStreaming: false } : item))
    );
  }, []);

  const schedulePcmChunk = useCallback(
    (base64Pcm: string) => {
      const { ctx, analyser } = ensureOutputAudio();
      if (ctx.state === 'suspended') {
        setNeedsAudioGesture(true);
      }
      const buffer = pcm24kBase64ToAudioBuffer(ctx, base64Pcm);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(analyser);

      const now = ctx.currentTime;
      const startAt = Math.max(now + 0.02, nextStartTimeRef.current);
      nextStartTimeRef.current = startAt + buffer.duration;

      activeSourcesRef.current.add(source);
      source.onended = () => {
        activeSourcesRef.current.delete(source);
      };
      source.start(startAt);
    },
    [ensureOutputAudio]
  );

  const playWavBase64 = useCallback(
    async (wavBase64: string) => {
      const { ctx, analyser } = ensureOutputAudio();
      stopPlaybackQueue();
      const rawBytes = base64ToUint8Array(wavBase64);
      const arrayBuf = rawBytes.buffer.slice(
        rawBytes.byteOffset,
        rawBytes.byteOffset + rawBytes.byteLength
      ) as ArrayBuffer;
      const audioBuffer = await ctx.decodeAudioData(arrayBuf);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(analyser);
      activeSourcesRef.current.add(source);
      source.onended = () => {
        activeSourcesRef.current.delete(source);
      };
      source.start(0);
    },
    [ensureOutputAudio, stopPlaybackQueue]
  );

  const cleanupVoiceResources = useCallback(() => {
    sessionTokenRef.current += 1;
    connectingRef.current = false;

    if (autoStartTimerRef.current !== null) {
      window.clearTimeout(autoStartTimerRef.current);
      autoStartTimerRef.current = null;
    }

    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch {
        // ignore
      }
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }
    if (gainNodeRef.current) {
      try {
        gainNodeRef.current.disconnect();
      } catch {
        // ignore
      }
      gainNodeRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (inputCtxRef.current) {
      inputCtxRef.current.close().catch(() => {});
      inputCtxRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }
    stopPlaybackQueue();
    finalizeStreamingEntries();
    setIsListening(false);
  }, [finalizeStreamingEntries, stopPlaybackQueue]);

  const stopLiveVoice = useCallback(() => {
    cleanupVoiceResources();
    setConnectionState('idle');
  }, [cleanupVoiceResources]);

  const unlockAudioContexts = useCallback(async () => {
    let anySuspended = false;
    if (outputCtxRef.current && outputCtxRef.current.state === 'suspended') {
      try {
        await outputCtxRef.current.resume();
      } catch {
        anySuspended = true;
      }
    }
    if (inputCtxRef.current && inputCtxRef.current.state === 'suspended') {
      try {
        await inputCtxRef.current.resume();
      } catch {
        anySuspended = true;
      }
    }
    if (!anySuspended) {
      setNeedsAudioGesture(false);
    }
  }, []);

  const startLiveVoice = useCallback(
    async (fromUserGesture = false) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        await unlockAudioContexts();
        return;
      }

      if (connectingRef.current) {
        if (!fromUserGesture) return;
        // User tapped while a background auto-start attempt stalled (common on mobile browsers)
        cleanupVoiceResources();
      }

      setErrorMessage(null);
      connectingRef.current = true;
      const token = ++sessionTokenRef.current;
      setConnectionState('connecting');

      let hadError = false;

      // Guard against non-gesture mobile auto-start stalling on getUserMedia/AudioContext
      if (!fromUserGesture) {
        autoStartTimerRef.current = window.setTimeout(() => {
          if (token === sessionTokenRef.current && connectingRef.current) {
            cleanupVoiceResources();
            setNeedsAudioGesture(true);
            setConnectionState('idle');
          }
        }, 3500);
      }

      try {
        // Call getUserMedia IMMEDIATELY while user activation gesture is still fresh on mobile!
        const micPromise = navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        // Initialize AudioContexts synchronously inside the gesture without awaiting resume first
        const { ctx: outCtx } = ensureOutputAudio();
        const inputCtx = createInputAudioContext();
        if (inputCtx.state === 'suspended') {
          inputCtx.resume().catch(() => {});
        }
        inputCtxRef.current = inputCtx;

        const stream = await micPromise;

        if (token !== sessionTokenRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        micStreamRef.current = stream;

        if (inputCtx.state === 'suspended') {
          await inputCtx.resume().catch(() => {});
        }
        if (inputCtx.state === 'suspended' || outCtx.state === 'suspended') {
          setNeedsAudioGesture(true);
        } else {
          setNeedsAudioGesture(false);
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${protocol}//${window.location.host}/ws/live`);
        wsRef.current = ws;

        ws.onopen = () => {
          if (token !== sessionTokenRef.current) {
            ws.close();
            return;
          }
          const current = artworkRef.current;
          ws.send(
            JSON.stringify({
              type: 'start',
              characterName: current.characterName,
              paintingTitle: current.title,
              historicalContext: current.historicalContext,
              voiceName: current.voiceName,
              systemPersona: current.systemPersona,
            })
          );
        };

        ws.onmessage = (event) => {
          if (token !== sessionTokenRef.current) return;
          const msg = JSON.parse(event.data);
          if (msg.type === 'ready') {
            connectingRef.current = false;
            if (autoStartTimerRef.current !== null) {
              window.clearTimeout(autoStartTimerRef.current);
              autoStartTimerRef.current = null;
            }
            setConnectionState('live');
            setIsListening(true);

            if (!processorRef.current && inputCtxRef.current) {
              const ctx = inputCtxRef.current;
              if (ctx.state === 'suspended') {
                ctx.resume().catch(() => {});
                if (ctx.state === 'suspended') {
                  setNeedsAudioGesture(true);
                }
              }
              const source = ctx.createMediaStreamSource(stream);
              const processor = ctx.createScriptProcessor(4096, 1, 1);
              const silentGain = ctx.createGain();
              silentGain.gain.value = 0;

              processorRef.current = processor;
              gainNodeRef.current = silentGain;

              source.connect(processor);
              processor.connect(silentGain);
              silentGain.connect(ctx.destination);

              processor.onaudioprocess = (e) => {
                if (ws.readyState !== WebSocket.OPEN) return;
                const base64 = float32ToPcm16Base64(
                  e.inputBuffer.getChannelData(0),
                  ctx.sampleRate
                );
                ws.send(JSON.stringify({ type: 'audio', data: base64 }));
              };
            }
          } else if (msg.type === 'audio' && msg.data) {
            schedulePcmChunk(msg.data);
          } else if (msg.type === 'inputTranscript' && msg.text) {
            upsertStreamingEntry('visitor', msg.text);
          } else if (msg.type === 'outputTranscript' && msg.text) {
            upsertStreamingEntry('character', msg.text);
          } else if (msg.type === 'interrupted') {
            stopPlaybackQueue();
            finalizeStreamingEntries();
          } else if (msg.type === 'turnComplete') {
            finalizeStreamingEntries();
          } else if (msg.type === 'error') {
            hadError = true;
            connectingRef.current = false;
            setErrorMessage(msg.message || 'Voice session encountered an error.');
            setConnectionState('error');
          } else if (msg.type === 'closed') {
            if (msg.reason && !hadError) {
              hadError = true;
              setErrorMessage(`Voice connection closed: ${msg.reason}`);
              setConnectionState('error');
            }
            cleanupVoiceResources();
            if (!hadError) {
              setConnectionState('idle');
            }
          }
        };

        ws.onerror = () => {
          if (token !== sessionTokenRef.current) return;
          hadError = true;
          connectingRef.current = false;
          setErrorMessage('Unable to maintain real-time voice connection.');
          setConnectionState('error');
        };

        ws.onclose = () => {
          if (token !== sessionTokenRef.current) return;
          cleanupVoiceResources();
          if (!hadError) {
            setConnectionState((prev) => (prev === 'error' ? 'error' : 'idle'));
          }
        };
      } catch (err) {
        if (token !== sessionTokenRef.current) return;
        hadError = true;
        connectingRef.current = false;
        const rawMsg = err instanceof Error ? err.message : 'Microphone access unavailable.';
        if (!fromUserGesture) {
          setNeedsAudioGesture(true);
          setConnectionState('idle');
        } else {
          setErrorMessage(rawMsg);
          setConnectionState('error');
        }
        cleanupVoiceResources();
      }
    },
    [
      cleanupVoiceResources,
      ensureOutputAudio,
      finalizeStreamingEntries,
      schedulePcmChunk,
      stopPlaybackQueue,
      unlockAudioContexts,
      upsertStreamingEntry,
    ]
  );

  const sendCameraFrameToLive = useCallback((jpegBase64: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const clean = jpegBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
      wsRef.current.send(JSON.stringify({ type: 'video', data: clean }));
    }
  }, []);

  const askCharacter = useCallback(
    async (promptText: string, animationCue?: string) => {
      const trimmed = promptText.trim();
      if (!trimmed) return;
      setErrorMessage(null);
      await unlockAudioContexts();

      if (animationCue && onAnimationCue) {
        onAnimationCue(animationCue);
      }

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        finalizeStreamingEntries();
        setTranscript((prev) => [
          ...prev,
          {
            id: `visitor-${Date.now()}`,
            speaker: 'visitor',
            text: trimmed,
            timestamp: formatTime(),
          },
        ]);
        wsRef.current.send(JSON.stringify({ type: 'text', text: trimmed }));
        return;
      }

      const userEntry: DialogueEntry = {
        id: `visitor-${Date.now()}`,
        speaker: 'visitor',
        text: trimmed,
        timestamp: formatTime(),
      };
      setTranscript((prev) => [...prev, userEntry]);
      setConnectionState('thinking');

      try {
        const current = artworkRef.current;
        const res = await fetch('/api/character/respond', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: trimmed,
            history: transcriptRef.current,
            systemPersona: current.systemPersona,
            voiceName: current.voiceName,
            includeAudio: true,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to get response from portrait.');
        }

        const replyEntry: DialogueEntry = {
          id: `character-${Date.now()}`,
          speaker: 'character',
          text: data.replyText,
          timestamp: formatTime(),
        };
        setTranscript((prev) => [...prev, replyEntry]);
        setConnectionState('idle');

        if (data.audioBase64) {
          await playWavBase64(data.audioBase64);
        }
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Unable to reach character voice service.'
        );
        setConnectionState('error');
      }
    },
    [finalizeStreamingEntries, onAnimationCue, playWavBase64, unlockAudioContexts]
  );

  useEffect(() => {
    return () => {
      cleanupVoiceResources();
    };
  }, [cleanupVoiceResources]);

  return {
    connectionState,
    isSpeaking,
    isListening,
    needsAudioGesture,
    errorMessage,
    setErrorMessage,
    transcript,
    speechLevelRef,
    startLiveVoice,
    stopLiveVoice,
    unlockAudioContexts,
    askCharacter,
    sendCameraFrameToLive,
    stopPlaybackQueue,
  };
}

function formatTime(): string {
  return new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Scan, RotateCcw, Eye, EyeOff, Mic } from 'lucide-react';
import {
  ARHotspot,
  DialogueEntry,
  FocalBox,
  FocalQuad,
  PortraitArtwork,
  QuadCorner,
  VoiceConnectionState,
} from '../types/portrait';
import { WASHINGTON_PORTRAIT } from '../data/washingtonPortrait';
import {
  buildFeatheredLayers,
  CachedPortraitLayer,
  drawAnimatedPaintingComposition,
  getPortraitRegionSpecs,
} from '../utils/livingPortraitLayers';
import { WashingtonAnchorTracker } from '../utils/washingtonAnchorTracker';
import {
  boxToQuad,
  PerspectiveCanvasRenderer,
  projectUvThroughQuad,
  quadToBoundingBox,
} from '../utils/perspectiveWarp';

interface ARPortraitStageProps {
  artwork: PortraitArtwork;
  speechLevelRef: React.MutableRefObject<number>;
  isSpeaking: boolean;
  isListening: boolean;
  needsAudioGesture: boolean;
  connectionState: VoiceConnectionState;
  activeHotspotId: string | null;
  activeCue: string | null;
  latestDialogue: DialogueEntry | null;
  latestVisitorLine: DialogueEntry | null;
  errorMessage: string | null;
  onSelectHotspot: (hotspot: ARHotspot) => void;
  onArtworkIdentified: (artwork: PortraitArtwork) => void;
  onResetToWashington: () => void;
  isCustomArtwork: boolean;
  onSendCameraFrame: (jpegBase64: string) => void;
  onCameraError: (msg: string | null) => void;
  onCameraReadyChange?: (ready: boolean) => void;
  onAvatarTap: () => void;
}

interface DustMote {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  alpha: number;
  depth: number;
  phase: number;
}

interface PositionedTag {
  spot: ARHotspot;
  dotX: number;
  dotY: number;
  side: 'left' | 'right';
  placement: 'hidden' | 'wide-side' | 'above-line';
  elbowX: number;
  lineEndX: number;
  labelAnchorX: number;
  labelY: number;
  maxWidthPx: number;
}

const DEFAULT_BOX: FocalBox = { x: 24, y: 14, width: 52, height: 72 };
const DEFAULT_QUAD: FocalQuad = boxToQuad(DEFAULT_BOX);

export const ARPortraitStage: React.FC<ARPortraitStageProps> = ({
  artwork,
  speechLevelRef,
  isSpeaking,
  isListening,
  needsAudioGesture,
  connectionState,
  activeHotspotId,
  activeCue,
  latestDialogue,
  latestVisitorLine,
  errorMessage,
  onSelectHotspot,
  onArtworkIdentified,
  onResetToWashington,
  isCustomArtwork,
  onSendCameraFrame,
  onCameraError,
  onCameraReadyChange,
  onAvatarTap,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const washingtonAnchorImgRef = useRef<HTMLImageElement | null>(null);
  const washingtonAnchorLayersRef = useRef<CachedPortraitLayer[]>([]);
  const avatarOffscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const perspectiveRendererRef = useRef<PerspectiveCanvasRenderer | null>(null);
  const anchorTrackerRef = useRef<WashingtonAnchorTracker>(
    new WashingtonAnchorTracker(WASHINGTON_PORTRAIT.imageUrl)
  );
  const videoPatchCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoMaskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [washingtonAvatarLoaded, setWashingtonAvatarLoaded] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [autoScan, setAutoScan] = useState(true);
  const [cameraDetected, setCameraDetected] = useState(false);
  const [anchorType, setAnchorType] = useState<'washington' | 'other' | null>(null);
  const [trackedQuad, setTrackedQuad] = useState<FocalQuad>(DEFAULT_QUAD);
  const [anchorConfidence, setAnchorConfidence] = useState<number>(0);
  const [scanNotice, setScanNotice] = useState<string | null>(
    'Aim camera at the Washington painting anchor.'
  );
  const [showHotspots, setShowHotspots] = useState(true);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 1024, height: 768 });

  const tiltRef = useRef({ x: 0, y: 0 });
  const activeCueRef = useRef<string | null>(activeCue);
  const artworkRef = useRef<PortraitArtwork>(artwork);
  const cameraReadyRef = useRef(cameraReady);
  const cameraDetectedRef = useRef(cameraDetected);
  const anchorTypeRef = useRef<'washington' | 'other' | null>(anchorType);
  const trackedQuadRef = useRef<FocalQuad>(trackedQuad);
  const isSpeakingRef = useRef(isSpeaking);
  const isListeningRef = useRef(isListening);
  const connectionStateRef = useRef(connectionState);

  const trackedBox = useMemo(() => quadToBoundingBox(trackedQuad), [trackedQuad]);

  useEffect(() => {
    tiltRef.current = tilt;
  }, [tilt]);
  useEffect(() => {
    activeCueRef.current = activeCue;
  }, [activeCue]);
  useEffect(() => {
    artworkRef.current = artwork;
  }, [artwork]);
  useEffect(() => {
    cameraReadyRef.current = cameraReady;
    onCameraReadyChange?.(cameraReady);
  }, [cameraReady, onCameraReadyChange]);
  useEffect(() => {
    cameraDetectedRef.current = cameraDetected;
  }, [cameraDetected]);
  useEffect(() => {
    anchorTypeRef.current = anchorType;
  }, [anchorType]);
  useEffect(() => {
    trackedQuadRef.current = trackedQuad;
  }, [trackedQuad]);
  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);
  useEffect(() => {
    connectionStateRef.current = connectionState;
  }, [connectionState]);

  // Preload the Washington AR Avatar & Anchor Template once so locking is instantaneous
  useEffect(() => {
    anchorTrackerRef.current.ensureLoaded().catch(() => {});
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      washingtonAnchorImgRef.current = img;
      const specs = getPortraitRegionSpecs(true, WASHINGTON_PORTRAIT.focalPoint);
      washingtonAnchorLayersRef.current = buildFeatheredLayers(img, specs);
      setWashingtonAvatarLoaded(true);
    };
    img.src = WASHINGTON_PORTRAIT.imageUrl;
  }, []);

  // Smartphone gyroscope parallax
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      const nx = Math.max(-1, Math.min(1, e.gamma / 30));
      const ny = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
      setTilt({ x: nx, y: ny });
    };
    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, []);

  // Track viewport dimensions for mobile-safe AR tag label placement
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      setContainerSize({
        width: Math.max(1, el.clientWidth),
        height: Math.max(1, el.clientHeight),
      });
    };
    updateSize();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(updateSize);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    setTilt({
      x: Math.max(-1, Math.min(1, nx)),
      y: Math.max(-1, Math.min(1, ny)),
    });
  };

  const handlePointerLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  // Manage camera lifecycle: automatically prefer plugged-in external USB webcam over built-in laptop webcam
  useEffect(() => {
    let cancelled = false;

    const stopCurrentStream = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };

    const startCamera = async () => {
      onCameraError(null);
      stopCurrentStream();
      setCameraReady(false);
      try {
        const initialConstraints: MediaStreamConstraints = {
          video: selectedCameraId
            ? {
                deviceId: { exact: selectedCameraId },
                width: { ideal: 1920 },
                height: { ideal: 1080 },
              }
            : {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1920 },
                height: { ideal: 1080 },
              },
          audio: false,
        };

        let stream = await navigator.mediaDevices.getUserMedia(initialConstraints);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const allDevices = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const videoDevices = allDevices.filter((d) => d.kind === 'videoinput');
        setAvailableCameras(videoDevices);

        const currentTrackDeviceId = stream.getVideoTracks()[0]?.getSettings()?.deviceId || '';

        if (!selectedCameraId && videoDevices.length > 1) {
          const preferred = pickPreferredExternalCamera(videoDevices);
          if (preferred && preferred.deviceId && preferred.deviceId !== currentTrackDeviceId) {
            stream.getTracks().forEach((t) => t.stop());
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                deviceId: { exact: preferred.deviceId },
                width: { ideal: 1920 },
                height: { ideal: 1080 },
              },
              audio: false,
            });
            if (cancelled) {
              stream.getTracks().forEach((t) => t.stop());
              return;
            }
            setSelectedCameraId(preferred.deviceId);
          } else if (currentTrackDeviceId) {
            setSelectedCameraId(currentTrackDeviceId);
          }
        } else if (!selectedCameraId && currentTrackDeviceId) {
          setSelectedCameraId(currentTrackDeviceId);
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraReady(true);
        }
      } catch (err) {
        if (!cancelled) {
          setCameraReady(false);
          onCameraError(
            err instanceof Error
              ? `Camera unavailable: ${err.message}`
              : 'Camera permission is required for AR tracking.'
          );
        }
      }
    };

    startCamera();

    const handleDeviceChange = async () => {
      try {
        const all = await navigator.mediaDevices.enumerateDevices();
        if (!cancelled) {
          setAvailableCameras(all.filter((d) => d.kind === 'videoinput'));
        }
      } catch {
        // ignore enumeration errors
      }
    };
    navigator.mediaDevices?.addEventListener?.('devicechange', handleDeviceChange);

    return () => {
      cancelled = true;
      navigator.mediaDevices?.removeEventListener?.('devicechange', handleDeviceChange);
      stopCurrentStream();
      setCameraReady(false);
    };
  }, [selectedCameraId, onCameraError]);

  // Real-time 12Hz 4-corner AR Image Anchor Tracking loop against the uploaded Washington painting
  useEffect(() => {
    if (!cameraReady) return;

    const interval = window.setInterval(() => {
      const video = videoRef.current;
      const container = containerRef.current;
      if (!video || !container || video.readyState < 2) return;

      if (anchorTypeRef.current === 'other' && cameraDetectedRef.current) return;

      const result = anchorTrackerRef.current.trackFrame(
        video,
        container.clientWidth,
        container.clientHeight
      );
      if (!result) return;

      setAnchorConfidence(result.confidence);

      if (result.detected) {
        trackedQuadRef.current = result.quad;
        setTrackedQuad(result.quad);
        if (!cameraDetectedRef.current || anchorTypeRef.current !== 'washington') {
          setCameraDetected(true);
          setAnchorType('washington');
          setScanNotice(null);
          if (artworkRef.current.id !== WASHINGTON_PORTRAIT.id) {
            onArtworkIdentified({
              ...WASHINGTON_PORTRAIT,
              focalBox: result.box,
              focalQuad: result.quad,
            });
          }
        }
      } else if (anchorTypeRef.current === 'washington') {
        setCameraDetected(false);
        setAnchorType(null);
        setScanNotice('Anchor lost — aim camera back at the Washington portrait.');
      }
    }, 85);

    return () => window.clearInterval(interval);
  }, [cameraReady, onArtworkIdentified]);

  // Capture exact visible object-cover crop from the live camera feed
  const captureVisibleVideoFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container || video.readyState < 2) return null;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    if (!vw || !vh || !cw || !ch) return null;

    const scale = Math.max(cw / vw, ch / vh);
    const srcW = cw / scale;
    const srcH = ch / scale;
    const srcX = (vw - srcW) / 2;
    const srcY = (vh - srcH) / 2;

    const outW = Math.min(960, cw);
    const outH = Math.round((outW * ch) / cw);
    const offscreen = document.createElement('canvas');
    offscreen.width = outW;
    offscreen.height = outH;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, outW, outH);
    return offscreen.toDataURL('image/jpeg', 0.85);
  }, []);

  // Forward 1 FPS JPEG frames to Gemini Live when Camera + Live Voice are active
  useEffect(() => {
    if (!cameraReady || connectionState !== 'live') return;
    const interval = window.setInterval(() => {
      const frame = captureVisibleVideoFrame();
      if (frame) onSendCameraFrame(frame);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [cameraReady, connectionState, captureVisibleVideoFrame, onSendCameraFrame]);

  // Gemini Vision recognition with 4-corner perspective quad detection
  const identifyCameraFrame = useCallback(
    async (dataUrl: string) => {
      setIsScanning(true);
      setScanNotice('Scanning camera feed for portrait anchor...');
      onCameraError(null);
      try {
        const res = await fetch('/api/identify-portrait', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: dataUrl, mimeType: 'image/jpeg' }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Could not analyze the frame.');
        }

        if (!data.detected) {
          if (anchorTypeRef.current !== 'washington') {
            setCameraDetected(false);
            setScanNotice(
              data.historicalContext ||
                'Aim camera at the Washington portrait anchor.'
            );
          }
          return;
        }

        const fBox: FocalBox = data.focalBox || DEFAULT_BOX;
        const fQuad: FocalQuad = isValidQuadShape(data.focalQuad)
          ? data.focalQuad
          : boxToQuad(fBox);

        if (data.isWashingtonAnchor) {
          anchorTrackerRef.current.seedQuad(fQuad);
          trackedQuadRef.current = fQuad;
          setTrackedQuad(fQuad);
          setCameraDetected(true);
          setAnchorType('washington');
          setScanNotice(null);
          onArtworkIdentified({
            ...WASHINGTON_PORTRAIT,
            focalBox: quadToBoundingBox(fQuad),
            focalQuad: fQuad,
          });
          return;
        }

        const fp = {
          x: typeof data.focalPoint?.x === 'number' ? data.focalPoint.x : fBox.x + fBox.width / 2,
          y: typeof data.focalPoint?.y === 'number' ? data.focalPoint.y : fBox.y + fBox.height * 0.3,
        };

        const identified: PortraitArtwork = {
          id: `camera-${Date.now()}`,
          accessionNumber: 'LIVE AR ANCHOR',
          title: data.paintingTitle || 'Identified Historical Portrait',
          characterName: data.characterName || 'Historical Figure',
          roleTitle: data.roleTitle || 'Museum Portrait Subject',
          artist: data.artist || 'Attributed School',
          year: data.year || 'Historical Period',
          medium: data.medium || 'Oil on canvas',
          dimensions: 'Tracked in Live Camera',
          galleryLocation: 'Camera AR Viewfinder',
          imageUrl: artworkRef.current.imageUrl,
          voiceName: ['Charon', 'Fenrir', 'Kore', 'Zephyr', 'Puck'].includes(data.suggestedVoice)
            ? data.suggestedVoice
            : 'Charon',
          historicalContext: data.historicalContext || '',
          systemPersona:
            data.systemPersona ||
            `You are ${data.characterName}, speaking from within "${data.paintingTitle}". Speak naturally in the first person with deep historical knowledge.`,
          openingLine:
            data.openingLine ||
            `Greetings, visitor. I am ${data.characterName}. Ask me what you wish to know about my life and this painting.`,
          focalPoint: fp,
          focalBox: quadToBoundingBox(fQuad),
          focalQuad: fQuad,
          hotspots:
            Array.isArray(data.hotspots) && data.hotspots.length > 0
              ? data.hotspots.map((h: Partial<ARHotspot>, idx: number) => {
                  const rawX = typeof h.x === 'number' ? h.x : fBox.x + fBox.width / 2;
                  const rawY =
                    typeof h.y === 'number' ? h.y : fBox.y + fBox.height * (0.3 + idx * 0.14);
                  // Keep markers slightly offset away from face/eyes
                  const offsetPos = offsetAwayFromFocal(rawX, rawY, fp.x, fp.y);
                  return {
                    id: h.id || `hs-${idx}`,
                    label: h.label || `Detail ${idx + 1}`,
                    eraDetail: h.eraDetail || 'Historical detail',
                    x: offsetPos.x,
                    y: offsetPos.y,
                    prompt: h.prompt || `Tell me about ${h.label || 'this detail'}.`,
                    animationCue:
                      h.animationCue === 'sword' ||
                      h.animationCue === 'horse' ||
                      h.animationCue === 'gaze' ||
                      h.animationCue === 'uniform' ||
                      h.animationCue === 'horizon'
                        ? h.animationCue
                        : 'gaze',
                  };
                })
              : [],
          suggestedQuestions:
            Array.isArray(data.suggestedQuestions) && data.suggestedQuestions.length > 0
              ? data.suggestedQuestions
              : [
                  'What historical moment does this portrait capture?',
                  'What were your greatest challenges during this era?',
                ],
        };

        trackedQuadRef.current = fQuad;
        setTrackedQuad(fQuad);
        setCameraDetected(true);
        setAnchorType('other');
        setAutoScan(false);
        setScanNotice(null);
        onArtworkIdentified(identified);
      } catch (err) {
        onCameraError(err instanceof Error ? err.message : 'Portrait recognition failed.');
      } finally {
        setIsScanning(false);
      }
    },
    [onArtworkIdentified, onCameraError]
  );

  const handleScanCameraFrame = useCallback(() => {
    if (isScanning) return;
    const frame = captureVisibleVideoFrame();
    if (!frame) return;
    identifyCameraFrame(frame);
  }, [captureVisibleVideoFrame, identifyCameraFrame, isScanning]);

  // Fallback Vision scan if real-time NCC hasn't locked yet
  useEffect(() => {
    if (!cameraReady || !autoScan || cameraDetected) return;
    const timer = window.setTimeout(() => {
      if (!cameraDetectedRef.current) {
        handleScanCameraFrame();
      }
    }, 1800);
    const interval = window.setInterval(() => {
      if (!cameraDetectedRef.current) {
        handleScanCameraFrame();
      }
    }, 5000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [cameraReady, autoScan, cameraDetected, handleScanCameraFrame]);

  // 60fps Perspective-Warped AR Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!avatarOffscreenCanvasRef.current) {
      const off = document.createElement('canvas');
      off.width = 520;
      off.height = 728;
      avatarOffscreenCanvasRef.current = off;
    }
    if (!perspectiveRendererRef.current) {
      perspectiveRendererRef.current = new PerspectiveCanvasRenderer();
    }

    const motes: DustMote[] = Array.from({ length: 26 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.9 + Math.random() * 1.9,
      vx: (Math.random() - 0.35) * 0.00018,
      vy: -0.00012 - Math.random() * 0.00022,
      alpha: 0.16 + Math.random() * 0.36,
      depth: 0.4 + Math.random() * 1.1,
      phase: Math.random() * Math.PI * 2,
    }));

    let rafId = 0;
    const startTime = performance.now();

    const render = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const parent = canvas.parentElement;
      if (parent) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const cw = parent.clientWidth;
        const ch = parent.clientHeight;
        if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
          canvas.width = Math.round(cw * dpr);
          canvas.height = Math.round(ch * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cw, ch);

        const speech = speechLevelRef.current;
        const currentArtwork = artworkRef.current;
        const currentTilt = tiltRef.current;
        const cue = activeCueRef.current;
        const behavior = {
          speech,
          isSpeaking: isSpeakingRef.current,
          isListening: isListeningRef.current,
          isThinking:
            connectionStateRef.current === 'thinking' ||
            connectionStateRef.current === 'connecting',
          cue,
          tiltX: currentTilt.x,
          tiltY: currentTilt.y,
        };

        const detected = cameraDetectedRef.current;
        const aType = anchorTypeRef.current;
        const video = videoRef.current;
        const hasVideo = cameraReadyRef.current && video && video.readyState >= 2;

        if (!detected) {
          const padX = cw * 0.18;
          const padY = ch * 0.14;
          drawOpticalQuadCorners(
            ctx,
            boxToQuad({ x: padX, y: padY, width: cw - padX * 2, height: ch - padY * 2 }),
            0,
            elapsed,
            0.38
          );
        } else {
          const quadPct = trackedQuadRef.current;
          const quadPx: FocalQuad = {
            topLeft: { x: (quadPct.topLeft.x / 100) * cw, y: (quadPct.topLeft.y / 100) * ch },
            topRight: { x: (quadPct.topRight.x / 100) * cw, y: (quadPct.topRight.y / 100) * ch },
            bottomRight: {
              x: (quadPct.bottomRight.x / 100) * cw,
              y: (quadPct.bottomRight.y / 100) * ch,
            },
            bottomLeft: {
              x: (quadPct.bottomLeft.x / 100) * cw,
              y: (quadPct.bottomLeft.y / 100) * ch,
            },
          };
          const boxPx = quadToBoundingBox(quadPx);

          if (
            aType === 'washington' &&
            washingtonAnchorImgRef.current &&
            washingtonAvatarLoaded &&
            avatarOffscreenCanvasRef.current &&
            perspectiveRendererRef.current
          ) {
            const offCanvas = avatarOffscreenCanvasRef.current;
            const offCtx = offCanvas.getContext('2d');
            if (offCtx) {
              const ow = offCanvas.width;
              const oh = offCanvas.height;
              offCtx.clearRect(0, 0, ow, oh);
              drawAnimatedPaintingComposition(
                offCtx,
                washingtonAnchorImgRef.current,
                washingtonAnchorLayersRef.current,
                0,
                0,
                ow,
                oh,
                elapsed,
                behavior,
                1,
                true
              );
              const offFx = (WASHINGTON_PORTRAIT.focalPoint.x / 100) * ow;
              const offFy = (WASHINGTON_PORTRAIT.focalPoint.y / 100) * oh;
              drawLivingVoiceAura(offCtx, offFx, offFy, Math.min(ow, oh), speech, elapsed);
              drawCueOverlay(offCtx, 0, 0, ow, oh, cue, elapsed);

              // Perspective-skew the animated portrait to fit the 4 tracked corners!
              perspectiveRendererRef.current.draw(ctx, offCanvas, quadPx, cw, ch, 0.96);
            }

            drawOpticalQuadCorners(ctx, quadPx, speech, elapsed, 0.85);
            drawAmbientMotesInQuad(ctx, motes, cw, ch, quadPx, boxPx, currentTilt, speech, elapsed);
          } else {
            // Other identified painting: animate the live camera video pixels directly
            const fx = (currentArtwork.focalPoint.x / 100) * cw;
            const fy = (currentArtwork.focalPoint.y / 100) * ch;
            if (hasVideo && video) {
              animateFigureInLiveVideo(
                ctx,
                video,
                cw,
                ch,
                boxPx.x,
                boxPx.y,
                boxPx.width,
                boxPx.height,
                fx,
                fy,
                elapsed,
                speech,
                cue,
                videoPatchCanvasRef,
                videoMaskCanvasRef
              );
            }
            drawOpticalQuadCorners(ctx, quadPx, speech, elapsed, 0.78);
            drawLivingVoiceAura(ctx, fx, fy, Math.min(boxPx.width, boxPx.height), speech, elapsed);
            drawCueOverlay(ctx, boxPx.x, boxPx.y, boxPx.width, boxPx.height, cue, elapsed);
            drawAmbientMotesInQuad(ctx, motes, cw, ch, quadPx, boxPx, currentTilt, speech, elapsed);
          }
        }
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [washingtonAvatarLoaded, speechLevelRef]);

  // Compute non-blocking AR tag dots + mobile-safe side/above-line callouts
  const positionedTags: PositionedTag[] = useMemo(() => {
    if (!cameraDetected || !showHotspots || artwork.hotspots.length === 0) return [];

    const viewW = containerSize.width;
    const leftMarginPct = Math.max(0, trackedBox.x);
    const rightMarginPct = Math.max(0, 100 - (trackedBox.x + trackedBox.width));
    const leftSpacePx = (leftMarginPct / 100) * viewW;
    const rightSpacePx = (rightMarginPct / 100) * viewW;

    const getSidePlacement = (spacePx: number): 'hidden' | 'wide-side' | 'above-line' => {
      if (spacePx >= 138) return 'wide-side';
      if (spacePx >= 44) return 'above-line';
      return 'hidden';
    };

    const leftPlacement = getSidePlacement(leftSpacePx);
    const rightPlacement = getSidePlacement(rightSpacePx);

    const raw = artwork.hotspots.map((spot) => {
      let dotX = spot.x;
      let dotY = spot.y;
      if (anchorType === 'washington') {
        const pt = projectUvThroughQuad(trackedQuad, spot.x / 100, spot.y / 100);
        dotX = pt.x;
        dotY = pt.y;
      }

      const boxMidX = trackedBox.x + trackedBox.width / 2;
      const side: 'left' | 'right' = dotX < boxMidX ? 'left' : 'right';
      return { spot, dotX, dotY, side };
    });

    const assignStaggeredY = (items: typeof raw, placement: 'hidden' | 'wide-side' | 'above-line') => {
      const sorted = [...items].sort((a, b) => a.dotY - b.dotY);
      const minGap = placement === 'above-line' ? 10 : 8.5;
      const result = new Map<string, number>();
      let prevY = 12;
      for (const item of sorted) {
        const clamped = Math.max(prevY + minGap, Math.min(76, item.dotY));
        result.set(item.spot.id, clamped);
        prevY = clamped;
      }
      return result;
    };

    const leftYMap = assignStaggeredY(raw.filter((r) => r.side === 'left'), leftPlacement);
    const rightYMap = assignStaggeredY(raw.filter((r) => r.side === 'right'), rightPlacement);

    return raw.map((item) => {
      const isLeft = item.side === 'left';
      const placement = isLeft ? leftPlacement : rightPlacement;
      const spacePx = isLeft ? leftSpacePx : rightSpacePx;
      const labelY =
        (isLeft ? leftYMap.get(item.spot.id) : rightYMap.get(item.spot.id)) ?? item.dotY;

      const safeOuterPct = 3;
      if (placement === 'wide-side') {
        const labelAnchorX = isLeft
          ? Math.max(12, trackedBox.x - 2.2)
          : Math.min(88, trackedBox.x + trackedBox.width + 2.2);
        const elbowX = isLeft
          ? Math.max(labelAnchorX + 1.0, trackedBox.x - 0.5)
          : Math.min(labelAnchorX - 1.0, trackedBox.x + trackedBox.width + 0.5);
        const availPx = isLeft
          ? (labelAnchorX / 100) * viewW - 12
          : ((100 - labelAnchorX) / 100) * viewW - 12;

        return {
          spot: item.spot,
          dotX: item.dotX,
          dotY: item.dotY,
          side: item.side,
          placement,
          elbowX,
          lineEndX: labelAnchorX,
          labelAnchorX,
          labelY,
          maxWidthPx: Math.max(76, Math.round(availPx)),
        };
      }

      // 'above-line' mobile-safe placement: horizontal shelf ends near safe screen edge (3% / 97%),
      // and wrapped compact text sits directly above that line inside the viewport.
      const lineEndX = isLeft ? safeOuterPct : 100 - safeOuterPct;
      const elbowX = isLeft
        ? Math.max(safeOuterPct + 4, trackedBox.x - 0.6)
        : Math.min(100 - safeOuterPct - 4, trackedBox.x + trackedBox.width + 0.6);

      return {
        spot: item.spot,
        dotX: item.dotX,
        dotY: item.dotY,
        side: item.side,
        placement,
        elbowX,
        lineEndX,
        labelAnchorX: lineEndX,
        labelY,
        maxWidthPx: Math.max(66, Math.min(110, Math.round(spacePx + 14))),
      };
    });
  }, [anchorType, artwork.hotspots, cameraDetected, containerSize.width, showHotspots, trackedBox, trackedQuad]);

  const activeHotspot = useMemo(
    () => artwork.hotspots.find((h) => h.id === activeHotspotId) || null,
    [artwork.hotspots, activeHotspotId]
  );

  const avatarTapCenter = useMemo(() => {
    if (anchorType === 'washington') {
      return projectUvThroughQuad(trackedQuad, 0.45, 0.34);
    }
    return {
      x: trackedBox.x + trackedBox.width * 0.5,
      y: trackedBox.y + trackedBox.height * 0.36,
    };
  }, [anchorType, trackedBox, trackedQuad]);

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="relative w-full h-full bg-[#0D0C0A] overflow-hidden select-none"
    >
      {/* Full-Screen Live Camera Feed */}
      <video
        ref={videoRef}
        playsInline
        muted
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
          cameraReady ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Camera permission awaiting state */}
      {!cameraReady && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#0D0C0A] text-[#F6F3EC]">
          <Camera className="w-9 h-9 text-[#C79A52] mb-3" />
          <p className="font-serif text-2xl font-medium">Starting AR Camera</p>
          <p className="text-sm text-[#B8B0A2] max-w-sm mt-2 leading-relaxed">
            Allow camera and microphone access, then point at the George Washington painting anchor.
          </p>
        </div>
      )}

      {/* Living Perspective-Warped AR Canvas Overlay */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Interactive Tap Target Directly on Anchored George Washington Avatar */}
      {cameraDetected && (
        <button
          type="button"
          onClick={onAvatarTap}
          aria-label={`Interact with ${artwork.characterName} avatar`}
          style={{
            left: `${avatarTapCenter.x}%`,
            top: `${avatarTapCenter.y}%`,
            width: `${Math.max(14, trackedBox.width * 0.45)}%`,
            height: `${Math.max(18, trackedBox.height * 0.4)}%`,
            transform: 'translate(-50%, -50%)',
          }}
          className="absolute z-10 cursor-pointer bg-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#E2B46D]/70 rounded-xl"
        />
      )}

      {/* Non-Blocking AR Tags: Very Small Offset Circles + Responsive Side / Above-Line Callouts */}
      {positionedTags.length > 0 && (
        <div className="absolute inset-0 z-10 pointer-events-none">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full pointer-events-none"
          >
            {positionedTags.map((tag) => {
              if (tag.placement === 'hidden') return null;
              const isActive = activeHotspotId === tag.spot.id;
              return (
                <polyline
                  key={`line-${tag.spot.id}`}
                  points={`${tag.dotX},${tag.dotY} ${tag.elbowX},${tag.labelY} ${tag.lineEndX},${tag.labelY}`}
                  fill="none"
                  vectorEffect="non-scaling-stroke"
                  stroke={isActive ? 'rgba(229, 190, 128, 0.95)' : 'rgba(246, 243, 236, 0.6)'}
                  strokeWidth={isActive ? 1.5 : 1}
                />
              );
            })}
          </svg>

          {positionedTags.map((tag) => {
            const isActive = activeHotspotId === tag.spot.id;
            return (
              <button
                key={`dot-${tag.spot.id}`}
                type="button"
                onClick={() => onSelectHotspot(tag.spot)}
                aria-label={`Inspect ${tag.spot.label}`}
                style={{ left: `${tag.dotX}%`, top: `${tag.dotY}%` }}
                className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-transparent cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#E2B46D]"
              >
                <span
                  className={`rounded-full transition-transform duration-150 ${
                    isActive
                      ? 'w-2.5 h-2.5 bg-[#E2B46D] ring-2 ring-[#F6F3EC] scale-110'
                      : 'w-2 h-2 bg-[#F6F3EC]/90 ring-1 ring-[#E2B46D]/90 hover:scale-125'
                  }`}
                />
              </button>
            );
          })}

          {positionedTags.map((tag) => {
            if (tag.placement === 'hidden') return null;
            const isActive = activeHotspotId === tag.spot.id;
            const isLeft = tag.side === 'left';
            const isAboveLine = tag.placement === 'above-line';

            const transform = isAboveLine
              ? isLeft
                ? 'translate(0, -100%)'
                : 'translate(-100%, -100%)'
              : isLeft
              ? 'translate(-100%, -50%)'
              : 'translate(0, -50%)';

            const textAlignClass = isAboveLine
              ? isLeft
                ? 'text-left pb-1'
                : 'text-right pb-1'
              : isLeft
              ? 'text-right pr-1.5'
              : 'text-left pl-1.5';

            return (
              <button
                key={`label-${tag.spot.id}`}
                type="button"
                onClick={() => onSelectHotspot(tag.spot)}
                style={{
                  left: `${tag.labelAnchorX}%`,
                  top: `${tag.labelY}%`,
                  transform,
                  maxWidth: `${tag.maxWidthPx}px`,
                }}
                className={`pointer-events-auto absolute py-0.5 leading-[1.15] cursor-pointer transition-colors ${
                  isAboveLine ? 'text-[10px] whitespace-normal' : 'text-[11px] whitespace-nowrap truncate'
                } ${textAlignClass} ${
                  isActive
                    ? 'text-[#E6C285] font-semibold'
                    : 'text-[#F6F3EC]/92 hover:text-[#E6C285] font-medium'
                }`}
              >
                <span className="drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]">{tag.spot.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Minimal Floating Top Viewfinder Controls (No Speak Button) */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="pointer-events-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/55 backdrop-blur-md border border-white/12 text-xs text-[#F6F3EC]">
          <span
            className={`w-2 h-2 rounded-full ${
              isSpeaking
                ? 'bg-[#E2B46D] animate-pulse'
                : isListening
                ? 'bg-emerald-400 animate-pulse'
                : connectionState === 'connecting'
                ? 'bg-amber-300 animate-pulse'
                : 'bg-white/40'
            }`}
          />
          <Mic className="w-3.5 h-3.5 text-[#E6C285]" />
          <span className="font-medium">
            {needsAudioGesture
              ? 'Tap anywhere to enable mic'
              : isSpeaking
              ? `${artwork.characterName} speaking`
              : isListening
              ? 'Mic active'
              : connectionState === 'connecting'
              ? 'Connecting mic...'
              : 'Mic standby'}
          </span>
          {cameraDetected && anchorType === 'washington' && anchorConfidence > 0 && (
            <span className="hidden sm:inline text-white/55 font-mono tabular-nums">
              · {Math.round(anchorConfidence * 100)}%
            </span>
          )}
        </div>

        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          {availableCameras.length > 1 && (
            <select
              aria-label="Select camera device"
              value={selectedCameraId}
              onChange={(e) => setSelectedCameraId(e.target.value)}
              className="min-h-[36px] max-w-[175px] px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/15 text-[#F6F3EC] text-xs font-medium truncate focus:outline-none focus:border-[#E2B46D]"
            >
              {availableCameras.map((cam, idx) => (
                <option key={cam.deviceId} value={cam.deviceId} className="bg-[#181614] text-[#F6F3EC]">
                  {cam.label || `Camera ${idx + 1}`}
                </option>
              ))}
            </select>
          )}

          {cameraReady && (
            <>
              <button
                type="button"
                onClick={() => setAutoScan((v) => !v)}
                className={`min-h-[36px] px-3 py-1 rounded-lg backdrop-blur-md border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  autoScan
                    ? 'bg-[#F6F3EC]/90 text-[#181614] border-[#F6F3EC]'
                    : 'bg-black/60 text-[#F6F3EC] border-white/15 hover:bg-black/80'
                }`}
              >
                {autoScan ? 'Auto-Track On' : 'Auto-Track Off'}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (cameraDetected) {
                    anchorTrackerRef.current.clearLock();
                    setCameraDetected(false);
                    setAnchorType(null);
                  }
                  handleScanCameraFrame();
                }}
                disabled={isScanning}
                className="min-h-[36px] px-3 py-1 rounded-lg bg-[#B4833E] text-[#11100F] text-xs font-semibold hover:bg-[#C79A52] disabled:opacity-60 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Scan className="w-3.5 h-3.5" />
                {isScanning ? 'Scanning...' : cameraDetected ? 'Re-Scan' : 'Scan'}
              </button>
            </>
          )}

          {isCustomArtwork && (
            <button
              type="button"
              onClick={() => {
                anchorTrackerRef.current.clearLock();
                setCameraDetected(false);
                setAnchorType(null);
                onResetToWashington();
              }}
              title="Return to Washington Anchor"
              className="min-h-[36px] px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/15 text-[#F6F3EC] text-xs font-medium hover:bg-black/80 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Washington
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowHotspots((v) => !v)}
            aria-label={showHotspots ? 'Hide portrait markers' : 'Show portrait markers'}
            className="min-h-[36px] min-w-[36px] px-2 rounded-lg bg-black/60 backdrop-blur-md border border-white/15 text-[#F6F3EC] hover:bg-black/80 transition-colors flex items-center justify-center"
          >
            {showHotspots ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Subtle scan or error notice */}
      {(errorMessage || scanNotice) && (
        <div className="absolute top-15 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-lg bg-black/70 backdrop-blur-md border border-white/15 text-xs text-[#F6F3EC] max-w-[90%] text-center pointer-events-none">
          {errorMessage || scanNotice}
        </div>
      )}

      {/* Subtle Bottom Scrim: Live AR Subtitles Only */}
      <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none bg-gradient-to-t from-black/85 via-black/45 to-transparent pt-14 pb-5 px-5 sm:px-8">
        <div className="max-w-3xl">
          {activeHotspot && (
            <p className="text-[11px] uppercase tracking-widest text-[#E6C285] mb-1">
              {activeHotspot.label} · {activeHotspot.eraDetail}
            </p>
          )}

          {latestVisitorLine && (
            <p className="text-xs text-[#D6CFC2] truncate mb-0.5">
              You: “{latestVisitorLine.text}”
            </p>
          )}

          {latestDialogue && cameraDetected && (
            <p className="text-sm sm:text-base text-[#F6F3EC] font-serif italic leading-snug line-clamp-3">
              “{latestDialogue.text}”
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

function isValidQuadShape(q: unknown): q is FocalQuad {
  if (!q || typeof q !== 'object') return false;
  const cand = q as FocalQuad;
  const pts = [cand.topLeft, cand.topRight, cand.bottomRight, cand.bottomLeft];
  return pts.every(
    (p) =>
      p &&
      typeof p.x === 'number' &&
      typeof p.y === 'number' &&
      Number.isFinite(p.x) &&
      Number.isFinite(p.y)
  );
}

function offsetAwayFromFocal(
  x: number,
  y: number,
  fx: number,
  fy: number
): { x: number; y: number } {
  const dx = x - fx;
  const dy = y - fy;
  const dist = Math.hypot(dx, dy);
  if (dist >= 7) return { x, y };
  const dirX = dx >= 0 ? 1 : -1;
  return {
    x: Math.max(8, Math.min(92, fx + dirX * 8)),
    y: Math.max(8, Math.min(92, y - 3)),
  };
}

function animateFigureInLiveVideo(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  cw: number,
  ch: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
  fx: number,
  fy: number,
  elapsed: number,
  speech: number,
  cue: string | null,
  patchCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>,
  maskCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>
) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;

  const scale = Math.max(cw / vw, ch / vh);
  const visSrcW = cw / scale;
  const visSrcH = ch / scale;
  const visSrcX = (vw - visSrcW) / 2;
  const visSrcY = (vh - visSrcH) / 2;

  const patchW = Math.max(64, Math.min(cw * 0.45, bw * 0.42));
  const patchH = Math.max(80, Math.min(ch * 0.5, bh * 0.44));
  const px = fx - patchW / 2;
  const py = fy - patchH * 0.42;

  const srcPatchX = visSrcX + (px / cw) * visSrcW;
  const srcPatchY = visSrcY + (py / ch) * visSrcH;
  const srcPatchW = (patchW / cw) * visSrcW;
  const srcPatchH = (patchH / ch) * visSrcH;

  if (!patchCanvasRef.current) {
    patchCanvasRef.current = document.createElement('canvas');
  }
  if (!maskCanvasRef.current) {
    maskCanvasRef.current = document.createElement('canvas');
  }

  const patchCanvas = patchCanvasRef.current;
  const maskCanvas = maskCanvasRef.current;
  const pw = Math.round(patchW);
  const ph = Math.round(patchH);

  if (patchCanvas.width !== pw || patchCanvas.height !== ph) {
    patchCanvas.width = pw;
    patchCanvas.height = ph;
    maskCanvas.width = pw;
    maskCanvas.height = ph;

    const mctx = maskCanvas.getContext('2d');
    if (mctx) {
      mctx.clearRect(0, 0, pw, ph);
      mctx.save();
      mctx.translate(pw / 2, ph / 2);
      mctx.scale(1, ph / Math.max(1, pw));
      const r = pw / 2;
      const grad = mctx.createRadialGradient(0, 0, r * 0.25, 0, 0, r);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.96)');
      grad.addColorStop(0.6, 'rgba(255, 255, 255, 0.65)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      mctx.fillStyle = grad;
      mctx.beginPath();
      mctx.arc(0, 0, r, 0, Math.PI * 2);
      mctx.fill();
      mctx.restore();
    }
  }

  const pctx = patchCanvas.getContext('2d');
  if (!pctx) return;
  pctx.clearRect(0, 0, pw, ph);
  pctx.drawImage(
    video,
    Math.max(0, srcPatchX),
    Math.max(0, srcPatchY),
    Math.max(1, srcPatchW),
    Math.max(1, srcPatchH),
    0,
    0,
    pw,
    ph
  );
  pctx.globalCompositeOperation = 'destination-in';
  pctx.drawImage(maskCanvas, 0, 0);
  pctx.globalCompositeOperation = 'source-over';

  const cueBoost = cue === 'gaze' ? 1.6 : 1;
  const breathScale = 1 + Math.sin(elapsed * 1.6) * 0.014 + speech * 0.032;
  const angle =
    Math.sin(elapsed * 1.15) * 0.018 * cueBoost +
    Math.sin(elapsed * 6.5) * speech * 0.028;
  const liftY = Math.sin(elapsed * 1.6) * -1.6 - speech * 4.0;
  const swayX = Math.cos(elapsed * 0.9) * 1.4;

  const pivotX = fx;
  const pivotY = py + patchH * 0.72;

  ctx.save();
  ctx.translate(pivotX + swayX, pivotY + liftY);
  ctx.rotate(angle);
  ctx.scale(breathScale, breathScale);
  ctx.drawImage(patchCanvas, -patchW / 2, -patchH * 0.72, patchW, patchH);
  ctx.restore();

  const breezeProgress = ((elapsed * 0.07) % 1.4) - 0.2;
  const wx = bx + breezeProgress * bw;
  const wy = by + bh * 0.22;
  const rad = bw * 0.28;
  const skyGrad = ctx.createRadialGradient(wx, wy, 2, wx, wy, rad);
  skyGrad.addColorStop(0, 'rgba(244, 224, 186, 0.12)');
  skyGrad.addColorStop(1, 'rgba(244, 224, 186, 0)');
  ctx.fillStyle = skyGrad;
  ctx.beginPath();
  ctx.arc(wx, wy, rad, 0, Math.PI * 2);
  ctx.fill();
}

function drawAmbientMotesInQuad(
  ctx: CanvasRenderingContext2D,
  motes: DustMote[],
  cw: number,
  ch: number,
  quad: FocalQuad,
  box: FocalBox,
  tilt: { x: number; y: number },
  speech: number,
  elapsed: number
) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(quad.topLeft.x, quad.topLeft.y);
  ctx.lineTo(quad.topRight.x, quad.topRight.y);
  ctx.lineTo(quad.bottomRight.x, quad.bottomRight.y);
  ctx.lineTo(quad.bottomLeft.x, quad.bottomLeft.y);
  ctx.closePath();
  ctx.clip();

  for (const m of motes) {
    m.x += m.vx + Math.sin(elapsed * 0.7 + m.phase) * 0.00009;
    m.y += m.vy;
    if (m.y < -0.02) {
      m.y = 1.02;
      m.x = Math.random();
    }
    if (m.x < -0.02) m.x = 1.02;
    if (m.x > 1.02) m.x = -0.02;

    const px = box.x + m.x * box.width + tilt.x * 14 * m.depth;
    const py = box.y + m.y * box.height + tilt.y * 10 * m.depth;
    if (px < 0 || px > cw || py < 0 || py > ch) continue;

    const shimmer = 0.65 + 0.35 * Math.sin(elapsed * 2.1 + m.phase);
    const alpha = m.alpha * shimmer * (1 + speech * 0.8);

    ctx.beginPath();
    ctx.arc(px, py, m.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(235, 198, 132, ${Math.min(0.85, alpha)})`;
    ctx.fill();
  }
  ctx.restore();
}

function drawLivingVoiceAura(
  ctx: CanvasRenderingContext2D,
  fx: number,
  fy: number,
  scale: number,
  speech: number,
  elapsed: number
) {
  const glowRadius = scale * (0.2 + speech * 0.18);
  const glowAlpha = 0.08 + speech * 0.28;
  const grad = ctx.createRadialGradient(fx, fy, 4, fx, fy, glowRadius);
  grad.addColorStop(0, `rgba(232, 186, 112, ${glowAlpha})`);
  grad.addColorStop(0.5, `rgba(180, 131, 62, ${glowAlpha * 0.45})`);
  grad.addColorStop(1, 'rgba(180, 131, 62, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(fx, fy, glowRadius, 0, Math.PI * 2);
  ctx.fill();

  if (speech > 0.03) {
    for (let i = 0; i < 3; i++) {
      const wavePhase = (elapsed * 1.15 + i * 0.33) % 1;
      const r = scale * (0.06 + wavePhase * (0.14 + speech * 0.14));
      const ringAlpha = (1 - wavePhase) * Math.min(0.55, speech * 0.75);
      ctx.beginPath();
      ctx.arc(fx, fy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(229, 190, 128, ${ringAlpha})`;
      ctx.lineWidth = 1.25;
      ctx.stroke();
    }
  }
}

function drawOpticalQuadCorners(
  ctx: CanvasRenderingContext2D,
  quad: FocalQuad,
  speech: number,
  elapsed: number,
  baseAlpha = 0.62
) {
  const alpha = baseAlpha + speech * 0.3 + Math.sin(elapsed * 2) * 0.06;
  ctx.strokeStyle = `rgba(224, 184, 118, ${alpha})`;
  ctx.lineWidth = 1.75;

  const drawCorner = (corner: QuadCorner, nextA: QuadCorner, nextB: QuadCorner) => {
    const lenA = Math.hypot(nextA.x - corner.x, nextA.y - corner.y);
    const lenB = Math.hypot(nextB.x - corner.x, nextB.y - corner.y);
    const armA = Math.min(26, lenA * 0.14);
    const armB = Math.min(26, lenB * 0.14);
    if (lenA < 1 || lenB < 1) return;

    const pAx = corner.x + ((nextA.x - corner.x) / lenA) * armA;
    const pAy = corner.y + ((nextA.y - corner.y) / lenA) * armA;
    const pBx = corner.x + ((nextB.x - corner.x) / lenB) * armB;
    const pBy = corner.y + ((nextB.y - corner.y) / lenB) * armB;

    ctx.beginPath();
    ctx.moveTo(pAx, pAy);
    ctx.lineTo(corner.x, corner.y);
    ctx.lineTo(pBx, pBy);
    ctx.stroke();
  };

  drawCorner(quad.topLeft, quad.topRight, quad.bottomLeft);
  drawCorner(quad.topRight, quad.topLeft, quad.bottomRight);
  drawCorner(quad.bottomRight, quad.topRight, quad.bottomLeft);
  drawCorner(quad.bottomLeft, quad.topLeft, quad.bottomRight);
}

function drawCueOverlay(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  dw: number,
  dh: number,
  cue: string | null,
  elapsed: number
) {
  if (!cue) return;
  if (cue === 'sword') {
    const sx = ox + dw * 0.13;
    const sy = oy + dh * 0.37;
    const ex = ox + dw * 0.32;
    const ey = oy + dh * 0.31;
    const t = (Math.sin(elapsed * 3.5) + 1) / 2;
    const px = sx + (ex - sx) * t;
    const py = sy + (ey - sy) * t;
    const grad = ctx.createRadialGradient(px, py, 1, px, py, dw * 0.08);
    grad.addColorStop(0, 'rgba(255, 244, 214, 0.55)');
    grad.addColorStop(1, 'rgba(255, 244, 214, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, dw * 0.08, 0, Math.PI * 2);
    ctx.fill();
  } else if (cue === 'horse') {
    const hx = ox + dw * 0.62;
    const hy = oy + dh * 0.78;
    const grad = ctx.createRadialGradient(hx, hy, 4, hx, hy, dw * 0.22);
    grad.addColorStop(0, 'rgba(218, 198, 164, 0.24)');
    grad.addColorStop(1, 'rgba(218, 198, 164, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(hx, hy, dw * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }
}

function pickPreferredExternalCamera(devices: MediaDeviceInfo[]): MediaDeviceInfo | null {
  if (devices.length === 0) return null;

  const builtInRegex =
    /integrated|built-in|facetime|internal|laptop|macbook|truevision|user facing|front|ir camera|infrared|depth/i;
  const externalRegex =
    /usb|external|logitech|elgato|razer|brio|c920|c922|c930|streamcam|hd pro|cam link|capture|avermedia|insta360|ugreen|anker|obs/i;
  const rearMobileRegex = /back|rear|environment/i;

  let best: MediaDeviceInfo | null = null;
  let bestScore = -999;

  for (const dev of devices) {
    const label = dev.label || '';
    let score = 0;

    if (externalRegex.test(label)) score += 12;
    if (rearMobileRegex.test(label)) score += 8;
    if (builtInRegex.test(label)) score -= 10;
    if (!builtInRegex.test(label) && label.length > 0) score += 4;
    if (/virtual|obs/i.test(label)) score -= 2;

    if (score > bestScore) {
      bestScore = score;
      best = dev;
    }
  }

  return best;
}

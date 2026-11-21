import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  Image as ImageIcon,
  Scan,
  Upload,
  Sparkles,
  RotateCcw,
  Eye,
  EyeOff,
  Mic,
  MicOff,
} from 'lucide-react';
import {
  ARHotspot,
  DialogueEntry,
  LensMode,
  PortraitArtwork,
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

interface ARPortraitStageProps {
  artwork: PortraitArtwork;
  lensMode: LensMode;
  onChangeLensMode: (mode: LensMode) => void;
  speechLevelRef: React.MutableRefObject<number>;
  isSpeaking: boolean;
  isListening: boolean;
  connectionState: VoiceConnectionState;
  activeHotspotId: string | null;
  activeCue: string | null;
  latestDialogue: DialogueEntry | null;
  latestVisitorLine: DialogueEntry | null;
  onSelectHotspot: (hotspot: ARHotspot) => void;
  onArtworkIdentified: (artwork: PortraitArtwork, source: 'camera' | 'upload') => void;
  onResetToWashington: () => void;
  isCustomArtwork: boolean;
  onSendCameraFrame: (jpegBase64: string) => void;
  onCameraError: (msg: string | null) => void;
  onToggleVoice: () => void;
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

interface TrackedBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const PortraitStage: React.FC<ARPortraitStageProps> = ({
  artwork,
  lensMode,
  onChangeLensMode,
  speechLevelRef,
  isSpeaking,
  isListening,
  connectionState,
  activeHotspotId,
  activeCue,
  latestDialogue,
  latestVisitorLine,
  onSelectHotspot,
  onArtworkIdentified,
  onResetToWashington,
  isCustomArtwork,
  onSendCameraFrame,
  onCameraError,
  onToggleVoice,
  onAvatarTap,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const portraitImgRef = useRef<HTMLImageElement | null>(null);
  const cachedLayersRef = useRef<CachedPortraitLayer[]>([]);
  const washingtonAnchorImgRef = useRef<HTMLImageElement | null>(null);
  const washingtonAnchorLayersRef = useRef<CachedPortraitLayer[]>([]);
  const anchorTrackerRef = useRef<WashingtonAnchorTracker>(
    new WashingtonAnchorTracker(WASHINGTON_PORTRAIT.imageUrl)
  );
  const videoPatchCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoMaskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [imgLoaded, setImgLoaded] = useState(false);
  const [washingtonAvatarLoaded, setWashingtonAvatarLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [autoScan, setAutoScan] = useState(true);
  const [cameraDetected, setCameraDetected] = useState(false);
  const [anchorType, setAnchorType] = useState<'washington' | 'other' | null>(null);
  const [trackedBox, setTrackedBox] = useState<TrackedBox>({
    x: 18,
    y: 12,
    width: 64,
    height: 76,
  });
  const [anchorConfidence, setAnchorConfidence] = useState<number>(0);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [showHotspots, setShowHotspots] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const tiltRef = useRef({ x: 0, y: 0 });
  const activeCueRef = useRef<string | null>(activeCue);
  const artworkRef = useRef<PortraitArtwork>(artwork);
  const lensModeRef = useRef<LensMode>(lensMode);
  const cameraReadyRef = useRef(cameraReady);
  const cameraDetectedRef = useRef(cameraDetected);
  const anchorTypeRef = useRef<'washington' | 'other' | null>(anchorType);
  const trackedBoxRef = useRef<TrackedBox>(trackedBox);
  const isSpeakingRef = useRef(isSpeaking);
  const isListeningRef = useRef(isListening);
  const connectionStateRef = useRef(connectionState);

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
    lensModeRef.current = lensMode;
  }, [lensMode]);
  useEffect(() => {
    cameraReadyRef.current = cameraReady;
  }, [cameraReady]);
  useEffect(() => {
    cameraDetectedRef.current = cameraDetected;
  }, [cameraDetected]);
  useEffect(() => {
    anchorTypeRef.current = anchorType;
  }, [anchorType]);
  useEffect(() => {
    trackedBoxRef.current = trackedBox;
  }, [trackedBox]);
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

  // Load portrait image for Gallery Portrait mode
  useEffect(() => {
    if (lensMode === 'camera') return;
    setImgLoaded(false);
    setImgError(false);
    cachedLayersRef.current = [];
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      portraitImgRef.current = img;
      const specs = getPortraitRegionSpecs(
        artwork.id === 'washington-equestrian-1777',
        artwork.focalPoint
      );
      cachedLayersRef.current = buildFeatheredLayers(img, specs);
      setImgLoaded(true);
    };
    img.onerror = () => {
      setImgError(true);
    };
    img.src = artwork.imageUrl;
  }, [artwork.imageUrl, artwork.id, artwork.focalPoint, lensMode]);

  // Reset camera anchor lock when switching back into Camera AR
  useEffect(() => {
    if (lensMode === 'camera') {
      setCameraDetected(false);
      setAnchorType(null);
      setAnchorConfidence(0);
      anchorTrackerRef.current.clearLock();
      setScanNotice('Aim your camera at the Washington painting anchor.');
    } else {
      setScanNotice(null);
    }
  }, [lensMode]);

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

  // Manage smartphone camera stream lifecycle
  useEffect(() => {
    let cancelled = false;
    if (lensMode !== 'camera') {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setCameraReady(false);
      return;
    }

    const startCamera = async () => {
      onCameraError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
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
              ? `Camera unavailable: ${err.message}. Switch to Gallery Portrait or upload a photo.`
              : 'Camera permission unavailable. Switch to Gallery Portrait or upload a photo.'
          );
        }
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setCameraReady(false);
    };
  }, [lensMode, onCameraError]);

  // Real-time 10Hz AR Image Anchor Tracking loop against the uploaded Washington painting
  useEffect(() => {
    if (lensMode !== 'camera' || !cameraReady) return;

    const interval = window.setInterval(() => {
      const video = videoRef.current;
      const container = containerRef.current;
      if (!video || !container || video.readyState < 2) return;

      // If locked onto a non-Washington painting via Gemini Vision, keep it until user re-scans
      if (anchorTypeRef.current === 'other' && cameraDetectedRef.current) return;

      const result = anchorTrackerRef.current.trackFrame(
        video,
        container.clientWidth,
        container.clientHeight
      );
      if (!result) return;

      setAnchorConfidence(result.confidence);

      if (result.detected) {
        trackedBoxRef.current = result.box;
        setTrackedBox(result.box);
        if (!cameraDetectedRef.current || anchorTypeRef.current !== 'washington') {
          setCameraDetected(true);
          setAnchorType('washington');
          setScanNotice('Washington AR anchor locked — tap or speak to converse.');
          if (artworkRef.current.id !== WASHINGTON_PORTRAIT.id) {
            onArtworkIdentified(
              { ...WASHINGTON_PORTRAIT, focalBox: result.box },
              'camera'
            );
          }
        }
      } else if (anchorTypeRef.current === 'washington') {
        setCameraDetected(false);
        setAnchorType(null);
        setScanNotice('Anchor lost — aim camera back at the Washington portrait.');
      }
    }, 100);

    return () => window.clearInterval(interval);
  }, [lensMode, cameraReady, onArtworkIdentified]);

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
    if (lensMode !== 'camera' || !cameraReady || connectionState !== 'live') return;
    const interval = window.setInterval(() => {
      const frame = captureVisibleVideoFrame();
      if (frame) onSendCameraFrame(frame);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [lensMode, cameraReady, connectionState, captureVisibleVideoFrame, onSendCameraFrame]);

  // Gemini Vision recognition for steep angles or other paintings
  const identifyImageBase64 = useCallback(
    async (dataUrl: string, source: 'camera' | 'upload', mimeType = 'image/jpeg') => {
      setIsScanning(true);
      setScanNotice(
        source === 'camera'
          ? 'Checking camera frame for portrait anchor...'
          : 'Analyzing portrait artwork...'
      );
      onCameraError(null);
      try {
        const res = await fetch('/api/identify-portrait', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: dataUrl, mimeType }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Could not analyze the frame.');
        }

        if (!data.detected) {
          if (source === 'camera' && anchorTypeRef.current !== 'washington') {
            setCameraDetected(false);
            setScanNotice(
              data.historicalContext ||
                'No painting recognized yet. Aim at the Washington portrait anchor.'
            );
          }
          return;
        }

        const fBox: TrackedBox = data.focalBox || { x: 18, y: 12, width: 64, height: 76 };

        // If Gemini Vision recognized the Washington anchor image in the camera feed,
        // lock the interactive Washington AI Avatar directly onto that anchor!
        if (data.isWashingtonAnchor) {
          const washingtonAnchored: PortraitArtwork = {
            ...WASHINGTON_PORTRAIT,
            focalBox: fBox,
          };
          if (source === 'camera') {
            anchorTrackerRef.current.seedLock(fBox);
            trackedBoxRef.current = fBox;
            setTrackedBox(fBox);
            setCameraDetected(true);
            setAnchorType('washington');
            setScanNotice('Washington AR anchor locked — avatar active.');
          }
          onArtworkIdentified(washingtonAnchored, source);
          return;
        }

        const identified: PortraitArtwork = {
          id: `${source}-${Date.now()}`,
          accessionNumber: source === 'camera' ? 'LIVE AR ANCHOR' : 'UPLOADED PORTRAIT',
          title: data.paintingTitle || 'Identified Historical Portrait',
          characterName: data.characterName || 'Historical Figure',
          roleTitle: data.roleTitle || 'Museum Portrait Subject',
          artist: data.artist || 'Attributed School',
          year: data.year || 'Historical Period',
          medium: data.medium || 'Oil on canvas',
          dimensions: source === 'camera' ? 'Tracked in Live Camera' : 'Uploaded Study',
          galleryLocation: source === 'camera' ? 'Camera AR Viewfinder' : 'Visitor Archive',
          imageUrl: source === 'upload' ? dataUrl : artworkRef.current.imageUrl,
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
          focalPoint: {
            x: typeof data.focalPoint?.x === 'number' ? data.focalPoint.x : fBox.x + fBox.width / 2,
            y: typeof data.focalPoint?.y === 'number' ? data.focalPoint.y : fBox.y + fBox.height * 0.3,
          },
          focalBox: fBox,
          hotspots:
            Array.isArray(data.hotspots) && data.hotspots.length > 0
              ? data.hotspots.map((h: Partial<ARHotspot>, idx: number) => ({
                  id: h.id || `hs-${idx}`,
                  label: h.label || `Detail ${idx + 1}`,
                  eraDetail: h.eraDetail || 'Historical detail',
                  x: typeof h.x === 'number' ? h.x : fBox.x + fBox.width / 2,
                  y: typeof h.y === 'number' ? h.y : fBox.y + fBox.height * (0.3 + idx * 0.14),
                  prompt: h.prompt || `Tell me about ${h.label || 'this detail'}.`,
                  animationCue:
                    h.animationCue === 'sword' ||
                    h.animationCue === 'horse' ||
                    h.animationCue === 'gaze' ||
                    h.animationCue === 'uniform' ||
                    h.animationCue === 'horizon'
                      ? h.animationCue
                      : 'gaze',
                }))
              : [],
          suggestedQuestions:
            Array.isArray(data.suggestedQuestions) && data.suggestedQuestions.length > 0
              ? data.suggestedQuestions
              : [
                  'What historical moment does this portrait capture?',
                  'What were your greatest challenges during this era?',
                ],
        };

        if (source === 'camera') {
          trackedBoxRef.current = fBox;
          setTrackedBox(fBox);
          setCameraDetected(true);
          setAnchorType('other');
          setAutoScan(false);
          setScanNotice(`Anchored: ${identified.characterName}`);
        } else {
          setScanNotice(null);
        }
        onArtworkIdentified(identified, source);
      } catch (err) {
        onCameraError(err instanceof Error ? err.message : 'Portrait recognition failed.');
        setScanNotice(null);
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
    identifyImageBase64(frame, 'camera', 'image/jpeg');
  }, [captureVisibleVideoFrame, identifyImageBase64, isScanning]);

  // Fallback Vision scan if real-time NCC hasn't locked yet (e.g. steep perspective or another painting)
  useEffect(() => {
    if (lensMode !== 'camera' || !cameraReady || !autoScan || cameraDetected) return;
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
  }, [lensMode, cameraReady, autoScan, cameraDetected, handleScanCameraFrame]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        identifyImageBase64(reader.result, 'upload', file.type || 'image/jpeg');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // 60fps AR Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const motes: DustMote[] = Array.from({ length: 28 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.9 + Math.random() * 1.9,
      vx: (Math.random() - 0.35) * 0.00018,
      vy: -0.00012 - Math.random() * 0.00022,
      alpha: 0.16 + Math.random() * 0.38,
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
        const mode = lensModeRef.current;
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

        if (mode === 'portrait') {
          const img = portraitImgRef.current;
          const layers = cachedLayersRef.current;
          if (img && imgLoaded) {
            const imgRatio = img.naturalWidth / Math.max(1, img.naturalHeight);
            const boxRatio = cw / Math.max(1, ch);
            let drawW = cw;
            let drawH = ch;
            if (imgRatio > boxRatio) {
              drawH = cw / imgRatio;
            } else {
              drawW = ch * imgRatio;
            }
            const dx = (cw - drawW) / 2 + currentTilt.x * -7;
            const dy = (ch - drawH) / 2 + currentTilt.y * -5;

            drawAnimatedPaintingComposition(
              ctx,
              img,
              layers,
              dx,
              dy,
              drawW,
              drawH,
              elapsed,
              behavior,
              1,
              false
            );

            const fx = dx + (currentArtwork.focalPoint.x / 100) * drawW;
            const fy = dy + (currentArtwork.focalPoint.y / 100) * drawH;
            drawLivingVoiceAura(ctx, fx, fy, Math.min(drawW, drawH), speech, elapsed);
            drawCueOverlay(ctx, dx, dy, drawW, drawH, cue, elapsed);
          }

          drawAmbientMotes(ctx, motes, cw, ch, 0, 0, cw, ch, currentTilt, speech, elapsed);
        } else {
          // CAMERA AR MODE:
          // Never display the uploaded image unless the anchor tracker or Vision
          // actively recognizes the painting in the live camera feed!
          const detected = cameraDetectedRef.current;
          const aType = anchorTypeRef.current;
          const video = videoRef.current;
          const hasVideo = cameraReadyRef.current && video && video.readyState >= 2;

          if (!detected) {
            const padX = cw * 0.16;
            const padY = ch * 0.14;
            drawOpticalFrameCorners(
              ctx,
              padX,
              padY,
              cw - padX * 2,
              ch - padY * 2,
              0,
              elapsed,
              0.42
            );
          } else {
            const box = trackedBoxRef.current;
            const bx = (box.x / 100) * cw;
            const by = (box.y / 100) * ch;
            const bw = (box.width / 100) * cw;
            const bh = (box.height / 100) * ch;

            if (
              aType === 'washington' &&
              washingtonAnchorImgRef.current &&
              washingtonAvatarLoaded
            ) {
              // Render the interactive, speech-reactive AI Avatar of George Washington
              // anchored directly onto the tracked Washington anchor box!
              drawAnimatedPaintingComposition(
                ctx,
                washingtonAnchorImgRef.current,
                washingtonAnchorLayersRef.current,
                bx,
                by,
                bw,
                bh,
                elapsed,
                behavior,
                0.96,
                true
              );

              const fx = bx + (WASHINGTON_PORTRAIT.focalPoint.x / 100) * bw;
              const fy = by + (WASHINGTON_PORTRAIT.focalPoint.y / 100) * bh;
              drawOpticalFrameCorners(ctx, bx, by, bw, bh, speech, elapsed, 0.85);
              drawLivingVoiceAura(ctx, fx, fy, Math.min(bw, bh), speech, elapsed);
              drawCueOverlay(ctx, bx, by, bw, bh, cue, elapsed);
              drawAmbientMotes(ctx, motes, cw, ch, bx, by, bw, bh, currentTilt, speech, elapsed);
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
                  bx,
                  by,
                  bw,
                  bh,
                  fx,
                  fy,
                  elapsed,
                  speech,
                  cue,
                  videoPatchCanvasRef,
                  videoMaskCanvasRef
                );
              }
              drawOpticalFrameCorners(ctx, bx, by, bw, bh, speech, elapsed, 0.8);
              drawLivingVoiceAura(ctx, fx, fy, Math.min(bw, bh), speech, elapsed);
              drawCueOverlay(ctx, bx, by, bw, bh, cue, elapsed);
              drawAmbientMotes(ctx, motes, cw, ch, bx, by, bw, bh, currentTilt, speech, elapsed);
            }
          }
        }
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [imgLoaded, washingtonAvatarLoaded, speechLevelRef]);

  // Compute DOM hotspot coordinates
  const getHotspotPosition = (spot: ARHotspot) => {
    const el = containerRef.current;
    if (lensMode === 'camera') {
      if (anchorType === 'washington') {
        return {
          leftPct: trackedBox.x + (spot.x / 100) * trackedBox.width,
          topPct: trackedBox.y + (spot.y / 100) * trackedBox.height,
        };
      }
      return { leftPct: spot.x, topPct: spot.y };
    }

    if (!el || !portraitImgRef.current || !imgLoaded) {
      return { leftPct: spot.x, topPct: spot.y };
    }
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    if (!cw || !ch) return { leftPct: spot.x, topPct: spot.y };

    const img = portraitImgRef.current;
    const imgRatio = img.naturalWidth / Math.max(1, img.naturalHeight);
    const boxRatio = cw / Math.max(1, ch);
    let drawW = cw;
    let drawH = ch;
    if (imgRatio > boxRatio) {
      drawH = cw / imgRatio;
    } else {
      drawW = ch * imgRatio;
    }
    const dxPct = ((cw - drawW) / 2 / cw) * 100;
    const dyPct = ((ch - drawH) / 2 / ch) * 100;
    const dwPct = (drawW / cw) * 100;
    const dhPct = (drawH / ch) * 100;

    return {
      leftPct: dxPct + (spot.x / 100) * dwPct,
      topPct: dyPct + (spot.y / 100) * dhPct,
    };
  };

  const hotspotsVisible =
    showHotspots && (lensMode === 'portrait' || (lensMode === 'camera' && cameraDetected));

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="relative w-full h-full min-h-0 bg-[#11100F] overflow-hidden select-none"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Live Camera Feed */}
      <video
        ref={videoRef}
        playsInline
        muted
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
          lensMode === 'camera' && cameraReady ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Camera permission awaiting state (never shows uploaded painting) */}
      {lensMode === 'camera' && !cameraReady && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#141210] text-[#F6F3EC]">
          <Camera className="w-9 h-9 text-[#C79A52] mb-3" />
          <h3 className="font-serif text-2xl font-medium">AR Anchor Camera</h3>
          <p className="text-sm text-[#B8B0A2] max-w-sm mt-2 leading-relaxed">
            Allow camera access and point at the Washington equestrian portrait to lock the AR image anchor and awaken an interactive George Washington avatar.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-[#B4833E] text-[#11100F] text-sm font-medium hover:bg-[#C79A52] transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Upload className="w-4 h-4" />
              Upload Portrait
            </button>
            <button
              type="button"
              onClick={() => onChangeLensMode('portrait')}
              className="min-h-[44px] px-4 py-2 rounded-lg border border-white/20 text-[#F6F3EC] text-sm font-medium hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
            >
              View Anchor Painting
            </button>
          </div>
        </div>
      )}

      {/* Fallback gallery plate if image fails to load in Gallery Portrait mode */}
      {lensMode === 'portrait' && imgError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-[#1E1B18] to-[#11100F] text-[#E8E2D6]">
          <ImageIcon className="w-10 h-10 text-[#B4833E] mb-3" />
          <p className="font-serif text-xl">{artwork.title}</p>
          <p className="text-sm text-[#A59D90] mt-1">{artwork.characterName}</p>
        </div>
      )}

      {/* Living AR Canvas Overlay */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Interactive Tap Target Directly on Anchored George Washington Avatar in Camera AR */}
      {lensMode === 'camera' && cameraDetected && (
        <button
          type="button"
          onClick={onAvatarTap}
          aria-label={`Interact with ${artwork.characterName} avatar`}
          style={{
            left: `${trackedBox.x + trackedBox.width * 0.25}%`,
            top: `${trackedBox.y + trackedBox.height * 0.15}%`,
            width: `${trackedBox.width * 0.5}%`,
            height: `${trackedBox.height * 0.45}%`,
          }}
          className="absolute z-10 cursor-pointer bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E2B46D] rounded-xl"
        />
      )}

      {/* Top Viewfinder HUD */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="pointer-events-auto inline-flex items-center p-1 rounded-xl bg-black/65 backdrop-blur-md border border-white/12">
          <button
            type="button"
            onClick={() => onChangeLensMode('portrait')}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              lensMode === 'portrait'
                ? 'bg-[#F6F3EC] text-[#181614]'
                : 'text-[#E5DFD3] hover:text-white'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Gallery Portrait
          </button>
          <button
            type="button"
            onClick={() => onChangeLensMode('camera')}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              lensMode === 'camera'
                ? 'bg-[#F6F3EC] text-[#181614]'
                : 'text-[#E5DFD3] hover:text-white'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            Camera AR
          </button>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          {lensMode === 'camera' && cameraReady && (
            <>
              <button
                type="button"
                onClick={() => setAutoScan((v) => !v)}
                className={`min-h-[40px] px-3 py-1.5 rounded-xl backdrop-blur-md border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  autoScan
                    ? 'bg-[#F6F3EC]/90 text-[#181614] border-[#F6F3EC]'
                    : 'bg-black/65 text-[#F6F3EC] border-white/15 hover:bg-black/80'
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
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#B4833E] text-[#11100F] text-xs font-semibold hover:bg-[#C79A52] disabled:opacity-60 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Scan className="w-3.5 h-3.5" />
                {isScanning ? 'Scanning...' : cameraDetected ? 'Re-Scan' : 'Scan Anchor'}
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
              title="Return to Washington Portrait"
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-black/65 backdrop-blur-md border border-white/15 text-[#F6F3EC] text-xs font-medium hover:bg-black/80 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Washington
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowHotspots((v) => !v)}
            aria-label={showHotspots ? 'Hide portrait hotspots' : 'Show portrait hotspots'}
            className="min-h-[40px] min-w-[40px] px-2.5 rounded-xl bg-black/65 backdrop-blur-md border border-white/15 text-[#F6F3EC] hover:bg-black/80 transition-colors flex items-center justify-center"
          >
            {showHotspots ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Anchored AR Avatar Header & Quick Voice Action attached directly to Tracked Painting */}
      {lensMode === 'camera' && cameraDetected && (
        <div
          style={{
            left: `${Math.max(3, Math.min(58, trackedBox.x))}%`,
            top: `${Math.max(12, trackedBox.y - 7)}%`,
          }}
          className="absolute z-20 flex items-center gap-2 pointer-events-auto"
        >
          <div className="px-2.5 py-1 rounded-md bg-black/80 backdrop-blur-sm border border-[#D9B16E]/45 text-[#F6F3EC] text-[11px] tracking-wide whitespace-nowrap">
            <span className="font-serif italic text-[#E6C285]">
              {anchorType === 'washington' ? 'Washington Anchor Locked' : artwork.characterName}
            </span>
            {anchorType === 'washington' && anchorConfidence > 0 && (
              <>
                <span className="mx-1.5 text-white/35">·</span>
                <span className="font-mono tabular-nums text-white/75">
                  {Math.round(anchorConfidence * 100)}%
                </span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={onToggleVoice}
            className={`min-h-[30px] px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
              isListening || connectionState === 'connecting'
                ? 'bg-[#9A3412] text-[#FBF9F4]'
                : 'bg-[#B4833E] text-[#11100F] hover:bg-[#C79A52]'
            }`}
          >
            {isListening || connectionState === 'connecting' ? (
              <>
                <MicOff className="w-3 h-3" />
                Stop Voice
              </>
            ) : (
              <>
                <Mic className="w-3 h-3" />
                Talk Live
              </>
            )}
          </button>
        </div>
      )}

      {/* Interactive AR Tags Overlaid on Portrait Details */}
      {hotspotsVisible && (
        <div className="absolute inset-0 z-10 pointer-events-none">
          {artwork.hotspots.map((spot) => {
            const isActive = activeHotspotId === spot.id;
            const { leftPct, topPct } = getHotspotPosition(spot);
            return (
              <div
                key={spot.id}
                style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
              >
                <button
                  type="button"
                  onClick={() => onSelectHotspot(spot)}
                  aria-label={`Inspect ${spot.label}`}
                  className="group relative min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E2B46D] rounded-full"
                >
                  <span
                    className={`w-6 h-6 rounded-full border transition-transform duration-200 flex items-center justify-center ${
                      isActive
                        ? 'scale-110 bg-[#B4833E] border-[#F6F3EC] text-[#11100F]'
                        : 'bg-black/65 border-[#D9B16E]/85 text-[#F6F3EC] group-hover:scale-110 group-hover:bg-[#B4833E]/90 group-hover:text-[#11100F]'
                    }`}
                  >
                    <Sparkles className="w-3 h-3" />
                  </span>

                  <span
                    className={`absolute left-1/2 -translate-x-1/2 top-full mt-0.5 px-2.5 py-1 rounded-lg bg-[#141210]/90 border border-[#D9B16E]/40 text-[#F6F3EC] text-[11px] font-medium whitespace-nowrap shadow-lg transition-opacity duration-150 pointer-events-none ${
                      isActive || lensMode === 'camera'
                        ? 'opacity-100'
                        : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    {spot.label}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Scan notice banner */}
      {scanNotice && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-lg bg-black/75 backdrop-blur-md border border-white/15 text-xs text-[#F6F3EC] max-w-[90%] text-center">
          {scanNotice}
        </div>
      )}

      {/* Measured Bottom Scrim: Live AR Subtitles */}
      <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none bg-gradient-to-t from-black/90 via-black/55 to-transparent pt-14 pb-4 px-4 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0 flex-1 max-w-2xl">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-[#D6B47B] mb-1">
              <span>
                {lensMode === 'camera' && !cameraDetected
                  ? 'Washington Image Anchor'
                  : artwork.characterName}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {lensMode === 'camera' && !cameraDetected
                  ? isScanning
                    ? 'Matching anchor'
                    : 'Searching camera feed'
                  : isSpeaking
                  ? 'Avatar speaking'
                  : isListening
                  ? 'Avatar listening'
                  : connectionState === 'thinking'
                  ? 'Avatar thinking'
                  : connectionState === 'connecting'
                  ? 'Connecting voice'
                  : 'Avatar ready'}
              </span>
            </div>

            {latestVisitorLine && (
              <p className="text-xs text-[#C7C0B4] truncate mb-0.5">
                You: “{latestVisitorLine.text}”
              </p>
            )}

            {latestDialogue && (lensMode === 'portrait' || cameraDetected) && (
              <p className="text-sm sm:text-base text-[#F6F3EC] font-serif italic leading-snug line-clamp-3">
                “{latestDialogue.text}”
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="pointer-events-auto hidden sm:inline-flex min-h-[40px] px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/18 border border-white/15 text-[#F6F3EC] text-xs font-medium items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Painting
          </button>
        </div>
      </div>
    </div>
  );
};

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

function drawAmbientMotes(
  ctx: CanvasRenderingContext2D,
  motes: DustMote[],
  cw: number,
  ch: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
  tilt: { x: number; y: number },
  speech: number,
  elapsed: number
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(bx, by, bw, bh);
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

    const px = bx + m.x * bw + tilt.x * 14 * m.depth;
    const py = by + m.y * bh + tilt.y * 10 * m.depth;
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

function drawOpticalFrameCorners(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  speech: number,
  elapsed: number,
  baseAlpha = 0.62
) {
  const corner = Math.min(26, Math.min(w, h) * 0.13);
  const alpha = baseAlpha + speech * 0.3 + Math.sin(elapsed * 2) * 0.06;
  ctx.strokeStyle = `rgba(224, 184, 118, ${alpha})`;
  ctx.lineWidth = 1.75;

  const drawCorner = (cx: number, cy: number, dx: number, dy: number) => {
    ctx.beginPath();
    ctx.moveTo(cx + dx * corner, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + dy * corner);
    ctx.stroke();
  };

  drawCorner(x, y, 1, 1);
  drawCorner(x + w, y, -1, 1);
  drawCorner(x, y + h, 1, -1);
  drawCorner(x + w, y + h, -1, -1);
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

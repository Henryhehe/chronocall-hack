import { CallEvidencePanel } from "./components/CallEvidencePanel";
import { RehearsalPanel } from "./components/RehearsalPanel";
import { EncounterReflection } from './components/EncounterReflection';
import type { EncounterReflection as Encounter, InquiryId } from '../../../shared/inquiry.ts';
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArtworkScannerModal } from "./components/ArtworkScannerModal";
import { CallLauncher } from "./components/CallLauncher";
import { CallStage } from "./components/CallStage";
import { ChronoSelfieModal } from "./components/ChronoSelfieModal";
import { OnlineArtworkModal } from "./components/OnlineArtworkModal";
import { matchCuratedContact } from "./data/contacts";
import { useFaceTimeCall } from "./hooks/useFaceTimeCall";
import { captureMediaFrame } from "../../utils/canvas";
import {
  playConnectChime,
  playEndCallChime,
  startOutgoingRingtone,
} from "./utils/ringtone";
import type {
  FaceTimeDecisionResult,
  FaceTimePhase,
  FaceTimePortraitResult,
  GeminiPipelineEvent,
  HistoricalProfile,
  RuntimeHealth,
  VideoEngineMode,
} from "./types";

// Shopify: offer prints of the painting after the call (src/features/shop).
import { PrintOfferModal } from "../shop/PrintOfferModal";
import { usePrintOffer } from "../shop/usePrintOffer";

export default function FaceTimeApp() {
  const [inquiry, setInquiry] = useState<InquiryId>('perspective');
  const [prediction, setPrediction] = useState('');
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [lastEncounter, setLastEncounter] = useState<Encounter | null>(null);
  const [showPrints, setShowPrints] = useState(false);
  const [health, setHealth] = useState<RuntimeHealth | null>(null);
  const [phase, setPhase] = useState<FaceTimePhase>("launcher");
  const [activeProfile, setActiveProfile] = useState<HistoricalProfile | null>(
    null
  );
  const [portraitDataUrl, setPortraitDataUrl] = useState<string | null>(null);
  const [portraitPreparing, setPortraitPreparing] = useState(false);
  const [ringingSubtitle, setRingingSubtitle] = useState(
    "Connecting across history…"
  );
  const [videoEngineMode, setVideoEngineMode] =
    useState<VideoEngineMode>("hybrid");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [artworkSearchOpen, setArtworkSearchOpen] = useState(false);
  const [artworkInitialQuery, setArtworkInitialQuery] = useState("");
  const [resolvingQuery, setResolvingQuery] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pipelineEvents, setPipelineEvents] = useState<GeminiPipelineEvent[]>(
    []
  );
  const [latestDecision, setLatestDecision] =
    useState<FaceTimeDecisionResult | null>(null);
  const [verifyingDecision, setVerifyingDecision] = useState(false);

  const callSeqRef = useRef(0);
  const portraitRequestRef = useRef<AbortController | null>(null);
  const stopRingtoneRef = useRef<(() => void) | null>(null);
  const lastVerifiedUtteranceRef = useRef<string>("");

  const recordPipelineEvent = useCallback(
    (event: Omit<GeminiPipelineEvent, "id" | "timestamp">) => {
      setPipelineEvents((prev) =>
        [
          {
            ...event,
            id: `${event.stage}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            timestamp: Date.now(),
          },
          ...prev,
        ].slice(0, 16)
      );
    },
    []
  );
  const [selfieModalOpen, setSelfieModalOpen] = useState(false);
  const [selfieCallerFrame, setSelfieCallerFrame] = useState<string | undefined>(
    undefined
  );

  const userVideoElRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/health")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: RuntimeHealth | null) => {
        if (active && data) setHealth(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const demoMode = health?.demoMode ?? false;
  const printOffer = usePrintOffer({ phase, profile: activeProfile });

  const stopRingtone = useCallback(() => {
    stopRingtoneRef.current?.();
    stopRingtoneRef.current = null;
  }, []);

  const call = useFaceTimeCall({
    demoMode,
    onError: setErrorMessage,
    onDecisionPending: () => setVerifyingDecision(true),
    onDecision: result => {
      setVerifyingDecision(false);
      setLatestDecision(result);
      if (result) recordPipelineEvent({
        stage: "decisions", model: result.model,
        label: `${Math.round(result.confidence * 100)}% ${result.verdict.replace("_", " ")}`,
        status: "done", latencyMs: result.latencyMs,
      });
    },
  });

  const beginCall = useCallback(
    async (profile: HistoricalProfile, scannedReferenceDataUrl?: string) => {
      const seq = ++callSeqRef.current;
      portraitRequestRef.current?.abort();
      const portraitRequest = new AbortController();
      portraitRequestRef.current = portraitRequest;
      setPortraitPreparing(true);
      setLastEncounter(null);
      setShowPrints(false);
      setOriginalImage(scannedReferenceDataUrl || profile.scannedImageDataUrl || profile.previewImageUrl || null);
      stopRingtone();
      setErrorMessage(null);
      setScannerOpen(false);
      setArtworkSearchOpen(false);
      setActiveProfile(profile);
      setPortraitDataUrl(
        scannedReferenceDataUrl || profile.previewImageUrl || null
      );
      setRingingSubtitle(`Calling ${profile.location} (${profile.era})…`);
      setLatestDecision(null);
      setVerifyingDecision(false);
      lastVerifiedUtteranceRef.current = "";
      setPipelineEvents([]);
      setPhase("ringing");

      stopRingtoneRef.current = startOutgoingRingtone();

      const minRingDelay = new Promise((r) => setTimeout(r, 1500));

      // Upgrade the existing artwork in the background; voice never waits for image generation.
      void (async () => {
        const startedAt = Date.now();
        const timeout = window.setTimeout(() => portraitRequest.abort(), 45_000);
        recordPipelineEvent({
          stage: "portrait",
          model: "gemini-3.1-flash-lite-image",
          label: "Synthesizing living portrait",
          status: "running",
        });
        try {
          setRingingSubtitle(
            scannedReferenceDataUrl
              ? profile.artworkTitle
                ? `Bringing ${profile.name} to life from “${profile.artworkTitle}”…`
                : `Bringing ${profile.name} to life from your artwork…`
              : `Connecting video feed from ${profile.era}…`
          );
          const res = await fetch("/api/facetime/portrait", {
            method: "POST",
            signal: portraitRequest.signal,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              profile,
              referenceImageBase64: scannedReferenceDataUrl,
              referenceMimeType: "image/jpeg",
            }),
          });
          if (!res.ok) throw new Error('Portrait unavailable');
          const data = (await res.json()) as FaceTimePortraitResult;
          if (!data.imageDataUrl) throw new Error('Portrait unavailable');
          if (callSeqRef.current === seq && data.imageDataUrl) {
            setPortraitDataUrl(data.imageDataUrl);
            recordPipelineEvent({
              stage: "portrait",
              model: data.model || "gemini-3.1-flash-lite-image",
              label: "Living portrait ready",
              status: "done",
              latencyMs: data.latencyMs || Date.now() - startedAt,
            });
          }
        } catch {
          if (callSeqRef.current === seq) recordPipelineEvent({
            stage: "portrait", model: "gemini-3.1-flash-lite-image",
            label: "Portrait unavailable · using artwork preview",
            status: "standby", latencyMs: Date.now() - startedAt,
          });
        } finally {
          window.clearTimeout(timeout);
          if (callSeqRef.current === seq) setPortraitPreparing(false);
          if (portraitRequestRef.current === portraitRequest) portraitRequestRef.current = null;
        }
      })();

      await minRingDelay;
      if (callSeqRef.current !== seq) return;

      stopRingtone();
      playConnectChime();
      setPhase("in-call");
      void call.startCall(profile);
    },
    [call, stopRingtone]
  );

  const handleDialCustomName = useCallback(
    async (rawName: string) => {
      const trimmed = rawName.trim();
      if (!trimmed) return;

      const curated = matchCuratedContact(trimmed);
      if (curated && curated.name.toLowerCase() === trimmed.toLowerCase()) {
        void beginCall(curated);
        return;
      }

      setResolvingQuery(true);
      setErrorMessage(null);
      const startedAt = Date.now();
      recordPipelineEvent({
        stage: "persona",
        model: "gemini-4-hydrogen",
        label: `Resolving ${trimmed}`,
        status: "running",
      });
      try {
        const res = await fetch("/api/facetime/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: trimmed }),
        });
        const data = (await res.json()) as {
          profile?: HistoricalProfile;
          error?: string;
        };
        if (!res.ok || !data.profile) {
          throw new Error(
            data.error || `Could not prepare a FaceTime call with ${trimmed}.`
          );
        }
        recordPipelineEvent({
          stage: "persona",
          model: "gemini-4-hydrogen",
          label: `Persona ready: ${data.profile.name}`,
          status: "done",
          latencyMs: Date.now() - startedAt,
        });
        void beginCall(data.profile);
      } catch (err) {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Could not dial that historical figure."
        );
      } finally {
        setResolvingQuery(false);
      }
    },
    [beginCall]
  );

  const handleConfirmScannedCall = useCallback(
    (profile: HistoricalProfile, scannedDataUrl: string) => {
      recordPipelineEvent({
        stage: "vision",
        model: "gemini-4-hydrogen",
        label: `Artwork matched: ${profile.name}`,
        status: "done",
      });
      void beginCall(profile, scannedDataUrl || undefined);
    },
    [beginCall, recordPipelineEvent]
  );

  // Asynchronous Decisions API historical grounding whenever the figure finishes a spoken turn
  useEffect(() => {
    // Live calls receive the shared character evaluation over the socket.
    if (phase !== "in-call" || !activeProfile ||
        (call.voiceStatus !== "demo" && call.voiceStatus !== "text-only")) return;
    const latestFigureEntry = [...call.transcripts]
      .reverse()
      .find((t) => t.speaker === "figure" && !t.streaming && t.text.trim().length > 12);
    if (!latestFigureEntry) return;
    const key = `${latestFigureEntry.id}:${latestFigureEntry.text}`;
    if (lastVerifiedUtteranceRef.current === key) return;
    lastVerifiedUtteranceRef.current = key;

    const latestUserEntry = [...call.transcripts]
      .reverse()
      .find((t) => t.speaker === "user");

    let cancelled = false;
    setVerifyingDecision(true);
    void (async () => {
      try {
        const res = await fetch("/api/facetime/decision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profile: activeProfile,
            utterance: latestFigureEntry.text,
            userPrompt: latestUserEntry?.text,
          }),
        });
        if (!res.ok || cancelled) return;
        const result = (await res.json()) as FaceTimeDecisionResult;
        if (cancelled) return;
        setLatestDecision(result);
        recordPipelineEvent({
          stage: "decisions",
          model: result.model,
          label: `${Math.round(result.confidence * 100)}% ${result.verdict.replace("_", " ")}`,
          status: "done",
          latencyMs: result.latencyMs,
        });
      } catch {
        // Non-blocking telemetry — ignore transient errors
      } finally {
        if (!cancelled) setVerifyingDecision(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProfile, call.transcripts, call.voiceStatus, phase, recordPipelineEvent]);

  const handleEndCall = useCallback(() => {
    if (phase === 'in-call' && activeProfile) {
      setLastEncounter({ id: `${Date.now()}`, figure: activeProfile.name, era: activeProfile.era,
        artworkTitle: activeProfile.artworkTitle, originalImage, inquiry, prediction, demoMode,
        replies: call.transcripts.map(r => ({ ...r })), trace: call.evidence });
    }
    callSeqRef.current++;
    portraitRequestRef.current?.abort();
    portraitRequestRef.current = null;
    stopRingtone();
    call.stopCall();
    playEndCallChime();
    setPhase("launcher");
    setActiveProfile(null);
    setPortraitDataUrl(null);
    setPortraitPreparing(false);
    setSelfieModalOpen(false);
    setSelfieCallerFrame(undefined);
  }, [call, stopRingtone, phase, activeProfile, originalImage, inquiry, prediction, demoMode]);

  const bindUserVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      userVideoElRef.current = el;
      call.bindUserVideoRef(el);
    },
    [call]
  );

  const handleTakePhotoTogether = useCallback((callerImageBase64?: string) => {
    setSelfieCallerFrame(callerImageBase64);
    setSelfieModalOpen(true);
  }, []);

  const handleTakeAnotherSelfie = useCallback(() => {
    let freshFrame: string | undefined = undefined;
    if (call.cameraEnabled && call.cameraReady && userVideoElRef.current) {
      try {
        const captured = captureMediaFrame(userVideoElRef.current, 960, 0.85);
        if (captured?.base64) {
          freshFrame = captured.base64;
        }
      } catch {
        // Fallback gracefully if frame capture fails
      }
    }
    return freshFrame;
  }, [call.cameraEnabled, call.cameraReady]);

  useEffect(() => {
    return () => {
      callSeqRef.current++;
      portraitRequestRef.current?.abort();
      portraitRequestRef.current = null;
      stopRingtone();
    };
  }, [stopRingtone]);

  return (
    <>
      {phase === "launcher" && (
        <CallLauncher
          inquiry={inquiry}
          prediction={prediction}
          onInquiryChange={id => { setInquiry(id); setPrediction(''); }}
          onPredictionChange={setPrediction}
          reflection={lastEncounter ? <EncounterReflection key={lastEncounter.id} encounter={lastEncounter} onBrowsePrints={() => setShowPrints(true)} /> : undefined}
          health={health}
          resolvingQuery={resolvingQuery}
          errorMessage={errorMessage}
          onDismissError={() => setErrorMessage(null)}
          onDialCustomName={(name) => void handleDialCustomName(name)}
          onSelectContact={(contact) => void beginCall(contact)}
          onOpenScanner={() => setScannerOpen(true)}
          onOpenArtworkSearch={(initial) => {
            setArtworkInitialQuery(initial ?? "");
            setArtworkSearchOpen(true);
          }}
        />
      )}

      {phase === "launcher" && call.evidence && (
        <details className="mx-auto max-w-3xl px-5 pb-6">
          <summary className="cursor-pointer py-3 text-sm text-slate-300">Last call evidence · {call.evidence.figure}</summary>
          <CallEvidencePanel trace={call.evidence} />
        </details>
      )}

      <div hidden={phase !== "launcher"}><RehearsalPanel trace={call.evidence} /></div>

      {(phase === "ringing" || phase === "in-call") && activeProfile && (
        <CallStage
          inquiry={inquiry}
          prediction={prediction}
          originalImage={originalImage}
          evidence={call.evidence}
          phase={phase}
          profile={activeProfile}
          portraitDataUrl={portraitDataUrl}
          portraitPreparing={portraitPreparing}
          ringingSubtitle={ringingSubtitle}
          demoMode={demoMode}
          voiceStatus={call.voiceStatus}
          micMuted={call.micMuted}
          onToggleMic={() => call.setMicMuted((m) => !m)}
          cameraEnabled={call.cameraEnabled}
          cameraReady={call.cameraReady}
          facingMode={call.facingMode}
          bindUserVideoRef={bindUserVideoRef}
          onToggleCamera={call.toggleCamera}
          onFlipCamera={call.flipCamera}
          isSpeaking={call.isSpeaking}
          speechLevelRef={call.speechLevelRef}
          transcripts={call.transcripts}
          liveCaption={call.liveCaption}
          lastReaction={call.lastReaction}
          portalInvite={call.portalInvite}
          onDismissPortalInvite={call.clearPortalInvite}
          isSendingText={call.isSendingText}
          onSendMessage={(msg) => void call.sendMessage(msg)}
          videoEngineMode={videoEngineMode}
          onChangeVideoEngineMode={setVideoEngineMode}
          pipelineEvents={pipelineEvents}
          latestDecision={latestDecision}
          verifyingDecision={verifyingDecision}
          onTakePhotoTogether={handleTakePhotoTogether}
          errorMessage={errorMessage}
          onDismissError={() => setErrorMessage(null)}
          onEndCall={handleEndCall}
          callerAnnotation={call.callerAnnotation}
          onDismissAnnotation={call.dismissAnnotation}
          activeArtifact={call.activeArtifact}
          isGeneratingArtifact={call.isGeneratingArtifact}
          artifactLoadingTitle={call.artifactLoadingTitle}
          onDismissArtifact={call.dismissArtifact}
          onAskForSketch={() => void call.askForSketch()}
          onTriggerDemoInspection={call.triggerDemoInspection}
        />
      )}

      {activeProfile && (
        <ChronoSelfieModal
          open={selfieModalOpen}
          onClose={() => setSelfieModalOpen(false)}
          profile={activeProfile}
          callerImageBase64={selfieCallerFrame}
          figureImageBase64={
            portraitDataUrl || activeProfile.previewImageUrl || undefined
          }
          onTakeAnother={handleTakeAnotherSelfie}
        />
      )}

      <ArtworkScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onConfirmCall={handleConfirmScannedCall}
      />

      <OnlineArtworkModal
        open={artworkSearchOpen}
        initialQuery={artworkInitialQuery}
        onClose={() => setArtworkSearchOpen(false)}
        onLaunchWithArtwork={(profile, artworkDataUrl) =>
          void beginCall(profile, artworkDataUrl)
        }
      />
      {/* Opens by itself when a call ends (printOffer.open), and again from "Explore artwork prints". */}
      <PrintOfferModal {...printOffer} open={showPrints || printOffer.open} onClose={() => { setShowPrints(false); printOffer.onClose(); }} />
    </>
  );
}

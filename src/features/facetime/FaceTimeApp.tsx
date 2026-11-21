import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArtworkScannerModal } from "./components/ArtworkScannerModal";
import { CallLauncher } from "./components/CallLauncher";
import { CallStage } from "./components/CallStage";
import { matchCuratedContact } from "./data/contacts";
import { useFaceTimeCall } from "./hooks/useFaceTimeCall";
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

export default function FaceTimeApp() {
  const [health, setHealth] = useState<RuntimeHealth | null>(null);
  const [phase, setPhase] = useState<FaceTimePhase>("launcher");
  const [activeProfile, setActiveProfile] = useState<HistoricalProfile | null>(
    null
  );
  const [portraitDataUrl, setPortraitDataUrl] = useState<string | null>(null);
  const [ringingSubtitle, setRingingSubtitle] = useState(
    "Connecting across history…"
  );
  const [videoEngineMode, setVideoEngineMode] =
    useState<VideoEngineMode>("hybrid");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [resolvingQuery, setResolvingQuery] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pipelineEvents, setPipelineEvents] = useState<GeminiPipelineEvent[]>(
    []
  );
  const [latestDecision, setLatestDecision] =
    useState<FaceTimeDecisionResult | null>(null);
  const [verifyingDecision, setVerifyingDecision] = useState(false);

  const callSeqRef = useRef(0);
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

  const stopRingtone = useCallback(() => {
    stopRingtoneRef.current?.();
    stopRingtoneRef.current = null;
  }, []);

  const call = useFaceTimeCall({
    demoMode,
    onError: setErrorMessage,
  });

  const beginCall = useCallback(
    async (profile: HistoricalProfile, scannedReferenceDataUrl?: string) => {
      const seq = ++callSeqRef.current;
      stopRingtone();
      setErrorMessage(null);
      setScannerOpen(false);
      setActiveProfile(profile);
      setPortraitDataUrl(
        scannedReferenceDataUrl || profile.previewImageUrl || null
      );
      setRingingSubtitle(`Calling ${profile.location} (${profile.era})…`);
      setLatestDecision(null);
      setVerifyingDecision(false);
      lastVerifiedUtteranceRef.current = "";
      setPhase("ringing");

      stopRingtoneRef.current = startOutgoingRingtone();

      const minRingDelay = new Promise((r) => setTimeout(r, 1500));

      // Fetch / generate photorealistic FaceTime portrait while ringing
      const portraitTask = (async () => {
        const startedAt = Date.now();
        recordPipelineEvent({
          stage: "portrait",
          model: "gemini-3.1-flash-lite-image",
          label: "Synthesizing living portrait",
          status: "running",
        });
        try {
          setRingingSubtitle(
            scannedReferenceDataUrl
              ? `Bringing ${profile.name} to life from your scan…`
              : `Connecting video feed from ${profile.era}…`
          );
          const res = await fetch("/api/facetime/portrait", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              profile,
              referenceImageBase64: scannedReferenceDataUrl,
              referenceMimeType: "image/jpeg",
            }),
          });
          if (!res.ok) return;
          const data = (await res.json()) as FaceTimePortraitResult;
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
          // Keep preview/gradient fallback cleanly if portrait synthesis fails
        }
      })();

      await Promise.all([minRingDelay, portraitTask]);
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
    if (phase !== "in-call" || !activeProfile) return;
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
  }, [activeProfile, call.transcripts, phase, recordPipelineEvent]);

  const handleEndCall = useCallback(() => {
    callSeqRef.current++;
    stopRingtone();
    call.stopCall();
    playEndCallChime();
    setPhase("launcher");
    setActiveProfile(null);
    setPortraitDataUrl(null);
  }, [call, stopRingtone]);

  useEffect(() => {
    return () => {
      stopRingtone();
    };
  }, [stopRingtone]);

  return (
    <>
      {phase === "launcher" && (
        <CallLauncher
          health={health}
          resolvingQuery={resolvingQuery}
          errorMessage={errorMessage}
          onDismissError={() => setErrorMessage(null)}
          onDialCustomName={(name) => void handleDialCustomName(name)}
          onSelectContact={(contact) => void beginCall(contact)}
          onOpenScanner={() => setScannerOpen(true)}
        />
      )}

      {(phase === "ringing" || phase === "in-call") && activeProfile && (
        <CallStage
          phase={phase}
          profile={activeProfile}
          portraitDataUrl={portraitDataUrl}
          ringingSubtitle={ringingSubtitle}
          demoMode={demoMode}
          voiceStatus={call.voiceStatus}
          micMuted={call.micMuted}
          onToggleMic={() => call.setMicMuted((m) => !m)}
          cameraEnabled={call.cameraEnabled}
          cameraReady={call.cameraReady}
          facingMode={call.facingMode}
          bindUserVideoRef={call.bindUserVideoRef}
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
          errorMessage={errorMessage}
          onDismissError={() => setErrorMessage(null)}
          onEndCall={handleEndCall}
        />
      )}

      <ArtworkScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onConfirmCall={handleConfirmScannedCall}
      />
    </>
  );
}

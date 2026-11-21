import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { WASHINGTON_PORTRAIT } from './data/washingtonPortrait';
import { useMuseumVoice } from './hooks/useMuseumVoice';
import { ARHotspot, PortraitArtwork } from './types/portrait';
import { ARPortraitStage } from './components/ARPortraitStage';

export default function App() {
  const [artwork, setArtwork] = useState<PortraitArtwork>(WASHINGTON_PORTRAIT);
  const [activeHotspotId, setActiveHotspotId] = useState<string | null>(null);
  const [activeCue, setActiveCue] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const handleCue = useCallback((cue: string | null) => {
    setActiveCue(cue);
    if (cue) {
      window.setTimeout(() => {
        setActiveCue((prev) => (prev === cue ? null : prev));
      }, 4200);
    }
  }, []);

  const {
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
  } = useMuseumVoice({
    artwork,
    onAnimationCue: handleCue,
  });

  const isCustomArtwork = artwork.id !== WASHINGTON_PORTRAIT.id;
  const combinedError = cameraError || errorMessage;

  // Start microphone sequentially once camera permission resolves (avoids dual-prompt collision on mobile)
  useEffect(() => {
    if (cameraReady) {
      startLiveVoice(false);
      return;
    }
    const fallbackTimer = window.setTimeout(() => {
      startLiveVoice(false);
    }, 1800);
    return () => window.clearTimeout(fallbackTimer);
  }, [artwork.id, cameraReady, startLiveVoice]);

  // Unlock AudioContext and retry mic inside a user gesture if mobile browser blocked auto-mic
  useEffect(() => {
    const handleGesture = () => {
      unlockAudioContexts();
      if (connectionState !== 'live') {
        startLiveVoice(true);
      }
    };
    window.addEventListener('pointerdown', handleGesture, { passive: true });
    window.addEventListener('keydown', handleGesture, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', handleGesture);
      window.removeEventListener('keydown', handleGesture);
    };
  }, [connectionState, startLiveVoice, unlockAudioContexts]);

  const latestCharacterLine = useMemo(() => {
    for (let i = transcript.length - 1; i >= 0; i--) {
      if (transcript[i].speaker === 'character') return transcript[i];
    }
    return null;
  }, [transcript]);

  const latestVisitorLine = useMemo(() => {
    for (let i = transcript.length - 1; i >= 0; i--) {
      if (transcript[i].speaker === 'visitor') return transcript[i];
    }
    return null;
  }, [transcript]);

  const handleSelectHotspot = useCallback(
    (spot: ARHotspot) => {
      setActiveHotspotId(spot.id);
      askCharacter(spot.prompt, spot.animationCue);
    },
    [askCharacter]
  );

  const handleArtworkIdentified = useCallback(
    (identified: PortraitArtwork) => {
      if (identified.id !== artwork.id) {
        stopLiveVoice();
      }
      setArtwork(identified);
      setActiveHotspotId(null);
      setCameraError(null);
      setErrorMessage(null);
    },
    [artwork.id, setErrorMessage, stopLiveVoice]
  );

  const handleResetToWashington = useCallback(() => {
    if (artwork.id !== WASHINGTON_PORTRAIT.id) {
      stopLiveVoice();
    }
    setArtwork(WASHINGTON_PORTRAIT);
    setActiveHotspotId(null);
    setCameraError(null);
    setErrorMessage(null);
  }, [artwork.id, setErrorMessage, stopLiveVoice]);

  return (
    <main className="h-dvh w-screen overflow-hidden bg-[#0D0C0A] text-[#F6F3EC]">
      <ARPortraitStage
        artwork={artwork}
        speechLevelRef={speechLevelRef}
        isSpeaking={isSpeaking}
        isListening={isListening}
        needsAudioGesture={needsAudioGesture}
        connectionState={connectionState}
        activeHotspotId={activeHotspotId}
        activeCue={activeCue}
        latestDialogue={latestCharacterLine}
        latestVisitorLine={latestVisitorLine}
        errorMessage={combinedError}
        onSelectHotspot={handleSelectHotspot}
        onArtworkIdentified={handleArtworkIdentified}
        onResetToWashington={handleResetToWashington}
        isCustomArtwork={isCustomArtwork}
        onSendCameraFrame={sendCameraFrameToLive}
        onCameraError={setCameraError}
        onCameraReadyChange={setCameraReady}
        onAvatarTap={() =>
          askCharacter(
            'General Washington, please greet me and tell me what moment this painting captures.',
            'gaze'
          )
        }
      />
    </main>
  );
}

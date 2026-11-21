import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { WASHINGTON_PORTRAIT } from './data/washingtonPortrait';
import { useMuseumVoice } from './hooks/useMuseumVoice';
import { ARHotspot, PortraitArtwork } from './types/portrait';
import { ARPortraitStage } from './components/ARPortraitStage';

export default function App() {
  const [artwork, setArtwork] = useState<PortraitArtwork | null>(null);
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

  const hasHumanSubject = Boolean(artwork?.hasHumanSubject);
  const voiceArtwork = artwork ?? WASHINGTON_PORTRAIT;

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
    artwork: voiceArtwork,
    onAnimationCue: handleCue,
  });

  const combinedError = cameraError || (hasHumanSubject ? errorMessage : null);

  // Activate live microphone/voice ONLY when camera is ready AND an artwork with a human subject is detected
  useEffect(() => {
    if (!cameraReady || !artwork || !artwork.hasHumanSubject) {
      stopLiveVoice();
      return;
    }
    startLiveVoice(false);
  }, [artwork, cameraReady, startLiveVoice, stopLiveVoice]);

  // Unlock AudioContext and retry mic inside a user gesture if mobile browser blocked auto-mic
  useEffect(() => {
    if (!cameraReady || !artwork || !artwork.hasHumanSubject) {
      return;
    }
    const handleGesture = () => {
      unlockAudioContexts();
      if (needsAudioGesture || connectionState !== 'live') {
        startLiveVoice(true);
      }
    };
    window.addEventListener('pointerdown', handleGesture, { passive: true });
    window.addEventListener('keydown', handleGesture, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', handleGesture);
      window.removeEventListener('keydown', handleGesture);
    };
  }, [
    artwork,
    cameraReady,
    connectionState,
    needsAudioGesture,
    startLiveVoice,
    unlockAudioContexts,
  ]);

  const latestCharacterLine = useMemo(() => {
    if (!hasHumanSubject) return null;
    for (let i = transcript.length - 1; i >= 0; i--) {
      if (transcript[i].speaker === 'character') return transcript[i];
    }
    return null;
  }, [hasHumanSubject, transcript]);

  const latestVisitorLine = useMemo(() => {
    if (!hasHumanSubject) return null;
    for (let i = transcript.length - 1; i >= 0; i--) {
      if (transcript[i].speaker === 'visitor') return transcript[i];
    }
    return null;
  }, [hasHumanSubject, transcript]);

  const handleSelectHotspot = useCallback(
    (spot: ARHotspot) => {
      setActiveHotspotId(spot.id);
      handleCue(spot.animationCue);
      if (artwork?.hasHumanSubject) {
        askCharacter(spot.prompt, spot.animationCue);
      }
    },
    [artwork?.hasHumanSubject, askCharacter, handleCue]
  );

  const handleArtworkIdentified = useCallback(
    (identified: PortraitArtwork) => {
      if (identified.id !== artwork?.id || !identified.hasHumanSubject) {
        stopLiveVoice();
      }
      setArtwork(identified);
      setActiveHotspotId(null);
      setActiveCue(null);
      setCameraError(null);
      setErrorMessage(null);
    },
    [artwork?.id, setErrorMessage, stopLiveVoice]
  );

  const handleArtworkLost = useCallback(() => {
    stopLiveVoice();
    setArtwork(null);
    setActiveHotspotId(null);
    setActiveCue(null);
    setErrorMessage(null);
  }, [setErrorMessage, stopLiveVoice]);

  const handleAvatarTap = useCallback(() => {
    if (!artwork || !artwork.hasHumanSubject) return;
    askCharacter(
      `As ${artwork.characterName} in "${artwork.title}", please greet me in character and share what moment or story this painting captures.`,
      'gaze'
    );
  }, [artwork, askCharacter]);

  return (
    <main className="h-dvh w-screen overflow-hidden bg-[#0D0C0A] text-[#F6F3EC]">
      <ARPortraitStage
        artwork={artwork}
        speechLevelRef={speechLevelRef}
        isSpeaking={hasHumanSubject ? isSpeaking : false}
        isListening={hasHumanSubject ? isListening : false}
        needsAudioGesture={hasHumanSubject ? needsAudioGesture : false}
        connectionState={hasHumanSubject ? connectionState : 'idle'}
        activeHotspotId={activeHotspotId}
        activeCue={activeCue}
        latestDialogue={latestCharacterLine}
        latestVisitorLine={latestVisitorLine}
        errorMessage={combinedError}
        onSelectHotspot={handleSelectHotspot}
        onArtworkIdentified={handleArtworkIdentified}
        onArtworkLost={handleArtworkLost}
        onSendCameraFrame={sendCameraFrameToLive}
        onCameraError={setCameraError}
        onCameraReadyChange={setCameraReady}
        onAvatarTap={handleAvatarTap}
      />
    </main>
  );
}

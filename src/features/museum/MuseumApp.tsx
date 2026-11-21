import './portrait-room.css';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff, MessageSquare, X, ArrowLeft, Smartphone, VolumeX, ScanEye } from 'lucide-react';
import { WASHINGTON_PORTRAIT } from './data/washingtonPortrait';
import { useMuseumVoice } from './hooks/useMuseumVoice';
import { ARHotspot, LensMode, PortraitArtwork } from './types/portrait';
import { PortraitStage } from './components/PortraitStage';
import { ARPortraitStage } from './components/ARPortraitStage';
import { CuratorialPanel } from './components/CuratorialPanel';
import { MobilePreviewModal } from './components/MobilePreviewModal';

export default function App({ onExit }: { onExit: () => void }) {
  const [artwork, setArtwork] = useState<PortraitArtwork>(WASHINGTON_PORTRAIT);
  const [cameraArtworkLost, setCameraArtworkLost] = useState(true);
  const [lensMode, setLensMode] = useState<LensMode>('portrait');
  const [activeHotspotId, setActiveHotspotId] = useState<string | null>(null);
  const [activeCue, setActiveCue] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [mobileQrOpen, setMobileQrOpen] = useState(false);

  const sheetRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (mobileSheetOpen) sheetRef.current?.showModal();
    else sheetRef.current?.close();
  }, [mobileSheetOpen]);

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
    askCharacter,
    sendCameraFrameToLive,
    stopPlaybackQueue,
  } = useMuseumVoice({
    artwork,
    onAnimationCue: handleCue,
  });

  const canSpeak = artwork.hasHumanSubject !== false && (lensMode !== 'camera' || !cameraArtworkLost);
  const isCustomArtwork = artwork.id !== WASHINGTON_PORTRAIT.id;
  const combinedError = cameraError || errorMessage;

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
      if (canSpeak) askCharacter(spot.prompt, spot.animationCue);
    },
    [askCharacter, canSpeak]
  );

  const handleArtworkIdentified = useCallback(
    (identified: PortraitArtwork, source: 'camera' | 'upload') => {
      stopLiveVoice();
      setArtwork(identified);
      setCameraArtworkLost(false);
      setActiveHotspotId(null);
      setCameraError(null);
      setErrorMessage(null);
      if (source === 'upload') {
        setLensMode('portrait');
      }
    },
    [setErrorMessage, stopLiveVoice]
  );

  const handleResetToWashington = useCallback(() => {
    stopLiveVoice();
    setArtwork(WASHINGTON_PORTRAIT);
    setActiveHotspotId(null);
    setCameraError(null);
    setErrorMessage(null);
    setLensMode('portrait');
  }, [setErrorMessage, stopLiveVoice]);

  const handleToggleVoice = () => {
    if (isListening || connectionState === 'connecting') {
      stopLiveVoice();
    } else if (canSpeak) {
      startLiveVoice(true);
    }
  };

  return (
    <div className="portrait-room">
      <header className="portrait-room-header">
        <button type="button" onClick={onExit} aria-label="Back to discovery"><ArrowLeft size={18} /><span>Chronocall</span></button>
        <span className="portrait-room-title">{artwork.characterName}</span>
        <button type="button" onClick={() => setMobileQrOpen(true)} aria-label="Open on phone"><Smartphone size={18} /></button>
      </header>
      <div className="portrait-room-stage">
                {lensMode === 'camera' ? <ARPortraitStage
                  artwork={cameraArtworkLost ? null : artwork}
                  speechLevelRef={speechLevelRef}
                  isSpeaking={canSpeak && isSpeaking}
                  isListening={canSpeak && isListening}
                  needsAudioGesture={needsAudioGesture}
                  connectionState={connectionState}
                  activeHotspotId={activeHotspotId}
                  activeCue={activeCue}
                  latestDialogue={latestCharacterLine}
                  latestVisitorLine={latestVisitorLine}
                  errorMessage={combinedError}
                  onSelectHotspot={handleSelectHotspot}
                  onArtworkIdentified={(identified) => handleArtworkIdentified(identified, 'camera')}
                  onArtworkLost={() => { stopLiveVoice(); setCameraArtworkLost(true); setActiveHotspotId(null); setActiveCue(null); }}
                  onSendCameraFrame={sendCameraFrameToLive}
                  onCameraError={setCameraError}
                  onAvatarTap={() => { if (canSpeak) askCharacter('Tell me about this painting.', 'gaze'); }}
                /> : <PortraitStage
                  artwork={artwork}
                  lensMode={lensMode}
                  onChangeLensMode={setLensMode}
                  speechLevelRef={speechLevelRef}
                  isSpeaking={isSpeaking}
                  isListening={isListening}
                  connectionState={connectionState}
                  activeHotspotId={activeHotspotId}
                  activeCue={activeCue}
                  latestDialogue={latestCharacterLine}
                  latestVisitorLine={latestVisitorLine}
                  onSelectHotspot={handleSelectHotspot}
                  onArtworkIdentified={handleArtworkIdentified}
                  onResetToWashington={handleResetToWashington}
                  isCustomArtwork={isCustomArtwork}
                  onSendCameraFrame={sendCameraFrameToLive}
                  onCameraError={setCameraError}
                  onToggleVoice={handleToggleVoice}
                  onAvatarTap={() =>
                    askCharacter(
                      'General Washington, please greet me and tell me what moment this painting captures.',
                      'gaze'
                    )
                  }
                />}
      </div>
      <div className="portrait-room-dock">
        {combinedError && <p role="alert" className="portrait-room-error">{combinedError}</p>}
        <div className="portrait-room-actions"><button type="button" className="portrait-room-secondary portrait-room-ar" aria-pressed={lensMode === 'camera'} onClick={() => { stopLiveVoice(); setCameraArtworkLost(true); setLensMode(lensMode === 'camera' ? 'portrait' : 'camera'); }}><ScanEye size={20} />{lensMode === 'camera' ? 'Back to portrait' : 'Start AR discovery'}</button>
          <button type="button" className="portrait-room-secondary" onClick={() => setMobileSheetOpen(true)} aria-label="Open conversation"><MessageSquare size={20} /><span>Conversation</span></button>
          <button type="button" className={`portrait-room-speak ${isListening || connectionState === 'connecting' ? 'is-active' : ''}`} onClick={handleToggleVoice} disabled={!canSpeak && !isListening}>
            {isListening || connectionState === 'connecting' ? <MicOff size={22} /> : <Mic size={22} />}
            <span>{connectionState === 'connecting' ? 'Cancel connection' : isListening ? 'End conversation' : 'Talk to portrait'}</span>
          </button>
          {isSpeaking && <button type="button" className="portrait-room-secondary" onClick={stopPlaybackQueue} aria-label="Interrupt speech"><VolumeX size={20} /><span>Interrupt</span></button>}
        </div>
        <p className="portrait-room-hint">{isListening ? 'Listening · Ask a question or interrupt naturally' : lensMode === 'camera' ? 'Point your camera at a painting. Once identified, talk to its subject.' : 'Talk to this portrait, or start AR discovery to scan a painting with your camera.'}</p>
      </div>
      <dialog aria-label="Portrait conversation" ref={sheetRef} className="portrait-room-sheet" onCancel={() => setMobileSheetOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) setMobileSheetOpen(false); }}>
        <div className="portrait-room-sheet-body">
          <div className="portrait-room-sheet-heading"><span>Conversation</span><button type="button" onClick={() => setMobileSheetOpen(false)} aria-label="Close conversation"><X size={22} /></button></div>
          <div className="portrait-room-panel">
              <CuratorialPanel
                artwork={artwork}
                transcript={transcript}
                connectionState={connectionState}
                isListening={isListening}
                isSpeaking={isSpeaking}
                errorMessage={combinedError}
                onStartVoice={() => { if (canSpeak) startLiveVoice(true); }}
                onStopVoice={stopLiveVoice}
                onInterruptPlayback={stopPlaybackQueue}
                onSendMessage={(text) => { if (canSpeak) askCharacter(text); }}
              />
          </div>
        </div>
      </dialog>
      <MobilePreviewModal open={mobileQrOpen} onClose={() => setMobileQrOpen(false)} />
    </div>
  );
}

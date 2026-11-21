import React, { useCallback, useMemo, useState } from 'react';
import { Mic, MicOff, MessageSquare, X, Camera, Sparkles, Smartphone } from 'lucide-react';
import { WASHINGTON_PORTRAIT } from './data/washingtonPortrait';
import { useMuseumVoice } from './hooks/useMuseumVoice';
import { ARHotspot, LensMode, PortraitArtwork } from './types/portrait';
import { ARPortraitStage } from './components/ARPortraitStage';
import { CuratorialPanel } from './components/CuratorialPanel';
import { MobilePreviewModal } from './components/MobilePreviewModal';

export default function App() {
  const [artwork, setArtwork] = useState<PortraitArtwork>(WASHINGTON_PORTRAIT);
  const [lensMode, setLensMode] = useState<LensMode>('portrait');
  const [activeHotspotId, setActiveHotspotId] = useState<string | null>(null);
  const [activeCue, setActiveCue] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [mobileQrOpen, setMobileQrOpen] = useState(false);

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
      askCharacter(spot.prompt, spot.animationCue);
    },
    [askCharacter]
  );

  const handleArtworkIdentified = useCallback(
    (identified: PortraitArtwork, source: 'camera' | 'upload') => {
      stopLiveVoice();
      setArtwork(identified);
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
    } else {
      startLiveVoice();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F3EC] text-[#181614] pb-20 lg:pb-0">
      {/* Three-Zone Top Bar */}
      <header className="border-b border-[#181614]/10 bg-[#F6F3EC]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <a
            href="#ar-stage"
            className="font-serif text-2xl font-semibold tracking-tight text-[#181614] whitespace-nowrap shrink-0"
          >
            The Living Gallery
          </a>

          <nav
            aria-label="Exhibition navigation"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-[#57514A]"
          >
            <a
              href="#ar-stage"
              className="hover:text-[#181614] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              AR Viewfinder
            </a>
            <a
              href="#portrait-details"
              className="hover:text-[#181614] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Portrait Details
            </a>
            <a
              href="#historical-context"
              className="hover:text-[#181614] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Historical Context
            </a>
            <a
              href="#visitor-guide"
              className="hover:text-[#181614] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Visitor Guide
            </a>
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={handleToggleVoice}
              className={`min-h-[42px] px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 ${
                isListening || connectionState === 'connecting'
                  ? 'bg-[#9A3412] text-[#FBF9F4] hover:bg-[#7C2D12]'
                  : 'bg-[#181614] text-[#FBF9F4] hover:bg-[#2E2A26]'
              }`}
            >
              {isListening || connectionState === 'connecting' ? (
                <>
                  <MicOff className="w-4 h-4" />
                  <span>Stop Voice</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  <span>Speak to Portrait</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Museum AR Stage */}
      <main id="ar-stage" className="flex-1">
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10">
          {/* Quiet Unboxed Gallery Context Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#181614]/10 mb-6">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs uppercase tracking-widest text-[#6B655E]">
              <span>{artwork.galleryLocation}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{artwork.accessionNumber}</span>
              <span aria-hidden="true">·</span>
              <span>Interactive Augmented Reality</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-[#57514A] hidden sm:inline">
                Tap any marker or speak aloud to converse with{' '}
                <span className="font-medium text-[#181614]">{artwork.characterName}</span>
              </span>
              <button
                type="button"
                onClick={() => setMobileQrOpen(true)}
                className="min-h-[36px] px-3 py-1.5 rounded-lg border border-[#181614]/15 bg-[#FBF9F4] text-xs font-medium text-[#181614] hover:border-[#8C6229] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Smartphone className="w-3.5 h-3.5 text-[#8C6229]" />
                <span>Open on Phone</span>
              </button>
            </div>
          </div>

          {/* 12-Column Balanced AR Stage & Curatorial Folio */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="h-[480px] sm:h-[560px] lg:h-[650px]">
                <ARPortraitStage
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
                />
              </div>

              {/* Quick AR Detail Strip under Viewfinder */}
              {artwork.hotspots.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 curatorial-scroll">
                  {artwork.hotspots.map((spot) => {
                    const active = activeHotspotId === spot.id;
                    return (
                      <button
                        key={spot.id}
                        type="button"
                        onClick={() => handleSelectHotspot(spot)}
                        className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                          active
                            ? 'bg-[#181614] text-[#FBF9F4] border-[#181614]'
                            : 'bg-[#FBF9F4] text-[#3E3934] border-[#181614]/12 hover:border-[#8C6229] hover:text-[#181614]'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5 text-[#B4833E]" />
                        <span>{spot.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Desktop Curatorial Folio & Live Dialogue */}
            <div className="hidden lg:block lg:col-span-5">
              <CuratorialPanel
                artwork={artwork}
                transcript={transcript}
                connectionState={connectionState}
                isListening={isListening}
                isSpeaking={isSpeaking}
                errorMessage={combinedError}
                onStartVoice={startLiveVoice}
                onStopVoice={stopLiveVoice}
                onInterruptPlayback={stopPlaybackQueue}
                onSendMessage={(text) => askCharacter(text)}
              />
            </div>
          </div>
        </section>

        {/* Section 2: Interactive Portrait Details */}
        <section
          id="portrait-details"
          className="border-t border-[#181614]/10 bg-[#F0ECE2]/60 py-14"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-10">
              <p className="text-xs uppercase tracking-widest text-[#6B655E]">
                01. Iconography & Composition
              </p>
              <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-[#181614] mt-2 text-balance">
                Elements inside the painting
              </h2>
              <p className="text-sm sm:text-base text-[#4A453F] mt-2 leading-relaxed">
                Select any compositional study below to illuminate that region in the AR canvas and hear {artwork.characterName} reflect on its meaning.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {artwork.hotspots.map((spot, index) => (
                <button
                  key={spot.id}
                  type="button"
                  onClick={() => {
                    handleSelectHotspot(spot);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="text-left p-6 rounded-xl bg-[#FBF9F4] border border-[#181614]/10 hover:border-[#8C6229] transition-colors flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs text-[#6B655E] font-mono tabular-nums mb-2">
                      <span>{`Study 0${index + 1}`}</span>
                      <span>{`${Math.round(spot.x)}%, ${Math.round(spot.y)}%`}</span>
                    </div>
                    <h3 className="font-serif text-xl font-semibold text-[#181614]">
                      {spot.label}
                    </h3>
                    <p className="text-sm text-[#57514A] mt-1.5 leading-relaxed">
                      {spot.eraDetail}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-[#8C6229]">
                    Ask about this detail →
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Section 3: Historical Context Editorial Essay */}
        <section id="historical-context" className="border-t border-[#181614]/10 py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-7 max-w-prose">
              <p className="text-xs uppercase tracking-widest text-[#6B655E]">
                02. Archival Context
              </p>
              <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-[#181614] mt-2 text-balance">
                The equestrian portrait in American memory
              </h2>
              <p className="mt-5 text-base text-[#2F2B27] leading-loose first-letter:text-5xl first-letter:font-serif first-letter:font-semibold first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:leading-none">
                {artwork.historicalContext}
              </p>
              <blockquote className="my-8 py-5 border-t border-b border-[#181614]/15 font-serif italic text-xl sm:text-2xl text-[#181614] leading-snug">
                “Perseverance and spirit have done wonders in all ages.”
                <footer className="mt-2 not-italic font-sans text-xs uppercase tracking-widest text-[#6B655E]">
                  George Washington · Letters of 1777
                </footer>
              </blockquote>
              <p className="text-base text-[#4A453F] leading-relaxed">
                By anchoring optical atmospheric effects, subtle posture motion, and live conversational voice directly onto the canvas coordinates, Chronocall turns passive observation into an active historical exchange.
              </p>
            </div>

            <div className="lg:col-span-5">
              <div className="p-6 rounded-2xl bg-[#FBF9F4] border border-[#181614]/10">
                <h3 className="font-serif text-2xl font-semibold text-[#181614] mb-4">
                  Chronology of the Campaign
                </h3>
                <ol className="divide-y divide-[#181614]/10 text-sm">
                  <li className="py-3.5">
                    <span className="font-mono text-xs text-[#8C6229] tabular-nums">
                      DEC 1776
                    </span>
                    <p className="font-medium text-[#181614] mt-0.5">
                      Crossing the Delaware & Battle of Trenton
                    </p>
                    <p className="text-xs text-[#57514A] mt-1">
                      Nighttime river crossing through ice floes restores Continental morale.
                    </p>
                  </li>
                  <li className="py-3.5">
                    <span className="font-mono text-xs text-[#8C6229] tabular-nums">
                      JAN 1777
                    </span>
                    <p className="font-medium text-[#181614] mt-0.5">
                      Battle of Princeton
                    </p>
                    <p className="text-xs text-[#57514A] mt-1">
                      Washington rides forward on his gray charger to rally wavering lines within musket range.
                    </p>
                  </li>
                  <li className="py-3.5">
                    <span className="font-mono text-xs text-[#8C6229] tabular-nums">
                      1777 – 1778
                    </span>
                    <p className="font-medium text-[#181614] mt-0.5">
                      Winter Encampment at Valley Forge
                    </p>
                    <p className="text-xs text-[#57514A] mt-1">
                      Disciplined drilling transforms the Continental regiments into a cohesive army.
                    </p>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Visitor Guide */}
        <section
          id="visitor-guide"
          className="border-t border-[#181614]/10 bg-[#EBE6DC]/55 py-14"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-8">
              <p className="text-xs uppercase tracking-widest text-[#6B655E]">
                03. Gallery Instructions
              </p>
              <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-[#181614] mt-2 text-balance">
                How to converse with a painting
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-xl bg-[#FBF9F4] border border-[#181614]/10">
                <div className="flex items-center gap-2 text-xs font-mono text-[#8C6229] mb-2">
                  <Camera className="w-4 h-4" />
                  <span>STEP 01</span>
                </div>
                <h3 className="font-serif text-xl font-semibold text-[#181614]">
                  Aim Camera AR or Open Portrait
                </h3>
                <p className="text-sm text-[#57514A] mt-2 leading-relaxed">
                  Switch to Camera AR to point your phone at any museum portrait and tap Scan Painting, or explore the framed George Washington painting directly.
                </p>
              </div>

              <div className="p-6 rounded-xl bg-[#FBF9F4] border border-[#181614]/10">
                <div className="flex items-center gap-2 text-xs font-mono text-[#8C6229] mb-2">
                  <Mic className="w-4 h-4" />
                  <span>STEP 02</span>
                </div>
                <h3 className="font-serif text-xl font-semibold text-[#181614]">
                  Speak Naturally in Real Time
                </h3>
                <p className="text-sm text-[#57514A] mt-2 leading-relaxed">
                  Tap Speak to Portrait to stream live voice audio. Ask follow-up questions or interrupt mid-thought just as you would in person.
                </p>
              </div>

              <div className="p-6 rounded-xl bg-[#FBF9F4] border border-[#181614]/10">
                <div className="flex items-center gap-2 text-xs font-mono text-[#8C6229] mb-2">
                  <Sparkles className="w-4 h-4" />
                  <span>STEP 03</span>
                </div>
                <h3 className="font-serif text-xl font-semibold text-[#181614]">
                  Touch Painting Details
                </h3>
                <p className="text-sm text-[#57514A] mt-2 leading-relaxed">
                  Tap the optical markers anchored on Washington’s sword, coat, or charger Blueskin to trigger contextual animations and stories.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Mobile Bottom Ergonomic Thumb Dock (<= 15% mobile height) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#F6F3EC]/95 backdrop-blur-md border-t border-[#181614]/12 px-4 py-2.5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleToggleVoice}
          className={`flex-1 min-h-[46px] px-4 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${
            isListening || connectionState === 'connecting'
              ? 'bg-[#9A3412] text-[#FBF9F4]'
              : 'bg-[#181614] text-[#FBF9F4]'
          }`}
        >
          {isListening || connectionState === 'connecting' ? (
            <>
              <MicOff className="w-4 h-4" />
              <span>Stop Voice</span>
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" />
              <span>Speak</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => setMobileSheetOpen(true)}
          className="min-h-[46px] px-4 rounded-xl border border-[#181614]/20 bg-[#FBF9F4] text-[#181614] text-sm font-medium flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
        >
          <MessageSquare className="w-4 h-4 text-[#8C6229]" />
          <span>Dialogue & Notes</span>
        </button>
      </div>

      {/* Mobile Slide-Up Curatorial Sheet */}
      {mobileSheetOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex flex-col justify-end bg-black/55 backdrop-blur-xs">
          <div className="bg-[#FBF9F4] rounded-t-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#181614]/10">
              <span className="text-xs uppercase tracking-widest text-[#6B655E]">
                Curatorial Folio
              </span>
              <button
                type="button"
                onClick={() => setMobileSheetOpen(false)}
                aria-label="Close dialogue sheet"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#181614] hover:bg-[#EBE6DC]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <CuratorialPanel
                artwork={artwork}
                transcript={transcript}
                connectionState={connectionState}
                isListening={isListening}
                isSpeaking={isSpeaking}
                errorMessage={combinedError}
                onStartVoice={startLiveVoice}
                onStopVoice={stopLiveVoice}
                onInterruptPlayback={stopPlaybackQueue}
                onSendMessage={(text) => askCharacter(text)}
              />
            </div>
          </div>
        </div>
      )}

      <MobilePreviewModal
        open={mobileQrOpen}
        onClose={() => setMobileQrOpen(false)}
      />
    </div>
  );
}

/**
 * Pure Web Audio API FaceTime-inspired chimes (ringing, connect, end call).
 * Zero external audio assets required; fails silently if autoplay is blocked.
 */

function createTone(
  ctx: AudioContext,
  freq: number,
  startOffset: number,
  duration: number,
  peakGain = 0.08,
  type: OscillatorType = "sine"
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + startOffset);

  const t0 = ctx.currentTime + startOffset;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peakGain, t0 + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** Plays a repeating soft FaceTime-style outgoing ring pulse until stop() is called. */
export function startOutgoingRingtone(): () => void {
  let stopped = false;
  let timerId: number | null = null;
  let ctx: AudioContext | null = null;

  const playPulse = () => {
    if (stopped) return;
    try {
      if (!ctx || ctx.state === "closed") {
        ctx = new AudioContext();
      }
      if (ctx.state === "suspended") {
        void ctx.resume();
      }
      // Warm gentle major-ninth double chime reminiscent of modern video-call ringing
      createTone(ctx, 523.25, 0.0, 0.45, 0.055, "sine"); // C5
      createTone(ctx, 659.25, 0.06, 0.45, 0.045, "sine"); // E5
      createTone(ctx, 783.99, 0.14, 0.55, 0.04, "triangle"); // G5
      createTone(ctx, 1046.5, 0.24, 0.65, 0.03, "sine"); // C6
    } catch {
      // Autoplay restriction or unavailable audio device — stay silent cleanly
    }
  };

  playPulse();
  timerId = window.setInterval(playPulse, 2600);

  return () => {
    stopped = true;
    if (timerId !== null) window.clearInterval(timerId);
    if (ctx && ctx.state !== "closed") {
      void ctx.close().catch(() => {});
    }
    ctx = null;
  };
}

export function playConnectChime(): void {
  try {
    const ctx = new AudioContext();
    createTone(ctx, 587.33, 0.0, 0.22, 0.06, "sine"); // D5
    createTone(ctx, 880.0, 0.1, 0.34, 0.06, "sine"); // A5
    window.setTimeout(() => {
      if (ctx.state !== "closed") void ctx.close().catch(() => {});
    }, 600);
  } catch {
    // Ignore audio errors
  }
}

export function playEndCallChime(): void {
  try {
    const ctx = new AudioContext();
    createTone(ctx, 523.25, 0.0, 0.18, 0.055, "sine"); // C5
    createTone(ctx, 392.0, 0.11, 0.28, 0.055, "sine"); // G4
    window.setTimeout(() => {
      if (ctx.state !== "closed") void ctx.close().catch(() => {});
    }, 550);
  } catch {
    // Ignore audio errors
  }
}

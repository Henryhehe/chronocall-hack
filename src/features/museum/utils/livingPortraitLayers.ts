export interface FeatheredRegionSpec {
  id: string;
  /** Normalized 0..1 center X */
  cx: number;
  /** Normalized 0..1 center Y */
  cy: number;
  /** Normalized 0..1 radius X */
  rx: number;
  /** Normalized 0..1 radius Y */
  ry: number;
  /** Normalized 0..1 pivot X */
  px: number;
  /** Normalized 0..1 pivot Y */
  py: number;
}

export interface CachedPortraitLayer {
  spec: FeatheredRegionSpec;
  canvas: HTMLCanvasElement;
}

export interface AvatarBehaviorState {
  speech: number;
  isSpeaking: boolean;
  isListening: boolean;
  isThinking: boolean;
  cue: string | null;
  tiltX: number;
  tiltY: number;
}

export function getPortraitRegionSpecs(
  isWashington: boolean,
  focalPoint: { x: number; y: number },
  hasHumanSubject = true
): FeatheredRegionSpec[] {
  if (!hasHumanSubject) {
    return [];
  }
  if (isWashington) {
    return [
      {
        id: 'headTorso',
        cx: 0.45,
        cy: 0.27,
        rx: 0.14,
        ry: 0.14,
        px: 0.45,
        py: 0.39,
      },
      {
        id: 'jaw',
        cx: 0.448,
        cy: 0.268,
        rx: 0.024,
        ry: 0.018,
        px: 0.448,
        py: 0.258,
      },
      {
        id: 'swordArm',
        cx: 0.24,
        cy: 0.34,
        rx: 0.15,
        ry: 0.09,
        px: 0.39,
        py: 0.34,
      },
      {
        id: 'horseHead',
        cx: 0.73,
        cy: 0.51,
        rx: 0.17,
        ry: 0.14,
        px: 0.58,
        py: 0.53,
      },
      {
        id: 'maneTail',
        cx: 0.28,
        cy: 0.6,
        rx: 0.12,
        ry: 0.17,
        px: 0.34,
        py: 0.48,
      },
    ];
  }

  const fx = Math.max(0.18, Math.min(0.82, focalPoint.x / 100));
  const fy = Math.max(0.16, Math.min(0.75, focalPoint.y / 100));
  return [
    {
      id: 'headTorso',
      cx: fx,
      cy: fy,
      rx: 0.16,
      ry: 0.16,
      px: fx,
      py: Math.min(0.92, fy + 0.14),
    },
  ];
}

export function buildFeatheredLayers(
  img: HTMLImageElement | HTMLCanvasElement,
  specs: FeatheredRegionSpec[]
): CachedPortraitLayer[] {
  const w = ('naturalWidth' in img ? img.naturalWidth : img.width) || 512;
  const h = ('naturalHeight' in img ? img.naturalHeight : img.height) || 680;

  return specs.map((spec) => {
    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const octx = offscreen.getContext('2d');
    if (octx) {
      octx.drawImage(img, 0, 0, w, h);

      const mask = document.createElement('canvas');
      mask.width = w;
      mask.height = h;
      const mctx = mask.getContext('2d');
      if (mctx) {
        const cx = spec.cx * w;
        const cy = spec.cy * h;
        const rx = spec.rx * w;
        const ry = spec.ry * h;

        mctx.save();
        mctx.translate(cx, cy);
        mctx.scale(1, ry / Math.max(1, rx));
        const grad = mctx.createRadialGradient(0, 0, rx * 0.2, 0, 0, rx);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.55, 'rgba(255, 255, 255, 0.72)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        mctx.fillStyle = grad;
        mctx.beginPath();
        mctx.arc(0, 0, rx, 0, Math.PI * 2);
        mctx.fill();
        mctx.restore();

        octx.globalCompositeOperation = 'destination-in';
        octx.drawImage(mask, 0, 0);
        octx.globalCompositeOperation = 'source-over';
      }
    }

    return { spec, canvas: offscreen };
  });
}

export function drawAnimatedPaintingComposition(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | HTMLCanvasElement,
  layers: CachedPortraitLayer[],
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  elapsed: number,
  behavior: AvatarBehaviorState,
  alpha = 1,
  featherEdges = false,
  drawBase = true
) {
  const { speech, isSpeaking, isListening, isThinking, cue, tiltX, tiltY } = behavior;

  ctx.save();
  ctx.globalAlpha = alpha;

  if (featherEdges) {
    const radius = Math.min(12, Math.min(dw, dh) * 0.025);
    ctx.beginPath();
    ctx.roundRect(dx, dy, dw, dh, radius);
    ctx.clip();
  }

  // 1. Base painting with subtle respiratory swell (skipped for live-video custom artworks to avoid double-vision)
  const breathScale = 1 + Math.sin(elapsed * 1.45) * 0.003 + speech * 0.005;
  const cx = dx + dw / 2;
  const cy = dy + dh / 2;

  if (drawBase) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(breathScale, breathScale);
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }

  // Compute head transform first so jaw & blink track head motion exactly
  const listenLean = isListening && !isSpeaking ? 0.018 : 0;
  const thinkLift = isThinking ? -0.015 : 0;
  const headCueBoost = cue === 'gaze' ? 1.7 : 1;
  const headAngle =
    Math.sin(elapsed * 1.15) * 0.012 * headCueBoost +
    Math.sin(elapsed * 6.2) * speech * 0.022 +
    listenLean +
    thinkLift +
    tiltX * 0.014;
  const headShiftY =
    Math.sin(elapsed * 1.45) * -1.4 - speech * 3.4 + (isListening ? 1.2 : 0) + tiltY * 1.5;
  const headShiftX = Math.cos(elapsed * 0.9) * 1.1 + tiltX * 2.0;
  const headScale = 1 + speech * 0.018 + (isListening && !isSpeaking ? 0.008 : 0);

  // 2. Feathered living anatomical layers
  for (const layer of layers) {
    const { spec, canvas } = layer;

    if (spec.id === 'jaw') {
      // Articulated jaw tracks the head transform + adds syllabic speech drop
      const headLayer = layers.find((l) => l.spec.id === 'headTorso');
      const hpx = dx + (headLayer?.spec.px ?? 0.45) * dw;
      const hpy = dy + (headLayer?.spec.py ?? 0.39) * dh;

      const syllable =
        speech > 0.035
          ? speech * (0.55 + 0.45 * Math.abs(Math.sin(elapsed * 19.5)))
          : 0;
      const jawDrop = syllable * dh * 0.0095;

      ctx.save();
      ctx.translate(hpx + headShiftX, hpy + headShiftY);
      ctx.rotate(headAngle);
      ctx.scale(headScale, headScale);

      // Subtle warm oral shadow inside mouth crease when speaking
      if (syllable > 0.06) {
        const mx = (spec.cx - (headLayer?.spec.px ?? 0.45)) * dw;
        const my = (spec.cy - 0.008 - (headLayer?.spec.py ?? 0.39)) * dh;
        ctx.fillStyle = `rgba(38, 22, 16, ${Math.min(0.65, syllable * 0.72)})`;
        ctx.beginPath();
        ctx.ellipse(mx, my + jawDrop * 0.35, dw * 0.011, Math.max(1.2, jawDrop * 0.52), 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.translate(0, jawDrop);
      ctx.drawImage(
        canvas,
        -(headLayer?.spec.px ?? 0.45) * dw,
        -(headLayer?.spec.py ?? 0.39) * dh,
        dw,
        dh
      );
      ctx.restore();
      continue;
    }

    const pivotX = dx + spec.px * dw;
    const pivotY = dy + spec.py * dh;

    if (spec.id === 'headTorso') {
      ctx.save();
      ctx.translate(pivotX + headShiftX, pivotY + headShiftY);
      ctx.rotate(headAngle);
      ctx.scale(headScale, headScale);
      ctx.drawImage(canvas, -spec.px * dw, -spec.py * dh, dw, dh);

      // Natural periodic eye blink (~140ms every 4.2s) for Washington's calibrated eye position
      const hasJawLayer = layers.some((l) => l.spec.id === 'jaw');
      const blinkCycle = elapsed % 4.2;
      if (hasJawLayer && blinkCycle > 3.95 && blinkCycle < 4.12) {
        const blinkProgress = Math.sin(((blinkCycle - 3.95) / 0.17) * Math.PI);
        const eyeX = (0.447 - spec.px) * dw;
        const eyeY = (0.244 - spec.py) * dh;
        ctx.fillStyle = `rgba(176, 138, 108, ${0.72 * blinkProgress})`;
        ctx.beginPath();
        ctx.ellipse(eyeX - dw * 0.011, eyeY, dw * 0.008, dh * 0.0045 * blinkProgress, 0, 0, Math.PI * 2);
        ctx.ellipse(eyeX + dw * 0.011, eyeY, dw * 0.008, dh * 0.0045 * blinkProgress, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
      continue;
    }

    let angle = 0;
    let shiftX = 0;
    let shiftY = 0;
    let scale = 1;

    if (spec.id === 'swordArm') {
      const cueBoost = cue === 'sword' ? 2.1 : 1;
      angle =
        Math.sin(elapsed * 1.35 + 0.6) * 0.018 * cueBoost -
        speech * 0.038 * (0.6 + 0.4 * Math.sin(elapsed * 5.2));
      shiftY = -speech * 2.4;
    } else if (spec.id === 'horseHead') {
      const cueBoost = cue === 'horse' ? 2.0 : 1;
      angle = Math.sin(elapsed * 1.65 + 1.4) * 0.025 * cueBoost + speech * 0.014;
      shiftY = Math.sin(elapsed * 1.65) * 1.8;
    } else if (spec.id === 'maneTail') {
      angle = Math.sin(elapsed * 2.1 + 0.8) * 0.028 + Math.sin(elapsed * 3.7) * 0.01;
      shiftX = Math.sin(elapsed * 2.1) * 1.6;
    }

    ctx.save();
    ctx.translate(pivotX + shiftX, pivotY + shiftY);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.drawImage(canvas, -spec.px * dw, -spec.py * dh, dw, dh);
    ctx.restore();
  }

  // 3. Drifting atmospheric clouds / smoke across painted upper sky
  for (let i = 0; i < 5; i++) {
    const progress = ((elapsed * (0.014 + i * 0.004) + i * 0.21) % 1.4) - 0.2;
    const wx = dx + progress * dw;
    const wy = dy + (0.1 + (i % 3) * 0.08) * dh;
    const rad = dw * (0.18 + (i % 2) * 0.08);
    const boost = cue === 'horizon' ? 1.8 : 1;
    const grad = ctx.createRadialGradient(wx, wy, 2, wx, wy, rad);
    grad.addColorStop(0, `rgba(244, 224, 186, ${0.075 * boost})`);
    grad.addColorStop(1, 'rgba(244, 224, 186, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(wx, wy, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // 4. Subtle gallery vignette when anchored onto live camera feed
  if (featherEdges) {
    const edgeGrad = ctx.createRadialGradient(
      cx,
      cy,
      Math.min(dw, dh) * 0.38,
      cx,
      cy,
      Math.max(dw, dh) * 0.65
    );
    edgeGrad.addColorStop(0, 'rgba(17, 16, 15, 0)');
    edgeGrad.addColorStop(1, 'rgba(17, 16, 15, 0.28)');
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(dx, dy, dw, dh);
  }

  ctx.restore();
}

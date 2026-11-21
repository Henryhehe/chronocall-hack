import { FocalBox, FocalQuad, QuadCorner } from '../types/portrait';
import {
  boxToQuad,
  computeSquareToQuadHomography,
  isConvexQuad,
  quadToBoundingBox,
} from './perspectiveWarp';

export interface AnchorTrackResult {
  detected: boolean;
  confidence: number;
  /** Axis-aligned bounding box in 0..100 percentages */
  box: FocalBox;
  /** Exact 4 perspective corners in 0..100 percentages */
  quad: FocalQuad;
}

interface TemplateData {
  cols: number;
  rows: number;
  aspect: number;
  grayNorm: Float32Array;
  rMean: Float32Array;
  gMean: Float32Array;
  bMean: Float32Array;
  uCoords: Float32Array;
  vCoords: Float32Array;
}

const TEMPLATE_COLS = 18;
const TEMPLATE_ROWS = 25;

export class WashingtonAnchorTracker {
  private template: TemplateData | null = null;
  private loadingPromise: Promise<void> | null = null;
  private workCanvas: HTMLCanvasElement;
  private workCtx: CanvasRenderingContext2D | null;

  private locked = false;
  private missCount = 0;
  private smoothQuad: FocalQuad | null = null;

  constructor(private readonly anchorUrl: string) {
    this.workCanvas = document.createElement('canvas');
    this.workCtx = this.workCanvas.getContext('2d', { willReadFrequently: true });
  }

  public async ensureLoaded(): Promise<void> {
    if (this.template) return;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = new Promise<void>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = TEMPLATE_COLS;
        c.height = TEMPLATE_ROWS;
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, TEMPLATE_COLS, TEMPLATE_ROWS);
          const data = ctx.getImageData(0, 0, TEMPLATE_COLS, TEMPLATE_ROWS).data;
          const n = TEMPLATE_COLS * TEMPLATE_ROWS;
          const gray = new Float32Array(n);
          const rArr = new Float32Array(n);
          const gArr = new Float32Array(n);
          const bArr = new Float32Array(n);
          const uCoords = new Float32Array(n);
          const vCoords = new Float32Array(n);

          let sum = 0;
          for (let r = 0; r < TEMPLATE_ROWS; r++) {
            for (let col = 0; col < TEMPLATE_COLS; col++) {
              const i = r * TEMPLATE_COLS + col;
              const pr = data[i * 4];
              const pg = data[i * 4 + 1];
              const pb = data[i * 4 + 2];
              const lum = 0.299 * pr + 0.587 * pg + 0.114 * pb;
              gray[i] = lum;
              rArr[i] = pr;
              gArr[i] = pg;
              bArr[i] = pb;
              uCoords[i] = (col + 0.5) / TEMPLATE_COLS;
              vCoords[i] = (r + 0.5) / TEMPLATE_ROWS;
              sum += lum;
            }
          }

          const mean = sum / n;
          let sqSum = 0;
          for (let i = 0; i < n; i++) {
            const d = gray[i] - mean;
            gray[i] = d;
            sqSum += d * d;
          }
          const std = Math.sqrt(sqSum) || 1;
          for (let i = 0; i < n; i++) {
            gray[i] /= std;
          }

          this.template = {
            cols: TEMPLATE_COLS,
            rows: TEMPLATE_ROWS,
            aspect: img.naturalWidth / Math.max(1, img.naturalHeight),
            grayNorm: gray,
            rMean: rArr,
            gMean: gArr,
            bMean: bArr,
            uCoords,
            vCoords,
          };
        }
        resolve();
      };
      img.onerror = () => resolve();
      img.src = this.anchorUrl;
    });

    return this.loadingPromise;
  }

  public seedLock(box: FocalBox) {
    this.seedQuad(boxToQuad(box));
  }

  public seedQuad(quad: FocalQuad) {
    this.locked = true;
    this.missCount = 0;
    this.smoothQuad = cloneQuad(quad);
  }

  public clearLock() {
    this.locked = false;
    this.missCount = 0;
    this.smoothQuad = null;
  }

  /**
   * Matches the uploaded Washington anchor painting inside the live camera <video>
   * frame and tracks its 4 perspective corners using projective homography refinement.
   */
  public trackFrame(
    video: HTMLVideoElement,
    viewW: number,
    viewH: number
  ): AnchorTrackResult | null {
    if (!this.template || !this.workCtx || video.readyState < 2 || viewW <= 0 || viewH <= 0) {
      return null;
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;

    const analysisW = 180;
    const analysisH = Math.max(100, Math.round((analysisW * viewH) / viewW));
    if (this.workCanvas.width !== analysisW || this.workCanvas.height !== analysisH) {
      this.workCanvas.width = analysisW;
      this.workCanvas.height = analysisH;
    }

    const coverScale = Math.max(viewW / vw, viewH / vh);
    const srcW = viewW / coverScale;
    const srcH = viewH / coverScale;
    const srcX = (vw - srcW) / 2;
    const srcY = (vh - srcH) / 2;

    this.workCtx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, analysisW, analysisH);
    const pixels = this.workCtx.getImageData(0, 0, analysisW, analysisH).data;

    const len = analysisW * analysisH;
    const frameGray = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const idx = i * 4;
      frameGray[i] = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
    }

    // Fast gradient magnitude map to help quad edges snap onto painting/frame borders
    const edgeMag = new Float32Array(len);
    for (let y = 1; y < analysisH - 1; y++) {
      const row = y * analysisW;
      for (let x = 1; x < analysisW - 1; x++) {
        const i = row + x;
        const gx = Math.abs(frameGray[i + 1] - frameGray[i - 1]);
        const gy = Math.abs(frameGray[i + analysisW] - frameGray[i - analysisW]);
        edgeMag[i] = Math.min(255, gx + gy);
      }
    }

    const tmpl = this.template;
    let bestScore = -1;
    let bestQuadPx: FocalQuad = boxToQuad({ x: 24, y: 14, width: 52, height: 72 });

    if (this.locked && this.smoothQuad) {
      const initQuadPx = pctQuadToPx(this.smoothQuad, analysisW, analysisH);
      const refined = this.refineQuadPerspective(
        initQuadPx,
        frameGray,
        pixels,
        edgeMag,
        analysisW,
        analysisH
      );
      bestScore = refined.score;
      bestQuadPx = refined.quad;
    } else {
      // Global multi-scale + multi-aspect scan across the camera viewport
      let coarseScore = -1;
      let coarseBox = { x: 0, y: 0, w: 0, h: 0 };
      const heightFractions = [0.28, 0.38, 0.5, 0.63, 0.76, 0.88];
      const aspectMultipliers = [0.82, 1.0, 1.18];

      for (const frac of heightFractions) {
        const candH = analysisH * frac;
        for (const am of aspectMultipliers) {
          const candW = candH * tmpl.aspect * am;
          if (candW < 24 || candW >= analysisW - 2 || candH >= analysisH - 2) continue;

          const strideX = Math.max(4, Math.round(candW * 0.1));
          const strideY = Math.max(4, Math.round(candH * 0.1));

          for (let y = 0; y <= analysisH - candH; y += strideY) {
            for (let x = 0; x <= analysisW - candW; x += strideX) {
              const score = this.evaluateRectCandidate(
                frameGray,
                pixels,
                analysisW,
                x,
                y,
                candW,
                candH
              );
              if (score > coarseScore) {
                coarseScore = score;
                coarseBox = { x, y, w: candW, h: candH };
              }
            }
          }
        }
      }

      if (coarseScore >= 0.56) {
        const seedPx = boxToQuad({
          x: coarseBox.x,
          y: coarseBox.y,
          width: coarseBox.w,
          height: coarseBox.h,
        });
        const refined = this.refineQuadPerspective(
          seedPx,
          frameGray,
          pixels,
          edgeMag,
          analysisW,
          analysisH
        );
        bestScore = refined.score;
        bestQuadPx = refined.quad;
      } else {
        bestScore = coarseScore;
      }
    }

    const enterThreshold = 0.64;
    const holdThreshold = 0.50;
    const fallbackBox: FocalBox = { x: 24, y: 14, width: 52, height: 72 };
    const fallbackQuad = boxToQuad(fallbackBox);

    if (!this.locked) {
      if (bestScore >= enterThreshold && isValidTrackedQuad(bestQuadPx, analysisW, analysisH, tmpl.aspect)) {
        this.locked = true;
        this.missCount = 0;
        const pctQuad = pxQuadToPct(bestQuadPx, analysisW, analysisH);
        this.smoothQuad = pctQuad;
        return {
          detected: true,
          confidence: bestScore,
          box: quadToBoundingBox(pctQuad),
          quad: pctQuad,
        };
      }
      return {
        detected: false,
        confidence: Math.max(0, bestScore),
        box: fallbackBox,
        quad: fallbackQuad,
      };
    }

    if (
      bestScore >= holdThreshold &&
      this.smoothQuad &&
      isValidTrackedQuad(bestQuadPx, analysisW, analysisH, tmpl.aspect)
    ) {
      this.missCount = 0;
      const targetQuad = pxQuadToPct(bestQuadPx, analysisW, analysisH);
      this.smoothQuad = smoothQuadCorners(this.smoothQuad, targetQuad, 0.36, 0.14);
      return {
        detected: true,
        confidence: bestScore,
        box: quadToBoundingBox(this.smoothQuad),
        quad: this.smoothQuad,
      };
    }

    this.missCount += 1;
    if (this.missCount > 12) {
      this.locked = false;
      this.smoothQuad = null;
      return {
        detected: false,
        confidence: Math.max(0, bestScore),
        box: fallbackBox,
        quad: fallbackQuad,
      };
    }

    const activeQuad = this.smoothQuad || fallbackQuad;
    return {
      detected: true,
      confidence: Math.max(0, bestScore),
      box: quadToBoundingBox(activeQuad),
      quad: activeQuad,
    };
  }

  /**
   * 2-phase perspective refinement:
   * 1) Global shift, scale, roll, and horizontal/vertical keystone taper
   * 2) Individual 4-corner projective coordinate descent
   */
  private refineQuadPerspective(
    initQuad: FocalQuad,
    frameGray: Float32Array,
    pixels: Uint8ClampedArray,
    edgeMag: Float32Array,
    frameW: number,
    frameH: number
  ): { quad: FocalQuad; score: number } {
    const tmpl = this.template!;
    let current = cloneQuad(initQuad);
    let currentScore = this.evaluateQuadCandidate(
      current,
      frameGray,
      pixels,
      edgeMag,
      frameW,
      frameH
    );

    const tryCandidate = (cand: FocalQuad) => {
      if (!isValidTrackedQuad(cand, frameW, frameH, tmpl.aspect)) return;
      const s = this.evaluateQuadCandidate(cand, frameGray, pixels, edgeMag, frameW, frameH);
      if (s > currentScore) {
        currentScore = s;
        current = cand;
      }
    };

    // Phase 1: Translation + Scale + Roll + Perspective Keystone
    const box = quadToBoundingBox(current);
    const shiftSteps = [Math.max(3, box.width * 0.08), Math.max(1.5, box.width * 0.03)];
    for (const step of shiftSteps) {
      for (const [dx, dy] of [
        [-step, 0],
        [step, 0],
        [0, -step],
        [0, step],
      ]) {
        tryCandidate(translateQuad(current, dx, dy));
      }
      // Uniform scale
      tryCandidate(scaleQuadAroundCenter(current, 1.05, 1.05));
      tryCandidate(scaleQuadAroundCenter(current, 0.95, 0.95));
      // Aspect foreshortening
      tryCandidate(scaleQuadAroundCenter(current, 1.05, 1.0));
      tryCandidate(scaleQuadAroundCenter(current, 0.95, 1.0));
      // In-plane tilt / roll
      tryCandidate(rotateQuadAroundCenter(current, 0.04));
      tryCandidate(rotateQuadAroundCenter(current, -0.04));
      // Horizontal perspective taper (left edge taller vs right edge taller)
      tryCandidate(taperQuadHorizontal(current, step * 0.85));
      tryCandidate(taperQuadHorizontal(current, -step * 0.85));
      // Vertical perspective taper (top edge wider vs bottom edge wider)
      tryCandidate(taperQuadVertical(current, step * 0.85));
      tryCandidate(taperQuadVertical(current, -step * 0.85));
    }

    // Phase 2: Independent 4-corner refinement to hug perspective skew tightly
    const cornerSteps = [Math.max(2.2, box.width * 0.045), 1.0];
    const cornerKeys: (keyof FocalQuad)[] = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];
    const dirs = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];

    for (const step of cornerSteps) {
      for (const key of cornerKeys) {
        const baseCorner = current[key];
        let bestLocal = current;
        let bestLocalScore = currentScore;

        for (const [ux, uy] of dirs) {
          const cand = cloneQuad(current);
          cand[key] = {
            x: baseCorner.x + ux * step,
            y: baseCorner.y + uy * step,
          };
          if (!isValidTrackedQuad(cand, frameW, frameH, tmpl.aspect)) continue;
          const s = this.evaluateQuadCandidate(cand, frameGray, pixels, edgeMag, frameW, frameH);
          if (s > bestLocalScore) {
            bestLocalScore = s;
            bestLocal = cand;
          }
        }
        current = bestLocal;
        currentScore = bestLocalScore;
      }
    }

    return { quad: current, score: currentScore };
  }

  private evaluateQuadCandidate(
    quad: FocalQuad,
    frameGray: Float32Array,
    pixels: Uint8ClampedArray,
    edgeMag: Float32Array,
    frameW: number,
    frameH: number
  ): number {
    const H = computeSquareToQuadHomography(quad);
    if (!H.valid) return -1;

    const tmpl = this.template!;
    const n = tmpl.uCoords.length;
    const samples = new Float32Array(n);
    let sum = 0;
    let colorDiffSum = 0;

    const maxX = frameW - 1.001;
    const maxY = frameH - 1.001;

    for (let i = 0; i < n; i++) {
      const u = tmpl.uCoords[i];
      const v = tmpl.vCoords[i];
      const denom = H.g * u + H.h * v + 1;
      if (denom <= 0.05) return -1;

      const px = (H.a * u + H.b * v + H.c) / denom;
      const py = (H.d * u + H.e * v + H.f) / denom;
      if (px < 0 || px >= maxX || py < 0 || py >= maxY) return -1;

      // Bilinear grayscale sampling for smooth sub-pixel homography gradient
      const x0 = px | 0;
      const y0 = py | 0;
      const fx = px - x0;
      const fy = py - y0;
      const idx00 = y0 * frameW + x0;
      const idx10 = idx00 + 1;
      const idx01 = idx00 + frameW;
      const idx11 = idx01 + 1;

      const g0 = frameGray[idx00] + (frameGray[idx10] - frameGray[idx00]) * fx;
      const g1 = frameGray[idx01] + (frameGray[idx11] - frameGray[idx01]) * fx;
      const g = g0 + (g1 - g0) * fy;
      samples[i] = g;
      sum += g;

      const pIdx = idx00 * 4;
      const dr = Math.abs(pixels[pIdx] - tmpl.rMean[i]);
      const dg = Math.abs(pixels[pIdx + 1] - tmpl.gMean[i]);
      const db = Math.abs(pixels[pIdx + 2] - tmpl.bMean[i]);
      colorDiffSum += (dr + dg + db) / 765;
    }

    const mean = sum / n;
    let sqSum = 0;
    let dot = 0;
    for (let i = 0; i < n; i++) {
      const d = samples[i] - mean;
      sqSum += d * d;
      dot += d * tmpl.grayNorm[i];
    }

    const std = Math.sqrt(sqSum);
    if (std < 210) return -1;

    const ncc = dot / std;
    const colorMatch = Math.max(0, 1 - colorDiffSum / n);

    // Subtle perimeter edge energy along the 4 edges to snap corners onto painted/framed borders
    let edgeSum = 0;
    let edgeCount = 0;
    const edges: [QuadCorner, QuadCorner][] = [
      [quad.topLeft, quad.topRight],
      [quad.topRight, quad.bottomRight],
      [quad.bottomRight, quad.bottomLeft],
      [quad.bottomLeft, quad.topLeft],
    ];
    for (const [a, b] of edges) {
      for (let k = 1; k <= 5; k++) {
        const t = k / 6;
        const ex = Math.round(a.x + (b.x - a.x) * t);
        const ey = Math.round(a.y + (b.y - a.y) * t);
        if (ex >= 1 && ex < frameW - 1 && ey >= 1 && ey < frameH - 1) {
          edgeSum += edgeMag[ey * frameW + ex];
          edgeCount++;
        }
      }
    }
    const edgeBonus = edgeCount > 0 ? Math.min(1, edgeSum / (edgeCount * 110)) : 0;

    return ncc * 0.74 + colorMatch * 0.2 + edgeBonus * 0.06;
  }

  private evaluateRectCandidate(
    frameGray: Float32Array,
    pixels: Uint8ClampedArray,
    frameW: number,
    bx: number,
    by: number,
    bw: number,
    bh: number
  ): number {
    const tmpl = this.template!;
    const cols = tmpl.cols;
    const rows = tmpl.rows;
    const n = cols * rows;

    const samples = new Float32Array(n);
    let sum = 0;
    let colorDiffSum = 0;

    for (let r = 0; r < rows; r++) {
      const sy = Math.min(Math.floor(by + ((r + 0.5) / rows) * bh), Math.floor(by + bh - 1));
      const rowOff = sy * frameW;
      for (let c = 0; c < cols; c++) {
        const sx = Math.min(Math.floor(bx + ((c + 0.5) / cols) * bw), Math.floor(bx + bw - 1));
        const idx = rowOff + sx;
        const g = frameGray[idx];
        const i = r * cols + c;
        samples[i] = g;
        sum += g;

        const pIdx = idx * 4;
        const dr = Math.abs(pixels[pIdx] - tmpl.rMean[i]);
        const dg = Math.abs(pixels[pIdx + 1] - tmpl.gMean[i]);
        const db = Math.abs(pixels[pIdx + 2] - tmpl.bMean[i]);
        colorDiffSum += (dr + dg + db) / 765;
      }
    }

    const mean = sum / n;
    let sqSum = 0;
    let dot = 0;
    for (let i = 0; i < n; i++) {
      const d = samples[i] - mean;
      sqSum += d * d;
      dot += d * tmpl.grayNorm[i];
    }

    const std = Math.sqrt(sqSum);
    if (std < 210) return -1;

    const ncc = dot / std;
    const colorMatch = Math.max(0, 1 - colorDiffSum / n);
    return ncc * 0.78 + colorMatch * 0.22;
  }
}

function cloneQuad(q: FocalQuad): FocalQuad {
  return {
    topLeft: { ...q.topLeft },
    topRight: { ...q.topRight },
    bottomRight: { ...q.bottomRight },
    bottomLeft: { ...q.bottomLeft },
  };
}

function pctQuadToPx(q: FocalQuad, w: number, h: number): FocalQuad {
  return {
    topLeft: { x: (q.topLeft.x / 100) * w, y: (q.topLeft.y / 100) * h },
    topRight: { x: (q.topRight.x / 100) * w, y: (q.topRight.y / 100) * h },
    bottomRight: { x: (q.bottomRight.x / 100) * w, y: (q.bottomRight.y / 100) * h },
    bottomLeft: { x: (q.bottomLeft.x / 100) * w, y: (q.bottomLeft.y / 100) * h },
  };
}

function pxQuadToPct(q: FocalQuad, w: number, h: number): FocalQuad {
  return {
    topLeft: { x: (q.topLeft.x / w) * 100, y: (q.topLeft.y / h) * 100 },
    topRight: { x: (q.topRight.x / w) * 100, y: (q.topRight.y / h) * 100 },
    bottomRight: { x: (q.bottomRight.x / w) * 100, y: (q.bottomRight.y / h) * 100 },
    bottomLeft: { x: (q.bottomLeft.x / w) * 100, y: (q.bottomLeft.y / h) * 100 },
  };
}

function smoothQuadCorners(
  prev: FocalQuad,
  target: FocalQuad,
  alpha: number,
  deadbandPct: number
): FocalQuad {
  const lerpPt = (a: QuadCorner, b: QuadCorner): QuadCorner => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return {
      x: Math.abs(dx) < deadbandPct ? a.x : a.x + dx * alpha,
      y: Math.abs(dy) < deadbandPct ? a.y : a.y + dy * alpha,
    };
  };
  return {
    topLeft: lerpPt(prev.topLeft, target.topLeft),
    topRight: lerpPt(prev.topRight, target.topRight),
    bottomRight: lerpPt(prev.bottomRight, target.bottomRight),
    bottomLeft: lerpPt(prev.bottomLeft, target.bottomLeft),
  };
}

function dist(a: QuadCorner, b: QuadCorner): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function isValidTrackedQuad(
  q: FocalQuad,
  frameW: number,
  frameH: number,
  tmplAspect: number
): boolean {
  const pts = [q.topLeft, q.topRight, q.bottomRight, q.bottomLeft];
  for (const p of pts) {
    if (p.x < -frameW * 0.1 || p.x > frameW * 1.1 || p.y < -frameH * 0.1 || p.y > frameH * 1.1) {
      return false;
    }
  }
  if (!isConvexQuad(q)) return false;

  const topLen = dist(q.topLeft, q.topRight);
  const botLen = dist(q.bottomLeft, q.bottomRight);
  const leftLen = dist(q.topLeft, q.bottomLeft);
  const rightLen = dist(q.topRight, q.bottomRight);

  if (Math.min(topLen, botLen, leftLen, rightLen) < 18) return false;
  if (Math.max(topLen / botLen, botLen / topLen) > 1.85) return false;
  if (Math.max(leftLen / rightLen, rightLen / leftLen) > 1.85) return false;

  const avgW = (topLen + botLen) * 0.5;
  const avgH = (leftLen + rightLen) * 0.5;
  const aspect = avgW / Math.max(1, avgH);
  if (aspect < tmplAspect * 0.42 || aspect > tmplAspect * 2.15) return false;

  return true;
}

function translateQuad(q: FocalQuad, dx: number, dy: number): FocalQuad {
  return {
    topLeft: { x: q.topLeft.x + dx, y: q.topLeft.y + dy },
    topRight: { x: q.topRight.x + dx, y: q.topRight.y + dy },
    bottomRight: { x: q.bottomRight.x + dx, y: q.bottomRight.y + dy },
    bottomLeft: { x: q.bottomLeft.x + dx, y: q.bottomLeft.y + dy },
  };
}

function quadCenter(q: FocalQuad): QuadCorner {
  return {
    x: (q.topLeft.x + q.topRight.x + q.bottomRight.x + q.bottomLeft.x) * 0.25,
    y: (q.topLeft.y + q.topRight.y + q.bottomRight.y + q.bottomLeft.y) * 0.25,
  };
}

function scaleQuadAroundCenter(q: FocalQuad, sx: number, sy: number): FocalQuad {
  const c = quadCenter(q);
  const scalePt = (p: QuadCorner): QuadCorner => ({
    x: c.x + (p.x - c.x) * sx,
    y: c.y + (p.y - c.y) * sy,
  });
  return {
    topLeft: scalePt(q.topLeft),
    topRight: scalePt(q.topRight),
    bottomRight: scalePt(q.bottomRight),
    bottomLeft: scalePt(q.bottomLeft),
  };
}

function rotateQuadAroundCenter(q: FocalQuad, rad: number): FocalQuad {
  const c = quadCenter(q);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rotPt = (p: QuadCorner): QuadCorner => {
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    return {
      x: c.x + dx * cos - dy * sin,
      y: c.y + dx * sin + dy * cos,
    };
  };
  return {
    topLeft: rotPt(q.topLeft),
    topRight: rotPt(q.topRight),
    bottomRight: rotPt(q.bottomRight),
    bottomLeft: rotPt(q.bottomLeft),
  };
}

function taperQuadHorizontal(q: FocalQuad, deltaY: number): FocalQuad {
  return {
    topLeft: { x: q.topLeft.x, y: q.topLeft.y - deltaY },
    bottomLeft: { x: q.bottomLeft.x, y: q.bottomLeft.y + deltaY },
    topRight: { x: q.topRight.x, y: q.topRight.y + deltaY },
    bottomRight: { x: q.bottomRight.x, y: q.bottomRight.y - deltaY },
  };
}

function taperQuadVertical(q: FocalQuad, deltaX: number): FocalQuad {
  return {
    topLeft: { x: q.topLeft.x - deltaX, y: q.topLeft.y },
    topRight: { x: q.topRight.x + deltaX, y: q.topRight.y },
    bottomLeft: { x: q.bottomLeft.x + deltaX, y: q.bottomLeft.y },
    bottomRight: { x: q.bottomRight.x - deltaX, y: q.bottomRight.y },
  };
}

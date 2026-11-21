import { FocalBox, FocalQuad, QuadCorner } from '../types/portrait';
import {
  applySimilarityToQuad,
  boxToQuad,
  computeSquareToQuadHomography,
  detectPaintingQuadFromGray,
  fitSimilarityRANSAC,
  isPlausiblePerspectiveQuad,
  orderQuadCorners,
  Point2DPair,
  projectScreenToQuadUv,
  projectUvWithHomography,
  quadToBoundingBox,
} from './perspectiveWarp';

export interface AnchorTrackResult {
  detected: boolean;
  confidence: number;
  mode: 'washington' | 'custom';
  /** Axis-aligned bounding box in 0..100 percentages */
  box: FocalBox;
  /** Exact 4 perspective corners in 0..100 percentages */
  quad: FocalQuad;
}

interface FeatureAnchor {
  u: number;
  v: number;
  refPatchNorm: Float32Array;
}

const PATCH_RADIUS = 4; // 9x9 patch
const PATCH_SIDE = PATCH_RADIUS * 2 + 1;
const PATCH_LEN = PATCH_SIDE * PATCH_SIDE;

const THUMB_COLS = 16;
const THUMB_ROWS = 16;
const THUMB_LEN = THUMB_COLS * THUMB_ROWS;

export class WashingtonAnchorTracker {
  private workCanvas: HTMLCanvasElement;
  private workCtx: CanvasRenderingContext2D | null;

  private analysisW = 320;
  private analysisH = 240;
  private prevGray: Float32Array | null = null;
  private currGray: Float32Array | null = null;
  private blurBuf: Float32Array | null = null;

  private anchors: FeatureAnchor[] = [];
  private refThumbRaw: Float32Array | null = null;
  private refThumbValid: Uint8Array | null = null;
  private refThumbU: Float32Array;
  private refThumbV: Float32Array;
  private tmplAspect = 1;

  private locked = false;
  private mode: 'washington' | 'custom' = 'custom';
  private missCount = 0;
  private tickCount = 0;
  private smoothQuad: FocalQuad | null = null;

  constructor(_anchorUrl?: string) {
    this.workCanvas = document.createElement('canvas');
    this.workCtx = this.workCanvas.getContext('2d', { willReadFrequently: true });

    this.refThumbU = new Float32Array(THUMB_LEN);
    this.refThumbV = new Float32Array(THUMB_LEN);
    for (let r = 0; r < THUMB_ROWS; r++) {
      for (let c = 0; c < THUMB_COLS; c++) {
        const i = r * THUMB_COLS + c;
        this.refThumbU[i] = 0.06 + ((c + 0.5) / THUMB_COLS) * 0.88;
        this.refThumbV[i] = 0.06 + ((r + 0.5) / THUMB_ROWS) * 0.88;
      }
    }
  }

  public async ensureLoaded(): Promise<void> {
    return Promise.resolve();
  }

  public clearLock() {
    this.locked = false;
    this.missCount = 0;
    this.tickCount = 0;
    this.smoothQuad = null;
    this.anchors = [];
    this.refThumbRaw = null;
    this.refThumbValid = null;
    this.prevGray = null;
  }

  /**
   * Seeds the warp-proof 4-corner anchor tracker on the exact T0 scan canvas.
   * Uses blurred Sobel directional edge accumulation to snap the 4 straight borders
   * right onto the painting canvas edges, then extracts 25 high-contrast interior patches.
   */
  public seedFromFrameCanvas(
    frameCanvas: HTMLCanvasElement,
    rawQuadPct: FocalQuad,
    mode: 'washington' | 'custom'
  ): FocalQuad {
    const fw = Math.max(1, frameCanvas.width);
    const fh = Math.max(1, frameCanvas.height);

    this.analysisW = 320;
    this.analysisH = Math.max(120, Math.round((this.analysisW * fh) / fw));
    if (this.workCanvas.width !== this.analysisW || this.workCanvas.height !== this.analysisH) {
      this.workCanvas.width = this.analysisW;
      this.workCanvas.height = this.analysisH;
    }

    const orderedRaw = orderQuadCorners(rawQuadPct);
    if (!this.workCtx) {
      return orderedRaw;
    }

    this.workCtx.drawImage(frameCanvas, 0, 0, this.analysisW, this.analysisH);
    const pixels = this.workCtx.getImageData(0, 0, this.analysisW, this.analysisH).data;
    const nPix = this.analysisW * this.analysisH;
    const rawGray = new Float32Array(nPix);
    fillGrayFromRgba(pixels, rawGray, nPix);

    const refGray = new Float32Array(nPix);
    gaussianBlur3x3(rawGray, refGray, this.analysisW, this.analysisH);

    const rawQuadPx = pctQuadToPx(orderedRaw, this.analysisW, this.analysisH);
    const detectedQuadPx = detectPaintingQuadFromGray(
      refGray,
      this.analysisW,
      this.analysisH,
      rawQuadPx,
      {
        searchFraction: 0.12,
        maxSearchPx: 22,
        maxTiltDeg: 12,
        minEdgeScore: 13,
      }
    );

    const topLen = dist(detectedQuadPx.topLeft, detectedQuadPx.topRight);
    const botLen = dist(detectedQuadPx.bottomLeft, detectedQuadPx.bottomRight);
    const leftLen = dist(detectedQuadPx.topLeft, detectedQuadPx.bottomLeft);
    const rightLen = dist(detectedQuadPx.topRight, detectedQuadPx.bottomRight);
    this.tmplAspect = ((topLen + botLen) * 0.5) / Math.max(1, (leftLen + rightLen) * 0.5);

    this.anchors = this.extractGridAnchors(refGray, this.analysisW, this.analysisH, detectedQuadPx);
    const thumb = this.sampleThumbPixels(refGray, this.analysisW, this.analysisH, detectedQuadPx);
    this.refThumbRaw = thumb?.values ?? null;
    this.refThumbValid = thumb?.valid ?? null;

    this.prevGray = refGray;
    this.currGray = new Float32Array(nPix);
    this.blurBuf = new Float32Array(nPix);
    this.mode = mode;
    this.locked = true;
    this.missCount = 0;
    this.tickCount = 0;

    const detectedPct = pxQuadToPct(detectedQuadPx, this.analysisW, this.analysisH);
    this.smoothQuad = cloneQuad(detectedPct);
    return detectedPct;
  }

  /**
   * Warp-proof real-time 4-corner tracking:
   * 1) Forward-backward ZNCC feature matching inside the painting
   * 2) Rigid 4-DOF Similarity RANSAC (translation + scale + rotation) -> ZERO keystone explosion!
   * 3) Drift-free T0 reference micro-sync (4-DOF)
   * 4) Periodic gentle Sobel border micro-lock to follow gradual perspective tilt smoothly
   */
  public trackFrame(
    video: HTMLVideoElement,
    viewW: number,
    viewH: number,
    isCatchUp = false
  ): AnchorTrackResult | null {
    if (
      !this.locked ||
      !this.smoothQuad ||
      !this.prevGray ||
      !this.workCtx ||
      video.readyState < 2 ||
      viewW <= 0 ||
      viewH <= 0
    ) {
      return null;
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;

    if (this.workCanvas.width !== this.analysisW || this.workCanvas.height !== this.analysisH) {
      this.workCanvas.width = this.analysisW;
      this.workCanvas.height = this.analysisH;
    }

    const coverScale = Math.max(viewW / vw, viewH / vh);
    const srcW = viewW / coverScale;
    const srcH = viewH / coverScale;
    const srcX = (vw - srcW) / 2;
    const srcY = (vh - srcH) / 2;

    this.workCtx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, this.analysisW, this.analysisH);
    const pixels = this.workCtx.getImageData(0, 0, this.analysisW, this.analysisH).data;
    const nPix = this.analysisW * this.analysisH;
    if (!this.currGray || this.currGray.length !== nPix) {
      this.currGray = new Float32Array(nPix);
    }
    if (!this.blurBuf || this.blurBuf.length !== nPix) {
      this.blurBuf = new Float32Array(nPix);
    }
    fillGrayFromRgba(pixels, this.blurBuf, nPix);
    gaussianBlur3x3(this.blurBuf, this.currGray, this.analysisW, this.analysisH);

    // Quick frame-to-frame motion measurement
    let diffSum = 0;
    let diffCount = 0;
    for (let i = 0; i < nPix; i += 19) {
      diffSum += Math.abs(this.currGray[i] - this.prevGray[i]);
      diffCount++;
    }
    const frameDiff = diffCount > 0 ? diffSum / diffCount : 99;

    const prevQuadPx = pctQuadToPx(this.smoothQuad, this.analysisW, this.analysisH);
    const Hprev = computeSquareToQuadHomography(prevQuadPx);

    // Step 1: Forward-Backward ZNCC matching on 25 interior anchors
    const pairs: Point2DPair[] = [];
    const patchBuf = new Float32Array(PATCH_LEN);
    const backPatchBuf = new Float32Array(PATCH_LEN);
    const searchRadius = isCatchUp ? 26 : 15;
    const coarseStep = isCatchUp ? 4 : 2;

    for (const anchor of this.anchors) {
      const pred = projectUvWithHomography(Hprev, anchor.u, anchor.v, prevQuadPx);
      const px = Math.round(pred.x);
      const py = Math.round(pred.y);

      const hasPrevPatch = extractNormalizedPatch(
        this.prevGray,
        this.analysisW,
        this.analysisH,
        px,
        py,
        patchBuf
      );
      if (!hasPrevPatch) continue;

      const fwd = findBestPatchMatch(
        this.currGray,
        this.analysisW,
        this.analysisH,
        px,
        py,
        patchBuf,
        searchRadius,
        coarseStep
      );
      if (!fwd || fwd.score < 0.58) continue;

      // Forward-backward check kills outliers/glare/moiré instantly
      if (
        extractNormalizedPatch(this.currGray, this.analysisW, this.analysisH, fwd.x, fwd.y, backPatchBuf)
      ) {
        const bwd = findBestPatchMatch(
          this.prevGray,
          this.analysisW,
          this.analysisH,
          px,
          py,
          backPatchBuf,
          4,
          1
        );
        if (!bwd || Math.hypot(bwd.x - px, bwd.y - py) > 1.8) {
          continue;
        }
      }

      pairs.push({ x0: pred.x, y0: pred.y, x1: fwd.x, y1: fwd.y });
    }

    // Step 2: Fit rigid 4-DOF Similarity transform (cannot introduce wild warping!)
    let candQuadPx: FocalQuad = prevQuadPx;
    if (pairs.length >= 4) {
      const sim = fitSimilarityRANSAC(pairs, 2.0);
      if (sim && sim.inliers >= 4) {
        const moved = applySimilarityToQuad(prevQuadPx, sim);
        if (isValidTrackedQuad(moved, this.analysisW, this.analysisH, this.tmplAspect)) {
          candQuadPx = moved;
        }
      }
    }

    // Step 3: Drift-free T0 reference micro-sync (still rigid 4-DOF!)
    const Hcand = computeSquareToQuadHomography(candQuadPx);
    const refPairs: Point2DPair[] = [];
    for (const anchor of this.anchors) {
      const pred = projectUvWithHomography(Hcand, anchor.u, anchor.v, candQuadPx);
      const match = findBestPatchMatch(
        this.currGray,
        this.analysisW,
        this.analysisH,
        Math.round(pred.x),
        Math.round(pred.y),
        anchor.refPatchNorm,
        3,
        1
      );
      if (match && match.score >= 0.64) {
        refPairs.push({ x0: pred.x, y0: pred.y, x1: match.x, y1: match.y });
      }
    }
    if (refPairs.length >= 6) {
      const refSim = fitSimilarityRANSAC(refPairs, 1.8);
      if (refSim && refSim.inliers >= 6) {
        const synced = applySimilarityToQuad(candQuadPx, refSim);
        if (isValidTrackedQuad(synced, this.analysisW, this.analysisH, this.tmplAspect)) {
          candQuadPx = synced;
        }
      }
    }

    // Step 4: Periodic gentle Sobel border micro-refinement to adapt smoothly to viewing angle changes
    this.tickCount += 1;
    if (!isCatchUp && this.tickCount % 6 === 0 && frameDiff < 10) {
      const edgeRefined = detectPaintingQuadFromGray(
        this.currGray,
        this.analysisW,
        this.analysisH,
        candQuadPx,
        {
          searchFraction: 0.04,
          maxSearchPx: 5,
          maxTiltDeg: 4,
          minEdgeScore: 16,
        }
      );
      if (isValidTrackedQuad(edgeRefined, this.analysisW, this.analysisH, this.tmplAspect)) {
        candQuadPx = blendQuad(candQuadPx, edgeRefined, 0.2);
      }
    }

    // Step 5: Verify artwork presence inside candQuadPx
    let globalScore = this.evaluateGlobalThumb(
      this.currGray,
      this.analysisW,
      this.analysisH,
      candQuadPx
    );
    const prevScore = this.evaluateGlobalThumb(
      this.currGray,
      this.analysisW,
      this.analysisH,
      prevQuadPx
    );
    if (prevScore > globalScore + 0.04) {
      globalScore = prevScore;
      candQuadPx = prevQuadPx;
    }

    // Swap frame buffers cleanly
    const tmp = this.prevGray;
    this.prevGray = this.currGray;
    this.currGray = tmp;

    const holdThreshold = frameDiff < 3.5 ? 0.24 : 0.32;
    if (
      globalScore >= holdThreshold &&
      isValidTrackedQuad(candQuadPx, this.analysisW, this.analysisH, this.tmplAspect)
    ) {
      this.missCount = 0;
      const targetPct = pxQuadToPct(candQuadPx, this.analysisW, this.analysisH);
      this.smoothQuad = isCatchUp
        ? cloneQuad(targetPct)
        : smoothQuadVelocityAware(this.smoothQuad, targetPct);
      return {
        detected: true,
        confidence: Math.min(1, Math.max(0, globalScore)),
        mode: this.mode,
        box: quadToBoundingBox(this.smoothQuad),
        quad: this.smoothQuad,
      };
    }

    this.missCount += 1;
    if (this.missCount > 35) {
      const fallbackBox: FocalBox = { x: 24, y: 14, width: 52, height: 72 };
      this.clearLock();
      return {
        detected: false,
        confidence: Math.max(0, globalScore),
        mode: this.mode,
        box: fallbackBox,
        quad: boxToQuad(fallbackBox),
      };
    }

    return {
      detected: true,
      confidence: Math.max(0, globalScore),
      mode: this.mode,
      box: quadToBoundingBox(this.smoothQuad),
      quad: this.smoothQuad,
    };
  }

  private extractGridAnchors(
    gray: Float32Array,
    w: number,
    h: number,
    quadPx: FocalQuad
  ): FeatureAnchor[] {
    const H = computeSquareToQuadHomography(quadPx);
    const out: FeatureAnchor[] = [];
    const cells = 5;

    for (let cy = 0; cy < cells; cy++) {
      for (let cx = 0; cx < cells; cx++) {
        const uMin = 0.08 + (cx / cells) * 0.84;
        const uMax = 0.08 + ((cx + 1) / cells) * 0.84;
        const vMin = 0.08 + (cy / cells) * 0.84;
        const vMax = 0.08 + ((cy + 1) / cells) * 0.84;

        let bestX = 0;
        let bestY = 0;
        let bestEnergy = -1;

        for (let sv = 0; sv < 4; sv++) {
          const v = vMin + ((sv + 0.5) / 4) * (vMax - vMin);
          for (let su = 0; su < 4; su++) {
            const u = uMin + ((su + 0.5) / 4) * (uMax - uMin);
            const pt = projectUvWithHomography(H, u, v, quadPx);
            const ix = Math.round(pt.x);
            const iy = Math.round(pt.y);
            if (ix <= PATCH_RADIUS + 1 || ix >= w - PATCH_RADIUS - 2) continue;
            if (iy <= PATCH_RADIUS + 1 || iy >= h - PATCH_RADIUS - 2) continue;

            // Harris-like cornerness (min directional gradient energy) for strong 2D lock
            let ixx = 0;
            let iyy = 0;
            let ixy = 0;
            for (let dy = -2; dy <= 2; dy++) {
              const row = (iy + dy) * w + ix;
              for (let dx = -2; dx <= 2; dx++) {
                const idx = row + dx;
                const gx = gray[idx + 1] - gray[idx - 1];
                const gy = gray[idx + w] - gray[idx - w];
                ixx += gx * gx;
                iyy += gy * gy;
                ixy += gx * gy;
              }
            }
            const trace = ixx + iyy;
            const det = ixx * iyy - ixy * ixy;
            const cornerScore = det - 0.04 * trace * trace;
            if (cornerScore > bestEnergy) {
              bestEnergy = cornerScore;
              bestX = ix;
              bestY = iy;
            }
          }
        }

        if (bestEnergy > 0) {
          const patch = new Float32Array(PATCH_LEN);
          if (extractNormalizedPatch(gray, w, h, bestX, bestY, patch)) {
            const uv = projectScreenToQuadUv(quadPx, bestX, bestY);
            out.push({ u: uv.u, v: uv.v, refPatchNorm: patch });
          }
        }
      }
    }

    return out;
  }

  private sampleThumbPixels(
    gray: Float32Array,
    w: number,
    h: number,
    quadPx: FocalQuad
  ): { values: Float32Array; valid: Uint8Array; count: number } | null {
    const H = computeSquareToQuadHomography(quadPx);
    const values = new Float32Array(THUMB_LEN);
    const valid = new Uint8Array(THUMB_LEN);
    const maxX = w - 1.001;
    const maxY = h - 1.001;
    let count = 0;

    for (let i = 0; i < THUMB_LEN; i++) {
      const u = this.refThumbU[i];
      const v = this.refThumbV[i];
      const denom = H.g * u + H.h * v + 1;
      if (denom <= 0.05) continue;
      const px = (H.a * u + H.b * v + H.c) / denom;
      const py = (H.d * u + H.e * v + H.f) / denom;
      if (px < 0 || px >= maxX || py < 0 || py >= maxY) continue;

      const x0 = px | 0;
      const y0 = py | 0;
      const fx = px - x0;
      const fy = py - y0;
      const idx = y0 * w + x0;
      const g0 = gray[idx] + (gray[idx + 1] - gray[idx]) * fx;
      const g1 = gray[idx + w] + (gray[idx + w + 1] - gray[idx + w]) * fx;
      values[i] = g0 + (g1 - g0) * fy;
      valid[i] = 1;
      count++;
    }

    if (count < THUMB_LEN * 0.45) return null;
    return { values, valid, count };
  }

  private evaluateGlobalThumb(
    gray: Float32Array,
    w: number,
    h: number,
    quadPx: FocalQuad
  ): number {
    if (!this.refThumbRaw || !this.refThumbValid) return -1;
    const curr = this.sampleThumbPixels(gray, w, h, quadPx);
    if (!curr) return -1;

    let sumA = 0;
    let sumB = 0;
    let count = 0;
    for (let i = 0; i < THUMB_LEN; i++) {
      if (this.refThumbValid[i] && curr.valid[i]) {
        sumA += this.refThumbRaw[i];
        sumB += curr.values[i];
        count++;
      }
    }
    if (count < THUMB_LEN * 0.4) return -1;

    const meanA = sumA / count;
    const meanB = sumB / count;
    let sqA = 0;
    let sqB = 0;
    let dot = 0;
    for (let i = 0; i < THUMB_LEN; i++) {
      if (this.refThumbValid[i] && curr.valid[i]) {
        const da = this.refThumbRaw[i] - meanA;
        const db = curr.values[i] - meanB;
        sqA += da * da;
        sqB += db * db;
        dot += da * db;
      }
    }
    const denom = Math.sqrt(sqA * sqB);
    if (denom < 1e-3) return -1;
    return dot / denom;
  }
}

function fillGrayFromRgba(pixels: Uint8ClampedArray, out: Float32Array, len: number) {
  for (let i = 0; i < len; i++) {
    const idx = i * 4;
    out[i] = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
  }
}

function gaussianBlur3x3(src: Float32Array, dst: Float32Array, w: number, h: number) {
  for (let x = 0; x < w; x++) {
    dst[x] = src[x];
    dst[(h - 1) * w + x] = src[(h - 1) * w + x];
  }
  for (let y = 1; y < h - 1; y++) {
    const row = y * w;
    dst[row] = src[row];
    dst[row + w - 1] = src[row + w - 1];
    for (let x = 1; x < w - 1; x++) {
      const i = row + x;
      dst[i] =
        (src[i - w - 1] +
          2 * src[i - w] +
          src[i - w + 1] +
          2 * src[i - 1] +
          4 * src[i] +
          2 * src[i + 1] +
          src[i + w - 1] +
          2 * src[i + w] +
          src[i + w + 1]) *
        0.0625;
    }
  }
}

function extractNormalizedPatch(
  gray: Float32Array,
  w: number,
  h: number,
  cx: number,
  cy: number,
  out: Float32Array
): boolean {
  if (cx < PATCH_RADIUS || cx >= w - PATCH_RADIUS || cy < PATCH_RADIUS || cy >= h - PATCH_RADIUS) {
    return false;
  }

  let k = 0;
  let sum = 0;
  for (let dy = -PATCH_RADIUS; dy <= PATCH_RADIUS; dy++) {
    const row = (cy + dy) * w + cx;
    for (let dx = -PATCH_RADIUS; dx <= PATCH_RADIUS; dx++) {
      const v = gray[row + dx];
      out[k++] = v;
      sum += v;
    }
  }

  const mean = sum / PATCH_LEN;
  let sq = 0;
  for (let i = 0; i < PATCH_LEN; i++) {
    const d = out[i] - mean;
    out[i] = d;
    sq += d * d;
  }

  const std = Math.sqrt(sq);
  if (std < 10) return false;
  for (let i = 0; i < PATCH_LEN; i++) {
    out[i] /= std;
  }
  return true;
}

function scorePatchAt(
  gray: Float32Array,
  w: number,
  cx: number,
  cy: number,
  tmplNorm: Float32Array
): number {
  let sum = 0;
  let sq = 0;
  let dot = 0;
  let k = 0;

  for (let dy = -PATCH_RADIUS; dy <= PATCH_RADIUS; dy++) {
    const row = (cy + dy) * w + cx;
    for (let dx = -PATCH_RADIUS; dx <= PATCH_RADIUS; dx++) {
      const v = gray[row + dx];
      sum += v;
      sq += v * v;
      dot += v * tmplNorm[k++];
    }
  }

  const varSum = sq - (sum * sum) / PATCH_LEN;
  if (varSum <= 14) return -1;
  return dot / Math.sqrt(varSum);
}

function findBestPatchMatch(
  gray: Float32Array,
  w: number,
  h: number,
  predX: number,
  predY: number,
  tmplNorm: Float32Array,
  searchRadius: number,
  coarseStep: number
): { x: number; y: number; score: number } | null {
  const minX = Math.max(PATCH_RADIUS, predX - searchRadius);
  const maxX = Math.min(w - PATCH_RADIUS - 1, predX + searchRadius);
  const minY = Math.max(PATCH_RADIUS, predY - searchRadius);
  const maxY = Math.min(h - PATCH_RADIUS - 1, predY + searchRadius);
  if (minX > maxX || minY > maxY) return null;

  let bestX = predX;
  let bestY = predY;
  let bestScore = -1;

  for (let y = minY; y <= maxY; y += coarseStep) {
    for (let x = minX; x <= maxX; x += coarseStep) {
      const s = scorePatchAt(gray, w, x, y, tmplNorm);
      if (s > bestScore) {
        bestScore = s;
        bestX = x;
        bestY = y;
      }
    }
  }

  if (coarseStep > 1) {
    const fx0 = Math.max(PATCH_RADIUS, bestX - coarseStep);
    const fx1 = Math.min(w - PATCH_RADIUS - 1, bestX + coarseStep);
    const fy0 = Math.max(PATCH_RADIUS, bestY - coarseStep);
    const fy1 = Math.min(h - PATCH_RADIUS - 1, bestY + coarseStep);
    for (let y = fy0; y <= fy1; y++) {
      for (let x = fx0; x <= fx1; x++) {
        const s = scorePatchAt(gray, w, x, y, tmplNorm);
        if (s > bestScore) {
          bestScore = s;
          bestX = x;
          bestY = y;
        }
      }
    }
  }

  return bestScore > -1 ? { x: bestX, y: bestY, score: bestScore } : null;
}

function cloneQuad(q: FocalQuad): FocalQuad {
  return {
    topLeft: { ...q.topLeft },
    topRight: { ...q.topRight },
    bottomRight: { ...q.bottomRight },
    bottomLeft: { ...q.bottomLeft },
  };
}

function blendQuad(a: FocalQuad, b: FocalQuad, alpha: number): FocalQuad {
  const lerp = (p: QuadCorner, q: QuadCorner): QuadCorner => ({
    x: p.x + (q.x - p.x) * alpha,
    y: p.y + (q.y - p.y) * alpha,
  });
  return {
    topLeft: lerp(a.topLeft, b.topLeft),
    topRight: lerp(a.topRight, b.topRight),
    bottomRight: lerp(a.bottomRight, b.bottomRight),
    bottomLeft: lerp(a.bottomLeft, b.bottomLeft),
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

function smoothQuadVelocityAware(prev: FocalQuad, target: FocalQuad): FocalQuad {
  const keys: (keyof FocalQuad)[] = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];
  let maxMove = 0;
  for (const k of keys) {
    maxMove = Math.max(maxMove, Math.hypot(target[k].x - prev[k].x, target[k].y - prev[k].y));
  }

  // Crisp deadband eliminates micro-jitter when holding steady
  if (maxMove < 0.18) return prev;
  const alpha = maxMove > 1.8 ? 0.72 : maxMove > 0.6 ? 0.52 : 0.32;
  return blendQuad(prev, target, alpha);
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
    if (
      !Number.isFinite(p.x) ||
      !Number.isFinite(p.y) ||
      p.x < -frameW * 0.25 ||
      p.x > frameW * 1.25 ||
      p.y < -frameH * 0.25 ||
      p.y > frameH * 1.25
    ) {
      return false;
    }
  }
  if (!isPlausiblePerspectiveQuad(q, 1.4, 58, 122)) return false;

  const topLen = dist(q.topLeft, q.topRight);
  const botLen = dist(q.bottomLeft, q.bottomRight);
  const leftLen = dist(q.topLeft, q.bottomLeft);
  const rightLen = dist(q.topRight, q.bottomRight);
  if (Math.min(topLen, botLen, leftLen, rightLen) < 22) return false;

  const avgW = (topLen + botLen) * 0.5;
  const avgH = (leftLen + rightLen) * 0.5;
  const aspect = avgW / Math.max(1, avgH);
  if (aspect < tmplAspect * 0.65 || aspect > tmplAspect * 1.55) return false;

  return true;
}

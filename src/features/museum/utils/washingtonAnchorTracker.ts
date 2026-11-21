export interface AnchorTrackResult {
  detected: boolean;
  confidence: number;
  /** Percentages 0..100 relative to the visible viewfinder */
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface TemplateData {
  cols: number;
  rows: number;
  aspect: number;
  grayNorm: Float32Array;
  rMean: Float32Array;
  gMean: Float32Array;
  bMean: Float32Array;
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
  private smoothBox: { x: number; y: number; width: number; height: number } | null = null;

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

          let sum = 0;
          for (let i = 0; i < n; i++) {
            const r = data[i * 4];
            const g = data[i * 4 + 1];
            const b = data[i * 4 + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            gray[i] = lum;
            rArr[i] = r;
            gArr[i] = g;
            bArr[i] = b;
            sum += lum;
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
          };
        }
        resolve();
      };
      img.onerror = () => resolve();
      img.src = this.anchorUrl;
    });

    return this.loadingPromise;
  }

  public seedLock(box: { x: number; y: number; width: number; height: number }) {
    this.locked = true;
    this.missCount = 0;
    this.smoothBox = { ...box };
  }

  public clearLock() {
    this.locked = false;
    this.missCount = 0;
    this.smoothBox = null;
  }

  /**
   * Matches the uploaded Washington anchor painting inside the live camera <video>
   * frame using multi-scale normalized cross-correlation + regional contrast check.
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

    // Downsample visible object-cover viewport to ~144px wide for fast real-time matching
    const analysisW = 144;
    const analysisH = Math.max(80, Math.round((analysisW * viewH) / viewW));
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

    // Precompute grayscale buffer of the analysis frame
    const frameGray = new Float32Array(analysisW * analysisH);
    for (let i = 0; i < frameGray.length; i++) {
      const idx = i * 4;
      frameGray[i] = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
    }

    const tmpl = this.template;
    let bestScore = -1;
    let bestBox = { x: 0, y: 0, w: 0, h: 0 };

    if (this.locked && this.smoothBox) {
      // Local refinement search around previous tracked anchor box
      const prevPx = {
        x: (this.smoothBox.x / 100) * analysisW,
        y: (this.smoothBox.y / 100) * analysisH,
        w: (this.smoothBox.width / 100) * analysisW,
        h: (this.smoothBox.height / 100) * analysisH,
      };

      const scaleFactors = [0.9, 0.96, 1.0, 1.04, 1.1];
      const padX = Math.max(6, prevPx.w * 0.18);
      const padY = Math.max(6, prevPx.h * 0.18);

      for (const sf of scaleFactors) {
        const candH = prevPx.h * sf;
        const candW = candH * tmpl.aspect;
        if (candW < 24 || candH < 32 || candW > analysisW || candH > analysisH) continue;

        const minX = Math.max(0, Math.floor(prevPx.x - padX));
        const maxX = Math.min(analysisW - candW, Math.ceil(prevPx.x + padX));
        const minY = Math.max(0, Math.floor(prevPx.y - padY));
        const maxY = Math.min(analysisH - candH, Math.ceil(prevPx.y + padY));

        for (let y = minY; y <= maxY; y += 2) {
          for (let x = minX; x <= maxX; x += 2) {
            const score = this.evaluateCandidate(frameGray, pixels, analysisW, x, y, candW, candH);
            if (score > bestScore) {
              bestScore = score;
              bestBox = { x, y, w: candW, h: candH };
            }
          }
        }
      }
    } else {
      // Global multi-scale scan across the camera viewport
      const heightFractions = [0.34, 0.46, 0.6, 0.74, 0.88];
      for (const frac of heightFractions) {
        const candH = analysisH * frac;
        const candW = candH * tmpl.aspect;
        if (candW >= analysisW - 2 || candH >= analysisH - 2) continue;

        const strideX = Math.max(4, Math.round(candW * 0.1));
        const strideY = Math.max(4, Math.round(candH * 0.1));

        for (let y = 0; y <= analysisH - candH; y += strideY) {
          for (let x = 0; x <= analysisW - candW; x += strideX) {
            const score = this.evaluateCandidate(frameGray, pixels, analysisW, x, y, candW, candH);
            if (score > bestScore) {
              bestScore = score;
              bestBox = { x, y, w: candW, h: candH };
            }
          }
        }
      }
    }

    const enterThreshold = 0.66;
    const holdThreshold = 0.52;

    if (!this.locked) {
      if (bestScore >= enterThreshold) {
        this.locked = true;
        this.missCount = 0;
        const pctBox = {
          x: (bestBox.x / analysisW) * 100,
          y: (bestBox.y / analysisH) * 100,
          width: (bestBox.w / analysisW) * 100,
          height: (bestBox.h / analysisH) * 100,
        };
        this.smoothBox = pctBox;
        return { detected: true, confidence: bestScore, box: pctBox };
      }
      return {
        detected: false,
        confidence: Math.max(0, bestScore),
        box: { x: 18, y: 12, width: 64, height: 76 },
      };
    }

    // Hysteresis while locked so transient motion blur doesn't drop anchor immediately
    if (bestScore >= holdThreshold && this.smoothBox) {
      this.missCount = 0;
      const target = {
        x: (bestBox.x / analysisW) * 100,
        y: (bestBox.y / analysisH) * 100,
        width: (bestBox.w / analysisW) * 100,
        height: (bestBox.h / analysisH) * 100,
      };
      // Exponential smoothing for jitter-free AR overlay
      const alpha = 0.38;
      this.smoothBox = {
        x: this.smoothBox.x + (target.x - this.smoothBox.x) * alpha,
        y: this.smoothBox.y + (target.y - this.smoothBox.y) * alpha,
        width: this.smoothBox.width + (target.width - this.smoothBox.width) * alpha,
        height: this.smoothBox.height + (target.height - this.smoothBox.height) * alpha,
      };
      return { detected: true, confidence: bestScore, box: this.smoothBox };
    }

    this.missCount += 1;
    if (this.missCount > 12) {
      this.locked = false;
      this.smoothBox = null;
      return {
        detected: false,
        confidence: Math.max(0, bestScore),
        box: { x: 18, y: 12, width: 64, height: 76 },
      };
    }

    return {
      detected: true,
      confidence: Math.max(0, bestScore),
      box: this.smoothBox || { x: 18, y: 12, width: 64, height: 76 },
    };
  }

  private evaluateCandidate(
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

        // Coarse chromatic consistency check (prevents inverted/flat shapes matching)
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

    // Require minimum internal contrast so blank walls don't divide by ~0
    const std = Math.sqrt(sqSum);
    if (std < 220) return -1;

    const ncc = dot / std;
    const colorMatch = Math.max(0, 1 - colorDiffSum / n);
    return ncc * 0.78 + colorMatch * 0.22;
  }
}

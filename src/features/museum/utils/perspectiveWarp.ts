import { FocalBox, FocalQuad, QuadCorner } from '../types/portrait';

export interface SquareToQuadHomography {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
  g: number;
  h: number;
  w0: number;
  w1: number;
  w2: number;
  w3: number;
  valid: boolean;
}

export function boxToQuad(box: FocalBox): FocalQuad {
  return {
    topLeft: { x: box.x, y: box.y },
    topRight: { x: box.x + box.width, y: box.y },
    bottomRight: { x: box.x + box.width, y: box.y + box.height },
    bottomLeft: { x: box.x, y: box.y + box.height },
  };
}

export function quadToBoundingBox(quad: FocalQuad): FocalBox {
  const xs = [quad.topLeft.x, quad.topRight.x, quad.bottomRight.x, quad.bottomLeft.x];
  const ys = [quad.topLeft.y, quad.topRight.y, quad.bottomRight.y, quad.bottomLeft.y];
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

export function isConvexQuad(quad: FocalQuad): boolean {
  const pts = [quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft];
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % 4];
    const c = pts[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-3) return false;
    const s = cross > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (sign !== s) return false;
  }
  return true;
}

/**
 * Closed-form planar projective homography mapping unit square (0,0)-(1,0)-(1,1)-(0,1)
 * onto quad (topLeft, topRight, bottomRight, bottomLeft).
 */
export function computeSquareToQuadHomography(quad: FocalQuad): SquareToQuadHomography {
  const x0 = quad.topLeft.x;
  const y0 = quad.topLeft.y;
  const x1 = quad.topRight.x;
  const y1 = quad.topRight.y;
  const x2 = quad.bottomRight.x;
  const y2 = quad.bottomRight.y;
  const x3 = quad.bottomLeft.x;
  const y3 = quad.bottomLeft.y;

  const dx1 = x1 - x2;
  const dy1 = y1 - y2;
  const dx2 = x3 - x2;
  const dy2 = y3 - y2;
  const sx = x0 - x1 + x2 - x3;
  const sy = y0 - y1 + y2 - y3;

  const det = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(det) < 1e-5) {
    return {
      a: x1 - x0,
      b: x3 - x0,
      c: x0,
      d: y1 - y0,
      e: y3 - y0,
      f: y0,
      g: 0,
      h: 0,
      w0: 1,
      w1: 1,
      w2: 1,
      w3: 1,
      valid: false,
    };
  }

  const g = (sx * dy2 - sy * dx2) / det;
  const h = (dx1 * sy - dy1 * sx) / det;
  const a = x1 - x0 + g * x1;
  const b = x3 - x0 + h * x3;
  const c = x0;
  const d = y1 - y0 + g * y1;
  const e = y3 - y0 + h * y3;
  const f = y0;

  const w0 = 1;
  const w1 = 1 + g;
  const w2 = 1 + g + h;
  const w3 = 1 + h;

  const valid = w0 > 0.05 && w1 > 0.05 && w2 > 0.05 && w3 > 0.05;

  return { a, b, c, d, e, f, g, h, w0, w1, w2, w3, valid };
}

export function projectUvWithHomography(
  H: SquareToQuadHomography,
  u: number,
  v: number,
  quad: FocalQuad
): QuadCorner {
  if (!H.valid) {
    const topX = quad.topLeft.x + (quad.topRight.x - quad.topLeft.x) * u;
    const topY = quad.topLeft.y + (quad.topRight.y - quad.topLeft.y) * u;
    const botX = quad.bottomLeft.x + (quad.bottomRight.x - quad.bottomLeft.x) * u;
    const botY = quad.bottomLeft.y + (quad.bottomRight.y - quad.bottomLeft.y) * u;
    return {
      x: topX + (botX - topX) * v,
      y: topY + (botY - topY) * v,
    };
  }
  const denom = H.g * u + H.h * v + 1;
  if (Math.abs(denom) < 1e-5) {
    return { x: quad.topLeft.x, y: quad.topLeft.y };
  }
  return {
    x: (H.a * u + H.b * v + H.c) / denom,
    y: (H.d * u + H.e * v + H.f) / denom,
  };
}

export function projectUvThroughQuad(quad: FocalQuad, u: number, v: number): QuadCorner {
  const H = computeSquareToQuadHomography(quad);
  return projectUvWithHomography(H, u, v, quad);
}

/**
 * Inverse projective mapping: converts a point (sx, sy) in screen/frame coordinates
 * back into normalized painting-local UV coordinates [0..1, 0..1].
 */
export function projectScreenToQuadUv(
  quad: FocalQuad,
  sx: number,
  sy: number
): { u: number; v: number } {
  const H = computeSquareToQuadHomography(quad);
  if (!H.valid) {
    const box = quadToBoundingBox(quad);
    return {
      u: Math.max(0.02, Math.min(0.98, (sx - box.x) / Math.max(1, box.width))),
      v: Math.max(0.02, Math.min(0.98, (sy - box.y) / Math.max(1, box.height))),
    };
  }

  // Inverse of 3x3 matrix [[a,b,c],[d,e,f],[g,h,1]] via adjugate
  const A = H.e * 1 - H.f * H.h;
  const B = H.c * H.h - H.b * 1;
  const C = H.b * H.f - H.c * H.e;
  const D = H.f * H.g - H.d * 1;
  const E = H.a * 1 - H.c * H.g;
  const F = H.c * H.d - H.a * H.f;
  const G = H.d * H.h - H.e * H.g;
  const I_b = H.b * H.g - H.a * H.h;
  const K = H.a * H.e - H.b * H.d;

  const uNum = A * sx + B * sy + C;
  const vNum = D * sx + E * sy + F;
  const wNum = G * sx + I_b * sy + K;

  if (Math.abs(wNum) < 1e-6) {
    return { u: 0.5, v: 0.5 };
  }

  return {
    u: Math.max(0.02, Math.min(0.98, uNum / wNum)),
    v: Math.max(0.02, Math.min(0.98, vNum / wNum)),
  };
}

/**
 * Extracts a perspective-rectified upright HTMLCanvasElement directly from a source canvas
 * (such as the exact T0 scan frame sent to Vision) given 4 corners in 0..100 percentages.
 */
export function extractRectifiedCanvasFromCanvas(
  visCanvas: HTMLCanvasElement,
  quadPct: FocalQuad
): HTMLCanvasElement | null {
  const visW = visCanvas.width;
  const visH = visCanvas.height;
  if (!visW || !visH) return null;
  const vctx = visCanvas.getContext('2d', { willReadFrequently: true });
  if (!vctx) return null;
  const srcImg = vctx.getImageData(0, 0, visW, visH).data;

  const quadVis: FocalQuad = {
    topLeft: { x: (quadPct.topLeft.x / 100) * visW, y: (quadPct.topLeft.y / 100) * visH },
    topRight: { x: (quadPct.topRight.x / 100) * visW, y: (quadPct.topRight.y / 100) * visH },
    bottomRight: {
      x: (quadPct.bottomRight.x / 100) * visW,
      y: (quadPct.bottomRight.y / 100) * visH,
    },
    bottomLeft: {
      x: (quadPct.bottomLeft.x / 100) * visW,
      y: (quadPct.bottomLeft.y / 100) * visH,
    },
  };

  const avgW =
    (Math.hypot(quadVis.topRight.x - quadVis.topLeft.x, quadVis.topRight.y - quadVis.topLeft.y) +
      Math.hypot(
        quadVis.bottomRight.x - quadVis.bottomLeft.x,
        quadVis.bottomRight.y - quadVis.bottomLeft.y
      )) *
    0.5;
  const avgH =
    (Math.hypot(quadVis.bottomLeft.x - quadVis.topLeft.x, quadVis.bottomLeft.y - quadVis.topLeft.y) +
      Math.hypot(
        quadVis.bottomRight.x - quadVis.topRight.x,
        quadVis.bottomRight.y - quadVis.topRight.y
      )) *
    0.5;

  const aspect = Math.max(0.45, Math.min(2.2, avgW / Math.max(1, avgH)));
  const outW = aspect >= 1 ? 480 : Math.max(220, Math.round(480 * aspect));
  const outH = aspect >= 1 ? Math.max(220, Math.round(480 / aspect)) : 480;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW;
  outCanvas.height = outH;
  const octx = outCanvas.getContext('2d');
  if (!octx) return null;

  const outData = octx.createImageData(outW, outH);
  const dst = outData.data;
  const H = computeSquareToQuadHomography(quadVis);
  const maxX = visW - 1.001;
  const maxY = visH - 1.001;

  for (let oy = 0; oy < outH; oy++) {
    const v = (oy + 0.5) / outH;
    for (let ox = 0; ox < outW; ox++) {
      const u = (ox + 0.5) / outW;
      const pt = projectUvWithHomography(H, u, v, quadVis);
      const sx = Math.max(0, Math.min(maxX, pt.x));
      const sy = Math.max(0, Math.min(maxY, pt.y));

      const x0 = sx | 0;
      const y0 = sy | 0;
      const fx = sx - x0;
      const fy = sy - y0;

      const i00 = (y0 * visW + x0) * 4;
      const i10 = i00 + 4;
      const i01 = i00 + visW * 4;
      const i11 = i01 + 4;

      const w00 = (1 - fx) * (1 - fy);
      const w10 = fx * (1 - fy);
      const w01 = (1 - fx) * fy;
      const w11 = fx * fy;

      const dIdx = (oy * outW + ox) * 4;
      dst[dIdx] = srcImg[i00] * w00 + srcImg[i10] * w10 + srcImg[i01] * w01 + srcImg[i11] * w11;
      dst[dIdx + 1] =
        srcImg[i00 + 1] * w00 + srcImg[i10 + 1] * w10 + srcImg[i01 + 1] * w01 + srcImg[i11 + 1] * w11;
      dst[dIdx + 2] =
        srcImg[i00 + 2] * w00 + srcImg[i10 + 2] * w10 + srcImg[i01 + 2] * w01 + srcImg[i11 + 2] * w11;
      dst[dIdx + 3] = 255;
    }
  }

  octx.putImageData(outData, 0, 0);
  return outCanvas;
}

/**
 * Extracts a perspective-rectified upright HTMLCanvasElement of a detected painting
 * from the visible object-cover viewport of a live <video> element.
 */
export function extractRectifiedCanvasFromVideo(
  video: HTMLVideoElement,
  viewW: number,
  viewH: number,
  quadPct: FocalQuad
): HTMLCanvasElement | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh || viewW <= 0 || viewH <= 0) return null;

  const visW = Math.min(720, Math.max(320, Math.round(viewW)));
  const visH = Math.max(200, Math.round((visW * viewH) / viewW));

  const visCanvas = document.createElement('canvas');
  visCanvas.width = visW;
  visCanvas.height = visH;
  const vctx = visCanvas.getContext('2d', { willReadFrequently: true });
  if (!vctx) return null;

  const coverScale = Math.max(viewW / vw, viewH / vh);
  const srcW = viewW / coverScale;
  const srcH = viewH / coverScale;
  const srcX = (vw - srcW) / 2;
  const srcY = (vh - srcH) / 2;

  vctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, visW, visH);
  return extractRectifiedCanvasFromCanvas(visCanvas, quadPct);
}

export interface UvPointCorrespondence {
  u: number;
  v: number;
  x: number;
  y: number;
}

/**
 * Solves an 8-DOF planar homography mapping painting UV (0..1)^2 -> pixel (x, y)
 * using Hartley-normalized Direct Linear Transform (least-squares normal equations).
 */
export function solveHomographyDLT(pairs: UvPointCorrespondence[]): FocalQuad | null {
  const n = pairs.length;
  if (n < 4) return null;

  let mx = 0;
  let my = 0;
  for (const p of pairs) {
    mx += p.x;
    my += p.y;
  }
  mx /= n;
  my /= n;

  let meanDist = 0;
  for (const p of pairs) {
    meanDist += Math.hypot(p.x - mx, p.y - my);
  }
  meanDist /= n;
  const scale = meanDist > 1e-3 ? meanDist / Math.SQRT2 : 1;

  // 8x8 symmetric normal matrix M = A^T A, rhs = A^T b
  const M = Array.from({ length: 8 }, () => new Float64Array(8));
  const rhs = new Float64Array(8);

  for (const p of pairs) {
    const u = p.u;
    const v = p.v;
    const x = (p.x - mx) / scale;
    const y = (p.y - my) / scale;

    const r1 = [u, v, 1, 0, 0, 0, -u * x, -v * x];
    const r2 = [0, 0, 0, u, v, 1, -u * y, -v * y];

    for (let i = 0; i < 8; i++) {
      rhs[i] += r1[i] * x + r2[i] * y;
      for (let j = i; j < 8; j++) {
        M[i][j] += r1[i] * r1[j] + r2[i] * r2[j];
      }
    }
  }

  for (let i = 0; i < 8; i++) {
    M[i][i] += 1e-6;
    for (let j = 0; j < i; j++) {
      M[i][j] = M[j][i];
    }
  }

  // Gaussian elimination with partial pivoting
  const aug = M.map((row, idx) => {
    const out = new Float64Array(9);
    out.set(row);
    out[8] = rhs[idx];
    return out;
  });

  for (let col = 0; col < 8; col++) {
    let pivotRow = col;
    let pivotAbs = Math.abs(aug[col][col]);
    for (let r = col + 1; r < 8; r++) {
      const val = Math.abs(aug[r][col]);
      if (val > pivotAbs) {
        pivotAbs = val;
        pivotRow = r;
      }
    }
    if (pivotAbs < 1e-10) return null;
    if (pivotRow !== col) {
      const tmp = aug[col];
      aug[col] = aug[pivotRow];
      aug[pivotRow] = tmp;
    }

    const diag = aug[col][col];
    for (let j = col; j < 9; j++) {
      aug[col][j] /= diag;
    }
    for (let r = 0; r < 8; r++) {
      if (r === col) continue;
      const factor = aug[r][col];
      if (Math.abs(factor) < 1e-12) continue;
      for (let j = col; j < 9; j++) {
        aug[r][j] -= factor * aug[col][j];
      }
    }
  }

  const aN = aug[0][8];
  const bN = aug[1][8];
  const cN = aug[2][8];
  const dN = aug[3][8];
  const eN = aug[4][8];
  const fN = aug[5][8];
  const g = aug[6][8];
  const h = aug[7][8];

  // Un-normalize H = T^-1 * H_norm
  const a = scale * aN + mx * g;
  const b = scale * bN + mx * h;
  const c = scale * cN + mx;
  const d = scale * dN + my * g;
  const e = scale * eN + my * h;
  const f = scale * fN + my;

  const evalCorner = (u: number, v: number): QuadCorner | null => {
    const denom = g * u + h * v + 1;
    if (denom <= 0.08 || !Number.isFinite(denom)) return null;
    const x = (a * u + b * v + c) / denom;
    const y = (d * u + e * v + f) / denom;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
  };

  const topLeft = evalCorner(0, 0);
  const topRight = evalCorner(1, 0);
  const bottomRight = evalCorner(1, 1);
  const bottomLeft = evalCorner(0, 1);
  if (!topLeft || !topRight || !bottomRight || !bottomLeft) return null;

  const quad = { topLeft, topRight, bottomRight, bottomLeft };
  return isConvexQuad(quad) ? quad : null;
}

/**
 * Fits a 4-corner perspective quad from interior UV->pixel correspondences with RANSAC
 * so partial occlusions or specular glare do not pull the painting corners off-target.
 */
export function fitQuadRANSAC(
  pairs: UvPointCorrespondence[],
  inlierThresholdPx = 2.6
): FocalQuad | null {
  if (pairs.length < 4) return null;
  if (pairs.length === 4) return solveHomographyDLT(pairs);

  let bestInliers: UvPointCorrespondence[] = [];
  let bestScore = -1;

  // Deterministic well-spread 4-point subsets + stride sampling
  const n = pairs.length;
  const trials = Math.min(28, n * 3);
  for (let t = 0; t < trials; t++) {
    const i0 = t % n;
    const i1 = (i0 + Math.max(1, Math.floor(n * 0.27))) % n;
    const i2 = (i0 + Math.max(2, Math.floor(n * 0.54))) % n;
    const i3 = (i0 + Math.max(3, Math.floor(n * 0.79)) + (t >> 2)) % n;
    if (new Set([i0, i1, i2, i3]).size < 4) continue;

    const sample = [pairs[i0], pairs[i1], pairs[i2], pairs[i3]];
    const candQuad = solveHomographyDLT(sample);
    if (!candQuad) continue;

    const H = computeSquareToQuadHomography(candQuad);
    if (!H.valid) continue;

    const inliers: UvPointCorrespondence[] = [];
    let score = 0;
    for (const p of pairs) {
      const proj = projectUvWithHomography(H, p.u, p.v, candQuad);
      const err = Math.hypot(proj.x - p.x, proj.y - p.y);
      if (err <= inlierThresholdPx) {
        inliers.push(p);
        score += 1 - (err / inlierThresholdPx) * 0.45;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestInliers = inliers;
    }
  }

  if (bestInliers.length >= 4) {
    return solveHomographyDLT(bestInliers);
  }
  return solveHomographyDLT(pairs);
}

/**
 * Orders 4 arbitrary corner points consistently into clockwise
 * (topLeft, topRight, bottomRight, bottomLeft) order so homographies never twist.
 */
export function orderQuadCorners(quad: FocalQuad): FocalQuad {
  const pts = [quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft];
  const cx = (pts[0].x + pts[1].x + pts[2].x + pts[3].x) * 0.25;
  const cy = (pts[0].y + pts[1].y + pts[2].y + pts[3].y) * 0.25;

  // Sort clockwise in screen coordinates (y increases downward -> atan2 increases clockwise)
  const sorted = [...pts].sort(
    (a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx)
  );

  // Rotate array so index 0 is topLeft (minimum x + y)
  let tlIdx = 0;
  let bestSum = Infinity;
  for (let i = 0; i < 4; i++) {
    const s = sorted[i].x + sorted[i].y;
    if (s < bestSum) {
      bestSum = s;
      tlIdx = i;
    }
  }

  return {
    topLeft: { ...sorted[tlIdx] },
    topRight: { ...sorted[(tlIdx + 1) % 4] },
    bottomRight: { ...sorted[(tlIdx + 2) % 4] },
    bottomLeft: { ...sorted[(tlIdx + 3) % 4] },
  };
}

/**
 * Checks whether a 4-corner quad is geometrically realistic for a painting viewed by a camera
 * (convex, corner angles near 90 deg within realistic foreshortening, opposite sides within ratio).
 */
export function isPlausiblePerspectiveQuad(
  quad: FocalQuad,
  maxSideRatio = 1.38,
  minAngleDeg = 60,
  maxAngleDeg = 120
): boolean {
  if (!isConvexQuad(quad)) return false;

  const pts = [quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft];
  const topLen = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
  const rightLen = Math.hypot(pts[2].x - pts[1].x, pts[2].y - pts[1].y);
  const botLen = Math.hypot(pts[3].x - pts[2].x, pts[3].y - pts[2].y);
  const leftLen = Math.hypot(pts[0].x - pts[3].x, pts[0].y - pts[3].y);

  if (Math.min(topLen, rightLen, botLen, leftLen) < 1e-3) return false;
  if (Math.max(topLen / botLen, botLen / topLen) > maxSideRatio) return false;
  if (Math.max(leftLen / rightLen, rightLen / leftLen) > maxSideRatio) return false;

  const minCos = Math.cos((maxAngleDeg * Math.PI) / 180);
  const maxCos = Math.cos((minAngleDeg * Math.PI) / 180);

  for (let i = 0; i < 4; i++) {
    const prev = pts[(i + 3) % 4];
    const curr = pts[i];
    const next = pts[(i + 1) % 4];
    const v1x = prev.x - curr.x;
    const v1y = prev.y - curr.y;
    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;
    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);
    if (len1 < 1e-3 || len2 < 1e-3) return false;
    const cosAngle = (v1x * v2x + v1y * v2y) / (len1 * len2);
    if (cosAngle < minCos || cosAngle > maxCos) return false;
  }

  return true;
}

export interface Point2DPair {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface SimilarityTransform {
  /** s * cos(theta) */
  a: number;
  /** s * sin(theta) */
  b: number;
  tx: number;
  ty: number;
  scale: number;
  inliers: number;
}

function solveSimilarityLeastSquares(pairs: Point2DPair[]): SimilarityTransform | null {
  const n = pairs.length;
  if (n < 2) return null;

  let mx0 = 0;
  let my0 = 0;
  let mx1 = 0;
  let my1 = 0;
  for (const p of pairs) {
    mx0 += p.x0;
    my0 += p.y0;
    mx1 += p.x1;
    my1 += p.y1;
  }
  mx0 /= n;
  my0 /= n;
  mx1 /= n;
  my1 /= n;

  let numA = 0;
  let numB = 0;
  let den = 0;
  for (const p of pairs) {
    const dx0 = p.x0 - mx0;
    const dy0 = p.y0 - my0;
    const dx1 = p.x1 - mx1;
    const dy1 = p.y1 - my1;
    numA += dx0 * dx1 + dy0 * dy1;
    numB += dx0 * dy1 - dy0 * dx1;
    den += dx0 * dx0 + dy0 * dy0;
  }

  if (den < 1e-4) return null;
  const a = numA / den;
  const b = numB / den;
  const scale = Math.hypot(a, b);
  if (!Number.isFinite(scale) || scale < 0.7 || scale > 1.45) return null;

  const tx = mx1 - (a * mx0 - b * my0);
  const ty = my1 - (b * mx0 + a * my0);
  if (!Number.isFinite(tx) || !Number.isFinite(ty)) return null;

  return { a, b, tx, ty, scale, inliers: n };
}

/**
 * Fits a rigid 4-DOF 2D Similarity Transform (translation + uniform scale + in-plane rotation)
 * with RANSAC consensus. Cannot explode into keystone distortion or corner warping.
 */
export function fitSimilarityRANSAC(
  pairs: Point2DPair[],
  inlierThresholdPx = 2.0
): SimilarityTransform | null {
  const n = pairs.length;
  if (n < 2) return null;

  let bestInliers: Point2DPair[] = [];
  let bestScore = -1;

  // Evaluate all well-separated 2-point hypotheses (fast since n <= 25)
  const step = n > 14 ? 2 : 1;
  for (let i = 0; i < n; i += step) {
    for (let j = i + 1; j < n; j++) {
      const p0 = pairs[i];
      const p1 = pairs[j];
      if (Math.hypot(p1.x0 - p0.x0, p1.y0 - p0.y0) < 12) continue;

      const cand = solveSimilarityLeastSquares([p0, p1]);
      if (!cand) continue;

      const inliers: Point2DPair[] = [];
      let score = 0;
      for (const p of pairs) {
        const px = cand.a * p.x0 - cand.b * p.y0 + cand.tx;
        const py = cand.b * p.x0 + cand.a * p.y0 + cand.ty;
        const err = Math.hypot(px - p.x1, py - p.y1);
        if (err <= inlierThresholdPx) {
          inliers.push(p);
          score += 1 - (err / inlierThresholdPx) * 0.4;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestInliers = inliers;
      }
    }
  }

  if (bestInliers.length >= 3) {
    return solveSimilarityLeastSquares(bestInliers);
  }
  return solveSimilarityLeastSquares(pairs);
}

export function applySimilarityToQuad(quad: FocalQuad, sim: SimilarityTransform): FocalQuad {
  const mapPt = (p: QuadCorner): QuadCorner => ({
    x: sim.a * p.x - sim.b * p.y + sim.tx,
    y: sim.b * p.x + sim.a * p.y + sim.ty,
  });
  return {
    topLeft: mapPt(quad.topLeft),
    topRight: mapPt(quad.topRight),
    bottomRight: mapPt(quad.bottomRight),
    bottomLeft: mapPt(quad.bottomLeft),
  };
}

export interface EdgeSnapOptions {
  /** Max perpendicular search distance as a fraction of edge length (default 0.11) */
  searchFraction?: number;
  /** Max perpendicular search distance in pixels (default 24) */
  maxSearchPx?: number;
  /** Max angle tilt around seed edge in degrees (default 12) */
  maxTiltDeg?: number;
  /** Minimum directional edge score to accept a detected border (default 14) */
  minEdgeScore?: number;
}

/**
 * Detects the exact 4 straight borders of a painting using blurred Sobel directional gradients
 * with sign-consistency Radon line accumulation, then intersects them to locate pixel-accurate
 * corners while enforcing strict perspective sanity bounds.
 */
export function detectPaintingQuadFromGray(
  gray: Float32Array,
  w: number,
  h: number,
  seedQuadPx: FocalQuad,
  options: EdgeSnapOptions = {}
): FocalQuad {
  const orderedSeed = orderQuadCorners(seedQuadPx);
  const {
    searchFraction = 0.11,
    maxSearchPx = 24,
    maxTiltDeg = 12,
    minEdgeScore = 14,
  } = options;

  // Compute Sobel (gx, gy) on blurred grayscale for noise-free straight edge detection
  const gxArr = new Float32Array(w * h);
  const gyArr = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    const row = y * w;
    for (let x = 1; x < w - 1; x++) {
      const i = row + x;
      const tl = gray[i - w - 1];
      const tc = gray[i - w];
      const tr = gray[i - w + 1];
      const ml = gray[i - 1];
      const mr = gray[i + 1];
      const bl = gray[i + w - 1];
      const bc = gray[i + w];
      const br = gray[i + w + 1];
      gxArr[i] = (tr + 2 * mr + br - (tl + 2 * ml + bl)) * 0.25;
      gyArr[i] = (bl + 2 * bc + br - (tl + 2 * tc + tr)) * 0.25;
    }
  }

  const cx =
    (orderedSeed.topLeft.x +
      orderedSeed.topRight.x +
      orderedSeed.bottomRight.x +
      orderedSeed.bottomLeft.x) *
    0.25;
  const cy =
    (orderedSeed.topLeft.y +
      orderedSeed.topRight.y +
      orderedSeed.bottomRight.y +
      orderedSeed.bottomLeft.y) *
    0.25;

  const findBestStraightBorder = (a: QuadCorner, b: QuadCorner): [QuadCorner, QuadCorner] => {
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const len = Math.hypot(ex, ey);
    if (len < 24) return [a, b];

    const tx0 = ex / len;
    const ty0 = ey / len;
    let nx0 = ty0;
    let ny0 = -tx0;
    const midX = (a.x + b.x) * 0.5;
    const midY = (a.y + b.y) * 0.5;
    if ((midX - cx) * nx0 + (midY - cy) * ny0 < 0) {
      nx0 = -nx0;
      ny0 = -ny0;
    }

    const searchPx = Math.max(4, Math.min(maxSearchPx, Math.round(len * searchFraction)));
    const angleStepDeg = maxTiltDeg <= 5 ? 1.5 : 2.0;
    const numSamples = 26;

    let bestScore = -1;
    let bestD = 0;
    let bestRad = 0;
    let bestRawStrength = 0;

    for (let deg = -maxTiltDeg; deg <= maxTiltDeg + 0.01; deg += angleStepDeg) {
      const rad = (deg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const tx = tx0 * cos - ty0 * sin;
      const ty = tx0 * sin + ty0 * cos;
      const nx = nx0 * cos - ny0 * sin;
      const ny = nx0 * sin + ny0 * cos;

      const anglePrior = 1 - (Math.abs(deg) / (maxTiltDeg + 4)) * 0.16;

      for (let d = -searchPx; d <= searchPx; d += 1) {
        const lineMidX = midX + nx0 * d;
        const lineMidY = midY + ny0 * d;

        let absSum = 0;
        let signedSum = 0;
        let validSamples = 0;

        for (let s = 0; s < numSamples; s++) {
          const offset = ((s + 0.5) / numSamples - 0.5) * len * 0.78;
          const sx = Math.round(lineMidX + tx * offset);
          const sy = Math.round(lineMidY + ty * offset);
          if (sx < 2 || sx >= w - 2 || sy < 2 || sy >= h - 2) continue;
          const idx = sy * w + sx;
          // Strictly gradient perpendicular to candidate painting edge
          const perp = gxArr[idx] * nx + gyArr[idx] * ny;
          absSum += Math.abs(perp);
          signedSum += perp;
          validSamples++;
        }

        if (validSamples < numSamples * 0.55) continue;

        const meanAbs = absSum / validSamples;
        const signConsistency = Math.abs(signedSum) / Math.max(1e-3, absSum);
        const distPrior = 1 - (Math.abs(d) / (searchPx + 2)) * 0.22;
        const rawStrength = meanAbs * (0.4 + 0.6 * signConsistency);
        const score = rawStrength * distPrior * anglePrior;

        if (score > bestScore) {
          bestScore = score;
          bestD = d;
          bestRad = rad;
          bestRawStrength = rawStrength;
        }
      }
    }

    if (bestRawStrength < minEdgeScore) {
      return [a, b];
    }

    const cos = Math.cos(bestRad);
    const sin = Math.sin(bestRad);
    const tx = tx0 * cos - ty0 * sin;
    const ty = tx0 * sin + ty0 * cos;
    const lineMidX = midX + nx0 * bestD;
    const lineMidY = midY + ny0 * bestD;
    const half = len * 0.5;

    return [
      { x: lineMidX - tx * half, y: lineMidY - ty * half },
      { x: lineMidX + tx * half, y: lineMidY + ty * half },
    ];
  };

  const top = findBestStraightBorder(orderedSeed.topLeft, orderedSeed.topRight);
  const right = findBestStraightBorder(orderedSeed.topRight, orderedSeed.bottomRight);
  const bottom = findBestStraightBorder(orderedSeed.bottomRight, orderedSeed.bottomLeft);
  const left = findBestStraightBorder(orderedSeed.bottomLeft, orderedSeed.topLeft);

  const intersect = (
    p1: QuadCorner,
    p2: QuadCorner,
    p3: QuadCorner,
    p4: QuadCorner,
    fallback: QuadCorner
  ): QuadCorner => {
    const den = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
    if (Math.abs(den) < 1e-3) return fallback;
    const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / den;
    const ix = p1.x + t * (p2.x - p1.x);
    const iy = p1.y + t * (p2.y - p1.y);
    const maxMove = Math.max(10, Math.min(w, h) * 0.14);
    if (
      !Number.isFinite(ix) ||
      !Number.isFinite(iy) ||
      Math.hypot(ix - fallback.x, iy - fallback.y) > maxMove
    ) {
      return fallback;
    }
    return { x: ix, y: iy };
  };

  const detected: FocalQuad = {
    topLeft: intersect(top[0], top[1], left[0], left[1], orderedSeed.topLeft),
    topRight: intersect(top[0], top[1], right[0], right[1], orderedSeed.topRight),
    bottomRight: intersect(right[0], right[1], bottom[0], bottom[1], orderedSeed.bottomRight),
    bottomLeft: intersect(bottom[0], bottom[1], left[0], left[1], orderedSeed.bottomLeft),
  };

  return isPlausiblePerspectiveQuad(detected, 1.36, 62, 118) ? detected : orderedSeed;
}

/**
 * Renders a 2D source canvas skewed into an arbitrary 4-corner perspective quad
 * using hardware WebGL1 projective interpolation (with a subdivided 2D triangle mesh fallback).
 */
export class PerspectiveCanvasRenderer {
  private glCanvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private texture: WebGLTexture | null = null;
  private posBuffer: WebGLBuffer | null = null;
  private uvBuffer: WebGLBuffer | null = null;
  private aPosLoc = -1;
  private aUvLoc = -1;
  private uTexLoc: WebGLUniformLocation | null = null;
  private glFailed = false;

  constructor() {
    this.glCanvas = document.createElement('canvas');
  }

  private ensureWebGL(w: number, h: number): boolean {
    if (this.glFailed) return false;
    if (this.glCanvas.width !== w || this.glCanvas.height !== h) {
      this.glCanvas.width = w;
      this.glCanvas.height = h;
    }

    if (this.gl && this.program && this.texture) {
      return true;
    }

    const gl =
      this.glCanvas.getContext('webgl', {
        alpha: true,
        premultipliedAlpha: false,
        antialias: true,
      }) ||
      (this.glCanvas.getContext('experimental-webgl', {
        alpha: true,
        premultipliedAlpha: false,
      }) as WebGLRenderingContext | null);

    if (!gl) {
      this.glFailed = true;
      return false;
    }

    const vsSrc = `
      attribute vec4 a_pos;
      attribute vec2 a_uv;
      varying vec2 v_uv;
      void main() {
        gl_Position = a_pos;
        v_uv = a_uv;
      }
    `;
    const fsSrc = `
      precision mediump float;
      uniform sampler2D u_tex;
      varying vec2 v_uv;
      void main() {
        gl_FragColor = texture2D(u_tex, v_uv);
      }
    `;

    const compileShader = (type: number, src: string) => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    };

    const vs = compileShader(gl.VERTEX_SHADER, vsSrc);
    const fs = compileShader(gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) {
      this.glFailed = true;
      return false;
    }

    const prog = gl.createProgram();
    if (!prog) {
      this.glFailed = true;
      return false;
    }
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      this.glFailed = true;
      return false;
    }

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    this.gl = gl;
    this.program = prog;
    this.texture = tex;
    this.posBuffer = gl.createBuffer();
    this.uvBuffer = gl.createBuffer();
    this.aPosLoc = gl.getAttribLocation(prog, 'a_pos');
    this.aUvLoc = gl.getAttribLocation(prog, 'a_uv');
    this.uTexLoc = gl.getUniformLocation(prog, 'u_tex');

    // Static UV buffer for 2 triangles forming unit square
    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        0, 0,
        1, 0,
        1, 1,
        0, 0,
        1, 1,
        0, 1,
      ]),
      gl.STATIC_DRAW
    );

    return true;
  }

  public draw(
    targetCtx: CanvasRenderingContext2D,
    sourceCanvas: HTMLCanvasElement,
    quadPx: FocalQuad,
    viewW: number,
    viewH: number,
    alpha = 1
  ) {
    const H = computeSquareToQuadHomography(quadPx);
    const glW = Math.max(2, Math.round(viewW));
    const glH = Math.max(2, Math.round(viewH));

    if (H.valid && this.ensureWebGL(glW, glH) && this.gl && this.program) {
      const gl = this.gl;
      const toClipX = (px: number) => (px / viewW) * 2 - 1;
      const toClipY = (py: number) => 1 - (py / viewH) * 2;

      const x0 = toClipX(quadPx.topLeft.x);
      const y0 = toClipY(quadPx.topLeft.y);
      const x1 = toClipX(quadPx.topRight.x);
      const y1 = toClipY(quadPx.topRight.y);
      const x2 = toClipX(quadPx.bottomRight.x);
      const y2 = toClipY(quadPx.bottomRight.y);
      const x3 = toClipX(quadPx.bottomLeft.x);
      const y3 = toClipY(quadPx.bottomLeft.y);

      const w0 = H.w0;
      const w1 = H.w1;
      const w2 = H.w2;
      const w3 = H.w3;

      gl.viewport(0, 0, glW, glH);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.disable(gl.BLEND);

      gl.useProgram(this.program);

      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
      gl.uniform1i(this.uTexLoc, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([
          x0 * w0, y0 * w0, 0, w0,
          x1 * w1, y1 * w1, 0, w1,
          x2 * w2, y2 * w2, 0, w2,
          x0 * w0, y0 * w0, 0, w0,
          x2 * w2, y2 * w2, 0, w2,
          x3 * w3, y3 * w3, 0, w3,
        ]),
        gl.DYNAMIC_DRAW
      );
      gl.enableVertexAttribArray(this.aPosLoc);
      gl.vertexAttribPointer(this.aPosLoc, 4, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
      gl.enableVertexAttribArray(this.aUvLoc);
      gl.vertexAttribPointer(this.aUvLoc, 2, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      targetCtx.save();
      targetCtx.globalAlpha = alpha;
      targetCtx.drawImage(this.glCanvas, 0, 0, viewW, viewH);
      targetCtx.restore();
      return;
    }

    // Fallback: Subdivided 10x14 projective triangle mesh on 2D canvas
    this.drawSubdividedFallback(targetCtx, sourceCanvas, quadPx, H, alpha);
  }

  private drawSubdividedFallback(
    ctx: CanvasRenderingContext2D,
    src: HTMLCanvasElement,
    quad: FocalQuad,
    H: SquareToQuadHomography,
    alpha: number
  ) {
    const cols = 10;
    const rows = 14;
    const sw = src.width;
    const sh = src.height;
    ctx.save();
    ctx.globalAlpha = alpha;

    for (let r = 0; r < rows; r++) {
      const v0 = r / rows;
      const v1 = (r + 1) / rows;
      for (let c = 0; c < cols; c++) {
        const u0 = c / cols;
        const u1 = (c + 1) / cols;

        const p00 = projectUvWithHomography(H, u0, v0, quad);
        const p10 = projectUvWithHomography(H, u1, v0, quad);
        const p11 = projectUvWithHomography(H, u1, v1, quad);
        const p01 = projectUvWithHomography(H, u0, v1, quad);

        drawTexturedTriangle(
          ctx,
          src,
          p00.x, p00.y,
          p10.x, p10.y,
          p11.x, p11.y,
          u0 * sw, v0 * sh,
          u1 * sw, v0 * sh,
          u1 * sw, v1 * sh
        );
        drawTexturedTriangle(
          ctx,
          src,
          p00.x, p00.y,
          p11.x, p11.y,
          p01.x, p01.y,
          u0 * sw, v0 * sh,
          u1 * sw, v1 * sh,
          u0 * sw, v1 * sh
        );
      }
    }

    ctx.restore();
  }
}

function drawTexturedTriangle(
  ctx: CanvasRenderingContext2D,
  img: HTMLCanvasElement,
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  u0: number, v0: number,
  u1: number, v1: number,
  u2: number, v2: number
) {
  const denom = (u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0);
  if (Math.abs(denom) < 1e-4) return;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.closePath();
  ctx.clip();

  const a = ((x1 - x0) * (v2 - v0) - (x2 - x0) * (v1 - v0)) / denom;
  const b = ((y1 - y0) * (v2 - v0) - (y2 - y0) * (v1 - v0)) / denom;
  const c = ((u1 - u0) * (x2 - x0) - (u2 - u0) * (x1 - x0)) / denom;
  const d = ((u1 - u0) * (y2 - y0) - (u2 - u0) * (y1 - y0)) / denom;
  const e = x0 - a * u0 - c * v0;
  const f = y0 - b * u0 - d * v0;

  ctx.transform(a, b, c, d, e, f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

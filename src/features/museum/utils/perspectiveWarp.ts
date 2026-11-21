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

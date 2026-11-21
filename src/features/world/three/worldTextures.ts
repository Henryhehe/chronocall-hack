import * as THREE from "three";

export function createStoneFloorTexture(
  baseHex: string,
  groutHex: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = groutHex;
  ctx.fillRect(0, 0, size, size);

  const cols = 4;
  const rows = 4;
  const cellW = size / cols;
  const cellH = size / rows;

  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 0 ? 0 : cellW * 0.5;
    for (let c = -1; c <= cols; c++) {
      const x = c * cellW + offset + 3;
      const y = r * cellH + 3;
      const w = cellW - 6;
      const h = cellH - 6;

      ctx.fillStyle = baseHex;
      ctx.fillRect(x, y, w, h);

      // Subtle stone grain speckles
      for (let i = 0; i < 36; i++) {
        const sx = x + Math.random() * w;
        const sy = y + Math.random() * h;
        ctx.fillStyle =
          i % 2 === 0 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)";
        ctx.fillRect(sx, sy, 4, 3);
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 14);
  tex.anisotropy = Math.min(8, maxAnisotropy);
  return tex;
}

export function createWoodPlankTexture(
  baseHex: string,
  grainHex: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = grainHex;
  ctx.lineWidth = 2;
  for (let y = 8; y < size; y += 16) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(size * 0.3, y + 3, size * 0.7, y - 3, size, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    4,
    size / 2,
    size / 2,
    size / 2
  );
  grad.addColorStop(0, "rgba(0,0,0,0.65)");
  grad.addColorStop(0.55, "rgba(0,0,0,0.28)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createAvatarFaceTexture(
  imageSrc: string | null,
  fallbackInitial = "U"
): Promise<THREE.CanvasTexture> {
  return new Promise((resolve) => {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    const drawFallback = () => {
      ctx.fillStyle = "#1E293B";
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = "#06B6D4";
      ctx.lineWidth = 8;
      ctx.strokeRect(10, 10, size - 20, size - 20);
      ctx.fillStyle = "#E2E8F0";
      ctx.font = "bold 104px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(fallbackInitial.slice(0, 1).toUpperCase(), size / 2, size / 2);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      resolve(tex);
    };

    if (!imageSrc) {
      drawFallback();
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const s = Math.min(img.naturalWidth, img.naturalHeight);
      const sx = (img.naturalWidth - s) / 2;
      const sy = (img.naturalHeight - s) / 2;
      ctx.fillStyle = "#0F172A";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
      ctx.strokeStyle = "rgba(6, 182, 212, 0.7)";
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, size - 8, size - 8);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      resolve(tex);
    };
    img.onerror = drawFallback;
    img.src = imageSrc;
  });
}

import { DetectionBox } from "../types/vision";

const BOX_PALETTE = [
  "#06B6D4", // Calibrated cyan
  "#10B981", // Emerald
  "#F59E0B", // Telemetry amber
  "#38BDF8", // Sky
  "#A78BFA", // Violet
  "#FB7185", // Rose
];

export function getColorForLabel(label: string, index: number): string {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = (hash * 31 + label.charCodeAt(i)) | 0;
  }
  const paletteIdx = Math.abs(hash + index) % BOX_PALETTE.length;
  return BOX_PALETTE[paletteIdx];
}

export interface ContainedRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function computeContainedRect(
  containerW: number,
  containerH: number,
  mediaW: number,
  mediaH: number
): ContainedRect {
  if (
    containerW <= 0 ||
    containerH <= 0 ||
    mediaW <= 0 ||
    mediaH <= 0
  ) {
    return { left: 0, top: 0, width: containerW, height: containerH };
  }

  const containerRatio = containerW / containerH;
  const mediaRatio = mediaW / mediaH;

  if (mediaRatio > containerRatio) {
    const width = containerW;
    const height = containerW / mediaRatio;
    return {
      left: 0,
      top: (containerH - height) / 2,
      width,
      height,
    };
  } else {
    const height = containerH;
    const width = containerH * mediaRatio;
    return {
      left: (containerW - width) / 2,
      top: 0,
      width,
      height,
    };
  }
}

export function captureMediaFrame(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  maxWidth = 960,
  quality = 0.82
): { base64: string; width: number; height: number } | null {
  const naturalW =
    source instanceof HTMLVideoElement
      ? source.videoWidth
      : source instanceof HTMLCanvasElement
        ? source.width
        : source.naturalWidth;
  const naturalH =
    source instanceof HTMLVideoElement
      ? source.videoHeight
      : source instanceof HTMLCanvasElement
        ? source.height
        : source.naturalHeight;

  if (!naturalW || !naturalH) return null;

  const scale = naturalW > maxWidth ? maxWidth / naturalW : 1;
  const targetW = Math.round(naturalW * scale);
  const targetH = Math.round(naturalH * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(source, 0, 0, targetW, targetH);
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, "");
  return { base64, width: naturalW, height: naturalH };
}

export interface SnapshotStyleOptions {
  filterCss?: string;
  overlayTint?: string | null;
}

export function downloadAnnotatedSnapshot(
  source: HTMLVideoElement | HTMLImageElement,
  boxes: DetectionBox[],
  options?: SnapshotStyleOptions
): boolean {
  const naturalW =
    source instanceof HTMLVideoElement
      ? source.videoWidth
      : source.naturalWidth;
  const naturalH =
    source instanceof HTMLVideoElement
      ? source.videoHeight
      : source.naturalHeight;

  if (!naturalW || !naturalH) return false;

  const canvas = document.createElement("canvas");
  canvas.width = naturalW;
  canvas.height = naturalH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;

  if (options?.filterCss && options.filterCss !== "none") {
    ctx.filter = options.filterCss;
  }
  ctx.drawImage(source, 0, 0, naturalW, naturalH);
  ctx.filter = "none";

  if (options?.overlayTint) {
    ctx.fillStyle = options.overlayTint;
    ctx.fillRect(0, 0, naturalW, naturalH);
  }

  for (const box of boxes) {
    const x = (box.xmin / 1000) * naturalW;
    const y = (box.ymin / 1000) * naturalH;
    const w = ((box.xmax - box.xmin) / 1000) * naturalW;
    const h = ((box.ymax - box.ymin) / 1000) * naturalH;

    ctx.strokeStyle = box.color;
    ctx.lineWidth = Math.max(2, Math.round(naturalW / 400));
    ctx.strokeRect(x, y, w, h);

    const fontSize = Math.max(13, Math.round(naturalW / 55));
    ctx.font = `600 ${fontSize}px "JetBrains Mono", monospace`;
    const labelText = `${box.label} ${Math.round(box.confidence * 100)}%`;
    const textMetrics = ctx.measureText(labelText);
    const padX = 8;
    const padY = 4;
    const tagW = textMetrics.width + padX * 2;
    const tagH = fontSize + padY * 2;
    const tagY = y - tagH >= 0 ? y - tagH : y;

    ctx.fillStyle = "rgba(7, 9, 14, 0.88)";
    ctx.fillRect(x, tagY, tagW, tagH);
    ctx.fillStyle = box.color;
    ctx.fillRect(x, tagY, 3, tagH);

    ctx.fillStyle = "#F8FAFC";
    ctx.textBaseline = "middle";
    ctx.fillText(labelText, x + padX, tagY + tagH / 2);
  }

  const link = document.createElement("a");
  link.download = `gemini-vision-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
  return true;
}

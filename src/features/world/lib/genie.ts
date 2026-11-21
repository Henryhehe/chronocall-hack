import { GoogleGenAI } from "@google/genai";

export type GenieMoveKey =
  | "key_w"
  | "key_a"
  | "key_s"
  | "key_d"
  | "arrow_up"
  | "arrow_down"
  | "arrow_left"
  | "arrow_right";

export interface GenieWorldController {
  sendKey: (action: "key_down" | "key_up", input: GenieMoveKey) => Promise<void>;
  steerWorld: (text: string) => Promise<void>;
  stop: () => Promise<void>;
}

/**
 * Captures a 16:9 JPEG with base64 length under 36,000 chars (~27 KB raw bytes)
 * so the complete world_setup JSON stays well below WebRTC DataChannel limits.
 */
export function captureGenieSeedFrame(
  source: HTMLVideoElement | HTMLImageElement
): { base64: string; dataUrl: string; approxBytes: number } | null {
  const naturalW =
    source instanceof HTMLVideoElement
      ? source.videoWidth
      : source.naturalWidth;
  const naturalH =
    source instanceof HTMLVideoElement
      ? source.videoHeight
      : source.naturalHeight;
  if (!naturalW || !naturalH) return null;

  const targetW = 480;
  const targetH = 270; // 16:9
  const targetRatio = 16 / 9;
  const sourceRatio = naturalW / naturalH;

  let sx = 0;
  let sy = 0;
  let sw = naturalW;
  let sh = naturalH;

  if (sourceRatio > targetRatio) {
    sw = Math.round(naturalH * targetRatio);
    sx = Math.round((naturalW - sw) / 2);
  } else {
    sh = Math.round(naturalW / targetRatio);
    sy = Math.round((naturalH - sh) / 2);
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, targetW, targetH);

  let quality = 0.72;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  let base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, "");

  while (base64.length > 36000 && quality > 0.25) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
    base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, "");
  }

  return {
    base64,
    dataUrl,
    approxBytes: Math.round(base64.length * 0.75),
  };
}

/**
 * Loads an image URL or data URL and compresses it to a 16:9 JPEG with
 * base64 length under 36,000 chars so world_setup stays safely below DataChannel limits.
 */
export function compressImageUrlForGenie(
  imageSrc: string
): Promise<{ base64: string; dataUrl: string; approxBytes: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const targetW = 480;
      const targetH = 270;
      const targetRatio = 16 / 9;
      const sourceRatio = img.naturalWidth / img.naturalHeight;

      let sx = 0;
      let sy = 0;
      let sw = img.naturalWidth;
      let sh = img.naturalHeight;

      if (sourceRatio > targetRatio) {
        sw = Math.round(img.naturalHeight * targetRatio);
        sx = Math.round((img.naturalWidth - sw) / 2);
      } else {
        sh = Math.round(img.naturalWidth / targetRatio);
        sy = Math.round((img.naturalHeight - sh) / 2);
      }

      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas 2D context unavailable."));
        return;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);

      let quality = 0.75;
      let dataUrl = canvas.toDataURL("image/jpeg", quality);
      let base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, "");

      while (base64.length > 36000 && quality > 0.25) {
        quality -= 0.08;
        dataUrl = canvas.toDataURL("image/jpeg", quality);
        base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, "");
      }

      resolve({
        base64,
        dataUrl,
        approxBytes: Math.round(base64.length * 0.75),
      });
    };
    img.onerror = () => {
      reject(new Error("Failed to decode generated character image."));
    };
    img.src = imageSrc;
  });
}

export async function startGenieWorld(params: {
  videoEl: HTMLVideoElement;
  audioEl?: HTMLAudioElement | null;
  interactionId: string;
  authToken: string;
  worldPrompt: string;
  referenceImageBase64?: string;
  onStatusChange?: (status: string) => void;
  onError: (message: string) => void;
  onEnded: () => void;
}): Promise<GenieWorldController> {
  const clientAi = new GoogleGenAI({
    apiKey: params.authToken,
    apiVersion: "v1beta",
    httpOptions: {
      baseUrl: `${window.location.origin}/api/genie/proxy`,
    },
  });

  // Always keep videoEl muted so browser autoplay policy never pauses WebRTC video
  params.videoEl.muted = true;
  params.videoEl.playsInline = true;

  const session = await clientAi.interactions.connect(params.interactionId, {
    transport: "webrtc",
  });
  session.transport.setVideoElement(params.videoEl);
  if (params.audioEl) {
    session.transport.setAudioElement(params.audioEl);
  }

  const pc = session.transport.peerConnection;
  const handleIceChange = () => {
    if (!pc) return;
    params.onStatusChange?.(`WebRTC ICE: ${pc.iceConnectionState}`);
    if (pc.iceConnectionState === "failed") {
      params.onError(
        "WebRTC media connection failed (ICE blocked or timed out on this network)."
      );
    }
  };
  if (pc) {
    pc.addEventListener("iceconnectionstatechange", handleIceChange);
    params.onStatusChange?.(`WebRTC ICE: ${pc.iceConnectionState}`);
  }

  const ended = (async () => {
    try {
      for await (const event of session.receive()) {
        if (event.event_type === "error") {
          params.onError(event.error?.message ?? "Genie 4 session error.");
        } else if (event.event_type === "interaction.completed") {
          params.onEnded();
        }
      }
    } catch (err) {
      params.onError(err instanceof Error ? err.message : String(err));
    }
  })();

  await session.send({
    event_type: "world_setup",
    world_prompt: { text: params.worldPrompt },
    ...(params.referenceImageBase64
      ? {
          reference_image: {
            mime_type: "image/jpeg",
            data: params.referenceImageBase64,
          },
        }
      : {}),
  });

  // Ensure muted video playback starts promptly as tracks arrive
  void params.videoEl.play().catch(() => {
    // Will retry on loadeddata/canplay in GenieWorldView
  });

  const sendKey = async (
    action: "key_down" | "key_up",
    input: GenieMoveKey
  ) => {
    await session.send({ event_type: "user_action", action, input });
  };

  let cooldownUntil = 0;
  const steerWorld = async (text: string) => {
    if (Date.now() < cooldownUntil) return;
    cooldownUntil = Date.now() + 2000;
    for (let i = 0; i < 10; i++) {
      await session.send(text);
      await new Promise((r) => setTimeout(r, 150));
    }
  };

  const stop = async () => {
    if (pc) {
      pc.removeEventListener("iceconnectionstatechange", handleIceChange);
    }
    try {
      await session.complete();
      await ended;
    } catch {
      session.detach();
    }
  };

  return { sendKey, steerWorld, stop };
}

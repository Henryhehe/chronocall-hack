export const VISION_MODEL = "gemini-4-hydrogen";
export const PRO_VISION_MODEL = "gemini-4-neon";
export const IMAGE_GEN_MODEL = "gemini-3.1-flash-lite-image";
export const LIVE_MODEL = "gemini-3.8-live";
export const LIVE_THINKING_MODEL = "gemini-3.8-live-extended-thinking";
export const GENIE_MODEL = "models/genie-4";

export type AllowedVisionModel = typeof VISION_MODEL | typeof PRO_VISION_MODEL;

export function resolveVisionModel(requested?: unknown): AllowedVisionModel {
  return requested === PRO_VISION_MODEL ? PRO_VISION_MODEL : VISION_MODEL;
}

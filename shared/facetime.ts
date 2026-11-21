export type FaceTimeVoiceName = "Charon" | "Fenrir" | "Kore" | "Zephyr" | "Puck";

export type VideoEngineMode = "hybrid" | "genie" | "veo" | "portrait";

export type ActiveVideoLayer = "portrait" | "genie" | "veo";

export type FigureSourceType = "curated" | "search" | "scanned";

export type ArtworkKind =
  | "painting"
  | "statue"
  | "photograph"
  | "illustration"
  | "unknown";

export interface FaceAnchor {
  /** Normalized 0..1 face center X */
  cx: number;
  /** Normalized 0..1 face center Y */
  cy: number;
  /** Normalized 0..1 eye-line Y */
  eyeY: number;
  /** Normalized 0..1 mouth Y */
  mouthY: number;
}

export interface HistoricalProfile {
  id: string;
  name: string;
  title: string;
  era: string;
  location: string;
  bio: string;
  systemPersona: string;
  openingLine: string;
  voiceName: FaceTimeVoiceName;
  portraitPrompt: string;
  videoMotionPrompt: string;
  genieWorldPrompt: string;
  accentColor: string;
  gradientFrom: string;
  gradientTo: string;
  initials: string;
  starterQuestions: string[];
  sourceType: FigureSourceType;
  artworkTitle?: string;
  artist?: string;
  previewImageUrl?: string;
  scannedImageDataUrl?: string;
  faceAnchor?: FaceAnchor;
}

export interface FaceTimeIdentifyResult {
  detected: boolean;
  confidence: number;
  artworkType: ArtworkKind;
  artworkTitle: string;
  artist: string;
  year: string;
  reason?: string;
  profile: HistoricalProfile | null;
  demoMode?: boolean;
}

export interface FaceTimePortraitResult {
  imageDataUrl: string;
  mimeType: string;
  model: string;
  latencyMs: number;
  demoMode?: boolean;
}

export interface FaceTimeVideoJobStatus {
  jobId: string;
  status: "queued" | "running" | "ready" | "error";
  mode: "listening" | "speaking";
  videoUrl?: string;
  error?: string;
  model?: string;
}

export interface FaceTimeReactionCue {
  mood:
    | "warm"
    | "curious"
    | "amused"
    | "thoughtful"
    | "passionate"
    | "surprised";
  gesture: string;
  videoCue: string;
}

export type GeminiPipelineStage =
  | "vision"
  | "persona"
  | "portrait"
  | "live-voice"
  | "decisions"
  | "video-stream"
  | "video-loop";

export interface GeminiPipelineEvent {
  id: string;
  stage: GeminiPipelineStage;
  model: string;
  label: string;
  status: "running" | "active" | "done" | "standby" | "demo";
  latencyMs?: number;
  detail?: string;
  timestamp: number;
}

export type DecisionVerdict =
  | "verified"
  | "plausible_persona"
  | "anachronism";

export interface FaceTimeDecisionResult {
  verdict: DecisionVerdict;
  confidence: number;
  probabilities: Record<string, number>;
  eraFidelityScore: number;
  eraFidelityMax: number;
  suggestedCue: string;
  summary: string;
  model: string;
  latencyMs: number;
  demoMode?: boolean;
}

export function formatDecisionVerdictLabel(verdict: DecisionVerdict): string {
  switch (verdict) {
    case "verified":
      return "Historically Grounded";
    case "plausible_persona":
      return "In-Era Persona";
    case "anachronism":
      return "Anachronism Flagged";
  }
}

export function formatConfidencePercent(confidence: number): string {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(confidence) ? confidence : 0));
  return `${Math.round(clamped * 100)}%`;
}

export type FaceTimeClientMessage =
  | { type: "start"; profile: HistoricalProfile }
  | { type: "audio" | "video"; data: string }
  | { type: "text"; text: string };

export type FaceTimeServerEvent =
  | {
      type: "status";
      status: "connecting" | "connected" | "closed";
      model?: string;
    }
  | { type: "audio"; data: string }
  | {
      type: "inputTranscript" | "outputTranscript" | "modelText";
      text: string;
    }
  | { type: "interrupted" | "turnComplete" }
  | { type: "reaction"; cue: FaceTimeReactionCue }
  | { type: "error"; message: string };

const VALID_VOICES: ReadonlySet<FaceTimeVoiceName> = new Set([
  "Charon",
  "Fenrir",
  "Kore",
  "Zephyr",
  "Puck",
]);

const PALETTES: ReadonlyArray<{
  accent: string;
  from: string;
  to: string;
}> = [
  { accent: "#F59E0B", from: "#451A03", to: "#0F172A" },
  { accent: "#38BDF8", from: "#0C4A6E", to: "#0F172A" },
  { accent: "#A78BFA", from: "#3B0764", to: "#0F172A" },
  { accent: "#34D399", from: "#064E3B", to: "#0F172A" },
  { accent: "#FB7185", from: "#4C0519", to: "#0F172A" },
  { accent: "#FBBF24", from: "#422006", to: "#111827" },
];

export function normalizeVoiceName(value?: unknown): FaceTimeVoiceName {
  if (typeof value === "string" && VALID_VOICES.has(value as FaceTimeVoiceName)) {
    return value as FaceTimeVoiceName;
  }
  return "Charon";
}

export function computeInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "HF";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function pickPaletteForName(name: string): {
  accent: string;
  from: string;
  to: string;
} {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return PALETTES[Math.abs(hash) % PALETTES.length];
}

export function slugifyFigureId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "historical-figure";
}

export function normalizeHistoricalProfile(
  input: Partial<HistoricalProfile> & { name: string },
  sourceType: FigureSourceType = input.sourceType ?? "search"
): HistoricalProfile {
  const name = input.name.trim() || "Historical Figure";
  const era = input.era?.trim() || "Historical Era";
  const location = input.location?.trim() || "Historic Study";
  const title = input.title?.trim() || "Historical Figure";
  const palette = pickPaletteForName(name);

  return {
    id: input.id?.trim() || `${slugifyFigureId(name)}-${Date.now().toString(36)}`,
    name,
    title,
    era,
    location,
    bio:
      input.bio?.trim() ||
      `${name} (${era}) joins you live across time from ${location}.`,
    systemPersona:
      input.systemPersona?.trim() ||
      `You are ${name}, ${title} from ${era} in ${location}. Speak authentically in first person with vivid period perspective, warmth, curiosity about the modern caller's world, and natural conversational pacing.`,
    openingLine:
      input.openingLine?.trim() ||
      `Good day! Can you see and hear me clearly through this remarkable glass? Tell me—what year are you calling from?`,
    voiceName: normalizeVoiceName(input.voiceName),
    portraitPrompt:
      input.portraitPrompt?.trim() ||
      `Hyper-realistic natural webcam video call frame of ${name} (${era}) alive and present in ${location}, chest-up medium close-up centered at eye level looking warmly straight into the camera lens, authentic period attire, natural window or warm candlelight illumination, shallow depth of field, candid lifelike human skin texture, no text, no UI overlays, no watermarks.`,
    videoMotionPrompt:
      input.videoMotionPrompt?.trim() ||
      `Photorealistic continuous FaceTime video call shot of ${name} sitting in ${location}, looking directly into the webcam with warm natural eye contact, subtle natural breathing, occasional realistic blinking, gentle attentive head nods and expressive conversational micro-gestures, steady locked camera framing, natural period lighting.`,
    genieWorldPrompt:
      input.genieWorldPrompt?.trim() ||
      `Photorealistic front-facing video call view of ${name} in ${location} during ${era}, looking directly into the camera at eye level, warmly attentive, breathing and blinking naturally, gesturing gently during conversation, warm cinematic daylight through an arched window, stable tripod framing.`,
    accentColor: input.accentColor?.trim() || palette.accent,
    gradientFrom: input.gradientFrom?.trim() || palette.from,
    gradientTo: input.gradientTo?.trim() || palette.to,
    initials: input.initials?.trim() || computeInitials(name),
    starterQuestions:
      Array.isArray(input.starterQuestions) && input.starterQuestions.length > 0
        ? input.starterQuestions
            .map((q) => String(q).trim())
            .filter(Boolean)
            .slice(0, 4)
        : [
            `What is happening right now in ${location}?`,
            `What would surprise you most about my world today?`,
            `Look at what I am holding up to my camera—what do you make of it?`,
          ],
    sourceType,
    artworkTitle: input.artworkTitle?.trim() || undefined,
    artist: input.artist?.trim() || undefined,
    previewImageUrl: input.previewImageUrl || undefined,
    scannedImageDataUrl: input.scannedImageDataUrl || undefined,
    faceAnchor: input.faceAnchor ?? {
      cx: 0.5,
      cy: 0.36,
      eyeY: 0.32,
      mouthY: 0.44,
    },
  };
}

/**
 * Pure priority resolver for the hybrid full-motion video stage.
 * Ensures the UI always renders the highest-fidelity active layer with zero black screens.
 */
export function resolveActiveVideoLayer(params: {
  mode: VideoEngineMode;
  genieHasFrame: boolean;
  veoReady: boolean;
}): ActiveVideoLayer {
  const { mode, genieHasFrame, veoReady } = params;
  if (mode === "portrait") return "portrait";
  if (mode === "genie") return genieHasFrame ? "genie" : "portrait";
  if (mode === "veo") return veoReady ? "veo" : "portrait";
  // Hybrid: prefer crisp Veo full-motion loop once rendered, or live Genie 4 WebRTC as soon as frames arrive.
  if (veoReady) return "veo";
  if (genieHasFrame) return "genie";
  return "portrait";
}

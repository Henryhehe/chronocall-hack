import type {
  ActiveVideoLayer,
  FaceTimeIdentifyResult,
  FaceTimePortraitResult,
  FaceTimeReactionCue,
  FaceTimeVideoJobStatus,
  FaceTimeVoiceName,
  HistoricalProfile,
  VideoEngineMode,
} from "../../../shared/facetime.ts";

export type {
  ActiveVideoLayer,
  FaceTimeIdentifyResult,
  FaceTimePortraitResult,
  FaceTimeReactionCue,
  FaceTimeVideoJobStatus,
  FaceTimeVoiceName,
  HistoricalProfile,
  VideoEngineMode,
};

export type FaceTimePhase = "launcher" | "ringing" | "in-call";

export type PiPCorner = "top-right" | "top-left" | "bottom-right" | "bottom-left";

export interface CallTranscriptMessage {
  id: string;
  speaker: "user" | "figure" | "system";
  text: string;
  timestamp: number;
  streaming?: boolean;
}

export interface RuntimeHealth {
  ok: boolean;
  demoMode: boolean;
  apiKeyConfigured: boolean;
}

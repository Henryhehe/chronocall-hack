import { buildSelfieEraStamp } from "../../../shared/facetime.ts";
import type {
  ActiveVideoLayer,
  DecisionVerdict,
  FaceTimeDecisionResult,
  FaceTimeArtifactRequest,
  FaceTimeArtifactResult,
  FaceTimeCallerAnnotation,
  FaceTimeIdentifyResult,
  FaceTimePortalInvite,
  FaceTimePortraitResult,
  FaceTimeReactionCue,
  FaceTimeVideoJobStatus,
  FaceTimeVoiceName,
  GeminiPipelineEvent,
  GeminiPipelineStage,
  HistoricalProfile,
  VideoEngineMode,
  FaceTimeSelfieResult,
} from "../../../shared/facetime.ts";
import { normalizePortalPrompt } from "../../../shared/facetime.ts";

export { buildSelfieEraStamp };

export type {
  ActiveVideoLayer,
  DecisionVerdict,
  FaceTimeDecisionResult,
  FaceTimeArtifactRequest,
  FaceTimeArtifactResult,
  FaceTimeCallerAnnotation,
  FaceTimeIdentifyResult,
  FaceTimePortalInvite,
  FaceTimePortraitResult,
  FaceTimeReactionCue,
  FaceTimeSelfieResult,
  FaceTimeVideoJobStatus,
  FaceTimeVoiceName,
  GeminiPipelineEvent,
  GeminiPipelineStage,
  HistoricalProfile,
  VideoEngineMode,
};
export { normalizePortalPrompt };

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

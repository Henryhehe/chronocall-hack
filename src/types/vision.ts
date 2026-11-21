import type { AllowedVisionModel } from "../../shared/models.ts";

export type SourceMode = 'camera' | 'screen' | 'image';

export type WorkspaceView = 'live' | 'character' | 'genie' | 'log' | 'compare';

export type InspectorTab = 'detections' | 'transcript' | 'settings';

export type VisionModelId = AllowedVisionModel;

export type VisualFilterId =
  | 'none'
  | 'sepia'
  | 'high-contrast'
  | 'sketch'
  | 'noir'
  | 'night-vision';

export type HistoricalPersonaId =
  | 'none'
  | 'roman-senator'
  | 'renaissance-polymath'
  | 'victorian-inventor'
  | 'edo-samurai'
  | 'ancient-pharaoh';

export interface HistoricalPersona {
  id: HistoricalPersonaId;
  name: string;
  era: string;
  greeting: string;
  geniePrompt: string;
}

export interface DetectionBox {
  id: string;
  label: string;
  confidence: number;
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
  detail?: string;
  color: string;
}

export interface DetectionFrameResult {
  frameId: string;
  timestamp: number;
  latencyMs: number;
  model: string;
  summary: string;
  objects: DetectionBox[];
  source: 'detect' | 'live-tool';
}

export interface LiveTranscriptEntry {
  id: string;
  speaker: 'user' | 'gemini' | 'system';
  text: string;
  timestamp: number;
  isInterim?: boolean;
}

export interface FrameQaEntry {
  id: string;
  question: string;
  answer: string;
  latencyMs: number;
  timestamp: number;
  model?: string;
}

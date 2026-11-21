export type VoiceName = 'Charon' | 'Fenrir' | 'Kore' | 'Zephyr' | 'Puck';

export interface ARHotspot {
  id: string;
  label: string;
  eraDetail: string;
  /** Percentage from left (0-100) */
  x: number;
  /** Percentage from top (0-100) */
  y: number;
  prompt: string;
  animationCue: 'sword' | 'horse' | 'gaze' | 'uniform' | 'horizon';
}

export interface FocalBox {
  /** Percentage 0-100 */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface QuadCorner {
  /** Percentage 0-100 */
  x: number;
  y: number;
}

export interface FocalQuad {
  topLeft: QuadCorner;
  topRight: QuadCorner;
  bottomRight: QuadCorner;
  bottomLeft: QuadCorner;
}

export interface PortraitArtwork {
  id: string;
  accessionNumber: string;
  title: string;
  characterName: string;
  roleTitle: string;
  artist: string;
  year: string;
  medium: string;
  dimensions: string;
  galleryLocation: string;
  styleMovement?: string;
  hasHumanSubject: boolean;
  imageUrl: string;
  voiceName: VoiceName;
  historicalContext: string;
  systemPersona: string;
  openingLine: string;
  focalPoint: { x: number; y: number };
  focalBox?: FocalBox;
  focalQuad?: FocalQuad;
  hotspots: ARHotspot[];
  suggestedQuestions: string[];
}

export interface DialogueEntry {
  id: string;
  speaker: 'visitor' | 'character';
  text: string;
  timestamp: string;
  isStreaming?: boolean;
}

export type LensMode = 'portrait' | 'camera';

export type VoiceConnectionState =
  | 'idle'
  | 'connecting'
  | 'live'
  | 'thinking'
  | 'error';

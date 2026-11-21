export type LowPolyPrimitiveShape =
  | "box"
  | "cylinder"
  | "cone"
  | "sphere"
  | "torus"
  | "octahedron"
  | "dodecahedron";

export type LowPolyInteractionEffect =
  | "ignite"
  | "levitate"
  | "spin"
  | "pulse"
  | "bounce"
  | "portal"
  | "chime";

export interface LowPolyPartSpec {
  shape: LowPolyPrimitiveShape;
  color: string;
  emissive?: string;
  emissiveIntensity?: number;
  roughness: number;
  metalness: number;
  position: [number, number, number];
  rotation: [number, number, number];
  size: [number, number, number];
}

export interface LowPolyObjectBlueprint {
  id: string;
  name: string;
  kind: string;
  description: string;
  x: number;
  z: number;
  rotationY: number;
  scale: number;
  interactionEffect: LowPolyInteractionEffect;
  parts: LowPolyPartSpec[];
}

export interface LowPolyScenePalette {
  skyColor: string;
  fogColor: string;
  groundColor: string;
  groutColor: string;
  accentColor: string;
  sunColor: string;
  sunIntensity: number;
  hemiSky: string;
  hemiGround: string;
  rain: boolean;
}

export interface LowPolySceneBlueprint {
  sceneName: string;
  atmosphereDescription: string;
  palette: LowPolyScenePalette;
  objects: LowPolyObjectBlueprint[];
  latencyMs?: number;
  model?: string;
}

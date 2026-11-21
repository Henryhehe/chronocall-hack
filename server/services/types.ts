import type * as vision from "./gemini/vision.ts";
import type * as character from "./gemini/character.ts";
import type * as world from "./gemini/world.ts";
import type * as genie from "./gemini/genie.ts";
import type { AllowedVisionModel } from "../../shared/models.ts";
import type { LowPolyObjectBlueprint, LowPolySceneBlueprint } from "../../src/types/world3d.ts";

// Fixture responses share the wire shape, but must retain their honest model label.
type WorldResponseMetadata = { latencyMs: number; model: AllowedVisionModel | "demo" };

/** Route handlers depend on this boundary, not the SDK or demo fixtures. */
export interface AiServices {
  detectObjectsInFrame: typeof vision.detectObjectsInFrame;
  askAboutFrame: typeof vision.askAboutFrame;
  transformSelfieToCharacterWorld: typeof character.transformSelfieToCharacterWorld;
  interactWithWorldObject: typeof world.interactWithWorldObject;
  generateLowPolyScene: (...args: Parameters<typeof world.generateLowPolyScene>) => Promise<LowPolySceneBlueprint & WorldResponseMetadata>;
  spawnLowPolyObject: (...args: Parameters<typeof world.spawnLowPolyObject>) => Promise<{ object: LowPolyObjectBlueprint } & WorldResponseMetadata>;
  createGenieSession: typeof genie.createGenieSession;
}

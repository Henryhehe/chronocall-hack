import type * as vision from "./gemini/vision.ts";
import type * as character from "./gemini/character.ts";
import type * as world from "./gemini/world.ts";
import type * as genie from "./gemini/genie.ts";

/** Route handlers depend on this boundary, not the SDK or demo fixtures. */
export interface AiServices {
  detectObjectsInFrame: typeof vision.detectObjectsInFrame;
  askAboutFrame: typeof vision.askAboutFrame;
  transformSelfieToCharacterWorld: typeof character.transformSelfieToCharacterWorld;
  interactWithWorldObject: typeof world.interactWithWorldObject;
  generateLowPolyScene: typeof world.generateLowPolyScene;
  spawnLowPolyObject: typeof world.spawnLowPolyObject;
  createGenieSession: typeof genie.createGenieSession;
}

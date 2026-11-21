import { Type, type FunctionDeclaration } from "@google/genai";
import { PERSONA_INSTRUCTIONS } from "./personas.ts";

export const highlightObjectsTool: FunctionDeclaration = {
  name: "highlight_objects",
  description:
    "Draws bounding boxes on the user's live camera viewport to visually highlight objects being identified, counted, or discussed.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      summary: {
        type: Type.STRING,
        description: "Brief summary of the highlighted items.",
      },
      objects: {
        type: Type.ARRAY,
        description: "Detected objects with normalized 0-1000 coordinates.",
        items: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING },
            ymin: { type: Type.INTEGER },
            xmin: { type: Type.INTEGER },
            ymax: { type: Type.INTEGER },
            xmax: { type: Type.INTEGER },
            detail: { type: Type.STRING },
          },
          required: ["label", "ymin", "xmin", "ymax", "xmax"],
        },
      },
    },
    required: ["objects"],
  },
};

export const steerWorldTool: FunctionDeclaration = {
  name: "steer_world",
  description:
    "Triggers a visible environmental change, weather shift, lighting effect, or dynamic event inside the user's live Genie 4 interactive world simulation when the user asks for something to happen or change in the world.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      event: {
        type: Type.STRING,
        description:
          "Concise visual event prompt describing what happens in the world (e.g., 'Sudden rain falls on stone', 'Torches ignite along the walls', 'Golden sunlight breaks through the clouds').",
      },
    },
    required: ["event"],
  },
};

export function buildWorldVoiceInstruction(
  persona?: string,
  worldContext?: string
): string {
  const personaLine =
    persona && PERSONA_INSTRUCTIONS[persona]
      ? PERSONA_INSTRUCTIONS[persona]
      : "You are the living voice of the user's character and interactive world.";
  const contextLine = worldContext?.trim()
    ? `Current world setting: ${worldContext.trim().slice(0, 350)}.`
    : "";
  return `${personaLine} ${contextLine} You are conversing in real time with the user while seeing live frames of their character and interactive 3D/Genie 4 world. Speak concisely and naturally in character. Whenever the user asks you to change the environment, weather, lighting, or make something happen in the world, call steer_world with a vivid short event description and reply in character.`;
}

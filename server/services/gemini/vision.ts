import { Type, ThinkingLevel } from "@google/genai";
import { getGeminiClient } from "./client.ts";
import { resolveVisionModel } from "../../../shared/models.ts";
import { PERSONA_INSTRUCTIONS } from "./personas.ts";

export interface RawDetectedObject {
  label: string;
  confidence: number;
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
  detail?: string;
}

export interface FrameDetectionPayload {
  summary: string;
  objects: RawDetectedObject[];
  latencyMs: number;
  model: string;
}

const DETECTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description:
        "A concise one-sentence description of what is visible in the frame.",
    },
    objects: {
      type: Type.ARRAY,
      description:
        "List of clearly visible objects with normalized 0-1000 bounding boxes.",
      items: {
        type: Type.OBJECT,
        properties: {
          label: {
            type: Type.STRING,
            description: "Concise singular or plural object name.",
          },
          confidence: {
            type: Type.NUMBER,
            description: "Estimated confidence from 0.0 to 1.0.",
          },
          ymin: {
            type: Type.INTEGER,
            description: "Top edge normalized coordinate (0 to 1000).",
          },
          xmin: {
            type: Type.INTEGER,
            description: "Left edge normalized coordinate (0 to 1000).",
          },
          ymax: {
            type: Type.INTEGER,
            description: "Bottom edge normalized coordinate (0 to 1000).",
          },
          xmax: {
            type: Type.INTEGER,
            description: "Right edge normalized coordinate (0 to 1000).",
          },
          detail: {
            type: Type.STRING,
            description: "Short visual detail such as color, state, or action.",
          },
        },
        required: ["label", "confidence", "ymin", "xmin", "ymax", "xmax"],
      },
    },
  },
  required: ["summary", "objects"],
};

function clampCoord(val: unknown): number {
  const n = typeof val === "number" ? val : Number(val);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1000, Math.round(n)));
}

export async function detectObjectsInFrame(params: {
  imageBase64: string;
  mimeType: string;
  focusPrompt?: string;
  model?: unknown;
  characterPersona?: string;
}): Promise<FrameDetectionPayload> {
  const ai = getGeminiClient();
  const model = resolveVisionModel(params.model);
  const startedAt = Date.now();

  const personaLine =
    params.characterPersona && PERSONA_INSTRUCTIONS[params.characterPersona]
      ? PERSONA_INSTRUCTIONS[params.characterPersona]
      : null;

  const focusInstruction = personaLine
    ? `Always detect the user's "head" (tight box around their head/face) and "shoulders" (upper torso/shoulders box) if a person is visible, plus up to 6 prominent objects they are holding or near. Write the "summary" field in-character (${personaLine}) reacting in one witty historical sentence to the modern objects or pose you observe.`
    : params.focusPrompt?.trim()
      ? `Prioritize detecting and localizing objects matching this focus: "${params.focusPrompt.trim()}". Still note major foreground items if relevant.`
      : "Detect and localize the most prominent, clearly visible objects, people, hands, tools, screens, or items in the scene (up to 12 items).";

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: params.mimeType,
            data: params.imageBase64,
          },
        },
        {
          text: `${focusInstruction} Return tight, accurate bounding boxes in normalized 0-1000 coordinates [ymin, xmin, ymax, xmax].`,
        },
      ],
    },
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      systemInstruction:
        "You are a precision real-time visual object detector. Only report objects clearly visible in the image. Never hallucinate unseen items. Output strictly valid JSON matching the schema.",
      responseMimeType: "application/json",
      responseSchema: DETECTION_SCHEMA,
    },
  });

  const latencyMs = Date.now() - startedAt;
  const rawText = (response.text ?? "{}").trim();

  let parsed: { summary?: string; objects?: RawDetectedObject[] } = {};
  try {
    parsed = JSON.parse(rawText);
  } catch {
    const match = rawText.match(/\{[\s\S]*\}/);
    if (match) {
      parsed = JSON.parse(match[0]);
    }
  }

  const objects: RawDetectedObject[] = Array.isArray(parsed.objects)
    ? parsed.objects
        .map((obj) => {
          const ymin = clampCoord(obj.ymin);
          const xmin = clampCoord(obj.xmin);
          const ymax = clampCoord(obj.ymax);
          const xmax = clampCoord(obj.xmax);
          const conf =
            typeof obj.confidence === "number" && Number.isFinite(obj.confidence)
              ? Math.max(0, Math.min(1, obj.confidence))
              : 0.85;
          return {
            label: String(obj.label ?? "Object").trim() || "Object",
            confidence: conf,
            ymin: Math.min(ymin, ymax),
            xmin: Math.min(xmin, xmax),
            ymax: Math.max(ymin, ymax),
            xmax: Math.max(xmin, xmax),
            detail: obj.detail ? String(obj.detail).trim() : undefined,
          };
        })
        .filter((o) => o.ymax - o.ymin >= 8 && o.xmax - o.xmin >= 8)
    : [];

  return {
    summary:
      typeof parsed.summary === "string" && parsed.summary.trim()
        ? parsed.summary.trim()
        : objects.length > 0
          ? `Detected ${objects.length} object${objects.length === 1 ? "" : "s"}.`
          : "No distinct objects detected in frame.",
    objects,
    latencyMs,
    model,
  };
}

export async function askAboutFrame(params: {
  imageBase64: string;
  mimeType: string;
  question: string;
  model?: unknown;
  characterPersona?: string;
}): Promise<{ answer: string; latencyMs: number; model: string }> {
  const ai = getGeminiClient();
  const model = resolveVisionModel(params.model);
  const startedAt = Date.now();

  const personaLine =
    params.characterPersona && PERSONA_INSTRUCTIONS[params.characterPersona]
      ? PERSONA_INSTRUCTIONS[params.characterPersona]
      : null;

  const systemInstruction = personaLine
    ? `${personaLine} You are viewing the user through a magical mirror into the future. Answer their question concisely in-character based strictly on what is visible in the current camera frame.`
    : "You are a concise, observant real-time camera assistant. Answer directly based only on what is visible in the current camera frame.";

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: params.mimeType,
            data: params.imageBase64,
          },
        },
        {
          text: params.question,
        },
      ],
    },
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      systemInstruction,
    },
  });

  return {
    answer: (response.text ?? "No response generated.").trim(),
    latencyMs: Date.now() - startedAt,
    model,
  };
}

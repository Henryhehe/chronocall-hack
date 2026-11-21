import { Type, ThinkingLevel } from "@google/genai";
import { getGeminiClient } from "./client.ts";
import { VISION_MODEL, resolveVisionModel } from "../../../shared/models.ts";
import { PERSONA_INSTRUCTIONS } from "./personas.ts";

const WORLD_INTERACT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    reply: {
      type: Type.STRING,
      description:
        "Vivid, concise 1-2 sentence reaction describing what happens or what the character discovers when interacting with the object.",
    },
    worldEffect: {
      type: Type.STRING,
      description:
        "Optional effect cue: none | ignite | daylight | dusk | rain | shimmer",
    },
  },
  required: ["reply", "worldEffect"],
};

export async function interactWithWorldObject(params: {
  objectName: string;
  objectKind: string;
  objectState: string;
  personaId?: string;
  worldTheme?: string;
  userAction?: string;
}): Promise<{ reply: string; worldEffect: string; latencyMs: number }> {
  const ai = getGeminiClient();
  const startedAt = Date.now();
  const personaLine =
    params.personaId && PERSONA_INSTRUCTIONS[params.personaId]
      ? PERSONA_INSTRUCTIONS[params.personaId]
      : "You are the narrator and character spirit of this interactive 3D world.";

  const response = await ai.models.generateContent({
    model: VISION_MODEL,
    contents: `Object: "${params.objectName}" (${params.objectKind}). Current state: ${params.objectState}. ${
      params.worldTheme ? `World theme: ${params.worldTheme}.` : ""
    } ${
      params.userAction
        ? `Player command/question: "${params.userAction}".`
        : "The player just walked up and interacted with this object."
    }`,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      systemInstruction: `${personaLine} Respond in 1-2 short, atmospheric sentences about what this object reveals or does. Set worldEffect to one of: none, ignite, daylight, dusk, rain, shimmer.`,
      responseMimeType: "application/json",
      responseSchema: WORLD_INTERACT_SCHEMA,
    },
  });

  let parsed: { reply?: string; worldEffect?: string } = {};
  try {
    parsed = JSON.parse((response.text ?? "{}").trim());
  } catch {
    parsed = {};
  }

  return {
    reply:
      typeof parsed.reply === "string" && parsed.reply.trim()
        ? parsed.reply.trim()
        : `You inspect the ${params.objectName}, feeling its craftsmanship hum beneath your hand.`,
    worldEffect:
      typeof parsed.worldEffect === "string" ? parsed.worldEffect : "shimmer",
    latencyMs: Date.now() - startedAt,
  };
}

const LOW_POLY_PART_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    shape: {
      type: Type.STRING,
      description:
        "Primitive geometry: box | cylinder | cone | sphere | torus | octahedron | dodecahedron",
    },
    color: {
      type: Type.STRING,
      description: "Strict 6-digit hex color starting with #, e.g. #D97706 or #334155",
    },
    emissive: {
      type: Type.STRING,
      description: "Strict 6-digit hex glow color starting with #, e.g. #06B6D4 or #000000",
    },
    emissiveIntensity: {
      type: Type.NUMBER,
      description: "Glow intensity 0.0 to 2.5",
    },
    roughness: {
      type: Type.NUMBER,
      description: "Surface roughness 0.1 to 1.0",
    },
    metalness: {
      type: Type.NUMBER,
      description: "Metalness 0.0 to 1.0",
    },
    position: {
      type: Type.ARRAY,
      items: { type: Type.NUMBER },
      description: "[x, y, z] local offset inside the object, y=0 is floor",
    },
    rotation: {
      type: Type.ARRAY,
      items: { type: Type.NUMBER },
      description: "[rx, ry, rz] Euler radians",
    },
    size: {
      type: Type.ARRAY,
      items: { type: Type.NUMBER },
      description:
        "[width, height, depth] for box; [radius, height, bottomRadiusOrTube] for cylinder/cone/torus/sphere/octahedron",
    },
  },
  required: ["shape", "color", "roughness", "metalness", "position", "rotation", "size"],
};

const LOW_POLY_OBJECT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    name: { type: Type.STRING, description: "Short evocative prop name" },
    kind: {
      type: Type.STRING,
      description:
        "Category word like shrine, brazier, chest, statue, fountain, portal, lantern, bell, lectern, pillar, tree, table",
    },
    description: {
      type: Type.STRING,
      description: "One short sentence describing this prop.",
    },
    x: { type: Type.NUMBER, description: "World X between -16 and 16" },
    z: { type: Type.NUMBER, description: "World Z between -16 and 16" },
    rotationY: { type: Type.NUMBER, description: "Yaw radians" },
    scale: { type: Type.NUMBER, description: "Overall scale 0.7 to 1.7" },
    interactionEffect: {
      type: Type.STRING,
      description:
        "How this object animates when clicked/[E]: ignite | levitate | spin | pulse | bounce | portal | chime",
    },
    parts: {
      type: Type.ARRAY,
      description:
        "4 to 9 raw low-poly geometric primitives stacked and aligned to form a recognizable 3D object.",
      items: LOW_POLY_PART_SCHEMA,
    },
  },
  required: [
    "id",
    "name",
    "kind",
    "description",
    "x",
    "z",
    "rotationY",
    "scale",
    "interactionEffect",
    "parts",
  ],
};

const LOW_POLY_SCENE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    sceneName: { type: Type.STRING },
    atmosphereDescription: {
      type: Type.STRING,
      description:
        "Concise description of the scene suitable for rendering or streaming.",
    },
    palette: {
      type: Type.OBJECT,
      properties: {
        skyColor: { type: Type.STRING },
        fogColor: { type: Type.STRING },
        groundColor: { type: Type.STRING },
        groutColor: { type: Type.STRING },
        accentColor: { type: Type.STRING },
        sunColor: { type: Type.STRING },
        sunIntensity: { type: Type.NUMBER },
        hemiSky: { type: Type.STRING },
        hemiGround: { type: Type.STRING },
        rain: { type: Type.BOOLEAN },
      },
      required: [
        "skyColor",
        "fogColor",
        "groundColor",
        "groutColor",
        "accentColor",
        "sunColor",
        "sunIntensity",
        "hemiSky",
        "hemiGround",
        "rain",
      ],
    },
    objects: {
      type: Type.ARRAY,
      description: "6 interactive low-poly 3D objects placed around the plaza.",
      items: LOW_POLY_OBJECT_SCHEMA,
    },
  },
  required: ["sceneName", "atmosphereDescription", "palette", "objects"],
};

const VALID_SHAPES = new Set([
  "box",
  "cylinder",
  "cone",
  "sphere",
  "torus",
  "octahedron",
  "dodecahedron",
]);
const VALID_EFFECTS = new Set([
  "ignite",
  "levitate",
  "spin",
  "pulse",
  "bounce",
  "portal",
  "chime",
]);

function sanitizeHex(val: unknown, fallback: string): string {
  if (typeof val !== "string") return fallback;
  const s = val.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  }
  const bare = s.replace(/^(0x|#)/i, "");
  if (/^[0-9a-fA-F]{6}$/.test(bare)) return `#${bare}`;
  return fallback;
}

function clampNum(val: unknown, min: number, max: number, fallback: number): number {
  const n = typeof val === "number" ? val : Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function sanitizeVec3(
  val: unknown,
  min: number,
  max: number,
  fallback: [number, number, number]
): [number, number, number] {
  if (!Array.isArray(val) || val.length < 3) return fallback;
  return [
    clampNum(val[0], min, max, fallback[0]),
    clampNum(val[1], min, max, fallback[1]),
    clampNum(val[2], min, max, fallback[2]),
  ];
}

function sanitizeBlueprintObject(raw: any, idx: number) {
  const parts = Array.isArray(raw?.parts)
    ? raw.parts.slice(0, 10).map((p: any) => ({
        shape: VALID_SHAPES.has(p?.shape) ? p.shape : "box",
        color: sanitizeHex(p?.color, "#94A3B8"),
        emissive: p?.emissive ? sanitizeHex(p.emissive, "#000000") : "#000000",
        emissiveIntensity: clampNum(p?.emissiveIntensity, 0, 2.5, 0),
        roughness: clampNum(p?.roughness, 0.1, 1, 0.65),
        metalness: clampNum(p?.metalness, 0, 1, 0.15),
        position: sanitizeVec3(p?.position, -4, 4, [0, 0.5, 0]),
        rotation: sanitizeVec3(p?.rotation, -Math.PI * 2, Math.PI * 2, [0, 0, 0]),
        size: sanitizeVec3(p?.size, 0.08, 4.5, [0.8, 0.8, 0.8]),
      }))
    : [
        {
          shape: "box" as const,
          color: "#64748B",
          emissive: "#000000",
          emissiveIntensity: 0,
          roughness: 0.7,
          metalness: 0.1,
          position: [0, 0.5, 0] as [number, number, number],
          rotation: [0, 0, 0] as [number, number, number],
          size: [1, 1, 1] as [number, number, number],
        },
      ];

  // Ensure objects do not spawn directly on top of player spawn (0, 4.5)
  let x = clampNum(raw?.x, -16.5, 16.5, (idx - 4) * 3);
  let z = clampNum(raw?.z, -16.5, 16.5, -5);
  if (Math.hypot(x, z - 4.5) < 2.8) {
    z -= 4.2;
  }

  return {
    id:
      typeof raw?.id === "string" && raw.id.trim()
        ? `${raw.id.trim().slice(0, 32)}-${idx}`
        : `ai-obj-${Date.now()}-${idx}`,
    name:
      typeof raw?.name === "string" && raw.name.trim()
        ? raw.name.trim().slice(0, 40)
        : `Construct #${idx + 1}`,
    kind:
      typeof raw?.kind === "string" && raw.kind.trim()
        ? raw.kind.trim().toLowerCase().slice(0, 24)
        : "shrine",
    description:
      typeof raw?.description === "string" && raw.description.trim()
        ? raw.description.trim().slice(0, 140)
        : "Gemini-constructed interactive low-poly structure.",
    x,
    z,
    rotationY: clampNum(raw?.rotationY, -Math.PI * 2, Math.PI * 2, 0),
    scale: clampNum(raw?.scale, 0.7, 1.7, 1.0),
    interactionEffect: VALID_EFFECTS.has(raw?.interactionEffect)
      ? raw.interactionEffect
      : "pulse",
    parts,
  };
}

export async function generateLowPolyScene(params: {
  scenePrompt: string;
  personaId?: string;
  model?: unknown;
}) {
  const ai = getGeminiClient();
  const model = resolveVisionModel(params.model);
  const startedAt = Date.now();

  const personaContext =
    params.personaId && PERSONA_INSTRUCTIONS[params.personaId]
      ? PERSONA_INSTRUCTIONS[params.personaId]
      : "";

  const prompt = [
    `Design a cohesive, visually striking interactive low-poly 3D courtyard scene built from raw geometric primitives.`,
    personaContext ? `Persona context: ${personaContext}` : "",
    `Requested world/scene: "${params.scenePrompt.trim()}".`,
    `Place 6 diverse interactive objects in a circular plaza (x and z between -14 and 14, keeping a clear 3-unit radius around spawn point x=0, z=4.5).`,
    `Construct each object from 4 to 5 carefully aligned low-poly parts (pedestals, pillars, arches, lanterns, crystals, shrines, chests, machines) where y=0 is the floor level.`,
  ]
    .filter(Boolean)
    .join(" ");

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      systemInstruction:
        "You are a 3D low-poly world architect generating structured Three.js primitive assemblies. Output strictly valid JSON matching the schema with well-proportioned coordinates and harmonious colors.",
      responseMimeType: "application/json",
      responseSchema: LOW_POLY_SCENE_SCHEMA,
    },
  });

  const rawText = (response.text ?? "{}").trim();
  let parsed: any = {};
  try {
    parsed = JSON.parse(rawText);
  } catch {
    const m = rawText.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
  }

  const rawPalette = parsed?.palette ?? {};
  const rawObjects = Array.isArray(parsed?.objects) ? parsed.objects : [];

  return {
    sceneName:
      typeof parsed?.sceneName === "string" && parsed.sceneName.trim()
        ? parsed.sceneName.trim().slice(0, 60)
        : "Gemini 4 Low-Poly World",
    atmosphereDescription:
      typeof parsed?.atmosphereDescription === "string" &&
      parsed.atmosphereDescription.trim()
        ? parsed.atmosphereDescription.trim()
        : params.scenePrompt.trim(),
    palette: {
      skyColor: sanitizeHex(rawPalette.skyColor, "#141E30"),
      fogColor: sanitizeHex(rawPalette.fogColor, "#141E30"),
      groundColor: sanitizeHex(rawPalette.groundColor, "#5B6470"),
      groutColor: sanitizeHex(rawPalette.groutColor, "#28303D"),
      accentColor: sanitizeHex(rawPalette.accentColor, "#06B6D4"),
      sunColor: sanitizeHex(rawPalette.sunColor, "#FFE8C8"),
      sunIntensity: clampNum(rawPalette.sunIntensity, 0.8, 3.0, 2.1),
      hemiSky: sanitizeHex(rawPalette.hemiSky, "#93C5FD"),
      hemiGround: sanitizeHex(rawPalette.hemiGround, "#334155"),
      rain: Boolean(rawPalette.rain),
    },
    objects: rawObjects.slice(0, 12).map((obj: any, i: number) =>
      sanitizeBlueprintObject(obj, i)
    ),
    latencyMs: Date.now() - startedAt,
    model,
  };
}

export async function spawnLowPolyObject(params: {
  objectPrompt: string;
  x: number;
  z: number;
  worldTheme?: string;
  model?: unknown;
}) {
  const ai = getGeminiClient();
  const model = resolveVisionModel(params.model);
  const startedAt = Date.now();

  const response = await ai.models.generateContent({
    model,
    contents: `Construct a single interactive low-poly 3D object for "${params.objectPrompt.trim()}"${
      params.worldTheme ? ` fitting inside "${params.worldTheme}"` : ""
    }. Place it at x=${params.x.toFixed(1)}, z=${params.z.toFixed(1)}. Build it out of 5 to 9 cleanly stacked low-poly primitive parts (y=0 floor base).`,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      systemInstruction:
        "You are a 3D low-poly modeler constructing articulated primitive groups for Three.js. Output strictly valid JSON matching the schema.",
      responseMimeType: "application/json",
      responseSchema: LOW_POLY_OBJECT_SCHEMA,
    },
  });

  const rawText = (response.text ?? "{}").trim();
  let parsed: any = {};
  try {
    parsed = JSON.parse(rawText);
  } catch {
    const m = rawText.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
  }

  const sanitized = sanitizeBlueprintObject(
    { ...parsed, x: params.x, z: params.z },
    Math.floor(Math.random() * 1000)
  );

  return {
    object: sanitized,
    latencyMs: Date.now() - startedAt,
    model,
  };
}

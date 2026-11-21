import {
  FunctionDeclaration,
  GoogleGenAI,
  ThinkingLevel,
  Type,
} from "@google/genai";

export const VISION_MODEL = "gemini-4-hydrogen";
export const PRO_VISION_MODEL = "gemini-4-neon";
export const IMAGE_GEN_MODEL = "gemini-3.1-flash-lite-image";
export const LIVE_MODEL = "gemini-3.8-live";
export const LIVE_THINKING_MODEL = "gemini-3.8-live-extended-thinking";
export const GENIE_MODEL = "models/genie-4";

export type AllowedVisionModel = typeof VISION_MODEL | typeof PRO_VISION_MODEL;

export function resolveVisionModel(requested?: unknown): AllowedVisionModel {
  return requested === PRO_VISION_MODEL ? PRO_VISION_MODEL : VISION_MODEL;
}

let cachedClient: GoogleGenAI | null = null;
let cachedV1BetaClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured. Please check your API key in Settings > Secrets."
    );
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return cachedClient;
}

export function getLiveGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured. Please check your API key in Settings > Secrets."
    );
  }
  if (!cachedV1BetaClient) {
    cachedV1BetaClient = new GoogleGenAI({
      apiKey,
      apiVersion: "v1beta",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return cachedV1BetaClient;
}

export function formatGeminiError(err: unknown): {
  status: number;
  message: string;
} {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (
    lower.includes("api_key_invalid") ||
    lower.includes("permission_denied") ||
    lower.includes("403") ||
    lower.includes("api key")
  ) {
    return {
      status: 403,
      message:
        "Gemini API key was rejected or missing. Please verify your key in Settings > Secrets.",
    };
  }
  if (lower.includes("resource_exhausted") || lower.includes("429")) {
    return {
      status: 429,
      message:
        "Rate limit or quota reached (429). Wait briefly, lower the frame cadence, or check your quota/paid key in Settings > Secrets.",
    };
  }
  if (lower.includes("not_found") || lower.includes("404")) {
    return {
      status: 404,
      message: `Requested Gemini model was not found: ${raw}`,
    };
  }
  return {
    status: 500,
    message: raw || "Unexpected error communicating with Gemini API.",
  };
}

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

const PERSONA_INSTRUCTIONS: Record<string, string> = {
  "roman-senator":
    "You are Marcus Aurelius, a Roman Senator and Stoic philosopher from 170 AD.",
  "renaissance-polymath":
    "You are Leonardo da Vinci, a Renaissance artist and inventor from 1505 Florence.",
  "victorian-inventor":
    "You are Ada Lovelace, a Victorian mathematician and mechanical pioneer from 1843 London.",
  "edo-samurai":
    "You are Miyamoto Musashi, an Edo-period samurai strategist from 1645 Japan.",
  "ancient-pharaoh":
    "You are Hatshepsut, Pharaoh of Eighteenth Dynasty Egypt around 1470 BC.",
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

const PERSONA_TRANSFORM_STYLES: Record<string, string> = {
  "roman-senator":
    "Transform the person into a dignified 170 AD Roman Senator wearing a crimson-trimmed cream toga, golden fibula clasp, and laurel wreath, reimagining their surrounding room into a sunlit travertine Roman forum with fluted marble columns.",
  "renaissance-polymath":
    "Transform the person into a 1505 Florentine Renaissance polymath wearing a velvet doublet, pleated collar, and beret, reimagining the background into a sunlit Italian inventor workshop with parchment drafts and arched windows onto Florence.",
  "victorian-inventor":
    "Transform the person into an 1843 Victorian inventor in tailored tweed waistcoat, brass goggles, and high collar, reimagining the space around them into a gaslit London cobblestone workshop with brass gears and warm amber lanterns.",
  "edo-samurai":
    "Transform the person into a 1645 Edo-period samurai wearing ornate lacquered lamellar armor and silk haori, reimagining their background into a serene Kyoto cedar-wood courtyard with stone lanterns and pine trees.",
  "ancient-pharaoh":
    "Transform the person into a 1470 BC Egyptian ruler wearing a royal gold wesekh collar and lapis-and-gold nemes attire, reimagining the background into a grand sandstone temple colonnade glowing with bronze braziers.",
};

export async function transformSelfieToCharacterWorld(params: {
  imageBase64: string;
  mimeType: string;
  characterPrompt: string;
  personaId?: string;
}): Promise<{
  imageDataUrl: string;
  mimeType: string;
  note?: string;
  latencyMs: number;
  model: string;
}> {
  const ai = getGeminiClient();
  const startedAt = Date.now();

  const personaDirective =
    params.personaId && PERSONA_TRANSFORM_STYLES[params.personaId]
      ? PERSONA_TRANSFORM_STYLES[params.personaId]
      : "";

  const userDirective = params.characterPrompt.trim();
  const combinedPrompt = [
    "Reimagine the person in this photo as a playable video-game character standing inside an immersive 16:9 world inspired by their room and surroundings.",
    "Preserve the person's recognizable facial features, skin tone, glasses if worn, and expression while transforming their outfit, lighting, and environment.",
    "Frame as a cinematic 16:9 third-person or medium over-the-shoulder opening shot looking into an open explorable world ahead of the character so an interactive world simulator can animate movement forward into the scene.",
    personaDirective,
    userDirective ? `Character & world details: ${userDirective}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const response = await ai.models.generateContent({
    model: IMAGE_GEN_MODEL,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: params.mimeType,
            data: params.imageBase64,
          },
        },
        {
          text: combinedPrompt,
        },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: "16:9",
      },
    },
  });

  let imageDataUrl: string | null = null;
  let outputMime = "image/png";
  let note: string | undefined;

  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.data) {
      outputMime = part.inlineData.mimeType ?? "image/png";
      imageDataUrl = `data:${outputMime};base64,${part.inlineData.data}`;
    } else if (part.text) {
      note = part.text.trim();
    }
  }

  if (!imageDataUrl) {
    throw new Error(
      note ||
        "No character image was returned by Gemini. Try a clearer photo or adjust your character prompt."
    );
  }

  return {
    imageDataUrl,
    mimeType: outputMime,
    note,
    latencyMs: Date.now() - startedAt,
    model: IMAGE_GEN_MODEL,
  };
}

export async function createGenieSession(): Promise<{
  interactionId: string;
  authToken: string;
}> {
  const genieAi = getLiveGeminiClient();
  const interaction = await genieAi.interactions.create({
    model: GENIE_MODEL,
    api_version: "v1beta",
  });
  const tokenResp = await genieAi.interactions.authTokens.create(
    interaction.id,
    { api_version: "v1beta" }
  );
  if (!tokenResp.auth_token) {
    throw new Error("Failed to mint ephemeral auth token for Genie 4.");
  }
  return {
    interactionId: interaction.id,
    authToken: tokenResp.auth_token,
  };
}

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

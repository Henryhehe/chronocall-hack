import crypto from "node:crypto";
import { ThinkingLevel, Type, type GenerateVideosOperation } from "@google/genai";
import { getGeminiClient } from "./client.ts";
import { IMAGE_GEN_MODEL, VISION_MODEL } from "../../../shared/models.ts";
import {
  normalizeHistoricalProfile,
  type ArtworkKind,
  type FaceTimeArtifactResult,
  type FaceTimeIdentifyResult,
  type FaceTimePortraitResult,
  type FaceTimeVideoJobStatus,
  type HistoricalProfile,
} from "../../../shared/facetime.ts";

const DEFAULT_VEO_MODEL =
  process.env.VEO_MODEL?.trim() || "veo-3.1-fast-generate-preview";

interface StoredVeoJob {
  jobId: string;
  mode: "listening" | "speaking";
  model: string;
  operation: GenerateVideosOperation;
  status: "queued" | "running" | "ready" | "error";
  error?: string;
  videoBuffer?: Buffer;
  videoMimeType?: string;
  createdAt: number;
}

const MAX_JOBS = 24;
const JOB_TTL_MS = 20 * 60 * 1000;
const veoJobs = new Map<string, StoredVeoJob>();

function pruneVeoJobs() {
  const now = Date.now();
  for (const [id, job] of veoJobs) {
    if (now - job.createdAt > JOB_TTL_MS) {
      veoJobs.delete(id);
    }
  }
  while (veoJobs.size > MAX_JOBS) {
    const oldestKey = veoJobs.keys().next().value;
    if (!oldestKey) break;
    veoJobs.delete(oldestKey);
  }
}

function stripDataUrlPrefix(value: string): { base64: string; mimeType: string } {
  const match = value.match(/^data:([^;]+);base64,(.+)$/s);
  if (match) {
    return { mimeType: match[1], base64: match[2] };
  }
  return { mimeType: "image/jpeg", base64: value };
}

export async function resolveHistoricalFigure(params: {
  query: string;
}): Promise<HistoricalProfile> {
  const ai = getGeminiClient();
  const query = params.query.trim();

  const response = await ai.models.generateContent({
    model: VISION_MODEL,
    contents: `The user wants to start a realistic FaceTime video call with the historical figure: "${query}".
Generate a historically accurate, engaging first-person profile so the caller immediately feels like they dialed this person live across history.
Select the best-matching prebuilt voice from: Charon (deep, dignified masculine), Fenrir (bold, commanding masculine), Kore (warm, articulate feminine), Zephyr (clear, bright conversational), Puck (lively, witty expressive).
Write vivid, photorealistic webcam-call visual prompts (portraitPrompt, videoMotionPrompt, genieWorldPrompt) showing the person alive at eye level in their authentic historical environment.`,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          title: { type: Type.STRING },
          era: { type: Type.STRING },
          location: { type: Type.STRING },
          bio: { type: Type.STRING },
          systemPersona: { type: Type.STRING },
          openingLine: { type: Type.STRING },
          voiceName: { type: Type.STRING },
          portraitPrompt: { type: Type.STRING },
          videoMotionPrompt: { type: Type.STRING },
          genieWorldPrompt: { type: Type.STRING },
          starterQuestions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: [
          "name",
          "title",
          "era",
          "location",
          "bio",
          "systemPersona",
          "openingLine",
          "voiceName",
          "portraitPrompt",
          "videoMotionPrompt",
          "genieWorldPrompt",
          "starterQuestions",
        ],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? "{}").trim()) as Partial<HistoricalProfile>;
  return normalizeHistoricalProfile(
    {
      ...parsed,
      name: parsed.name || query,
    },
    "search"
  );
}

export async function identifyFigureFromImage(params: {
  imageBase64: string;
  mimeType: string;
}): Promise<FaceTimeIdentifyResult> {
  const ai = getGeminiClient();
  const clean = stripDataUrlPrefix(params.imageBase64);
  const mimeType = params.mimeType || clean.mimeType || "image/jpeg";

  const response = await ai.models.generateContent({
    model: VISION_MODEL,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType,
            data: clean.base64,
          },
        },
        {
          text: `Inspect this camera frame or photo from a user who wants to FaceTime a historical figure by pointing their camera at a painting, portrait, photograph, book illustration, or statue/bust.
Determine if a recognizable historical figure (or notable artwork depicting a historical figure) is visible.
If detected=true:
- Identify the historical figure (name, title, era, location, concise bio).
- Identify the artworkType ("painting" | "statue" | "photograph" | "illustration" | "unknown"), artworkTitle, artist (or probable school), and year.
- Craft an authentic first-person systemPersona, a warm FaceTime openingLine, the best prebuilt voiceName (one of: Charon, Fenrir, Kore, Zephyr, Puck), 3 starterQuestions, and vivid photorealistic webcam-call prompts (portraitPrompt, videoMotionPrompt, genieWorldPrompt) that bring the depicted person to life in flesh-and-blood photorealism matching the likeness and period clothing seen in the artwork.
If no historical figure, painting, portrait, or statue is clearly visible, set detected=false and explain briefly in reason.`,
        },
      ],
    },
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          detected: { type: Type.BOOLEAN },
          confidence: { type: Type.NUMBER },
          artworkType: { type: Type.STRING },
          artworkTitle: { type: Type.STRING },
          artist: { type: Type.STRING },
          year: { type: Type.STRING },
          reason: { type: Type.STRING },
          name: { type: Type.STRING },
          title: { type: Type.STRING },
          era: { type: Type.STRING },
          location: { type: Type.STRING },
          bio: { type: Type.STRING },
          systemPersona: { type: Type.STRING },
          openingLine: { type: Type.STRING },
          voiceName: { type: Type.STRING },
          portraitPrompt: { type: Type.STRING },
          videoMotionPrompt: { type: Type.STRING },
          genieWorldPrompt: { type: Type.STRING },
          starterQuestions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ["detected", "confidence", "artworkType"],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? "{}").trim()) as Record<string, unknown>;
  const detected = Boolean(parsed.detected && typeof parsed.name === "string" && parsed.name.trim());
  const validKinds: ArtworkKind[] = [
    "painting",
    "statue",
    "photograph",
    "illustration",
    "unknown",
  ];
  const artworkType: ArtworkKind = validKinds.includes(parsed.artworkType as ArtworkKind)
    ? (parsed.artworkType as ArtworkKind)
    : "unknown";

  if (!detected) {
    return {
      detected: false,
      confidence: Number(parsed.confidence ?? 0),
      artworkType,
      artworkTitle: String(parsed.artworkTitle ?? ""),
      artist: String(parsed.artist ?? ""),
      year: String(parsed.year ?? ""),
      reason:
        typeof parsed.reason === "string" && parsed.reason.trim()
          ? parsed.reason.trim()
          : "No historical painting, portrait, or statue was clearly recognized. Try framing the face closer with steady lighting.",
      profile: null,
    };
  }

  const profile = normalizeHistoricalProfile(
    {
      name: String(parsed.name),
      title: typeof parsed.title === "string" ? parsed.title : undefined,
      era: typeof parsed.era === "string" ? parsed.era : undefined,
      location: typeof parsed.location === "string" ? parsed.location : undefined,
      bio: typeof parsed.bio === "string" ? parsed.bio : undefined,
      systemPersona:
        typeof parsed.systemPersona === "string" ? parsed.systemPersona : undefined,
      openingLine:
        typeof parsed.openingLine === "string" ? parsed.openingLine : undefined,
      voiceName: typeof parsed.voiceName === "string" ? (parsed.voiceName as HistoricalProfile["voiceName"]) : undefined,
      portraitPrompt:
        typeof parsed.portraitPrompt === "string" ? parsed.portraitPrompt : undefined,
      videoMotionPrompt:
        typeof parsed.videoMotionPrompt === "string"
          ? parsed.videoMotionPrompt
          : undefined,
      genieWorldPrompt:
        typeof parsed.genieWorldPrompt === "string"
          ? parsed.genieWorldPrompt
          : undefined,
      starterQuestions: Array.isArray(parsed.starterQuestions)
        ? parsed.starterQuestions.map(String)
        : undefined,
      artworkTitle:
        typeof parsed.artworkTitle === "string" ? parsed.artworkTitle : undefined,
      artist: typeof parsed.artist === "string" ? parsed.artist : undefined,
    },
    "scanned"
  );

  return {
    detected: true,
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.85))),
    artworkType,
    artworkTitle: String(parsed.artworkTitle ?? `${profile.name} Portrait`),
    artist: String(parsed.artist ?? "Historical School"),
    year: String(parsed.year ?? profile.era),
    profile,
  };
}

export async function generateHistoricalPortrait(params: {
  profile: HistoricalProfile;
  referenceImageBase64?: string;
  referenceMimeType?: string;
}): Promise<FaceTimePortraitResult> {
  const ai = getGeminiClient();
  const startedAt = Date.now();
  const { profile } = params;

  const parts: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = [];

  if (params.referenceImageBase64) {
    const clean = stripDataUrlPrefix(params.referenceImageBase64);
    parts.push({
      inlineData: {
        mimeType: params.referenceMimeType || clean.mimeType || "image/jpeg",
        data: clean.base64,
      },
    });
    parts.push({
      text: [
        `Bring the historical figure depicted in this painting, sculpture, or photograph (${profile.name}, ${profile.era}) vividly to life as a real living human on a FaceTime video call.`,
        "Preserve the recognizable facial structure, hairstyle, age, and period attire cues from the reference artwork, transforming painted canvas or carved stone/bronze into natural lifelike human skin, expressive warm eyes, and real fabrics.",
        `Framing: 16:9 chest-up front-facing webcam video call perspective, centered with eyes in the upper-middle third looking directly and warmly into the lens, seated in ${profile.location}.`,
        profile.portraitPrompt,
        "No frames, no borders, no captions, no UI elements, photorealistic cinema camera quality.",
      ].join(" "),
    });
  } else {
    parts.push({
      text: [
        profile.portraitPrompt,
        `Subject: ${profile.name} (${profile.title}, ${profile.era}) in ${profile.location}.`,
        "Framing: 16:9 medium close-up front-facing FaceTime video call shot, head and shoulders centered cleanly with eyes in the upper-middle third making warm direct eye contact with the camera.",
        "Natural lifelike human photography, authentic period clothing, warm directional window or candle lighting, subtle depth-of-field background, zero text, zero UI overlays.",
      ].join(" "),
    });
  }

  const response = await ai.models.generateContent({
    model: IMAGE_GEN_MODEL,
    contents: { parts },
    config: {
      imageConfig: {
        aspectRatio: "16:9",
      },
    },
  });

  let imageDataUrl: string | null = null;
  let outputMime = "image/png";

  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.data) {
      outputMime = part.inlineData.mimeType ?? "image/png";
      imageDataUrl = `data:${outputMime};base64,${part.inlineData.data}`;
      break;
    }
  }

  if (!imageDataUrl) {
    throw new Error(
      `Gemini did not return a portrait frame for ${profile.name}.`
    );
  }

  return {
    imageDataUrl,
    mimeType: outputMime,
    model: IMAGE_GEN_MODEL,
    latencyMs: Date.now() - startedAt,
  };
}

export async function startVeoPortraitVideo(params: {
  profile: HistoricalProfile;
  portraitDataUrl: string;
  mode: "listening" | "speaking";
}): Promise<FaceTimeVideoJobStatus> {
  pruneVeoJobs();
  const ai = getGeminiClient();
  const { base64, mimeType } = stripDataUrlPrefix(params.portraitDataUrl);

  const motionDirective =
    params.mode === "speaking"
      ? `Continuous realistic FaceTime video call footage of ${params.profile.name} speaking warmly and expressively directly to the camera in ${params.profile.location}. Natural subtle lip movement, expressive eyebrows, gentle head nods, occasional natural hand gestures near the lower frame, realistic blinking and breathing, steady locked webcam tripod camera, natural period lighting, no cuts, no text.`
      : `Continuous realistic FaceTime video call footage of ${params.profile.name} listening attentively to the caller on camera in ${params.profile.location}. Warm direct eye contact, gentle natural breathing, occasional realistic blinking, subtle thoughtful head tilts and small appreciative smiles, steady locked webcam tripod camera, natural period lighting, no cuts, no text.`;

  const operation = await ai.models.generateVideos({
    model: DEFAULT_VEO_MODEL,
    prompt: `${motionDirective} ${params.profile.videoMotionPrompt}`.trim(),
    image: {
      imageBytes: base64,
      mimeType,
    },
    config: {
      aspectRatio: "16:9",
      durationSeconds: 6,
      numberOfVideos: 1,
      personGeneration: "allow_adult",
    },
  });

  const jobId = crypto.randomUUID();
  veoJobs.set(jobId, {
    jobId,
    mode: params.mode,
    model: DEFAULT_VEO_MODEL,
    operation,
    status: operation.done ? "ready" : "running",
    createdAt: Date.now(),
  });

  return {
    jobId,
    status: operation.done ? "ready" : "running",
    mode: params.mode,
    model: DEFAULT_VEO_MODEL,
    videoUrl: operation.done ? `/api/facetime/video/${jobId}/media` : undefined,
  };
}

async function resolveVideoBytes(job: StoredVeoJob): Promise<Buffer> {
  if (job.videoBuffer) return job.videoBuffer;

  const generated = job.operation.response?.generatedVideos?.[0]?.video;
  if (!generated) {
    throw new Error("Veo completed without returning a generated video.");
  }

  if (generated.videoBytes) {
    job.videoBuffer = Buffer.from(generated.videoBytes, "base64");
    job.videoMimeType = generated.mimeType || "video/mp4";
    return job.videoBuffer;
  }

  if (generated.uri) {
    const apiKey = process.env.GEMINI_API_KEY;
    const headers: Record<string, string> = {};
    if (apiKey) headers["x-goog-api-key"] = apiKey;

    const resp = await fetch(generated.uri, { headers });
    if (!resp.ok) {
      throw new Error(`Failed to fetch Veo media stream (HTTP ${resp.status}).`);
    }
    const arrayBuf = await resp.arrayBuffer();
    job.videoBuffer = Buffer.from(arrayBuf);
    job.videoMimeType =
      resp.headers.get("content-type") || generated.mimeType || "video/mp4";
    return job.videoBuffer;
  }

  throw new Error("Generated Veo video has neither inline bytes nor download URI.");
}

export async function pollVeoPortraitVideo(
  jobId: string
): Promise<FaceTimeVideoJobStatus | null> {
  pruneVeoJobs();
  const job = veoJobs.get(jobId);
  if (!job) return null;

  if (job.status === "ready") {
    return {
      jobId: job.jobId,
      status: "ready",
      mode: job.mode,
      model: job.model,
      videoUrl: `/api/facetime/video/${job.jobId}/media`,
    };
  }
  if (job.status === "error") {
    return {
      jobId: job.jobId,
      status: "error",
      mode: job.mode,
      model: job.model,
      error: job.error,
    };
  }

  const ai = getGeminiClient();
  const updated = await ai.operations.getVideosOperation({
    operation: job.operation,
  });
  job.operation = updated;

  if (updated.error) {
    job.status = "error";
    job.error =
      typeof updated.error.message === "string"
        ? updated.error.message
        : "Video generation failed.";
    return {
      jobId: job.jobId,
      status: "error",
      mode: job.mode,
      model: job.model,
      error: job.error,
    };
  }

  if (updated.done) {
    try {
      await resolveVideoBytes(job);
      job.status = "ready";
      return {
        jobId: job.jobId,
        status: "ready",
        mode: job.mode,
        model: job.model,
        videoUrl: `/api/facetime/video/${job.jobId}/media`,
      };
    } catch (err) {
      job.status = "error";
      job.error = err instanceof Error ? err.message : "Could not retrieve Veo video.";
      return {
        jobId: job.jobId,
        status: "error",
        mode: job.mode,
        model: job.model,
        error: job.error,
      };
    }
  }

  return {
    jobId: job.jobId,
    status: "running",
    mode: job.mode,
    model: job.model,
  };
}

export async function getVeoVideoMedia(
  jobId: string
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const job = veoJobs.get(jobId);
  if (!job) return null;
  if (!job.videoBuffer && job.operation.done) {
    await resolveVideoBytes(job);
  }
  if (!job.videoBuffer) return null;
  return {
    buffer: job.videoBuffer,
    mimeType: job.videoMimeType || "video/mp4",
  };
}

export async function respondToFaceTimeText(params: {
  profile: HistoricalProfile;
  message: string;
  history?: Array<{ speaker: "user" | "figure"; text: string }>;
}): Promise<{ reply: string; latencyMs: number; model: string }> {
  const ai = getGeminiClient();
  const startedAt = Date.now();
  const history = (params.history ?? []).slice(-10);

  const contents = [
    ...history.map((entry) => ({
      role: entry.speaker === "user" ? "user" : "model",
      parts: [{ text: entry.text }],
    })),
    { role: "user", parts: [{ text: params.message }] },
  ];

  const response = await ai.models.generateContent({
    model: VISION_MODEL,
    contents,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      systemInstruction: `${params.profile.systemPersona}\nYou are live on a FaceTime video call with someone from the modern day. Reply naturally in 2–3 vivid, conversational spoken sentences without stage directions or markdown formatting.`,
    },
  });

  return {
    reply: (response.text ?? "").trim(),
    latencyMs: Date.now() - startedAt,
    model: VISION_MODEL,
  };
}

export async function generateHistoricalArtifact(params: {
  profile: HistoricalProfile;
  title: string;
  description: string;
  stylePrompt?: string;
}): Promise<FaceTimeArtifactResult> {
  const ai = getGeminiClient();
  const startedAt = Date.now();
  const { profile, title, description, stylePrompt } = params;

  const styleDirective =
    stylePrompt?.trim() ||
    `Authentic period archival sketch or technical diagram hand-drawn by ${profile.name} (${profile.era}) on aged textured parchment paper, delicate sepia and charcoal line work, period technical notes and flourishes, museum keepsake quality.`;

  const prompt = [
    `Create a historical artifact sketch titled "${title}".`,
    `Subject & Description: ${description}`,
    `Creator & Era: ${profile.name}, ${profile.title} (${profile.era}, ${profile.location}).`,
    `Visual Style: ${styleDirective}`,
    "Framing: 4:3 parchment artifact document, realistic aged paper texture, deckled edges, intricate authentic period drawing without modern digital artifacts or watermarks.",
  ].join(" ");

  const response = await ai.models.generateContent({
    model: IMAGE_GEN_MODEL,
    contents: {
      parts: [{ text: prompt }],
    },
    config: {
      imageConfig: {
        aspectRatio: "4:3",
      },
    },
  });

  let imageDataUrl: string | null = null;
  let outputMime = "image/png";

  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.data) {
      outputMime = part.inlineData.mimeType ?? "image/png";
      imageDataUrl = `data:${outputMime};base64,${part.inlineData.data}`;
      break;
    }
  }

  if (!imageDataUrl) {
    throw new Error(
      `Gemini did not return an artifact sketch for "${title}".`
    );
  }

  return {
    title,
    description,
    imageDataUrl,
    mimeType: outputMime,
    model: IMAGE_GEN_MODEL,
    latencyMs: Date.now() - startedAt,
  };
}

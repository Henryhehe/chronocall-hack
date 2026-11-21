import { getGeminiClient } from "./client.ts";
import { IMAGE_GEN_MODEL } from "../../../shared/models.ts";
import { PERSONA_TRANSFORM_STYLES } from "./personas.ts";

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

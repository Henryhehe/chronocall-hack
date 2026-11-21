import { Router } from "express";
import type { AiServices } from "../services/types.ts";
import { formatGeminiError } from "../services/gemini/errors.ts";

export function createCharacterRouter(services: AiServices) {
  const router = Router();
  router.post("/api/character-world/transform", async (req, res) => {
    try {
      const {
        imageBase64,
        mimeType = "image/jpeg",
        characterPrompt = "",
        personaId,
      } = req.body ?? {};
      if (!imageBase64 || typeof imageBase64 !== "string") {
        res.status(400).json({ error: "imageBase64 is required." });
        return;
      }
      const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "");
      const result = await services.transformSelfieToCharacterWorld({
        imageBase64: cleanBase64,
        mimeType: typeof mimeType === "string" ? mimeType : "image/jpeg",
        characterPrompt:
          typeof characterPrompt === "string" ? characterPrompt : "",
        personaId: typeof personaId === "string" ? personaId : undefined,
      });
      res.json(result);
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  return router;
}

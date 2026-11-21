import { Router } from "express";
import type { AiServices } from "../services/types.ts";
import { formatGeminiError } from "../services/gemini/errors.ts";

export function createVisionRouter(services: AiServices) {
  const router = Router();
  router.post("/api/detect", async (req, res) => {
    try {
      const {
        imageBase64,
        mimeType = "image/jpeg",
        focusPrompt,
        model,
        characterPersona,
      } = req.body ?? {};
      if (!imageBase64 || typeof imageBase64 !== "string") {
        res.status(400).json({ error: "imageBase64 is required." });
        return;
      }
      const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "");
      const result = await services.detectObjectsInFrame({
        imageBase64: cleanBase64,
        mimeType,
        focusPrompt: typeof focusPrompt === "string" ? focusPrompt : undefined,
        model,
        characterPersona:
          typeof characterPersona === "string" ? characterPersona : undefined,
      });
      res.json(result);
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  router.post("/api/ask", async (req, res) => {
    try {
      const {
        imageBase64,
        mimeType = "image/jpeg",
        question,
        model,
        characterPersona,
      } = req.body ?? {};
      if (!imageBase64 || typeof imageBase64 !== "string") {
        res.status(400).json({ error: "imageBase64 is required." });
        return;
      }
      if (!question || typeof question !== "string" || !question.trim()) {
        res.status(400).json({ error: "question is required." });
        return;
      }
      const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "");
      const result = await services.askAboutFrame({
        imageBase64: cleanBase64,
        mimeType,
        question: question.trim(),
        model,
        characterPersona:
          typeof characterPersona === "string" ? characterPersona : undefined,
      });
      res.json(result);
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  return router;
}

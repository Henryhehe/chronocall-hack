import { Router } from "express";
import type { AiServices } from "../services/types.ts";
import { formatGeminiError } from "../services/gemini/errors.ts";

export function createWorldRouter(services: AiServices) {
  const router = Router();
  router.post("/api/world/interact", async (req, res) => {
    try {
      const {
        objectName,
        objectKind,
        objectState,
        personaId,
        worldTheme,
        userAction,
      } = req.body ?? {};
      if (!objectName || typeof objectName !== "string") {
        res.status(400).json({ error: "objectName is required." });
        return;
      }
      const result = await services.interactWithWorldObject({
        objectName,
        objectKind: typeof objectKind === "string" ? objectKind : "prop",
        objectState: typeof objectState === "string" ? objectState : "idle",
        personaId: typeof personaId === "string" ? personaId : undefined,
        worldTheme: typeof worldTheme === "string" ? worldTheme : undefined,
        userAction: typeof userAction === "string" ? userAction : undefined,
      });
      res.json(result);
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  router.post("/api/world/generate-scene", async (req, res) => {
    try {
      const { scenePrompt, personaId, model } = req.body ?? {};
      if (!scenePrompt || typeof scenePrompt !== "string" || !scenePrompt.trim()) {
        res.status(400).json({ error: "scenePrompt is required." });
        return;
      }
      const result = await services.generateLowPolyScene({
        scenePrompt: scenePrompt.trim(),
        personaId: typeof personaId === "string" ? personaId : undefined,
        model,
      });
      res.json(result);
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  router.post("/api/world/spawn-object", async (req, res) => {
    try {
      const { objectPrompt, x = 0, z = 0, worldTheme, model } = req.body ?? {};
      if (!objectPrompt || typeof objectPrompt !== "string" || !objectPrompt.trim()) {
        res.status(400).json({ error: "objectPrompt is required." });
        return;
      }
      const result = await services.spawnLowPolyObject({
        objectPrompt: objectPrompt.trim(),
        x: typeof x === "number" && Number.isFinite(x) ? x : 0,
        z: typeof z === "number" && Number.isFinite(z) ? z : 0,
        worldTheme: typeof worldTheme === "string" ? worldTheme : undefined,
        model,
      });
      res.json(result);
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  return router;
}

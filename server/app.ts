import express, { type NextFunction, type Request, type Response } from "express";
import { createVisionRouter } from "./routes/vision.ts";
import { createCharacterRouter } from "./routes/character.ts";
import { createWorldRouter } from "./routes/world.ts";
import { createGenieRouter } from "./routes/genie.ts";
import type { AiServices } from "./services/types.ts";

export function createApp(options: { services: AiServices; demoMode: boolean; apiKeyConfigured: boolean }) {
  const app = express();
  app.use(express.json({ limit: "25mb" }));
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, demoMode: options.demoMode, apiKeyConfigured: options.apiKeyConfigured });
  });
  app.use(createVisionRouter(options.services));
  app.use(createCharacterRouter(options.services));
  app.use(createWorldRouter(options.services));
  app.use(createGenieRouter(options.services, options.demoMode));
  app.use("/api", (_req, res) => res.status(404).json({ error: "API endpoint not found." }));
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    res.status(400).json({ error: err instanceof Error ? err.message : "Invalid request payload." });
  });
  return app;
}

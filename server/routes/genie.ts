import { Router } from "express";
import type { AiServices } from "../services/types.ts";
import { formatGeminiError } from "../services/gemini/errors.ts";

export function createGenieRouter(services: AiServices, demoMode = false) {
  const router = Router();
  if (demoMode) {
    router.use("/api/genie", (_req, res) => {
      res.status(503).json({ error: "Genie streaming is unavailable in local demo mode. Start with a Gemini API key to use Genie." });
    });
  }
  router.post("/api/genie/session", async (_req, res) => {
    try {
      const session = await services.createGenieSession();
      res.json(session);
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  router.post(
    "/api/genie/proxy/:version/interactions/:idWithAction",
    async (req, res) => {
      try {
        const { version, idWithAction } = req.params;
        if (version !== "v1beta" || !idWithAction.endsWith(":webrtc")) {
          res.status(400).json({ error: "Invalid Genie WebRTC signaling path." });
          return;
        }
        const tokenHeader = req.headers["x-goog-api-key"];
        const authToken = Array.isArray(tokenHeader)
          ? tokenHeader[0]
          : tokenHeader;
        if (!authToken || !authToken.startsWith("auth_tokens/")) {
          res
            .status(401)
            .json({ error: "Missing valid Genie 4 ephemeral auth token." });
          return;
        }

        const interactionId = idWithAction.slice(0, -":webrtc".length);
        const upstreamUrl = `https://generativelanguage.googleapis.com/v1beta/interactions/${encodeURIComponent(
          interactionId
        )}:webrtc`;

        const upstreamRes = await fetch(upstreamUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": authToken,
          },
          body: JSON.stringify(req.body),
        });

        const text = await upstreamRes.text();
        res.status(upstreamRes.status);
        const contentType = upstreamRes.headers.get("content-type");
        if (contentType) {
          res.setHeader("Content-Type", contentType);
        }
        res.send(text);
      } catch (err) {
        const formatted = formatGeminiError(err);
        res.status(formatted.status).json({ error: formatted.message });
      }
    }
  );
  return router;
}

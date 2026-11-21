import "dotenv/config";
import http from "http";
import path from "path";
import express, { NextFunction, Request, Response } from "express";
import { WebSocketServer, WebSocket } from "ws";
import {
  Behavior,
  LiveServerMessage,
  Modality,
  ThinkingLevel,
} from "@google/genai";
import { createServer as createViteServer } from "vite";
import {
  askAboutFrame,
  buildWorldVoiceInstruction,
  createGenieSession,
  detectObjectsInFrame,
  formatGeminiError,
  generateLowPolyScene,
  getLiveGeminiClient,
  highlightObjectsTool,
  interactWithWorldObject,
  LIVE_MODEL,
  LIVE_THINKING_MODEL,
  spawnLowPolyObject,
  steerWorldTool,
  transformSelfieToCharacterWorld,
} from "./server/gemini";

const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "25mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/detect", async (req, res) => {
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
      const result = await detectObjectsInFrame({
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

  app.post("/api/ask", async (req, res) => {
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
      const result = await askAboutFrame({
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

  app.post("/api/character-world/transform", async (req, res) => {
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
      const result = await transformSelfieToCharacterWorld({
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

  app.post("/api/world/interact", async (req, res) => {
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
      const result = await interactWithWorldObject({
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

  app.post("/api/world/generate-scene", async (req, res) => {
    try {
      const { scenePrompt, personaId, model } = req.body ?? {};
      if (!scenePrompt || typeof scenePrompt !== "string" || !scenePrompt.trim()) {
        res.status(400).json({ error: "scenePrompt is required." });
        return;
      }
      const result = await generateLowPolyScene({
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

  app.post("/api/world/spawn-object", async (req, res) => {
    try {
      const { objectPrompt, x = 0, z = 0, worldTheme, model } = req.body ?? {};
      if (!objectPrompt || typeof objectPrompt !== "string" || !objectPrompt.trim()) {
        res.status(400).json({ error: "objectPrompt is required." });
        return;
      }
      const result = await spawnLowPolyObject({
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

  app.post("/api/genie/session", async (_req, res) => {
    try {
      const session = await createGenieSession();
      res.json(session);
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post(
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

  // Ensure unknown /api/* paths always return JSON rather than falling through to HTML
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "API endpoint not found." });
  });

  // Return JSON for body-parser or middleware errors on /api routes
  app.use(
    (err: unknown, req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith("/api")) {
        const msg =
          err instanceof Error ? err.message : "Invalid request payload.";
        res.status(400).json({ error: msg });
        return;
      }
      next(err);
    }
  );

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), "dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const urlPath = (request.url ?? "").split("?")[0];
    if (urlPath === "/ws/live") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  wss.on("connection", async (clientWs: WebSocket, request) => {
    let closed = false;
    let session: Awaited<
      ReturnType<ReturnType<typeof getLiveGeminiClient>["live"]["connect"]>
    > | null = null;

    const reqUrl = new URL(request.url ?? "/ws/live", "http://localhost");
    const requestedModel = reqUrl.searchParams.get("model");
    const liveMode = reqUrl.searchParams.get("mode");
    const isWorldMode = liveMode === "world";
    const worldPersona = reqUrl.searchParams.get("persona") ?? undefined;
    const worldContext = reqUrl.searchParams.get("worldContext") ?? undefined;
    const useExtendedThinking = requestedModel === LIVE_THINKING_MODEL;
    const liveModel = useExtendedThinking ? LIVE_THINKING_MODEL : LIVE_MODEL;

    const sendSafe = (payload: Record<string, unknown>) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(payload));
      }
    };

    try {
      const ai = getLiveGeminiClient();
      const baseTool = isWorldMode ? steerWorldTool : highlightObjectsTool;
      const liveTool = useExtendedThinking
        ? { ...baseTool, behavior: Behavior.NON_BLOCKING }
        : baseTool;

      const systemInstruction = isWorldMode
        ? buildWorldVoiceInstruction(worldPersona, worldContext)
        : "You are a fast, observant real-time camera vision assistant. You see live frames from the user's camera and converse naturally. Keep spoken answers concise and helpful. Whenever the user asks you to find, point out, count, or highlight objects—or when identifying prominent objects in view—call highlight_objects with normalized 0-1000 [ymin, xmin, ymax, xmax] bounding boxes.";

      session = await ai.live.connect({
        model: liveModel,
        config: {
          responseModalities: [Modality.AUDIO],
          ...(useExtendedThinking
            ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
            : {}),
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: isWorldMode ? "Charon" : "Zephyr",
              },
            },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: [{ functionDeclarations: [liveTool] }],
          systemInstruction,
        },
        callbacks: {
          onopen: () => {
            sendSafe({ type: "status", status: "connected", model: liveModel });
          },
          onmessage: (message: LiveServerMessage) => {
            const content = message.serverContent;
            if (content?.inputTranscription?.text) {
              sendSafe({
                type: "inputTranscript",
                text: content.inputTranscription.text,
              });
            }
            if (content?.outputTranscription?.text) {
              sendSafe({
                type: "outputTranscript",
                text: content.outputTranscription.text,
              });
            }
            for (const part of content?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                sendSafe({ type: "audio", data: part.inlineData.data });
              }
              if (part.text) {
                sendSafe({ type: "modelText", text: part.text });
              }
            }
            if (content?.interrupted) {
              sendSafe({ type: "interrupted" });
            }
            if (content?.turnComplete) {
              sendSafe({ type: "turnComplete" });
            }
            for (const call of message.toolCall?.functionCalls ?? []) {
              if (call.name === "highlight_objects") {
                sendSafe({
                  type: "highlightObjects",
                  args: call.args ?? { objects: [] },
                });
                session?.sendToolResponse({
                  functionResponses: [
                    {
                      id: call.id,
                      name: call.name,
                      response: {
                        result:
                          "Bounding boxes rendered on the user's camera overlay.",
                      },
                    },
                  ],
                });
              } else if (call.name === "steer_world") {
                const eventText =
                  typeof call.args?.event === "string"
                    ? call.args.event
                    : "";
                if (eventText) {
                  sendSafe({
                    type: "steerWorld",
                    event: eventText,
                  });
                }
                session?.sendToolResponse({
                  functionResponses: [
                    {
                      id: call.id,
                      name: call.name,
                      response: {
                        result: eventText
                          ? `Triggered world steering event: ${eventText}`
                          : "No event provided.",
                      },
                    },
                  ],
                });
              }
            }
          },
          onerror: (err: unknown) => {
            const formatted = formatGeminiError(err);
            sendSafe({ type: "error", message: formatted.message });
          },
          onclose: () => {
            sendSafe({ type: "status", status: "closed" });
          },
        },
      });

      if (closed) {
        session.close();
        return;
      }
    } catch (err) {
      const formatted = formatGeminiError(err);
      sendSafe({ type: "error", message: formatted.message });
      clientWs.close();
      return;
    }

    clientWs.on("message", (rawData) => {
      if (!session || closed) return;
      try {
        const msg = JSON.parse(rawData.toString());
        if (msg.type === "audio" && typeof msg.data === "string") {
          session.sendRealtimeInput({
            audio: { data: msg.data, mimeType: "audio/pcm;rate=16000" },
          });
        } else if (msg.type === "video" && typeof msg.data === "string") {
          session.sendRealtimeInput({
            video: { data: msg.data, mimeType: "image/jpeg" },
          });
        } else if (msg.type === "text" && typeof msg.text === "string") {
          session.sendRealtimeInput({ text: msg.text });
        }
      } catch (err) {
        const formatted = formatGeminiError(err);
        sendSafe({ type: "error", message: formatted.message });
      }
    });

    clientWs.on("close", () => {
      closed = true;
      try {
        session?.close();
      } catch {
        // Ignore close errors if session already closed
      }
    });
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Gemini Live Vision server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

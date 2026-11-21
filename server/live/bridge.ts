import type { Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { Behavior, Modality, ThinkingLevel, type LiveServerMessage } from "@google/genai";
import { getLiveGeminiClient } from "../services/gemini/client.ts";
import { formatGeminiError } from "../services/gemini/errors.ts";
import { buildWorldVoiceInstruction, highlightObjectsTool, steerWorldTool } from "../services/gemini/live-tools.ts";
import { LIVE_MODEL, LIVE_THINKING_MODEL } from "../../shared/models.ts";

export function attachLiveBridge(server: Server, demoMode = false) {
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

    const cleanup = () => {
      if (closed) return;
      closed = true;
      try {
        session?.close();
      } catch {
        // Ignore close errors if session already closed
      }
    };
    clientWs.on("close", cleanup);
    clientWs.on("error", cleanup);

    if (demoMode) {
      sendSafe({ type: "error", message: "Live voice is unavailable in local demo mode. Start with a Gemini API key to use voice." });
      clientWs.close();
      return;
    }

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
            sendSafe({ type: "status", status: "connecting", model: liveModel });
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
            cleanup();
            clientWs.close();
          },
          onclose: () => {
            sendSafe({ type: "status", status: "closed" });
            cleanup();
            clientWs.close();
          },
        },
      });

      if (closed) {
        session.close();
        return;
      }
      // The SDK resolves connect after setupComplete; listeners are already attached.
      sendSafe({ type: "status", status: "connected", model: liveModel });
    } catch (err) {
      const formatted = formatGeminiError(err);
      sendSafe({ type: "error", message: formatted.message });
      clientWs.close();
      return;
    }


  });

  return wss;
}

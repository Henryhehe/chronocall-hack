import type { Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import {
  Modality,
  Type,
  type FunctionDeclaration,
  type LiveServerMessage,
} from "@google/genai";
import { getLiveGeminiClient } from "../services/gemini/client.ts";
import { formatGeminiError } from "../services/gemini/errors.ts";
import { LIVE_MODEL } from "../../shared/models.ts";
import {
  normalizeHistoricalProfile,
  normalizePortalPrompt,
  type FaceTimeClientMessage,
  type FaceTimePortalInvite,
  type FaceTimeReactionCue,
  type FaceTimeServerEvent,
  type HistoricalProfile,
} from "../../shared/facetime.ts";

const expressReactionTool: FunctionDeclaration = {
  name: "express_reaction",
  description:
    "Updates your visible facial expression, posture, and video motion cue on the FaceTime call when your emotion or physical gesture shifts noticeably.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      mood: {
        type: Type.STRING,
        description:
          "One of: warm, curious, amused, thoughtful, passionate, surprised.",
      },
      gesture: {
        type: Type.STRING,
        description:
          "Short human gesture, e.g. 'nods warmly', 'leans closer to examine the camera', 'chuckles softly'.",
      },
      videoCue: {
        type: Type.STRING,
        description:
          "Concise natural motion prompt to steer the live video avatar, e.g. 'smiles warmly and leans slightly forward with bright attentive eyes'.",
      },
    },
    required: ["mood", "gesture", "videoCue"],
  },
};

const enterWorldPortalTool: FunctionDeclaration = {
  name: "enter_world_portal",
  description:
    "Invites the caller to step into your historical world, workshop, laboratory, or era when they ask to see around, explore your surroundings, or step into your world.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      locationName: {
        type: Type.STRING,
        description:
          "The specific historical room, laboratory, studio, or landscape, e.g. 'Leonardo's Florence Bottega' or 'Curie's Paris Radium Lab'.",
      },
      portalPrompt: {
        type: Type.STRING,
        description:
          "A vivid 3D first-person world generation prompt describing the historical environment to explore.",
      },
    },
    required: ["locationName"],
  },
};

function buildFaceTimeSystemInstruction(profile: HistoricalProfile): string {
  const artworkLine = profile.artworkTitle
    ? `The caller reached you by scanning "${profile.artworkTitle}"${profile.artist ? ` (${profile.artist})` : ""}. You may acknowledge stepping out of that portrait or statue into this live conversation if natural.`
    : "";

  return [
    profile.systemPersona,
    `Identity: ${profile.name} — ${profile.title} (${profile.era}, ${profile.location}).`,
    artworkLine,
    "Setting: You are LIVE on a FaceTime video call with a modern-day person. You can hear their voice and see live video frames from their camera.",
    "Style: Speak naturally, warmly, and vividly in first person as if talking face-to-face. Keep spoken turns concise (1–3 sentences) so the conversation flows briskly like a real video call. React genuinely if they hold an object up to the camera or ask about your era. Never break character or mention being an AI.",
    "Call express_reaction occasionally when your emotional reaction or posture shifts so your live video reflects your expression.",
    "Call enter_world_portal when the caller asks to see around your room, workshop, laboratory, or era (e.g. 'show me around', 'step into your world', 'can I explore?').",
  ]
    .filter(Boolean)
    .join("\n\n");
}

const VALID_MOODS: ReadonlySet<FaceTimeReactionCue["mood"]> = new Set([
  "warm",
  "curious",
  "amused",
  "thoughtful",
  "passionate",
  "surprised",
]);

export function attachFaceTimeBridge(server: Server, demoMode = false) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const urlPath = (request.url ?? "").split("?")[0];
    if (urlPath === "/ws/facetime") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  wss.on("connection", (clientWs: WebSocket) => {
    let closed = false;
    let starting = false;
    let session: Awaited<
      ReturnType<ReturnType<typeof getLiveGeminiClient>["live"]["connect"]>
    > | null = null;

    const sendSafe = (payload: FaceTimeServerEvent) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(payload));
      }
    };

    const cleanup = () => {
      if (closed) return;
      closed = true;
      try {
        session?.close();
      } catch {
        // Ignore close errors if upstream session already closed
      }
      session = null;
    };

    // Register close/error listeners before awaiting any upstream Gemini connect.
    clientWs.on("close", cleanup);
    clientWs.on("error", cleanup);

    if (demoMode) {
      sendSafe({
        type: "error",
        message:
          "Live voice is unavailable in local demo mode. Add GEMINI_API_KEY in .env.local to talk live.",
      });
      clientWs.close();
      return;
    }

    clientWs.on("message", async (rawData) => {
      if (closed) return;
      try {
        const msg = JSON.parse(rawData.toString()) as FaceTimeClientMessage;

        if (msg.type === "start") {
          if (starting || session) return;
          starting = true;
          const profile = normalizeHistoricalProfile(
            msg.profile,
            msg.profile?.sourceType ?? "search"
          );
          sendSafe({ type: "status", status: "connecting", model: LIVE_MODEL });

          const ai = getLiveGeminiClient();
          const connectedSession = await ai.live.connect({
            model: LIVE_MODEL,
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: profile.voiceName,
                  },
                },
              },
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              tools: [
                {
                  functionDeclarations: [
                    expressReactionTool,
                    enterWorldPortalTool,
                  ],
                },
              ],
              systemInstruction: buildFaceTimeSystemInstruction(profile),
            },
            callbacks: {
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
                  if (call.name === "express_reaction") {
                    const rawMood = String(call.args?.mood ?? "warm");
                    const mood: FaceTimeReactionCue["mood"] = VALID_MOODS.has(
                      rawMood as FaceTimeReactionCue["mood"]
                    )
                      ? (rawMood as FaceTimeReactionCue["mood"])
                      : "warm";
                    const cue: FaceTimeReactionCue = {
                      mood,
                      gesture: String(call.args?.gesture ?? "nods warmly"),
                      videoCue: String(
                        call.args?.videoCue ??
                          "looks warmly at the caller and nods naturally"
                      ),
                    };
                    sendSafe({ type: "reaction", cue });
                    connectedSession.sendToolResponse({
                      functionResponses: [
                        {
                          id: call.id,
                          name: call.name,
                          response: {
                            result: "Expression reflected on the FaceTime video feed.",
                          },
                        },
                      ],
                    });
                  } else if (call.name === "enter_world_portal") {
                    const locationName =
                      String(call.args?.locationName ?? "").trim() ||
                      profile.location;
                    const rawPrompt =
                      typeof call.args?.portalPrompt === "string"
                        ? call.args.portalPrompt
                        : undefined;
                    const portal: FaceTimePortalInvite = {
                      locationName,
                      portalPrompt: normalizePortalPrompt(profile, rawPrompt),
                    };
                    sendSafe({ type: "portalInvite", portal });
                    connectedSession.sendToolResponse({
                      functionResponses: [
                        {
                          id: call.id,
                          name: call.name,
                          response: {
                            result: `Portal invitation to ${locationName} delivered to caller.`,
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
            connectedSession.close();
            return;
          }

          session = connectedSession;
          sendSafe({ type: "status", status: "connected", model: LIVE_MODEL });

          // Have the historical figure naturally pick up and greet the caller as soon as the call connects.
          connectedSession.sendClientContent({
            turns: [
              {
                role: "user",
                parts: [
                  {
                    text: `[The FaceTime video call just connected. Greet the caller naturally in 1–2 warm spoken sentences in character as ${profile.name}.]`,
                  },
                ],
              },
            ],
            turnComplete: true,
          });
          return;
        }

        if (!session) return;

        if (msg.type === "audio" && typeof msg.data === "string") {
          session.sendRealtimeInput({
            audio: { data: msg.data, mimeType: "audio/pcm;rate=16000" },
          });
        } else if (msg.type === "video" && typeof msg.data === "string") {
          session.sendRealtimeInput({
            video: { data: msg.data, mimeType: "image/jpeg" },
          });
        } else if (msg.type === "text" && typeof msg.text === "string") {
          session.sendClientContent({
            turns: [{ role: "user", parts: [{ text: msg.text }] }],
            turnComplete: true,
          });
        }
      } catch (err) {
        const formatted = formatGeminiError(err);
        sendSafe({ type: "error", message: formatted.message });
        if (!session) {
          cleanup();
          clientWs.close();
        }
      }
    });
  });

  return wss;
}

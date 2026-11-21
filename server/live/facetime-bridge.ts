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
  clampAnnotationBox,
  normalizeHistoricalProfile,
  normalizePortalPrompt,
  type FaceTimeArtifactRequest,
  type FaceTimeCallerAnnotation,
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

const inspectCallerObjectTool: FunctionDeclaration = {
  name: "inspect_caller_object",
  description:
    "Call this whenever the caller holds an object up to their camera or asks you to look at something they are showing you. Identifies the object, provides your authentic historical era name/reaction, and localizes it with a bounding box (ymin, xmin, ymax, xmax clamped 0..1000).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      label: {
        type: Type.STRING,
        description:
          "Common modern name for the object, e.g. 'Smartphone', 'Wristwatch', 'Mug', 'Notebook'.",
      },
      historicalName: {
        type: Type.STRING,
        description:
          "How you (in your era) understand or refer to this object, e.g. 'Luminescent Glass Scrying Slate', 'Pocket Chronometer', 'Ceramic Goblet'.",
      },
      note: {
        type: Type.STRING,
        description:
          "Your vivid first-person observation or curiosity about the object from your era's worldview.",
      },
      ymin: {
        type: Type.INTEGER,
        description: "Top boundary of the object in the camera frame (0..1000).",
      },
      xmin: {
        type: Type.INTEGER,
        description: "Left boundary of the object in the camera frame (0..1000).",
      },
      ymax: {
        type: Type.INTEGER,
        description: "Bottom boundary of the object in the camera frame (0..1000).",
      },
      xmax: {
        type: Type.INTEGER,
        description: "Right boundary of the object in the camera frame (0..1000).",
      },
    },
    required: [
      "label",
      "historicalName",
      "note",
      "ymin",
      "xmin",
      "ymax",
      "xmax",
    ],
  },
};

const shareArtifactTool: FunctionDeclaration = {
  name: "share_artifact",
  description:
    "Shares or sketches a period-authentic artifact, blueprint, map, invention sketch, or keepsake with the caller mid-call. Use this when the caller asks for a drawing/keepsake or when sharing a signature creation of yours.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description:
          "Short evocative title of the sketch or artifact, e.g. 'Study of the Vitruvian Man', 'Camp Map of Valley Forge', 'Design for the Wardenclyffe Tower'.",
      },
      description: {
        type: Type.STRING,
        description:
          "Engaging 1–2 sentence description of what you are drawing or sharing and why it matters.",
      },
      stylePrompt: {
        type: Type.STRING,
        description:
          "Visual styling directive for the sketch, e.g. 'Sepia ink and wash on aged vellum with anatomical annotations in mirrored script'.",
      },
    },
    required: ["title", "description"],
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
    "Show & Tell (Live Object Inspection): If the caller holds up an object, shows something to the camera, or asks what you think of an item: call inspect_caller_object to identify it, name it from your historical perspective, and provide its coordinates (ymin, xmin, ymax, xmax clamped 0..1000).",
    "Live Keepsake (Artifact Sketch): If you want to sketch, illustrate, or share a keepsake artifact, diagram, invention blueprint, or document with the caller (or if they ask for a sketch): call share_artifact with a title, description, and period stylePrompt.",
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

// Character layer: general guide, background research, Decisions API turn checks (characterLayer.ts).
import { createCharacterLayer } from "./characterLayer.ts";

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

    const character = createCharacterLayer({ clientWs, getSession: () => session, isClosed: () => closed });
    const sendSafe = (payload: FaceTimeServerEvent) => {
      character.observe(payload);
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
          character.prepare(profile);
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
                    inspectCallerObjectTool,
                    shareArtifactTool,
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
                  } else if (call.name === "inspect_caller_object") {
                    const box = clampAnnotationBox({
                      ymin: Number(call.args?.ymin),
                      xmin: Number(call.args?.xmin),
                      ymax: Number(call.args?.ymax),
                      xmax: Number(call.args?.xmax),
                    });
                    const annotation: FaceTimeCallerAnnotation = {
                      label: String(call.args?.label ?? "Object"),
                      historicalName: String(
                        call.args?.historicalName ?? "Historical Item"
                      ),
                      note: String(call.args?.note ?? ""),
                      ...box,
                    };
                    sendSafe({ type: "callerAnnotation", annotation });
                    connectedSession.sendToolResponse({
                      functionResponses: [
                        {
                          id: call.id,
                          name: call.name,
                          response: {
                            result: `Object "${annotation.label}" inspected and annotated on video feed.`,
                          },
                        },
                      ],
                    });
                  } else if (call.name === "share_artifact") {
                    const artifact: FaceTimeArtifactRequest = {
                      title: String(
                        call.args?.title ?? `${profile.name}'s Keepsake`
                      ),
                      description: String(
                        call.args?.description ?? "Historical keepsake sketch."
                      ),
                      stylePrompt: String(call.args?.stylePrompt ?? ""),
                    };
                    sendSafe({ type: "artifactRequest", artifact });
                    connectedSession.sendToolResponse({
                      functionResponses: [
                        {
                          id: call.id,
                          name: call.name,
                          response: {
                            result: `Keepsake sketch request for "${artifact.title}" dispatched to caller.`,
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
                    text: `[The call just connected: a stranger appears to you in a glowing glass. Greet them in 1–2 spoken sentences, as ${profile.name} would greet a stranger in your own time and situation.]`,
                  },
                ],
              },
            ],
            turnComplete: true,
          });
          character.start();
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

import express from 'express';
import type { Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, type LiveServerMessage, Modality, ThinkingLevel, Type } from '@google/genai';
import { resolvePersona } from '../src/features/museum/data/personas.ts';
import {
  liveResearchPrompt,
  structurePrompt,
  LIVE_PROFILE_SCHEMA,
  factCheckQuestions,
  dropFailed,
  livePersona,
  type LiveProfile,
  type IdentifiedSubject,
} from '../src/features/museum/data/liveResearch.ts';
import { checkReply, correctionNote, type ReplyCheckResult } from './services/gemini/replyChecks.ts';
function createGeminiClient(apiVersion?: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    ...(apiVersion ? { apiVersion } : {}),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function parseApiError(err: unknown): { status: number; message: string } {
  let msg = '';
  if (err instanceof Error) {
    msg = err.message;
  } else if (err && typeof err === 'object') {
    const obj = err as { message?: unknown; error?: { message?: unknown }; reason?: unknown };
    if (typeof obj.message === 'string') msg = obj.message;
    else if (typeof obj.error?.message === 'string') msg = obj.error.message;
    else if (typeof obj.reason === 'string') msg = obj.reason;
    else msg = JSON.stringify(err);
  } else {
    msg = String(err);
  }
  if (msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED') || msg.includes('API key not valid')) {
    return {
      status: 403,
      message: 'Gemini API key is missing or invalid. Please check your key in Settings > Secrets.',
    };
  }
  if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
    return {
      status: 429,
      message: 'API quota reached. Please wait a moment or check your plan in Settings > Secrets.',
    };
  }
  return { status: 500, message: msg || 'Unexpected server error communicating with Gemini.' };
}

export function createMuseumRouter(demoMode = false) {
 const app = express.Router();
 app.use((req, res, next) => { if (demoMode && req.method === "POST" && ["/api/identify-portrait", "/api/character/respond", "/api/research-figure"].includes(req.path)) { res.status(503).json({ error: "Museum AI requires a Gemini API key; unavailable in demo mode." }); return; } next(); });
  app.get('/api/app-url', (req, res) => {
    const envUrl = process.env.APP_URL;
    const isPlaceholder = !envUrl || envUrl === 'MY_APP_URL';
    const hostHeader = req.get('host');
    const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
    const inferredUrl = hostHeader ? `${proto}://${hostHeader}` : '';
    const appUrl = !isPlaceholder ? envUrl : inferredUrl;
    res.json({ appUrl: appUrl ? new URL("/museum", appUrl).href : appUrl });
  });

  // Identify a painting or historical portrait from a smartphone camera frame or uploaded image
  app.post('/api/identify-portrait', async (req, res) => {
    try {
      const { imageBase64, mimeType = 'image/jpeg' } = req.body ?? {};
      if (!imageBase64 || typeof imageBase64 !== 'string') {
        return res.status(400).json({ error: 'imageBase64 is required.' });
      }

      const ai = createGeminiClient();
      const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: cleanBase64,
              },
            },
            {
              text: `Analyze this camera frame from a museum visitor's phone.
Determine if a historical portrait, equestrian painting, sculpture, or artwork depicting a historical or notable figure is visible (including paintings shown on walls, prints, books, or screens).
Set isWashingtonAnchor to true specifically if the visible painting is an equestrian portrait of George Washington on a white/gray horse (e.g., wearing a blue-and-buff Continental uniform with sword extended).
If a portrait is visible, identify the subject, artwork title, artist (or probable school), historical era, and return 3 to 4 interactive AR hotspot coordinates (x, y percentages 0-100 on the full frame) for notable details plus the portrait's approximate bounding box (focalBox x, y, width, height in 0-100 percentages).
If no portrait or figure is clearly visible, set detected to false and explain briefly in historicalContext.`,
            },
          ],
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              detected: { type: Type.BOOLEAN },
              isWashingtonAnchor: { type: Type.BOOLEAN },
              characterName: { type: Type.STRING },
              roleTitle: { type: Type.STRING },
              paintingTitle: { type: Type.STRING },
              artist: { type: Type.STRING },
              year: { type: Type.STRING },
              medium: { type: Type.STRING },
              historicalContext: { type: Type.STRING },
              systemPersona: {
                type: Type.STRING,
                description:
                  'First-person system instruction so the figure can speak authentically to a museum visitor with deep historical context.',
              },
              openingLine: { type: Type.STRING },
              suggestedVoice: {
                type: Type.STRING,
                description: 'One of: Charon, Fenrir, Kore, Zephyr, Puck',
              },
              focalPoint: {
                type: Type.OBJECT,
                properties: {
                  x: { type: Type.NUMBER },
                  y: { type: Type.NUMBER },
                },
                required: ['x', 'y'],
              },
              focalBox: {
                type: Type.OBJECT,
                properties: {
                  x: { type: Type.NUMBER },
                  y: { type: Type.NUMBER },
                  width: { type: Type.NUMBER },
                  height: { type: Type.NUMBER },
                },
                required: ['x', 'y', 'width', 'height'],
              },
              hotspots: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    label: { type: Type.STRING },
                    eraDetail: { type: Type.STRING },
                    x: { type: Type.NUMBER },
                    y: { type: Type.NUMBER },
                    prompt: { type: Type.STRING },
                    animationCue: { type: Type.STRING },
                  },
                  required: ['id', 'label', 'eraDetail', 'x', 'y', 'prompt'],
                },
              },
              suggestedQuestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['detected', 'isWashingtonAnchor', 'characterName', 'paintingTitle', 'historicalContext'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      // Replace the persona the model improvised with the general character guide (then call
      // /api/research-figure to add live research).
      // The improvised one is kept as `generatedPersona`: it is the one-call baseline for evaluation.
      if (parsed.detected && parsed.characterName) {
        const resolved = resolvePersona({
          characterName: parsed.characterName,
          title: parsed.paintingTitle,
          artist: parsed.artist,
          year: parsed.year,
        });
        parsed.generatedPersona = parsed.systemPersona;
        parsed.systemPersona = resolved.systemPersona;
        parsed.personaSource = resolved.source;
      }
      res.json(parsed);
    } catch (err) {
      const { status, message } = parseApiError(err);
      res.status(status).json({ error: message });
    }
  });

  // Text / Hotspot query endpoint with spoken WAV TTS synthesis
  // Live research for any identified figure (or part of a painting): research with Google Search,
  // structure, check every fact with the Decisions API, and return a system persona built from the
  // checked profile plus the general character guide. Call it right after /api/identify-portrait;
  // the figure can start talking on the guide alone and switch to this persona when it arrives.
  const researchCache = new Map<string, unknown>();
  app.post('/api/research-figure', async (req, res) => {
    const t0 = Date.now();
    try {
      const s = (req.body ?? {}) as IdentifiedSubject;
      if (!s.name && !s.subject) return res.status(400).json({ error: 'name or subject is required.' });
      const key = JSON.stringify([s.kind, s.name, s.subject, s.paintingTitle]).toLowerCase();
      if (researchCache.has(key)) return res.json({ ...(researchCache.get(key) as object), cached: true });

      const ai = createGeminiClient();
      const timings: Record<string, number> = {};

      // 1. Research with Google Search grounding (free prose, sources after each fact).
      const research = await ai.models.generateContent({
        model: 'gemini-4-neon',
        contents: liveResearchPrompt(s),
        config: { tools: [{ googleSearch: {} }] },
      });
      const notes = research.text ?? '';
      const sources = (research.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [])
        .map((c) => ({ title: c.web?.title, uri: c.web?.uri }))
        .filter((c) => c.uri);
      timings.researchMs = Date.now() - t0;

      // 2. Structure the notes (only what the notes support).
      const structured = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: structurePrompt(notes, s),
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseJsonSchema: LIVE_PROFILE_SCHEMA,
        },
      });
      let profile = JSON.parse((structured.text ?? '{}').trim()) as LiveProfile;
      profile.paintingLiberties ??= [];
      profile.eraViews ??= [];
      profile.sensitive ??= [];
      timings.structureMs = Date.now() - t0 - timings.researchMs;

      // 3. Check every fact against the research notes with the Decisions API (yes/no, calibrated).
      //    Code decides: a fact stays only if P(yes) >= 0.8.
      const checks: Record<string, number> = {};
      const qs = factCheckQuestions(profile);
      if (qs.length) {
        const t2 = Date.now();
        const decision = await ai.decisions.create({
          model: 'models/gemini-decision-1',
          input: `RESEARCH NOTES WITH SOURCES:\n${notes}`,
          questions: Object.fromEntries(
            qs.map((q) => [
              q.id,
              {
                type: 'noul' as const,
                instructions: `${q.question.replace('the attached source', 'the research notes, citing ' + q.source)} Answer true only if the notes clearly support it.`,
              },
            ]),
          ),
        });
        for (const q of qs) {
          const a = decision.answers?.[q.id] as { noul?: number } | undefined;
          checks[q.id] = a?.noul ?? 0;
        }
        timings.checkMs = Date.now() - t2;
      }
      const failed = new Set(Object.entries(checks).filter(([, p]) => p < 0.8).map(([id]) => id));
      profile = dropFailed(profile, failed);

      const result = {
        profile,
        systemPersona: livePersona(profile, { title: s.paintingTitle, artist: s.artist }),
        checks,
        dropped: [...failed],
        sources,
        timings: { ...timings, totalMs: Date.now() - t0 },
      };
      researchCache.set(key, result);
      res.json(result);
    } catch (err) {
      const { status, message } = parseApiError(err);
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/character/respond', async (req, res) => {
    try {
      const {
        message,
        history = [],
        systemPersona,
        voiceName = 'Charon',
        includeAudio = true,
      } = req.body ?? {};

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'message is required.' });
      }

      const ai = createGeminiClient();
      const contents = [
        ...history
          .filter((item: { speaker?: string; text?: string }) => item?.text)
          .slice(-10)
          .map((item: { speaker: string; text: string }) => ({
            role: item.speaker === 'visitor' ? 'user' : 'model',
            parts: [{ text: item.text }],
          })),
        { role: 'user', parts: [{ text: message }] },
      ];

      const instructions =
        systemPersona ||
        'You are a historical figure speaking from your museum portrait in 2-4 vivid, historically grounded sentences.';
      const generate = async (extra = '') =>
        (
          (
            await ai.models.generateContent({
              model: 'gemini-4-hydrogen',
              contents,
              config: {
                systemInstruction: extra ? `${instructions}\n\n${extra}` : instructions,
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              },
            })
          ).text ?? ''
        ).trim();

      // Check the reply with the Decisions API; if a check fails, regenerate once with a correction.
      let replyText = await generate();
      let checks: ReplyCheckResult = await checkReply(ai, { reply: replyText, instructions, visitorMessage: message });
      let retried = false;
      if (!checks.passed) {
        const retry = await generate(correctionNote(checks.failed));
        const retryChecks = await checkReply(ai, { reply: retry, instructions, visitorMessage: message });
        retried = true;
        if (retry && (retryChecks.passed || retryChecks.failed.length < checks.failed.length)) {
          replyText = retry;
          checks = retryChecks;
        }
      }
      let audioBase64: string | null = null;

      if (includeAudio && replyText) {
        const validVoice = ['Charon', 'Fenrir', 'Kore', 'Zephyr', 'Puck'].includes(voiceName)
          ? voiceName
          : 'Charon';
        try {
          const ttsResponse = await ai.models.generateContent({
            model: 'gemini-3.8-flash-lite-tts',
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: replyText,
                    speechMetadata: {
                      style: 'Dignified, warm, historically grounded conversational portrait voice',
                    },
                  },
                ],
              },
            ],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: validVoice },
                },
              },
            },
          });

          audioBase64 =
            ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ?? null;
        } catch (ttsErr) {
          console.warn('TTS synthesis fallback (returning text only):', ttsErr);
        }
      }

      res.json({
        replyText,
        audioBase64,
        mimeType: audioBase64 ? 'audio/wav' : null,
        replyChecks: { ...checks, retried },
      });
    } catch (err) {
      const { status, message } = parseApiError(err);
      res.status(status).json({ error: message });
    }
  });

return app;
}
export function attachMuseumBridge(server: Server, demoMode = false) {
 const wss = new WebSocketServer({ noServer: true });
 server.on("upgrade", (request, socket, head) => { if ((request.url ?? "").split("?")[0] === "/ws/museum") wss.handleUpgrade(request, socket, head, ws => wss.emit("connection", ws, request)); });
  wss.on('connection', (clientWs: WebSocket) => {
    if (demoMode) { clientWs.send(JSON.stringify({ type: 'error', message: 'Museum voice requires a Gemini API key; unavailable in demo mode.' })); clientWs.close(); return; }
    let sessionPromise: Promise<Awaited<ReturnType<GoogleGenAI['live']['connect']>>> | null = null;
    let liveSession: Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null = null;
    let isClosing = false;
    // Reply checks for live voice: collect each spoken turn's transcript and check it when the turn ends.
    let sessionInstructions = '';
    let lastVisitorText = '';
    let turnText = '';

    const safeSend = (payload: Record<string, unknown>) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(payload));
      }
    };

    clientWs.on('message', async (rawData) => {
      try {
        const msg = JSON.parse(rawData.toString());

        if (msg.type === 'start') {
          if (liveSession) {
            try {
              liveSession.close();
            } catch {
              // ignore cleanup errors
            }
            liveSession = null;
          }
          sessionPromise = null;

          const ai = createGeminiClient('v1beta');
          const voiceName = ['Charon', 'Fenrir', 'Kore', 'Zephyr', 'Puck'].includes(msg.voiceName)
            ? msg.voiceName
            : 'Charon';

          const systemInstruction = `${msg.systemPersona || ''}\n\nMuseum Context: Artwork "${msg.paintingTitle || 'Portrait'}". ${msg.historicalContext || ''}\nSpeak naturally as the living figure inside this painting. Keep answers concise, engaging, and directly responsive to what the visitor asks or points at.`;

          sessionInstructions = systemInstruction;
          turnText = '';
          lastVisitorText = '';
          const checker = createGeminiClient();

          sessionPromise = ai.live.connect({
            model: 'gemini-3.8-live',
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName },
                },
              },
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              systemInstruction,
            },
            callbacks: {
              onmessage: (message: LiveServerMessage) => {
                const content = message.serverContent;
                if (content?.inputTranscription?.text) {
                  lastVisitorText += content.inputTranscription.text;
                  safeSend({
                    type: 'inputTranscript',
                    text: content.inputTranscription.text,
                  });
                }
                if (content?.outputTranscription?.text) {
                  turnText += content.outputTranscription.text;
                  safeSend({
                    type: 'outputTranscript',
                    text: content.outputTranscription.text,
                  });
                }
                for (const part of content?.modelTurn?.parts ?? []) {
                  if (part.inlineData?.data) {
                    safeSend({
                      type: 'audio',
                      data: part.inlineData.data,
                    });
                  }
                }
                if (content?.interrupted) {
                  safeSend({ type: 'interrupted' });
                }
                if (content?.turnComplete) {
                  safeSend({ type: 'turnComplete' });
                  const spoken = turnText.trim();
                  const visitor = lastVisitorText.trim();
                  turnText = '';
                  lastVisitorText = '';
                  if (spoken) {
                    void checkReply(checker, { reply: spoken, instructions: sessionInstructions, visitorMessage: visitor }).then(
                      (result) => {
                        safeSend({ type: 'replyCheck', ...result });
                        if (!result.passed && liveSession && !isClosing) {
                          liveSession.sendClientContent({
                            turns: [{ role: 'user', parts: [{ text: correctionNote(result.failed) }] }],
                            turnComplete: true,
                          });
                        }
                      },
                    );
                  }
                }
              },
              onerror: (err: unknown) => {
                const parsed = parseApiError(err);
                console.error('Gemini Live error:', parsed.message);
                safeSend({ type: 'error', message: parsed.message });
              },
              onclose: (event?: { code?: number; reason?: string }) => {
                if (!isClosing) {
                  safeSend({
                    type: 'closed',
                    code: event?.code,
                    reason: event?.reason || '',
                  });
                }
              },
            },
          });

          liveSession = await sessionPromise;
          if (!isClosing) {
            safeSend({ type: 'ready' });
          }
          return;
        }

        const activeSession = liveSession ?? (sessionPromise ? await sessionPromise : null);
        if (!activeSession) return;

        if (msg.type === 'audio' && typeof msg.data === 'string') {
          activeSession.sendRealtimeInput({
            audio: { data: msg.data, mimeType: 'audio/pcm;rate=16000' },
          });
        } else if (msg.type === 'video' && typeof msg.data === 'string') {
          activeSession.sendRealtimeInput({
            video: { data: msg.data, mimeType: 'image/jpeg' },
          });
        } else if (msg.type === 'text' && typeof msg.text === 'string') {
          activeSession.sendClientContent({
            turns: [{ role: 'user', parts: [{ text: msg.text }] }],
            turnComplete: true,
          });
        }
      } catch (err) {
        const parsed = parseApiError(err);
        safeSend({ type: 'error', message: parsed.message });
      }
    });

    clientWs.on('close', () => {
      isClosing = true;
      if (liveSession) {
        try {
          liveSession.close();
        } catch {
          // ignore
        }
        liveSession = null;
      }
    });
  });

return wss;
}

import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

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

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/app-url', (req, res) => {
    const envUrl = process.env.APP_URL;
    const isPlaceholder = !envUrl || envUrl === 'MY_APP_URL';
    const hostHeader = req.get('host');
    const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
    const inferredUrl = hostHeader ? `${proto}://${hostHeader}` : '';
    const appUrl = !isPlaceholder ? envUrl : inferredUrl;
    res.json({ appUrl });
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
      res.json(parsed);
    } catch (err) {
      const { status, message } = parseApiError(err);
      res.status(status).json({ error: message });
    }
  });

  // Text / Hotspot query endpoint with spoken WAV TTS synthesis
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

      const textResponse = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents,
        config: {
          systemInstruction:
            systemPersona ||
            'You are a historical figure speaking from your museum portrait in 2-4 vivid, historically grounded sentences.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const replyText = (textResponse.text ?? '').trim();
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
      });
    } catch (err) {
      const { status, message } = parseApiError(err);
      res.status(status).json({ error: message });
    }
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws/live' });

  wss.on('connection', (clientWs: WebSocket) => {
    let sessionPromise: Promise<Awaited<ReturnType<GoogleGenAI['live']['connect']>>> | null = null;
    let liveSession: Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null = null;
    let isClosing = false;

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
                  safeSend({
                    type: 'inputTranscript',
                    text: content.inputTranscription.text,
                  });
                }
                if (content?.outputTranscription?.text) {
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

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Tableau Vivant server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

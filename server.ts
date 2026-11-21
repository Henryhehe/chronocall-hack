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
    const devUrl = !isPlaceholder ? envUrl : inferredUrl;
    const sharedUrl = devUrl.includes('ais-dev-')
      ? devUrl.replace('ais-dev-', 'ais-pre-')
      : devUrl;
    res.json({ appUrl: sharedUrl, sharedUrl, devUrl });
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
              text: `You are an expert museum art-history vision system. Analyze this camera frame to detect if ANY famous / canonical work of art (from art history / WikiArt collections, plus the Thomas Sully / John Faed equestrian portrait of George Washington) is visible.

IMPORTANT DETECTION RULES:
- A famous artwork may be hung on a wall, printed in a book/poster, OR displayed on a computer monitor, laptop, tablet, or phone screen (even with bezels, a desk, hands, or a room visible around it).
- If ANY recognizable famous / canonical / WikiArt artwork is clearly visible in the frame, set "detected": true.
- Set "detected": false ONLY if NO recognizable famous work of art is visible (e.g., only a blank wall, empty desk, keyboard, random room, or a live selfie/person with no famous painting).
- Set "isWashingtonAnchor": true ONLY if the artwork is the equestrian portrait of George Washington on a white/gray horse.
- Set "hasHumanSubject": true if the artwork depicts a recognizable human subject, historical person, mythological figure, or portrait figure (e.g., Mona Lisa, Girl with a Pearl Earring, Napoleon Crossing the Alps, Van Gogh Self-Portrait, American Gothic, The Birth of Venus, Washington on Horseback). Set "hasHumanSubject": false for landscapes, seascapes, still lifes, or abstract works without a speaking human figure (e.g., The Starry Night, The Great Wave off Kanagawa, Water Lilies, The Persistence of Memory).

When "detected": false:
- Return empty strings for text fields, empty arrays for hotspots/suggestedQuestions, [0, 0, 0, 0] for box2d, and 0 for numeric coordinates.

When "detected": true:
1. Provide concise canonical metadata: paintingTitle, artist (artist name only), year (short year/era only, e.g. "1889" or "c. 1503"), medium (short, e.g. "Oil on canvas"), styleMovement (e.g. "Post-Impressionism"), and historicalContext (2-3 sentences).
2. Accurately locate the painted canvas/artwork surface itself (excluding surrounding room, desk, wall, monitor bezel, or thick decorative frame):
   - Provide box2d as [ymin, xmin, ymax, xmax] in 0-1000 normalized image coordinates tightly enclosing the artwork surface.
   - Provide focalBox (x, y, width, height in 0-100 percentages matching box2d).
   - Provide focalQuad (topLeft, topRight, bottomRight, bottomLeft in 0-100 percentages) for the 4 corners of the artwork surface. Only tilt/skew the corners if the painting is visibly viewed at an angle; if viewed straight-on, keep the 4 corners aligned to the painting rectangle.
3. Set focalPoint (x, y in 0-100 percentages of image width/height) to the human subject's face/head if hasHumanSubject is true, or the painting's compositional center if false.
4. Return 3 to 4 AR hotspot tags (x, y in 0-100 percentages of the camera frame) highlighting notable artistic techniques, symbols, or historical details inside the painting. Offset each tag slightly beside the feature so it never covers a person's eyes or face.
5. If hasHumanSubject is true: set characterName to the specific depicted person/figure, roleTitle to their concise title/identity, choose suggestedVoice (Kore or Zephyr for female; Charon or Fenrir for male), and write a vivid first-person systemPersona (2-4 sentences instructing how to speak in character with deep historical knowledge of who they are, their life, and this painting) plus an in-character openingLine (1-2 sentences). If hasHumanSubject is false, set characterName to paintingTitle, roleTitle to artist, suggestedVoice to "Charon", systemPersona to "", and openingLine to a 1-sentence artwork caption.`,
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
              hasHumanSubject: { type: Type.BOOLEAN },
              characterName: {
                type: Type.STRING,
                description: 'Short name of depicted human subject, or paintingTitle if non-human.',
              },
              roleTitle: {
                type: Type.STRING,
                description: 'Concise role or subtitle (3-6 words max).',
              },
              paintingTitle: {
                type: Type.STRING,
                description: 'Canonical title of the artwork.',
              },
              artist: {
                type: Type.STRING,
                description: 'Artist name only (concise).',
              },
              year: {
                type: Type.STRING,
                description: 'Short creation year or date range only, e.g. "1889" or "c. 1503".',
              },
              medium: {
                type: Type.STRING,
                description: 'Short medium description, e.g. "Oil on canvas".',
              },
              styleMovement: {
                type: Type.STRING,
                description: 'Art movement or style, e.g. "High Renaissance".',
              },
              historicalContext: {
                type: Type.STRING,
                description: 'Concise 2-3 sentence historical and artistic overview.',
              },
              systemPersona: {
                type: Type.STRING,
                description:
                  'First-person system instruction so the depicted human subject can speak authentically with full historical knowledge of who they are (empty string if hasHumanSubject is false).',
              },
              openingLine: {
                type: Type.STRING,
                description: 'Brief 1-2 sentence greeting in character (or artwork caption).',
              },
              suggestedVoice: {
                type: Type.STRING,
                description: 'One of: Charon, Fenrir, Kore, Zephyr, Puck',
              },
              box2d: {
                type: Type.ARRAY,
                description:
                  'Tight bounding box of the painting surface as [ymin, xmin, ymax, xmax] in 0-1000 normalized coordinates.',
                items: { type: Type.NUMBER },
              },
              focalPoint: {
                type: Type.OBJECT,
                description: 'Center of subject face or compositional focal point in 0-100 frame %.',
                properties: {
                  x: { type: Type.NUMBER },
                  y: { type: Type.NUMBER },
                },
                required: ['x', 'y'],
              },
              focalBox: {
                type: Type.OBJECT,
                description: 'Axis-aligned bounding box of the painting in 0-100 frame %.',
                properties: {
                  x: { type: Type.NUMBER },
                  y: { type: Type.NUMBER },
                  width: { type: Type.NUMBER },
                  height: { type: Type.NUMBER },
                },
                required: ['x', 'y', 'width', 'height'],
              },
              focalQuad: {
                type: Type.OBJECT,
                description:
                  'Exact 4 perspective corners of the painting canvas in 0-100 frame percentages.',
                properties: {
                  topLeft: {
                    type: Type.OBJECT,
                    description: 'Top-left corner of the painting surface (x, y in 0-100).',
                    properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } },
                    required: ['x', 'y'],
                  },
                  topRight: {
                    type: Type.OBJECT,
                    description: 'Top-right corner of the painting surface (x, y in 0-100).',
                    properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } },
                    required: ['x', 'y'],
                  },
                  bottomRight: {
                    type: Type.OBJECT,
                    description: 'Bottom-right corner of the painting surface (x, y in 0-100).',
                    properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } },
                    required: ['x', 'y'],
                  },
                  bottomLeft: {
                    type: Type.OBJECT,
                    description: 'Bottom-left corner of the painting surface (x, y in 0-100).',
                    properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } },
                    required: ['x', 'y'],
                  },
                },
                required: ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'],
              },
              hotspots: {
                type: Type.ARRAY,
                description: '3 to 4 AR detail markers inside the painting in 0-100 frame %.',
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
            required: [
              'detected',
              'isWashingtonAnchor',
              'hasHumanSubject',
              'characterName',
              'roleTitle',
              'paintingTitle',
              'artist',
              'year',
              'medium',
              'styleMovement',
              'historicalContext',
              'systemPersona',
              'openingLine',
              'suggestedVoice',
              'box2d',
              'focalPoint',
              'focalBox',
              'focalQuad',
              'hotspots',
              'suggestedQuestions',
            ],
          },
        },
      });

      const rawText = (response.text ?? '{}')
        .trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '');
      const parsed = JSON.parse(rawText);
      res.json(parsed);
    } catch (err) {
      console.error('/api/identify-portrait error:', err);
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

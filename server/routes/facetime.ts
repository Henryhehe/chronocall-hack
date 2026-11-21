import { Router } from "express";
import { formatGeminiError } from "../services/gemini/errors.ts";
import * as geminiFaceTime from "../services/gemini/facetime.ts";
import {
  buildSelfieEraStamp,
  normalizeHistoricalProfile,
  type FaceTimeIdentifyResult,
  type FaceTimePortraitResult,
  type FaceTimeSelfieResult,
  type FaceTimeVideoJobStatus,
  type HistoricalProfile,
} from "../../shared/facetime.ts";

export interface FaceTimeServices {
  resolveHistoricalFigure: typeof geminiFaceTime.resolveHistoricalFigure;
  identifyFigureFromImage: typeof geminiFaceTime.identifyFigureFromImage;
  generateHistoricalPortrait: typeof geminiFaceTime.generateHistoricalPortrait;
  generateChronoSelfie?: typeof geminiFaceTime.generateChronoSelfie;
  startVeoPortraitVideo: typeof geminiFaceTime.startVeoPortraitVideo;
  pollVeoPortraitVideo: typeof geminiFaceTime.pollVeoPortraitVideo;
  getVeoVideoMedia: typeof geminiFaceTime.getVeoVideoMedia;
  respondToFaceTimeText: typeof geminiFaceTime.respondToFaceTimeText;
  evaluateHistoricalTurnDecision: typeof geminiFaceTime.evaluateHistoricalTurnDecision;
}

function createDemoPortraitSvgDataUrl(profile: HistoricalProfile): string {
  const safeName = profile.name.replace(/[<>&"']/g, "");
  const safeEra = profile.era.replace(/[<>&"']/g, "");
  const safeLoc = profile.location.replace(/[<>&"']/g, "");
  const safeInitials = profile.initials.replace(/[<>&"']/g, "");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
    <defs>
      <radialGradient id="bg" cx="50%" cy="35%" r="75%">
        <stop offset="0%" stop-color="${profile.accentColor}" stop-opacity="0.34"/>
        <stop offset="55%" stop-color="${profile.gradientFrom}"/>
        <stop offset="100%" stop-color="${profile.gradientTo}"/>
      </radialGradient>
      <radialGradient id="halo" cx="50%" cy="38%" r="32%">
        <stop offset="0%" stop-color="#FFF7ED" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="#FFF7ED" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="coat" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#27272A"/>
        <stop offset="100%" stop-color="#09090B"/>
      </linearGradient>
    </defs>
    <rect width="1280" height="720" fill="url(#bg)"/>
    <rect width="1280" height="720" fill="url(#halo)"/>
    <circle cx="220" cy="180" r="140" fill="${profile.accentColor}" opacity="0.08"/>
    <circle cx="1060" cy="210" r="190" fill="${profile.accentColor}" opacity="0.07"/>
    <!-- Architectural soft archway -->
    <path d="M 380 720 L 380 280 Q 640 80 900 280 L 900 720 Z" fill="#000000" opacity="0.24"/>
    <!-- Stylized studio silhouette portrait -->
    <ellipse cx="640" cy="645" rx="235" ry="185" fill="url(#coat)" opacity="0.92"/>
    <path d="M 540 500 Q 640 560 740 500 L 765 720 L 515 720 Z" fill="${profile.accentColor}" opacity="0.2"/>
    <rect x="606" y="388" width="68" height="86" rx="30" fill="#D4A373" opacity="0.88"/>
    <ellipse cx="640" cy="285" rx="96" ry="118" fill="#E6BE9A" opacity="0.92"/>
    <path d="M 542 265 Q 555 155 640 155 Q 725 155 738 265 Q 710 212 640 210 Q 570 212 542 265 Z" fill="#1F1917" opacity="0.85"/>
    <!-- Eyes & gentle expression -->
    <ellipse cx="604" cy="274" rx="8" ry="5" fill="#1C1917"/>
    <ellipse cx="676" cy="274" rx="8" ry="5" fill="#1C1917"/>
    <path d="M 616 336 Q 640 350 664 336" fill="none" stroke="#7C4D3A" stroke-width="4" stroke-linecap="round"/>
    <!-- Subtle watermark monogram -->
    <text x="640" y="618" text-anchor="middle" font-family="Georgia, serif" font-size="38" fill="#F8FAFC" opacity="0.24" letter-spacing="8">${safeInitials}</text>
    <text x="640" y="662" text-anchor="middle" font-family="system-ui, sans-serif" font-size="18" fill="#E2E8F0" opacity="0.5">${safeName} · ${safeEra} · ${safeLoc}</text>
  </svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

function createDemoSelfieSvgDataUrl(
  profile: HistoricalProfile,
  eraStamp: string
): string {
  const safeName = profile.name.replace(/[<>&"']/g, "");
  const safeEra = profile.era.replace(/[<>&"']/g, "");
  const safeLoc = profile.location.replace(/[<>&"']/g, "");
  const safeEraStamp = eraStamp.replace(/[<>&"']/g, "");
  const safeInitials = profile.initials.replace(/[<>&"']/g, "");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000">
    <defs>
      <linearGradient id="cardBg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FCFAF2"/>
        <stop offset="100%" stop-color="#F5EFE1"/>
      </linearGradient>
      <radialGradient id="selfieBg" cx="50%" cy="40%" r="75%">
        <stop offset="0%" stop-color="${profile.accentColor}" stop-opacity="0.36"/>
        <stop offset="50%" stop-color="${profile.gradientFrom}"/>
        <stop offset="100%" stop-color="${profile.gradientTo}"/>
      </radialGradient>
      <radialGradient id="warmSun" cx="45%" cy="30%" r="40%">
        <stop offset="0%" stop-color="#FEF3C7" stop-opacity="0.32"/>
        <stop offset="100%" stop-color="#FEF3C7" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="vignette" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#000000" stop-opacity="0.15"/>
        <stop offset="25%" stop-color="#000000" stop-opacity="0"/>
        <stop offset="75%" stop-color="#000000" stop-opacity="0"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.45"/>
      </linearGradient>
      <clipPath id="photoCut">
        <rect x="56" y="56" width="688" height="688" rx="8"/>
      </clipPath>
      <filter id="cardShadow" x="-5%" y="-3%" width="110%" height="110%">
        <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.18"/>
      </filter>
    </defs>

    <!-- Classic Polaroid Postcard Frame -->
    <rect x="16" y="16" width="768" height="968" rx="16" fill="url(#cardBg)" stroke="#E5DECE" stroke-width="2" filter="url(#cardShadow)"/>

    <!-- Inner Photo Area -->
    <g clip-path="url(#photoCut)">
      <rect x="56" y="56" width="688" height="688" fill="url(#selfieBg)"/>
      <rect x="56" y="56" width="688" height="688" fill="url(#warmSun)"/>

      <!-- Ambient Historical Background Elements (Arched Loggia & Window) -->
      <path d="M 120 744 L 120 280 Q 280 140 440 280 L 440 744 Z" fill="#000000" opacity="0.22"/>
      <path d="M 440 744 L 440 280 Q 600 140 760 280 L 760 744 Z" fill="#000000" opacity="0.18"/>
      <circle cx="280" cy="180" r="80" fill="${profile.accentColor}" opacity="0.12"/>

      <!-- Left Person: Historical Figure (e.g. Leonardo, Cleopatra, etc.) -->
      <!-- Body / Period Doublet -->
      <path d="M 110 744 C 110 590 190 510 280 500 C 370 510 410 590 410 744 Z" fill="#18181B" opacity="0.95"/>
      <path d="M 230 500 Q 280 540 330 500 L 345 744 L 215 744 Z" fill="${profile.accentColor}" opacity="0.25"/>
      <!-- Collar / Neck -->
      <rect x="252" y="420" width="56" height="85" rx="20" fill="#D4A373"/>
      <!-- Head / Face -->
      <ellipse cx="280" cy="335" rx="80" ry="102" fill="#E8C39E"/>
      <!-- Historical Hair / Beard silhouette -->
      <path d="M 198 320 Q 210 200 280 200 Q 350 200 362 320 Q 340 250 280 250 Q 220 250 198 320 Z" fill="#292524" opacity="0.92"/>
      <!-- Eyes & Warm Expression -->
      <ellipse cx="252" cy="325" rx="7" ry="5" fill="#1C1917"/>
      <ellipse cx="308" cy="325" rx="7" ry="5" fill="#1C1917"/>
      <path d="M 262 378 Q 280 392 298 378" fill="none" stroke="#7C4D3A" stroke-width="3.5" stroke-linecap="round"/>
      <!-- Subtle Monogram badge on chest -->
      <text x="280" y="620" text-anchor="middle" font-family="Georgia, serif" font-size="24" fill="#F8FAFC" opacity="0.32" letter-spacing="4">${safeInitials}</text>

      <!-- Right Person: Modern Caller in Authentic Period Attire Taking the Selfie -->
      <!-- Companion Arm stretched toward bottom-right camera corner -->
      <path d="M 520 620 Q 640 680 720 744 L 640 744 Q 580 670 480 620 Z" fill="#27272A" opacity="0.9"/>
      <!-- Companion Body -->
      <path d="M 390 744 C 390 600 460 520 540 510 C 620 520 690 600 710 744 Z" fill="#27272A" opacity="0.92"/>
      <path d="M 495 510 Q 540 550 585 510 L 600 744 L 480 744 Z" fill="${profile.accentColor}" opacity="0.18"/>
      <!-- Neck -->
      <rect x="515" y="425" width="50" height="85" rx="18" fill="#E2B18A"/>
      <!-- Head / Face leaning in warmly -->
      <ellipse cx="540" cy="342" rx="74" ry="96" fill="#ECCBB0"/>
      <!-- Hair -->
      <path d="M 466 330 Q 480 215 540 215 Q 600 215 614 330 Q 585 260 540 260 Q 495 260 466 330 Z" fill="#3E2723" opacity="0.9"/>
      <!-- Eyes & Smile -->
      <ellipse cx="514" cy="332" rx="6" ry="4.5" fill="#1C1917"/>
      <ellipse cx="566" cy="332" rx="6" ry="4.5" fill="#1C1917"/>
      <path d="M 522 384 Q 540 400 558 384" fill="none" stroke="#8D4F38" stroke-width="3.5" stroke-linecap="round"/>

      <!-- Camera Lens Vignette -->
      <rect x="56" y="56" width="688" height="688" fill="url(#vignette)"/>

      <!-- Top Badge: CHRONO-SELFIE -->
      <rect x="76" y="76" width="180" height="32" rx="16" fill="#000000" opacity="0.42"/>
      <text x="166" y="97" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#FEF3C7" letter-spacing="2">✦ CHRONO-SELFIE ✦</text>
    </g>

    <!-- Polaroid Bottom Chin (Captions & Stamps) -->
    <!-- Handwritten / Serif Main Caption -->
    <text x="64" y="802" font-family="Georgia, 'Times New Roman', serif" font-size="30" font-weight="700" font-style="italic" fill="#1C1917">With ${safeName}</text>
    <text x="64" y="836" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="500" fill="#57534E">${safeLoc} · Side-by-Side Across History</text>

    <!-- Vintage Red/Amber Era Stamp (Top right of chin) -->
    <rect x="532" y="774" width="204" height="34" rx="8" fill="#FEE2E2" stroke="#FCA5A5" stroke-width="1.5"/>
    <text x="634" y="796" text-anchor="middle" font-family="'Courier New', Courier, monospace" font-size="15" font-weight="800" fill="#B91C1C" letter-spacing="1.5">${safeEraStamp}</text>

    <!-- Postal Certification Footer -->
    <line x1="64" y1="864" x2="728" y2="864" stroke="#E7DFD2" stroke-width="1.5"/>

    <text x="64" y="896" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="600" fill="#78716C" letter-spacing="1.2">CHRONOCALL PHOTO TOGETHER · CERTIFIED TEMPORAL ENCOUNTER</text>
    <text x="64" y="918" font-family="'Courier New', monospace" font-size="11" fill="#A8A29E">LATENCY 0MS · DEMO MODE EMBED · PRESERVED IN TIME</text>

    <!-- Circular Vintage Postmark Seal -->
    <g transform="translate(680, 902)">
      <circle cx="0" cy="0" r="28" fill="none" stroke="#D97706" stroke-width="2" stroke-dasharray="4,2.5" opacity="0.75"/>
      <circle cx="0" cy="0" r="23" fill="none" stroke="#D97706" stroke-width="1" opacity="0.45"/>
      <text x="0" y="-7" text-anchor="middle" font-family="'Courier New', monospace" font-size="7.5" font-weight="800" fill="#B45309" letter-spacing="1">CHRONO</text>
      <text x="0" y="4" text-anchor="middle" font-family="'Courier New', monospace" font-size="7.5" font-weight="800" fill="#B45309" letter-spacing="1">POST</text>
      <text x="0" y="14" text-anchor="middle" font-family="'Courier New', monospace" font-size="7" font-weight="700" fill="#B45309">✦ ✦ ✦</text>
    </g>
  </svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

function buildDemoReply(profile: HistoricalProfile, message: string): string {
  const cleanMsg = message.trim();
  if (/camera|holding|look|see|show/i.test(cleanMsg)) {
    return `Through this miraculous looking-glass I can glimpse your modern chamber—though in local demo mode my live eyes are resting. Add a Gemini API key and I shall inspect every detail you hold before me as ${profile.name}!`;
  }
  if (/who are you|introduce|tell me about/i.test(cleanMsg)) {
    return `I am ${profile.name}, speaking to you across the centuries from ${profile.location} (${profile.era}). ${profile.bio}`;
  }
  return `What a curious question from your modern century: "${cleanMsg.slice(0, 90)}". Speaking from ${profile.location} in ${profile.era}, I find myself amazed that we can converse face-to-face like this—connect a Gemini API key to hear my full live voice!`;
}

export function createFaceTimeRouter(
  demoMode = false,
  services: FaceTimeServices = geminiFaceTime
) {
  const router = Router();

  router.post("/api/facetime/resolve", async (req, res) => {
    try {
      const query = typeof req.body?.query === "string" ? req.body.query.trim() : "";
      if (!query) {
        res.status(400).json({ error: "query (historical figure name) is required." });
        return;
      }

      if (demoMode) {
        const profile = normalizeHistoricalProfile(
          {
            name: query,
            title: "Historical Figure (Demo Mode)",
            era: "Across History",
            location: "Historic Study",
            bio: `Local demo profile for ${query}. Configure GEMINI_API_KEY in .env.local for live historical grounding, photorealistic portraits, and real-time voice.`,
            openingLine: `Greetings! I am ${query}. You are calling in local demo mode—configure a Gemini API key to converse with me in full live voice and AI video!`,
          },
          "search"
        );
        res.json({ profile, demoMode: true });
        return;
      }

      const profile = await services.resolveHistoricalFigure({ query });
      res.json({ profile, demoMode: false });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  router.post("/api/facetime/identify", async (req, res) => {
    try {
      const imageBase64 =
        typeof req.body?.imageBase64 === "string" ? req.body.imageBase64.trim() : "";
      const mimeType =
        typeof req.body?.mimeType === "string" ? req.body.mimeType : "image/jpeg";

      if (!imageBase64) {
        res.status(400).json({ error: "imageBase64 is required to scan a painting or statue." });
        return;
      }

      if (demoMode) {
        const dataUrl = imageBase64.startsWith("data:")
          ? imageBase64
          : `data:${mimeType};base64,${imageBase64}`;
        const demoProfile = normalizeHistoricalProfile(
          {
            id: "demo-scanned-washington",
            name: "George Washington",
            title: "Commander-in-Chief & 1st U.S. President",
            era: "1777 · Continental Army",
            location: "Valley Forge Command Tent",
            bio: "Demo scan result. In live mode, Gemini Vision identifies any painting, photograph, or sculpture you frame with your camera.",
            openingLine:
              "Good day, citizen! You scanned a portrait in demo mode—configure a Gemini API key to recognize any painting or statue live and speak with me directly.",
            voiceName: "Charon",
            artworkTitle: "Scanned Historical Portrait (Demo)",
            artist: "Demo Vision Fixture",
            previewImageUrl: dataUrl,
            scannedImageDataUrl: dataUrl,
          },
          "scanned"
        );
        const result: FaceTimeIdentifyResult = {
          detected: true,
          confidence: 0.94,
          artworkType: "painting",
          artworkTitle: "Scanned Historical Portrait (Demo)",
          artist: "Demo Vision Fixture",
          year: "1777",
          profile: demoProfile,
          demoMode: true,
        };
        res.json(result);
        return;
      }

      const result = await services.identifyFigureFromImage({
        imageBase64,
        mimeType,
      });
      res.json(result);
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  router.post("/api/facetime/portrait", async (req, res) => {
    try {
      const rawProfile = req.body?.profile;
      if (!rawProfile || typeof rawProfile?.name !== "string" || !rawProfile.name.trim()) {
        res.status(400).json({ error: "profile with a valid name is required." });
        return;
      }
      const profile = normalizeHistoricalProfile(rawProfile, rawProfile.sourceType ?? "search");
      const referenceImageBase64 =
        typeof req.body?.referenceImageBase64 === "string"
          ? req.body.referenceImageBase64
          : undefined;
      const referenceMimeType =
        typeof req.body?.referenceMimeType === "string"
          ? req.body.referenceMimeType
          : "image/jpeg";

      if (demoMode) {
        const imageDataUrl =
          referenceImageBase64
            ? referenceImageBase64.startsWith("data:")
              ? referenceImageBase64
              : `data:${referenceMimeType};base64,${referenceImageBase64}`
            : profile.previewImageUrl || createDemoPortraitSvgDataUrl(profile);
        const result: FaceTimePortraitResult = {
          imageDataUrl,
          mimeType: imageDataUrl.startsWith("data:image/svg+xml")
            ? "image/svg+xml"
            : referenceMimeType,
          model: "demo",
          latencyMs: 0,
          demoMode: true,
        };
        res.json(result);
        return;
      }

      const result = await services.generateHistoricalPortrait({
        profile,
        referenceImageBase64,
        referenceMimeType,
      });
      res.json(result);
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  router.post("/api/facetime/selfie", async (req, res) => {
    try {
      const rawProfile = req.body?.profile;
      if (!rawProfile || typeof rawProfile?.name !== "string" || !rawProfile.name.trim()) {
        res.status(400).json({ error: "profile with a valid name is required." });
        return;
      }
      const profile = normalizeHistoricalProfile(rawProfile, rawProfile.sourceType ?? "search");
      const callerImageBase64 =
        typeof req.body?.callerImageBase64 === "string"
          ? req.body.callerImageBase64
          : undefined;
      const callerMimeType =
        typeof req.body?.callerMimeType === "string"
          ? req.body.callerMimeType
          : "image/jpeg";
      const figureImageBase64 =
        typeof req.body?.figureImageBase64 === "string"
          ? req.body.figureImageBase64
          : undefined;
      const figureMimeType =
        typeof req.body?.figureMimeType === "string"
          ? req.body.figureMimeType
          : "image/jpeg";

      if (demoMode) {
        const eraStamp = buildSelfieEraStamp(profile);
        const imageDataUrl = createDemoSelfieSvgDataUrl(profile, eraStamp);
        const result: FaceTimeSelfieResult = {
          imageDataUrl,
          mimeType: "image/svg+xml",
          caption: `Time-travel selfie with ${profile.name}`,
          eraStamp,
          model: "demo",
          latencyMs: 0,
          demoMode: true,
        };
        res.json(result);
        return;
      }

      const generateFn =
        services.generateChronoSelfie ?? geminiFaceTime.generateChronoSelfie;
      const result = await generateFn({
        profile,
        callerImageBase64,
        callerMimeType,
        figureImageBase64,
        figureMimeType,
      });
      res.json(result);
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  router.post("/api/facetime/video", async (req, res) => {
    try {
      if (demoMode) {
        res.status(503).json({
          error:
            "Full-motion AI video (Veo) requires a Gemini API key; using live animated portrait in demo mode.",
        });
        return;
      }
      const rawProfile = req.body?.profile;
      const portraitDataUrl =
        typeof req.body?.portraitDataUrl === "string"
          ? req.body.portraitDataUrl.trim()
          : "";
      const mode: "listening" | "speaking" =
        req.body?.mode === "speaking" ? "speaking" : "listening";

      if (!rawProfile || typeof rawProfile?.name !== "string" || !portraitDataUrl) {
        res.status(400).json({
          error: "profile and portraitDataUrl are required to render full-motion video.",
        });
        return;
      }

      const profile = normalizeHistoricalProfile(rawProfile, rawProfile.sourceType ?? "search");
      const status: FaceTimeVideoJobStatus = await services.startVeoPortraitVideo({
        profile,
        portraitDataUrl,
        mode,
      });
      res.json(status);
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  router.get("/api/facetime/video/:jobId", async (req, res) => {
    try {
      if (demoMode) {
        res.status(503).json({ error: "Veo video jobs are unavailable in demo mode." });
        return;
      }
      const status = await services.pollVeoPortraitVideo(req.params.jobId);
      if (!status) {
        res.status(404).json({ error: "Video job not found or expired." });
        return;
      }
      res.json(status);
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  router.get("/api/facetime/video/:jobId/media", async (req, res) => {
    try {
      const media = await services.getVeoVideoMedia(req.params.jobId);
      if (!media) {
        res.status(404).json({ error: "Video media is not ready or has expired." });
        return;
      }
      res.setHeader("Content-Type", media.mimeType);
      res.setHeader("Content-Length", String(media.buffer.length));
      res.setHeader("Cache-Control", "private, max-age=600");
      res.send(media.buffer);
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  router.post("/api/facetime/respond", async (req, res) => {
    try {
      const rawProfile = req.body?.profile;
      const message =
        typeof req.body?.message === "string" ? req.body.message.trim() : "";
      const history = Array.isArray(req.body?.history) ? req.body.history : [];

      if (!rawProfile || typeof rawProfile?.name !== "string" || !message) {
        res.status(400).json({ error: "profile and message are required." });
        return;
      }
      const profile = normalizeHistoricalProfile(rawProfile, rawProfile.sourceType ?? "search");

      if (demoMode) {
        res.json({
          reply: buildDemoReply(profile, message),
          latencyMs: 0,
          model: "demo",
          demoMode: true,
        });
        return;
      }

      const result = await services.respondToFaceTimeText({
        profile,
        message,
        history,
      });
      res.json({ ...result, demoMode: false });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  router.post("/api/facetime/decision", async (req, res) => {
    try {
      const rawProfile = req.body?.profile;
      const utterance =
        typeof req.body?.utterance === "string" ? req.body.utterance.trim() : "";
      const userPrompt =
        typeof req.body?.userPrompt === "string" ? req.body.userPrompt.trim() : undefined;

      if (!rawProfile || typeof rawProfile?.name !== "string" || !utterance) {
        res.status(400).json({ error: "profile and utterance are required." });
        return;
      }
      const profile = normalizeHistoricalProfile(rawProfile, rawProfile.sourceType ?? "search");

      if (demoMode) {
        res.json({
          verdict: "verified",
          confidence: 0.94,
          probabilities: {
            verified: 0.94,
            plausible_persona: 0.05,
            anachronism: 0.01,
          },
          eraFidelityScore: 4,
          eraFidelityMax: 4,
          suggestedCue: "warm_nod",
          summary: `Grounded in ${profile.era} context (local demo fixture)`,
          model: "gemini-decision-1",
          latencyMs: 142,
          demoMode: true,
        });
        return;
      }

      const result = await services.evaluateHistoricalTurnDecision({
        profile,
        utterance,
        userPrompt,
      });
      res.json({ ...result, demoMode: false });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  return router;
}

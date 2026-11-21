import { Router } from "express";
import { formatGeminiError } from "../services/gemini/errors.ts";
import * as geminiFaceTime from "../services/gemini/facetime.ts";
import {
  normalizeHistoricalProfile,
  type FaceTimeArtifactResult,
  type FaceTimeIdentifyResult,
  type FaceTimePortraitResult,
  type FaceTimeVideoJobStatus,
  type HistoricalProfile,
} from "../../shared/facetime.ts";

export interface FaceTimeServices {
  resolveHistoricalFigure: typeof geminiFaceTime.resolveHistoricalFigure;
  identifyFigureFromImage: typeof geminiFaceTime.identifyFigureFromImage;
  generateHistoricalPortrait: typeof geminiFaceTime.generateHistoricalPortrait;
  generateHistoricalArtifact: typeof geminiFaceTime.generateHistoricalArtifact;
  startVeoPortraitVideo: typeof geminiFaceTime.startVeoPortraitVideo;
  pollVeoPortraitVideo: typeof geminiFaceTime.pollVeoPortraitVideo;
  getVeoVideoMedia: typeof geminiFaceTime.getVeoVideoMedia;
  respondToFaceTimeText: typeof geminiFaceTime.respondToFaceTimeText;
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

function createDemoArtifactSvgDataUrl(
  profile: HistoricalProfile,
  title: string,
  description: string
): string {
  const safeName = profile.name.replace(/[<>&"']/g, "");
  const safeEra = profile.era.replace(/[<>&"']/g, "");
  const safeLoc = profile.location.replace(/[<>&"']/g, "");
  const safeTitle = title.replace(/[<>&"']/g, "");
  const safeDesc = description.replace(/[<>&"']/g, "");
  const safeInitials = profile.initials.replace(/[<>&"']/g, "");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
    <defs>
      <linearGradient id="parchment" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FBF7EE"/>
        <stop offset="50%" stop-color="#F3EAD4"/>
        <stop offset="100%" stop-color="#E5D6BA"/>
      </linearGradient>
      <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
        <stop offset="60%" stop-color="#000000" stop-opacity="0"/>
        <stop offset="100%" stop-color="#4A3419" stop-opacity="0.22"/>
      </radialGradient>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#C4B08F" stroke-width="0.5" stroke-opacity="0.35"/>
      </pattern>
    </defs>
    <!-- Aged parchment background -->
    <rect width="800" height="600" fill="url(#parchment)"/>
    <rect width="800" height="600" fill="url(#grid)"/>
    <rect width="800" height="600" fill="url(#vignette)"/>

    <!-- Archival borders -->
    <rect x="24" y="24" width="752" height="552" fill="none" stroke="#8C6D46" stroke-width="2" stroke-opacity="0.85"/>
    <rect x="30" y="30" width="740" height="540" fill="none" stroke="#A68962" stroke-width="1" stroke-dasharray="4,3" stroke-opacity="0.6"/>

    <!-- Corner ornaments -->
    <path d="M 24 48 L 48 48 L 48 24" fill="none" stroke="#8C6D46" stroke-width="2"/>
    <path d="M 776 48 L 752 48 L 752 24" fill="none" stroke="#8C6D46" stroke-width="2"/>
    <path d="M 24 552 L 48 552 L 48 576" fill="none" stroke="#8C6D46" stroke-width="2"/>
    <path d="M 776 552 L 752 552 L 752 576" fill="none" stroke="#8C6D46" stroke-width="2"/>

    <!-- Architectural compass / geometric study -->
    <g transform="translate(400, 245)" stroke="#6B4C28" stroke-width="1.5" fill="none" opacity="0.85">
      <circle cx="0" cy="0" r="110" stroke-dasharray="3,3" opacity="0.6"/>
      <circle cx="0" cy="0" r="85"/>
      <circle cx="0" cy="0" r="50"/>
      <!-- Compass arms & diagonals -->
      <line x1="-130" y1="0" x2="130" y2="0" stroke-dasharray="2,2" opacity="0.5"/>
      <line x1="0" y1="-130" x2="0" y2="130" stroke-dasharray="2,2" opacity="0.5"/>
      <polygon points="0,-85 24,0 0,85 -24,0" fill="#8C6D46" fill-opacity="0.12"/>
      <polygon points="-85,0 0,24 85,0 0,-24" fill="#8C6D46" fill-opacity="0.12"/>
      <circle cx="0" cy="0" r="8" fill="#6B4C28"/>
      <!-- Stylized quill gears / arcs -->
      <path d="M -60 -30 Q 0 -70 60 -30" stroke="#7C4D3A" stroke-width="2"/>
      <path d="M -60 30 Q 0 70 60 30" stroke="#7C4D3A" stroke-width="2"/>
      <path d="M -80 -70 L -40 -35 L -100 -20" stroke="#8C6D46" stroke-width="1.2" opacity="0.7"/>
      <path d="M 80 -70 L 40 -35 L 100 -20" stroke="#8C6D46" stroke-width="1.2" opacity="0.7"/>
    </g>

    <!-- Header badge -->
    <text x="400" y="65" text-anchor="middle" font-family="Georgia, serif" font-size="12" font-weight="bold" fill="#7C5835" letter-spacing="4" text-transform="uppercase">CHRONOCALL ARCHIVAL KEEPSAKE</text>
    <line x1="260" y1="74" x2="540" y2="74" stroke="#8C6D46" stroke-width="1" opacity="0.6"/>

    <!-- Title & provenance -->
    <text x="400" y="105" text-anchor="middle" font-family="Georgia, serif" font-size="24" font-weight="bold" fill="#2E1F11">${safeTitle}</text>
    <text x="400" y="128" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="14" fill="#634B30">From the hand of ${safeName} · ${safeEra}</text>

    <!-- Description plaque -->
    <rect x="70" y="380" width="660" height="90" rx="6" fill="#F0E3CA" fill-opacity="0.75" stroke="#BF9F74" stroke-width="1"/>
    <text x="400" y="415" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#3D2916" font-style="italic">"${safeDesc.length > 85 ? safeDesc.slice(0, 82) + '…' : safeDesc}"</text>
    <text x="400" y="445" text-anchor="middle" font-family="system-ui, sans-serif" font-size="12" fill="#78593A" letter-spacing="0.5">Recorded live during FaceTime call · Origin: ${safeLoc}</text>

    <!-- Archival wax seal monogram -->
    <g transform="translate(685, 505)">
      <circle cx="0" cy="0" r="32" fill="#8B1E1E" stroke="#5E1212" stroke-width="2"/>
      <circle cx="0" cy="0" r="28" fill="none" stroke="#D4AF37" stroke-width="1" stroke-dasharray="2,2"/>
      <text x="0" y="7" text-anchor="middle" font-family="Georgia, serif" font-size="16" font-weight="bold" fill="#F8E5B8">${safeInitials}</text>
    </g>

    <!-- Footer provenance note -->
    <text x="70" y="525" font-family="Georgia, serif" font-size="13" font-style="italic" fill="#5A432D">Verified Historical Study · Chronocall Show &amp; Tell</text>
    <text x="70" y="545" font-family="system-ui, sans-serif" font-size="11" fill="#8C6D46">Drawn with authentic period pigments &amp; geometry in local demo mode.</text>
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

  router.post("/api/facetime/artifact", async (req, res) => {
    try {
      const rawProfile = req.body?.profile;
      const title =
        typeof req.body?.title === "string" ? req.body.title.trim() : "";
      const description =
        typeof req.body?.description === "string"
          ? req.body.description.trim()
          : "";
      const stylePrompt =
        typeof req.body?.stylePrompt === "string"
          ? req.body.stylePrompt.trim()
          : undefined;

      if (
        !rawProfile ||
        typeof rawProfile?.name !== "string" ||
        !rawProfile.name.trim() ||
        !title ||
        !description
      ) {
        res.status(400).json({
          error:
            "profile (with valid name), title, and description are required to sketch an artifact.",
        });
        return;
      }

      const profile = normalizeHistoricalProfile(
        rawProfile,
        rawProfile.sourceType ?? "search"
      );

      if (demoMode) {
        const imageDataUrl = createDemoArtifactSvgDataUrl(
          profile,
          title,
          description
        );
        const result: FaceTimeArtifactResult = {
          title,
          description,
          imageDataUrl,
          mimeType: "image/svg+xml",
          model: "demo",
          latencyMs: 0,
          demoMode: true,
        };
        res.json(result);
        return;
      }

      const result = await services.generateHistoricalArtifact({
        profile,
        title,
        description,
        stylePrompt,
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

  return router;
}

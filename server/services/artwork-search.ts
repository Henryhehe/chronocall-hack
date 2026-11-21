import { ThinkingLevel, Type } from "@google/genai";
import { getGeminiClient } from "./gemini/client.ts";
import { VISION_MODEL } from "../../shared/models.ts";
import {
  classifyArtworkMedium,
  rankArtworkCandidates,
  type OnlineArtworkCandidate,
  type OnlineArtworkMedium,
} from "../../shared/facetime.ts";

const ALLOWED_IMAGE_HOSTS = new Set([
  "upload.wikimedia.org",
  "commons.wikimedia.org",
  "images.metmuseum.org",
  "www.artic.edu",
]);

const USER_AGENT =
  "ChronocallHackathon/1.0 (https://github.com/Henryhehe/chronocall-hack)";

function stripHtml(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function fetchWithTimeout(
  url: string,
  timeoutMs = 5500,
  headers: Record<string, string> = {}
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, {
    signal: controller.signal,
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json, image/*;q=0.9",
      ...headers,
    },
  }).finally(() => clearTimeout(timer));
}

async function searchWikimediaCommons(
  searchTerm: string,
  limit = 10
): Promise<OnlineArtworkCandidate[]> {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("gsrlimit", String(limit));
  url.searchParams.set("gsrsearch", searchTerm);
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|extmetadata|mime");
  url.searchParams.set("iiurlwidth", "960");

  try {
    const res = await fetchWithTimeout(url.toString(), 5000);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      query?: {
        pages?: Record<
          string,
          {
            pageid: number;
            title?: string;
            imageinfo?: Array<{
              url?: string;
              thumburl?: string;
              descriptionurl?: string;
              mime?: string;
              extmetadata?: Record<string, { value?: string }>;
            }>;
          }
        >;
      };
    };

    const pages = Object.values(data.query?.pages ?? {});
    const results: OnlineArtworkCandidate[] = [];

    for (const page of pages) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      const mime = (info.mime ?? "").toLowerCase();
      if (!mime.startsWith("image/") || mime.includes("svg") || mime.includes("tiff")) {
        continue;
      }

      const imageUrl = info.thumburl || info.url;
      if (!imageUrl || !imageUrl.startsWith("https://")) continue;

      const meta = info.extmetadata ?? {};
      const rawTitle =
        stripHtml(meta.ObjectName?.value ?? "") ||
        stripHtml((page.title ?? "").replace(/^File:/i, "").replace(/\.[^.]+$/, "").replace(/_/g, " "));
      const artist = stripHtml(meta.Artist?.value ?? "") || "Historical Artist";
      const year =
        stripHtml(meta.DateTimeOriginal?.value ?? "").slice(0, 32) ||
        stripHtml(meta.DateTime?.value ?? "").slice(0, 4) ||
        "Historic";
      const desc = stripHtml(meta.ImageDescription?.value ?? "");
      const credit = stripHtml(meta.Credit?.value ?? meta.Institution?.value ?? "");

      const medium = classifyArtworkMedium(`${rawTitle} ${desc} ${searchTerm}`);

      results.push({
        id: `wm-${page.pageid}`,
        title: rawTitle.slice(0, 110) || "Historical Portrait",
        artist: artist.slice(0, 80),
        year: year || "Historic",
        medium,
        museum: credit.slice(0, 70) || "Wikimedia Commons",
        thumbnailUrl: imageUrl,
        imageUrl,
        pageUrl: info.descriptionurl || imageUrl,
      });
    }

    return results;
  } catch {
    return [];
  }
}

async function searchMetMuseum(
  query: string,
  limit = 6
): Promise<OnlineArtworkCandidate[]> {
  try {
    const searchUrl = `https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=${encodeURIComponent(
      query
    )}`;
    const res = await fetchWithTimeout(searchUrl, 4500);
    if (!res.ok) return [];
    const data = (await res.json()) as { objectIDs?: number[] | null };
    const ids = (data.objectIDs ?? []).slice(0, limit);
    if (ids.length === 0) return [];

    const items = await Promise.all(
      ids.map(async (objectId): Promise<OnlineArtworkCandidate | null> => {
        try {
          const objRes = await fetchWithTimeout(
            `https://collectionapi.metmuseum.org/public/collection/v1/objects/${objectId}`,
            3500
          );
          if (!objRes.ok) return null;
          const obj = (await objRes.json()) as {
            objectID?: number;
            title?: string;
            artistDisplayName?: string;
            objectDate?: string;
            medium?: string;
            classification?: string;
            primaryImageSmall?: string;
            primaryImage?: string;
            objectURL?: string;
          };
          const thumb = obj.primaryImageSmall || obj.primaryImage;
          if (!thumb || !thumb.startsWith("https://")) return null;

          const medium = classifyArtworkMedium(
            `${obj.classification ?? ""} ${obj.medium ?? ""} ${obj.title ?? ""}`
          );
          return {
            id: `met-${obj.objectID ?? objectId}`,
            title: (obj.title || "Met Collection Artwork").slice(0, 110),
            artist: (obj.artistDisplayName || "Historical Artist").slice(0, 80),
            year: (obj.objectDate || "Historic").slice(0, 32),
            medium,
            museum: "The Metropolitan Museum of Art",
            thumbnailUrl: thumb,
            imageUrl: thumb,
            pageUrl: obj.objectURL || thumb,
          };
        } catch {
          return null;
        }
      })
    );

    return items.filter((item): item is OnlineArtworkCandidate => item !== null);
  } catch {
    return [];
  }
}

async function pickMostFamousWithGemini(
  query: string,
  candidates: OnlineArtworkCandidate[]
): Promise<{ selectedId: string; whyFamous: string } | null> {
  if (candidates.length === 0) return null;
  try {
    const ai = getGeminiClient();
    const listText = candidates
      .slice(0, 10)
      .map(
        (c, i) =>
          `${i + 1}. id="${c.id}" | title="${c.title}" | artist="${c.artist}" | year="${c.year}" | medium=${c.medium} | museum="${c.museum}"`
      )
      .join("\n");

    const response = await ai.models.generateContent({
      model: VISION_MODEL,
      contents: `A user wants to FaceTime the historical figure "${query}" brought to life from their single most iconic, recognizable painting, portrait, or statue.
Choose the BEST candidate id from this list (must clearly depict ${query}'s face/likeness as a famous painting, portrait, or sculpture — avoid signatures, maps, coins, or unrelated scenes):
${listText}
Return the winning selectedId and a brief 1-sentence whyFamous description.`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            selectedId: { type: Type.STRING },
            whyFamous: { type: Type.STRING },
          },
          required: ["selectedId", "whyFamous"],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? "{}").trim()) as {
      selectedId?: string;
      whyFamous?: string;
    };
    if (
      parsed.selectedId &&
      candidates.some((c) => c.id === parsed.selectedId)
    ) {
      return {
        selectedId: parsed.selectedId,
        whyFamous:
          parsed.whyFamous?.trim() ||
          `Most iconic historical depiction of ${query}`,
      };
    }
  } catch {
    // Fall back gracefully to deterministic ranking
  }
  return null;
}

export async function searchOnlineArtworksForFigure(params: {
  query: string;
  mediumFilter?: "all" | "painting" | "sculpture";
  useGeminiRanking?: boolean;
}): Promise<{
  selectedArtwork: OnlineArtworkCandidate | null;
  alternatives: OnlineArtworkCandidate[];
}> {
  const query = params.query.trim();
  const mediumFilter = params.mediumFilter ?? "all";

  const [wmPortraits, wmSculptures, metResults] = await Promise.all([
    searchWikimediaCommons(`${query} portrait painting`, 8),
    searchWikimediaCommons(`${query} bust statue sculpture`, 6),
    searchMetMuseum(query, 5),
  ]);

  // Deduplicate by normalized URL / title
  const seen = new Set<string>();
  const merged: OnlineArtworkCandidate[] = [];
  for (const item of [...metResults, ...wmPortraits, ...wmSculptures]) {
    const key = `${item.imageUrl.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (
      mediumFilter === "painting" &&
      item.medium !== "painting" &&
      item.medium !== "portrait"
    ) {
      continue;
    }
    if (mediumFilter === "sculpture" && item.medium !== "sculpture") {
      continue;
    }
    merged.push(item);
  }

  const ranked = rankArtworkCandidates(query, merged).slice(0, 8);
  if (ranked.length === 0) {
    return { selectedArtwork: null, alternatives: [] };
  }

  let selectedIndex = 0;
  let whyFamous = `Auto-selected iconic ${ranked[0].medium} of ${query}`;

  if (params.useGeminiRanking !== false && ranked.length > 1) {
    const aiPick = await pickMostFamousWithGemini(query, ranked);
    if (aiPick) {
      const idx = ranked.findIndex((c) => c.id === aiPick.selectedId);
      if (idx >= 0) {
        selectedIndex = idx;
        whyFamous = aiPick.whyFamous;
      }
    }
  }

  const selectedArtwork: OnlineArtworkCandidate = {
    ...ranked[selectedIndex],
    isMostFamous: true,
    whyFamous,
  };
  const alternatives = ranked.filter((_, i) => i !== selectedIndex);

  return { selectedArtwork, alternatives };
}

export function isAllowedArtworkUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") return false;
    return ALLOWED_IMAGE_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export async function fetchAllowedArtworkImage(
  rawUrl: string
): Promise<{ buffer: Buffer; mimeType: string; dataUrl: string }> {
  if (!isAllowedArtworkUrl(rawUrl)) {
    throw new Error(
      "Artwork URL must be an HTTPS image from Wikimedia Commons, The Met, or Art Institute of Chicago."
    );
  }

  const res = await fetchWithTimeout(rawUrl, 8000);
  if (!res.ok) {
    throw new Error(`Could not download artwork image (HTTP ${res.status}).`);
  }

  const contentType = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0].trim();
  if (!contentType.startsWith("image/")) {
    throw new Error("Remote artwork URL did not return an image.");
  }

  const arr = await res.arrayBuffer();
  if (arr.byteLength === 0 || arr.byteLength > 8 * 1024 * 1024) {
    throw new Error("Artwork image size is empty or exceeds the 8MB limit.");
  }

  const buffer = Buffer.from(arr);
  const dataUrl = `data:${contentType};base64,${buffer.toString("base64")}`;
  return { buffer, mimeType: contentType, dataUrl };
}

export function buildDemoArtworkSearch(
  query: string,
  mediumFilter: "all" | "painting" | "sculpture" = "all"
): {
  selectedArtwork: OnlineArtworkCandidate;
  alternatives: OnlineArtworkCandidate[];
} {
  const safeQuery = query.trim() || "George Washington";
  const makeCard = (
    id: string,
    title: string,
    artist: string,
    year: string,
    medium: OnlineArtworkMedium,
    museum: string,
    accent: string,
    isMostFamous = false,
    useWashingtonAsset = false
  ): OnlineArtworkCandidate => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1E1B18"/>
          <stop offset="50%" stop-color="${accent}"/>
          <stop offset="100%" stop-color="#0C0A09"/>
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#g)"/>
      <rect x="44" y="44" width="712" height="512" rx="18" fill="none" stroke="#FDE68A" stroke-opacity="0.45" stroke-width="3"/>
      <ellipse cx="400" cy="245" rx="78" ry="96" fill="#E7C8A6" opacity="0.9"/>
      <ellipse cx="400" cy="495" rx="165" ry="125" fill="#1C1917" opacity="0.9"/>
      <text x="400" y="510" text-anchor="middle" font-family="Georgia, serif" font-size="26" fill="#FEF3C7">${title.replace(/[<>&"']/g, "")}</text>
      <text x="400" y="542" text-anchor="middle" font-family="system-ui, sans-serif" font-size="15" fill="#D6D3D1">${artist.replace(/[<>&"']/g, "")} · ${year.replace(/[<>&"']/g, "")}</text>
    </svg>`;
    const imgUrl = useWashingtonAsset
      ? "/assets/aistudio/washington_fd94f6dd.jpeg"
      : `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
    return {
      id,
      title,
      artist,
      year,
      medium,
      museum,
      thumbnailUrl: imgUrl,
      imageUrl: imgUrl,
      pageUrl: "https://commons.wikimedia.org",
      isMostFamous,
      whyFamous: isMostFamous
        ? `Most iconic ${medium} depicting ${safeQuery} (local demo fixture)`
        : undefined,
    };
  };

  const isWashington = /washington/i.test(safeQuery);
  const all: OnlineArtworkCandidate[] = [
    makeCard(
      "demo-art-1",
      isWashington
        ? "Washington at the Battle of Princeton"
        : `Iconic Portrait of ${safeQuery}`,
      isWashington ? "Charles Willson Peale" : "Master Historical Atelier",
      isWashington ? "1779" : "Classic Period",
      "painting",
      "National Portrait Gallery (Demo)",
      "#78350F",
      true,
      isWashington
    ),
    makeCard(
      "demo-art-2",
      `Marble Bust of ${safeQuery}`,
      "Classical Sculptor",
      "Historic Marble",
      "sculpture",
      "The Metropolitan Museum of Art (Demo)",
      "#334155"
    ),
    makeCard(
      "demo-art-3",
      `${safeQuery} in Their Study`,
      "Academy School",
      "Archival Oil",
      "painting",
      "Wikimedia Commons (Demo)",
      "#1E3A5F"
    ),
    makeCard(
      "demo-art-4",
      `Bronze Monument of ${safeQuery}`,
      "Civic Foundry",
      "Monumental Bronze",
      "sculpture",
      "Public Monument Archive (Demo)",
      "#3F3F46"
    ),
  ];

  const filtered =
    mediumFilter === "painting"
      ? all.filter((a) => a.medium === "painting" || a.medium === "portrait")
      : mediumFilter === "sculpture"
        ? all.filter((a) => a.medium === "sculpture")
        : all;

  const list = filtered.length > 0 ? filtered : all;
  const [first, ...rest] = list;
  return {
    selectedArtwork: {
      ...first,
      isMostFamous: true,
      whyFamous:
        first.whyFamous || `Most iconic ${first.medium} of ${safeQuery} (demo fixture)`,
    },
    alternatives: rest,
  };
}

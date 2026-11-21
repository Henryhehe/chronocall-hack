import { useCallback, useEffect, useRef, useState } from "react";

// After a FaceTime call with a painted figure, offer prints of that painting from Shopify stores.
// The search starts 20 s into the call (by a small copy of the scanned photo and the title), so it
// doesn't compete with the call's first seconds, and is usually ready when the visitor hangs up.

/** Wait this long into a call before searching, so the upload doesn't compete with call setup. */
const SEARCH_DELAY_MS = 20_000;
/** The painting photo is shrunk to this size before upload: enough for a "find similar" search. */
const IMAGE_MAX_PX = 512;

/** Shrinks a data-URL image to at most maxPx on its longer side, as a JPEG. */
export async function shrinkDataUrl(dataUrl: string | undefined, maxPx: number): Promise<{ base64: string; mimeType: string } | null> {
  if (!dataUrl?.startsWith("data:image/")) return null;
  try {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const scale = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { base64: canvas.toDataURL("image/jpeg", 0.75).split(",")[1] ?? "", mimeType: "image/jpeg" };
  } catch {
    return null; // fall back to a text-only search
  }
}

export interface PrintOffer {
  productId: string;
  variantId: string;
  title: string;
  seller: string;
  shop: string;
  price: { amount: number; currency: string; display: string };
  imageUrl?: string;
  productUrl?: string;
  checkoutUrl?: string;
  printScore: number | null;
}

export interface PrintSearch {
  offers: PrintOffer[];
  considered: number;
  rejected: { title: string; printScore: number }[];
  warnings: string[];
  decisions: { used: boolean; latencyMs: number; error?: string };
  matchedBy?: "exact" | "figure";
}

interface ProfileLike {
  id?: string;
  name: string;
  artworkTitle?: string;
  artist?: string;
  scannedImageDataUrl?: string;
}

export interface PrintOfferState {
  open: boolean;
  onClose: () => void;
  figureName: string;
  artworkTitle: string;
  loading: boolean;
  error: string | null;
  result: PrintSearch | null;
}

export function usePrintOffer(params: { phase: string; profile: ProfileLike | null }): PrintOfferState {
  const { phase, profile } = params;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PrintSearch | null>(null);
  const lastCall = useRef<ProfileLike | null>(null);
  const wasInCall = useRef(false);
  const searchedFor = useRef<string | null>(null);

  // Remember the call; the search itself waits so it doesn't compete with the call's first seconds.
  useEffect(() => {
    if (phase !== "in-call" || !profile) return;
    lastCall.current = profile;
    wasInCall.current = true;
    const timer = window.setTimeout(() => runSearch(profile), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [phase, profile]);

  // Offer the prints when the call ends (and search now if the call was shorter than the delay).
  useEffect(() => {
    if (phase === "launcher" && wasInCall.current) {
      wasInCall.current = false;
      if (lastCall.current) runSearch(lastCall.current);
      setOpen(true);
    }
  }, [phase]);

  function runSearch(p: ProfileLike) {
    const artworkTitle = p.artworkTitle?.trim() || `${p.name} portrait`;
    const key = `${p.id ?? p.name}|${artworkTitle}`;
    if (searchedFor.current === key) return;
    searchedFor.current = key;
    setResult(null);
    setError(null);
    setLoading(true);
    void shrinkDataUrl(p.scannedImageDataUrl, IMAGE_MAX_PX)
      .then((image) =>
        fetch("/api/shop/prints", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ artworkTitle, artist: p.artist, figure: p.name, imageBase64: image?.base64, mimeType: image?.mimeType }),
        }),
      )
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Could not search for prints.");
        if (searchedFor.current === key) setResult(data as PrintSearch);
      })
      .catch((err) => {
        if (searchedFor.current === key) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (searchedFor.current === key) setLoading(false);
      });
  }

  const onClose = useCallback(() => setOpen(false), []);

  return {
    open,
    onClose,
    figureName: lastCall.current?.name ?? "",
    artworkTitle: lastCall.current?.artworkTitle?.trim() || `${lastCall.current?.name ?? ""} portrait`,
    loading,
    error,
    result,
  };
}

import { useCallback, useEffect, useRef, useState } from "react";

// After a FaceTime call with a painted figure, offer prints of that painting from Shopify stores.
// The search starts in the background as soon as the call connects (by the scanned photo and the
// title), so the catalogue is ready the moment the visitor hangs up.

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

  // Start the search once the call is live.
  useEffect(() => {
    if (phase !== "in-call" || !profile) return;
    lastCall.current = profile;
    wasInCall.current = true;
    const artworkTitle = profile.artworkTitle?.trim() || `${profile.name} portrait`;
    const key = `${profile.id ?? profile.name}|${artworkTitle}`;
    if (searchedFor.current === key) return;
    searchedFor.current = key;
    setResult(null);
    setError(null);
    setLoading(true);
    const imageBase64 = profile.scannedImageDataUrl?.startsWith("data:image/")
      ? profile.scannedImageDataUrl.replace(/^data:image\/[a-zA-Z+.-]+;base64,/, "")
      : undefined;
    const mimeType = profile.scannedImageDataUrl?.match(/^data:(image\/[a-zA-Z+.-]+);/)?.[1];
    fetch("/api/shop/prints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artworkTitle, artist: profile.artist, imageBase64, mimeType }),
    })
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
  }, [phase, profile]);

  // Offer the prints when the call ends.
  useEffect(() => {
    if (phase === "launcher" && wasInCall.current) {
      wasInCall.current = false;
      setOpen(true);
    }
  }, [phase]);

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

import { useCallback, useRef, useState } from "react";
import { shrinkDataUrl, type PrintOfferState, type PrintSearch } from "./usePrintOffer";

// Print offer for any artwork on screen (used by the museum portrait room): call offer(artwork) to
// open the window and search Shopify stores for prints of it. Results are kept per artwork.

export interface ArtworkLike {
  title: string;
  artist?: string;
  characterName?: string;
  imageUrl?: string; // a data: URL from a scan is used for photo search; other URLs fall back to the title
}

export function useArtworkPrints(): PrintOfferState & { offer: (artwork: ArtworkLike) => void } {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PrintSearch | null>(null);
  const [current, setCurrent] = useState<ArtworkLike | null>(null);
  const cache = useRef(new Map<string, PrintSearch>());
  const pending = useRef<string | null>(null);

  const offer = useCallback((artwork: ArtworkLike) => {
    const title = artwork.title?.trim() || `${artwork.characterName ?? ""} portrait`;
    const key = `${title}|${artwork.artist ?? ""}`;
    setCurrent(artwork);
    setOpen(true);
    setError(null);
    const cached = cache.current.get(key);
    if (cached) {
      setResult(cached);
      setLoading(false);
      return;
    }
    if (pending.current === key) return;
    pending.current = key;
    setResult(null);
    setLoading(true);
    void shrinkDataUrl(artwork.imageUrl, 512)
      .then((image) =>
        fetch("/api/shop/prints", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ artworkTitle: title, artist: artwork.artist, figure: artwork.characterName, imageBase64: image?.base64, mimeType: image?.mimeType }),
        }),
      )
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Could not search for prints.");
        cache.current.set(key, data as PrintSearch);
        if (pending.current === key) setResult(data as PrintSearch);
      })
      .catch((err) => {
        if (pending.current === key) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (pending.current === key) {
          pending.current = null;
          setLoading(false);
        }
      });
  }, []);

  const onClose = useCallback(() => setOpen(false), []);

  return {
    open,
    onClose,
    offer,
    figureName: current?.characterName ?? "",
    artworkTitle: current?.title ?? "",
    loading,
    error,
    result,
  };
}

import React, { useState, useEffect } from "react";
import { ExternalLink, Loader2, ShoppingBag, X } from "lucide-react";
import { Modal } from "../../app/components/Modal";
import type { PrintOffer, PrintOfferState } from "./usePrintOffer";

interface CheckoutView {
  continueUrl: string | null;
  totals: { label?: string; amount?: number }[];
  messages: { type?: string; severity?: string; content?: string }[];
  links: { type?: string; title?: string; url: string }[];
  currency?: string;
}

/** Shown after a call: prints of the painting from Shopify stores, bought on the store's own checkout. */
export function PrintOfferModal(props: PrintOfferState) {
  const { open, onClose, figureName, artworkTitle, loading, error, result } = props;
  const [buying, setBuying] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<{ offer: PrintOffer; view: CheckoutView } | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setCheckout(null); setBuyError(null); setBuying(null); }
  }, [open, artworkTitle]);

  const buy = async (offer: PrintOffer) => {
    setBuying(offer.variantId);
    setBuyError(null);
    try {
      const res = await fetch("/api/shop/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop: offer.shop, variantId: offer.variantId, quantity: 1 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "The store could not open a checkout.");
      setCheckout({ offer, view: data as CheckoutView });
    } catch (err) {
      // Fall back to the store's own checkout link or product page from the catalog.
      const url = offer.checkoutUrl || offer.productUrl;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else setBuyError(err instanceof Error ? err.message : String(err));
    } finally {
      setBuying(null);
    }
  };

  const money = (amount: number | undefined, currency = "USD") =>
    amount === undefined
      ? ""
      : new Intl.NumberFormat("en", { style: "currency", currency }).format(amount / 100);

  return (
    <Modal open={open} onClose={onClose} label="Buy a print">
      <div className="w-full max-w-3xl rounded-xl overflow-hidden bg-surface border border-white/15 shadow-2xl flex flex-col max-h-[92vh]">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400/15 border border-amber-300/30 flex items-center justify-center text-amber-300">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                Take {figureName || "this moment"} home
              </h2>
              <p className="text-xs text-slate-400">Prints of “{artworkTitle}” from independent Shopify stores</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-11 h-11 shrink-0 rounded-lg bg-white/[0.08] hover:bg-white/[0.16] flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
          {checkout ? (
            <div className="flex flex-col gap-4">
              <div className="flex gap-4 items-start">
                {checkout.offer.imageUrl && (
                  <img src={checkout.offer.imageUrl} alt="" className="w-28 h-28 object-cover rounded-lg bg-black" />
                )}
                <div className="text-sm text-slate-300">
                  <p className="text-white font-semibold">{checkout.offer.title}</p>
                  <p>Sold by {checkout.offer.seller}</p>
                  <ul className="mt-2 space-y-0.5">
                    {checkout.view.totals.map((t, i) => (
                      <li key={i} className="flex justify-between gap-6">
                        <span>{t.label}</span>
                        <span>{money(t.amount, checkout.view.currency)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              {/* Missing address or contact errors are expected here: the shopper adds them on the store's page. */}
              {checkout.view.messages
                .filter((m) => m.type === "warning" || (m.type === "error" && m.severity === "unrecoverable"))
                .map((m, i) => (
                  <p key={i} className="text-xs text-amber-200">{m.content}</p>
                ))}
              {checkout.view.links.length > 0 && (
                <p className="text-xs text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
                  {checkout.view.links.map((l, i) => (
                    <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
                      {l.title || (l.type ?? "policy").replace(/_/g, " ")}
                    </a>
                  ))}
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                {checkout.view.continueUrl ? (
                  <a
                    href={checkout.view.continueUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-slate-950 font-semibold text-sm"
                  >
                    Continue to {checkout.offer.seller}’s secure checkout <ExternalLink className="w-4 h-4" />
                  </a>
                ) : (
                  <a
                    href={checkout.offer.checkoutUrl || checkout.offer.productUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-slate-950 font-semibold text-sm"
                  >
                    Open {checkout.offer.seller} <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setCheckout(null)}
                  className="px-4 py-2.5 rounded-lg bg-white/[0.08] text-slate-200 text-sm cursor-pointer"
                >
                  Back to prints
                </button>
              </div>
              <p className="text-xs text-slate-500">Add your address and pay on the store’s own secure page. Chronocall never handles payment.</p>
            </div>
          ) : loading && !result ? (
            <div className="flex items-center gap-2 text-sm text-slate-300 py-10 justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-400" /> Finding prints of this painting…
            </div>
          ) : error ? (
            <p className="text-sm text-slate-300 py-6">{error}</p>
          ) : result && result.offers.length === 0 ? (
            <p className="text-sm text-slate-300 py-6">No prints of this painting were found in Shopify stores right now.</p>
          ) : (
            <>
              {result?.matchedBy === "figure" && (
                <p className="mb-3 text-sm text-slate-300">
                  No prints of this exact painting are sold right now. Here are prints of {figureName || "the same figure"}.
                </p>
              )}
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {result?.offers.map((o) => (
                  <li key={o.variantId} className="rounded-lg border border-white/10 bg-white/[0.04] overflow-hidden flex flex-col">
                    {o.imageUrl ? (
                      <img src={o.imageUrl} alt={o.title} loading="lazy" className="w-full aspect-[4/3] object-cover bg-black" />
                    ) : (
                      <div className="w-full aspect-[4/3] bg-black" />
                    )}
                    <div className="p-3 flex flex-col gap-1 flex-1">
                      <p className="text-sm text-white font-medium leading-snug line-clamp-2">{o.title}</p>
                      <p className="text-xs text-slate-400">{o.seller}</p>
                      <div className="mt-auto pt-2 flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-white">{o.price.display}</span>
                        <button
                          type="button"
                          onClick={() => void buy(o)}
                          disabled={buying !== null}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white text-slate-950 font-semibold text-xs cursor-pointer disabled:opacity-60"
                        >
                          {buying === o.variantId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShoppingBag className="w-3.5 h-3.5" />}
                          Buy
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              {buyError && <p className="mt-3 text-xs text-amber-200">{buyError}</p>}
              {result?.warnings.map((w, i) => (
                <p key={i} className="mt-2 text-xs text-amber-200">{w}</p>
              ))}
              {result && (
                <p className="mt-4 text-xs text-slate-500">
                  {result.decisions.used
                    ? `Gemini Decisions checked ${result.considered} catalog results and selected likely matching prints.`
                    : `Showing catalog results for this painting.`}{" "}
                  Powered by Shop (shop.dev).
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

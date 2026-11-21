// "Buy a print of this painting": search the Shop catalog (by the camera photo and the title), then let
// the Decisions API keep only real reproductions of THIS artwork: one yes/no question per product.

import type { GoogleGenAI } from '@google/genai';
import { searchCatalog, type ShopProduct } from './shopMcp.ts';

const DECISION_MODEL = 'models/gemini-decision-1';
const DECISIONS_API_VERSION = process.env.DECISIONS_API_VERSION || 'v1alpha';
const KEEP_AT = 0.6;

export interface PrintOffer {
  productId: string;
  variantId: string;
  title: string;
  seller: string;
  shop: string; // seller.domain, needed for checkout
  price: { amount: number; currency: string; display: string };
  imageUrl?: string;
  productUrl?: string; // the merchant's product page, kept exactly as returned
  checkoutUrl?: string; // the merchant's direct checkout link, if Shop provides one
  available: boolean;
  printScore: number | null; // P(this is a reproduction print of the artwork), from the Decisions API
}

export interface PrintSearchResult {
  offers: PrintOffer[];
  considered: number;
  rejected: { title: string; printScore: number }[];
  warnings: string[];
  decisions: { used: boolean; latencyMs: number; error?: string };
  searchMs: number;
}

const money = (amount: number, currency: string) => {
  const f = new Intl.NumberFormat('en', { style: 'currency', currency });
  return f.format(amount / 10 ** (f.resolvedOptions().maximumFractionDigits ?? 2));
};

const plain = (d: ShopProduct['description']) => (typeof d === 'string' ? d : d?.plain ?? '').slice(0, 300);

function toOffer(p: ShopProduct, printScore: number | null): PrintOffer | null {
  const v = p.variants?.[0];
  if (!v) return null;
  const img = p.media?.find((m) => m.type === 'image') ?? v.media?.find((m) => m.type === 'image');
  return {
    productId: p.id,
    variantId: v.id,
    title: p.title,
    seller: v.seller?.name ?? 'Shop',
    shop: v.seller?.domain,
    price: { ...v.price, display: money(v.price.amount, v.price.currency) },
    imageUrl: img?.url,
    productUrl: v.url,
    checkoutUrl: v.checkout_url,
    available: v.availability?.available !== false,
    printScore,
  };
}

export async function findPrints(
  ai: GoogleGenAI | null,
  p: { artworkTitle: string; artist?: string; imageBase64?: string; imageMimeType?: string; country?: string; currency?: string },
): Promise<PrintSearchResult> {
  const t0 = Date.now();
  const query = `${p.artworkTitle}${p.artist ? ` ${p.artist}` : ''} art print`;
  const { products, messages } = await searchCatalog({
    query,
    imageBase64: p.imageBase64,
    imageMimeType: p.imageMimeType,
    country: p.country,
    currency: p.currency,
    limit: 12,
  });
  const searchMs = Date.now() - t0;
  const warnings = messages.filter((m) => m.type === 'warning').map((m) => m.content ?? m.code ?? 'warning');

  // Decisions API: is each product a reproduction print of this specific artwork (not a mug, a T-shirt,
  // or a different painting)? One call, one yes/no question per product.
  const scores = new Map<string, number>();
  let decisions: PrintSearchResult['decisions'] = { used: false, latencyMs: 0 };
  if (ai && products.length) {
    const t1 = Date.now();
    try {
      const artwork = `"${p.artworkTitle}"${p.artist ? ` by ${p.artist}` : ''}`;
      const r = await ai.decisions.create({
        api_version: DECISIONS_API_VERSION,
        model: DECISION_MODEL,
        input: `ARTWORK: ${artwork}\n\nPRODUCTS:\n${products
          .map((x, i) => `[${i}] ${x.title} — ${plain(x.description)}`)
          .join('\n')}`,
        questions: Object.fromEntries(
          products.map((_, i) => [
            `p${i}`,
            {
              type: 'noul' as const,
              instructions: `Is product [${i}] a print, poster or canvas reproduction of the ARTWORK ${artwork} itself, to hang on a wall (not a mug, apparel, puzzle, book, or a different artwork)?`,
            },
          ]),
        ),
      });
      products.forEach((_, i) => {
        const a = r.answers?.[`p${i}`] as { noul?: number } | undefined;
        if (typeof a?.noul === 'number') scores.set(products[i].id, a.noul);
      });
      decisions = { used: true, latencyMs: Date.now() - t1 };
    } catch (err) {
      decisions = { used: false, latencyMs: Date.now() - t1, error: err instanceof Error ? err.message : String(err) };
    }
  }

  const all = products
    .map((x) => toOffer(x, scores.get(x.id) ?? null))
    .filter((o): o is PrintOffer => !!o && !!o.shop && o.available);
  const offers = decisions.used ? all.filter((o) => (o.printScore ?? 0) >= KEEP_AT) : all;
  offers.sort((a, b) => (b.printScore ?? 0) - (a.printScore ?? 0) || a.price.amount - b.price.amount);
  return {
    offers: offers.slice(0, 6),
    considered: products.length,
    rejected: decisions.used
      ? all.filter((o) => (o.printScore ?? 0) < KEEP_AT).map((o) => ({ title: o.title, printScore: o.printScore ?? 0 }))
      : [],
    warnings,
    decisions,
    searchMs,
  };
}

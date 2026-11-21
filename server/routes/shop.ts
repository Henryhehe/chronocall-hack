// Shopify bonus track: buy a print of the painting you're talking to.
//   POST /api/shop/prints    { artworkTitle, artist?, imageBase64?, mimeType?, country? } → print offers
//   POST /api/shop/checkout  { shop, variantId, quantity?, country? }                    → merchant checkout
// Search works without a Gemini key (Shop MCP is keyless); the Decisions API filter runs when a key is set.
// The app never pays: the shopper completes the purchase on the merchant's checkout page.

import { Router } from "express";
import { getGeminiClient } from "../services/gemini/client.ts";
import { findPrints } from "../services/shop/prints.ts";
import { createCheckout, ShopMcpError } from "../services/shop/shopMcp.ts";

const COUNTRY = /^[A-Z]{2}$/;

export function createShopRouter(demoMode = false) {
  const router = Router();
  router.use((req, res, next) => {
    if (demoMode && req.method === "POST" && req.path.startsWith("/api/shop/")) {
      if (req.path === "/api/shop/prints") {
        res.json({ offers: [], considered: 0, rejected: [], warnings: ["Print shopping is unavailable in demo mode."], decisions: { used: false, latencyMs: 0 } });
      } else {
        res.status(503).json({ error: "Merchant checkout is unavailable in demo mode." });
      }
      return;
    }
    next();
  });

  router.post("/api/shop/prints", async (req, res) => {
    const artworkTitle = typeof req.body?.artworkTitle === "string" ? req.body.artworkTitle.trim() : "";
    if (!artworkTitle) {
      res.status(400).json({ error: "artworkTitle is required." });
      return;
    }
    const imageBase64 =
      typeof req.body?.imageBase64 === "string"
        ? req.body.imageBase64.replace(/^data:image\/[a-zA-Z+.-]+;base64,/, "")
        : undefined;
    try {
      const result = await findPrints(demoMode ? null : safeClient(), {
        artworkTitle,
        artist: typeof req.body?.artist === "string" ? req.body.artist : undefined,
        figure: typeof req.body?.figure === "string" && req.body.figure.trim() ? req.body.figure.trim() : undefined,
        imageBase64,
        imageMimeType: typeof req.body?.mimeType === "string" ? req.body.mimeType : "image/jpeg",
        country: COUNTRY.test(req.body?.country) ? req.body.country : "US",
      });
      res.json(result);
    } catch (err) {
      res.status(err instanceof ShopMcpError ? 502 : 500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.post("/api/shop/checkout", async (req, res) => {
    const { shop, variantId } = req.body ?? {};
    if (typeof shop !== "string" || typeof variantId !== "string" || !variantId.startsWith("gid://")) {
      res.status(400).json({ error: "shop and variantId (as returned by /api/shop/prints) are required." });
      return;
    }
    try {
      const checkout = await createCheckout({
        shop,
        variantId,
        quantity: Number.isInteger(req.body?.quantity) && req.body.quantity > 0 ? req.body.quantity : 1,
        country: COUNTRY.test(req.body?.country) ? req.body.country : "US",
      });
      // Only what the shopper needs; continue_url carries a checkout key, so it is never logged.
      res.json({
        status: checkout.status,
        continueUrl: checkout.continue_url ?? null,
        currency: checkout.currency,
        totals: (checkout.totals ?? []).map((t) => ({ label: t.display_text ?? t.type, amount: t.amount })),
        messages: (checkout.messages ?? []).map((m) => ({ type: m.type, severity: m.severity, content: m.content })),
        links: (checkout.links ?? []).map((l) => ({ type: l.type, title: l.title, url: l.url })),
      });
    } catch (err) {
      res.status(err instanceof ShopMcpError ? 502 : 500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return router;
}

function safeClient() {
  try {
    return getGeminiClient();
  } catch {
    return null; // no key: return unfiltered results rather than failing
  }
}

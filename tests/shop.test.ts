import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { GoogleGenAI } from "@google/genai";
import { findPrints } from "../server/services/shop/prints.ts";
import { createShopRouter } from "../server/routes/shop.ts";

const product = (id: string, title: string, amount: number) => ({
  id,
  title,
  media: [{ type: "image", url: `https://cdn.example/${id}.jpg` }],
  variants: [
    {
      id: `gid://shopify/ProductVariant/${id}`,
      url: `https://store.example/${id}`,
      checkout_url: `https://store.example/cart/${id}`,
      price: { amount, currency: "USD" },
      availability: { available: true },
      seller: { name: "Store", domain: "store.myshopify.com" },
    },
  ],
});

// Stand-in for Shop MCP: returns a fixed catalog for any search.
function withCatalog<T>(products: unknown[], fn: () => Promise<T>): Promise<T> {
  const real = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { structuredContent: { products, messages: [] } } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;
  return fn().finally(() => {
    globalThis.fetch = real;
  });
}

// Stand-in for the Decisions API: P(yes) per product index.
const decisions = (p: number[], calls: Array<Record<string, any>> = []) =>
  ({
    decisions: {
      create: async (req: Record<string, any>) => {
        calls.push(req);
        return { answers: Object.fromEntries(p.map((v, i) => [`p${i}`, { type: "noul", noul: v, confidence: 0.9 }])) };
      },
    },
  }) as unknown as GoogleGenAI;

test("the Decisions API keeps real prints of the painting and drops the rest, in one call", async () => {
  const calls: Array<Record<string, any>> = [];
  const r = await withCatalog(
    [product("1", "Mona Lisa art print", 2000), product("2", "Mona Lisa coffee mug", 1500), product("3", "Mona Lisa canvas", 6000)],
    () => findPrints(decisions([0.98, 0.05, 0.95], calls), { artworkTitle: "Mona Lisa", artist: "Leonardo da Vinci" }),
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].api_version, "v1alpha");
  assert.deepEqual(r.offers.map((o) => o.title), ["Mona Lisa art print", "Mona Lisa canvas"]);
  assert.deepEqual(r.rejected.map((x) => x.title), ["Mona Lisa coffee mug"]);
  assert.equal(r.offers[0].price.display, "$20.00");
  assert.equal(r.offers[0].shop, "store.myshopify.com");
});

test("without a Gemini key the catalog results are shown unfiltered", async () => {
  const r = await withCatalog([product("1", "Print", 2000), product("2", "Mug", 1500)], () =>
    findPrints(null, { artworkTitle: "Mona Lisa" }),
  );
  assert.equal(r.decisions.used, false);
  assert.equal(r.offers.length, 2);
});

test("shop routes validate their input", async () => {
  const app = express().use(express.json()).use(createShopRouter(true));
  const server = app.listen(0);
  const port = (server.address() as { port: number }).port;
  const post = (path: string, body: unknown) =>
    fetch(`http://127.0.0.1:${port}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  try {
    assert.equal((await post("/api/shop/prints", {})).status, 400);
    assert.equal((await post("/api/shop/checkout", { shop: "x.myshopify.com", variantId: "123" })).status, 400);
  } finally {
    server.close();
  }
});

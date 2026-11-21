import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import { createShopRouter } from "../../server/routes/shop.ts";

for (const demo of [false, true]) {
  test(`shop routes: ${demo ? 'demo isolation' : 'input validation'}`, async () => {
    const server = express().use(express.json()).use(createShopRouter(demo)).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const port = (server.address() as { port: number }).port;
    const post = (path: string, body: unknown) => fetch(`http://127.0.0.1:${port}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    try {
      const prints = await post('/api/shop/prints', demo ? { artworkTitle: 'Mona Lisa' } : {});
      assert.equal(prints.status, demo ? 200 : 400);
      if (demo) { const data = await prints.json(); assert.deepEqual(data.offers, []); assert.equal(data.decisions.used, false); }
      assert.equal((await post('/api/shop/checkout', { shop: 'x.myshopify.com', variantId: '123' })).status, demo ? 503 : 400);
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
}

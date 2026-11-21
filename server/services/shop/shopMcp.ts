// Shop MCP (shop.dev): Shopify's catalog of 1B+ products and merchant checkouts over one HTTPS endpoint.
// Anonymous search and checkout creation need no account or API key.
// Docs: https://shop.dev/docs/quickstart · /docs/search · /docs/checkout
//
// We never complete a checkout: the shopper reviews and pays on the merchant's own checkout page.

const ENDPOINT = process.env.SHOP_MCP_URL || 'https://mcp.shop.com/';
const PROTOCOL = '2026-07-28';

export interface Money {
  amount: number; // minor units, e.g. 4000 = 40.00
  currency: string;
}

export interface ShopVariant {
  id: string;
  title?: string;
  url?: string;
  checkout_url?: string;
  price: Money;
  availability?: { available?: boolean };
  seller: { id?: string; name: string; url?: string; domain: string };
  media?: { type: string; url: string; alt_text?: string }[];
  options?: { name: string; label: string }[];
}

export interface ShopProduct {
  id: string;
  title: string;
  description?: string | { plain?: string; html?: string };
  media?: { type: string; url: string; alt_text?: string }[];
  rating?: { value: number; scale_max: number; count: number };
  variants: ShopVariant[];
}

export interface ShopMessage {
  type: string;
  code?: string;
  content?: string;
}

export class ShopMcpError extends Error {}

async function callTool<T>(name: string, args: unknown, timeoutMs = 20_000): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': PROTOCOL,
      'Mcp-Method': 'tools/call',
      'Mcp-Name': name,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name,
        arguments: args,
        _meta: {
          'io.modelcontextprotocol/protocolVersion': PROTOCOL,
          'io.modelcontextprotocol/clientInfo': { name: 'chronocall', version: '0.1.0' },
          'io.modelcontextprotocol/clientCapabilities': {},
        },
      },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const json = (await res.json().catch(() => ({}))) as {
    result?: { isError?: boolean; structuredContent?: T; content?: { type: string; text?: string }[] };
    error?: { message?: string };
  };
  if (!res.ok || json.error) throw new ShopMcpError(json.error?.message || `Shop MCP HTTP ${res.status}`);
  if (json.result?.isError) {
    const text = json.result.content?.filter((p) => p.type === 'text').map((p) => p.text).join('\n');
    throw new ShopMcpError(text || `${name} failed`);
  }
  if (!json.result?.structuredContent) throw new ShopMcpError(`${name} returned no document`);
  return json.result.structuredContent;
}

export async function searchCatalog(p: {
  query: string;
  imageBase64?: string;
  imageMimeType?: string;
  country?: string;
  currency?: string;
  limit?: number;
}): Promise<{ products: ShopProduct[]; messages: ShopMessage[] }> {
  const catalog: Record<string, unknown> = {
    query: p.query,
    context: { address_country: p.country || 'US', currency: p.currency || 'USD', intent: 'art print of a painting' },
    pagination: { limit: p.limit ?? 12 },
  };
  // Search by photo: Shop takes the image bytes (JPEG/PNG/WebP, under ~3 MB), not a URL.
  if (p.imageBase64 && p.imageBase64.length < 3_800_000) {
    catalog.like = [{ image: { content_type: p.imageMimeType || 'image/jpeg', data: p.imageBase64 } }];
  }
  const doc = await callTool<{ products?: ShopProduct[]; messages?: ShopMessage[] }>('search_catalog', { catalog });
  return { products: doc.products ?? [], messages: doc.messages ?? [] };
}

export interface ShopCheckout {
  id: string;
  status: string;
  currency?: string;
  continue_url?: string;
  totals?: { type?: string; display_text?: string; amount?: number }[];
  messages?: (ShopMessage & { severity?: string })[];
  links?: { type?: string; url: string; title?: string }[];
  line_items?: unknown[];
}

/** Opens a checkout with the merchant. It places no order; the shopper pays at continue_url. */
export async function createCheckout(p: { shop: string; variantId: string; quantity?: number; country?: string }): Promise<ShopCheckout> {
  return callTool<ShopCheckout>('create_checkout', {
    shop: p.shop,
    checkout: {
      line_items: [{ item: { id: p.variantId }, quantity: p.quantity ?? 1 }],
      context: { address_country: p.country || 'US' },
    },
  });
}

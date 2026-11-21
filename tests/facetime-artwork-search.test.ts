import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyArtworkMedium,
  rankArtworkCandidates,
  type OnlineArtworkCandidate,
} from "../shared/facetime.ts";
import { isAllowedArtworkUrl, fetchAllowedArtworkImage } from "../server/services/artwork-search.ts";

test("classifyArtworkMedium distinguishes sculptures, paintings, and photographs", () => {
  assert.equal(classifyArtworkMedium("Roman marble bust of Julius Caesar"), "sculpture");
  assert.equal(classifyArtworkMedium("Oil on canvas portrait by Gilbert Stuart"), "painting");
  assert.equal(classifyArtworkMedium("1921 gelatin silver photograph of Albert Einstein"), "photograph");
  assert.equal(classifyArtworkMedium("Historical likeness"), "portrait");
});

test("rankArtworkCandidates promotes iconic portraits/sculptures above signatures and maps", () => {
  const candidates: OnlineArtworkCandidate[] = [
    {
      id: "sig",
      title: "George Washington signature autograph",
      artist: "Archive",
      year: "1789",
      medium: "portrait",
      museum: "Wikimedia Commons",
      thumbnailUrl: "https://upload.wikimedia.org/sig.jpg",
      imageUrl: "https://upload.wikimedia.org/sig.jpg",
      pageUrl: "https://commons.wikimedia.org/sig",
    },
    {
      id: "painting",
      title: "Portrait of George Washington",
      artist: "Gilbert Stuart",
      year: "1796",
      medium: "painting",
      museum: "National Portrait Gallery",
      thumbnailUrl: "https://upload.wikimedia.org/washington.jpg",
      imageUrl: "https://upload.wikimedia.org/washington.jpg",
      pageUrl: "https://commons.wikimedia.org/washington",
    },
  ];

  const ranked = rankArtworkCandidates("George Washington", candidates);
  assert.equal(ranked[0].id, "painting");
  assert.equal(ranked[1].id, "sig");
});

test("isAllowedArtworkUrl allows trusted museum HTTPS hosts and blocks arbitrary or HTTP URLs", () => {
  assert.equal(
    isAllowedArtworkUrl("https://upload.wikimedia.org/wikipedia/commons/a/a1/Portrait.jpg"),
    true
  );
  assert.equal(
    isAllowedArtworkUrl("https://images.metmuseum.org/CRDImages/ep/original/DP123.jpg"),
    true
  );
  assert.equal(isAllowedArtworkUrl("http://upload.wikimedia.org/insecure.jpg"), false);
  assert.equal(isAllowedArtworkUrl("https://evil.example.com/ssrf.jpg"), false);
  assert.equal(isAllowedArtworkUrl("not-a-url"), false);
});


test("artwork download validates redirects before contacting another host", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () =>
    new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } }));
  await assert.rejects(fetchAllowedArtworkImage("https://upload.wikimedia.org/art.jpg"), /allowed museum host/);
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.equal(isAllowedArtworkUrl("https://user:pass@upload.wikimedia.org/art.jpg"), false);
  assert.equal(isAllowedArtworkUrl("https://upload.wikimedia.org:8443/art.jpg"), false);
});

test("artwork download follows museum redirects and retains the image MIME type", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => ++calls === 1
    ? new Response(null, { status: 302, headers: { location: "https://images.metmuseum.org/art.png" } })
    : new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png" } }));
  const result = await fetchAllowedArtworkImage("https://upload.wikimedia.org/art.png");
  assert.equal(result.dataUrl, "data:image/png;base64,AQID");
  assert.equal(calls, 2);
});

test("artwork download rejects active image content and limits streamed bytes", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () =>
    new Response("<svg/>", { headers: { "content-type": "image/svg+xml" } }));
  await assert.rejects(fetchAllowedArtworkImage("https://upload.wikimedia.org/art.svg"), /JPEG, PNG, or WebP/);
  fetchMock.mock.mockImplementation(async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(8 * 1024 * 1024 + 1)); controller.close(); },
  }), { headers: { "content-type": "image/png" } }));
  await assert.rejects(fetchAllowedArtworkImage("https://upload.wikimedia.org/art.png"), /8MB limit/);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyArtworkMedium,
  rankArtworkCandidates,
  type OnlineArtworkCandidate,
} from "../shared/facetime.ts";
import { isAllowedArtworkUrl } from "../server/services/artwork-search.ts";

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
    isAllowedArtworkUrl("https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3a/Caesar_by_Rubens.jpg/960px-Caesar_by_Rubens.jpg"),
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

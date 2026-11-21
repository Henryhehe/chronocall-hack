import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSelfieEraStamp,
  normalizeHistoricalProfile,
  type FaceTimeSelfieResult,
} from "../shared/facetime.ts";

test("buildSelfieEraStamp handles composite eras, separate era/location, and missing fields", () => {
  // Case 1: Era already contains '·' separator (e.g., curated contacts)
  const leonardo = normalizeHistoricalProfile({
    name: "Leonardo da Vinci",
    era: "1505 · Florence",
    location: "Florentine Workshop",
  });
  assert.equal(buildSelfieEraStamp(leonardo), "1505 · Florence");

  // Case 2: Era and location are distinct strings without separator
  const franklin = normalizeHistoricalProfile({
    name: "Benjamin Franklin",
    era: "1776",
    location: "Philadelphia",
  });
  assert.equal(buildSelfieEraStamp(franklin), "1776 · Philadelphia");

  // Case 3: Era already includes location name
  const cleopatra = normalizeHistoricalProfile({
    name: "Cleopatra VII",
    era: "42 BC · Alexandria",
    location: "Royal Palace of Alexandria",
  });
  assert.equal(buildSelfieEraStamp(cleopatra), "42 BC · Alexandria");

  // Case 4: Only era provided, location empty
  const caesar = normalizeHistoricalProfile({
    name: "Julius Caesar",
    era: "44 BC",
    location: "",
  });
  assert.equal(buildSelfieEraStamp(caesar), "44 BC");

  // Case 5: Fallback when era and location are blank
  const unknown = normalizeHistoricalProfile({
    name: "Time Traveler",
    era: "",
    location: "",
  });
  assert.ok(buildSelfieEraStamp(unknown).length > 0);
});

test("FaceTimeSelfieResult data structure contract", () => {
  const profile = normalizeHistoricalProfile({
    name: "Ada Lovelace",
    era: "1843 · London",
    location: "Analytical Engine Study",
  });

  const stamp = buildSelfieEraStamp(profile);
  const sampleResult: FaceTimeSelfieResult = {
    imageDataUrl: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
    mimeType: "image/svg+xml",
    caption: `Time-travel selfie with ${profile.name}`,
    eraStamp: stamp,
    model: "gemini-3.1-flash-lite-image",
    latencyMs: 142,
    demoMode: false,
  };

  assert.equal(sampleResult.caption, "Time-travel selfie with Ada Lovelace");
  assert.equal(sampleResult.eraStamp, "1843 · London");
  assert.equal(sampleResult.model, "gemini-3.1-flash-lite-image");
  assert.equal(sampleResult.mimeType, "image/svg+xml");
  assert.equal(sampleResult.latencyMs, 142);
  assert.equal(sampleResult.demoMode, false);
  assert.ok(sampleResult.imageDataUrl.startsWith("data:image/"));
});

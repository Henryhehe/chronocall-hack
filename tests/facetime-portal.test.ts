import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeHistoricalProfile,
  normalizePortalPrompt,
  type FaceTimePortalInvite,
  type FaceTimeServerEvent,
} from "../shared/facetime.ts";

test("normalizePortalPrompt preserves valid custom raw prompts", () => {
  const profile = normalizeHistoricalProfile({
    name: "Leonardo da Vinci",
    location: "Florence Bottega",
    era: "Renaissance Italy (1503)",
  });

  const customPrompt =
    "A sunlit Renaissance painting bottega filled with wooden easels, anatomical sketches, and grinding pigments.";
  const result = normalizePortalPrompt(profile, customPrompt);
  assert.equal(result, customPrompt);
});

test("normalizePortalPrompt falls back to profile.genieWorldPrompt when rawPrompt is empty or missing", () => {
  const profile = normalizeHistoricalProfile({
    name: "Marie Curie",
    location: "Paris Shed Laboratory",
    era: "1898 · Paris",
    genieWorldPrompt:
      "A rustic Parisian shed laboratory with glowing pitchblende vials, iron stoves, and wooden benches.",
  });

  const promptUndefined = normalizePortalPrompt(profile);
  assert.equal(promptUndefined, profile.genieWorldPrompt);

  const promptEmpty = normalizePortalPrompt(profile, "   ");
  assert.equal(promptEmpty, profile.genieWorldPrompt);

  const promptShort = normalizePortalPrompt(profile, "abc");
  assert.equal(promptShort, profile.genieWorldPrompt);
});

test("normalizePortalPrompt constructs fallback prompt if profile has no genieWorldPrompt", () => {
  const profile = normalizeHistoricalProfile({
    name: "Ada Lovelace",
    location: "Ockham Park Study",
    era: "1843 · Victorian England",
  });
  // Clear genieWorldPrompt to verify ultimate fallback
  profile.genieWorldPrompt = "";

  const result = normalizePortalPrompt(profile);
  assert.ok(result.includes("Ockham Park Study"));
  assert.ok(result.includes("1843 · Victorian England"));
  assert.ok(result.includes("Ada Lovelace"));
  assert.ok(result.includes("First-person"));
});

test("FaceTimeServerEvent type check includes portalInvite with FaceTimePortalInvite payload", () => {
  const portal: FaceTimePortalInvite = {
    locationName: "Leonardo's Studio",
    portalPrompt: "Sunlit studio with unfinished Mona Lisa on easel",
  };

  const event: FaceTimeServerEvent = {
    type: "portalInvite",
    portal,
  };

  assert.equal(event.type, "portalInvite");
  assert.equal(event.portal.locationName, "Leonardo's Studio");
  assert.equal(
    event.portal.portalPrompt,
    "Sunlit studio with unfinished Mona Lisa on easel"
  );

  const serialized = JSON.stringify(event);
  const parsed = JSON.parse(serialized) as FaceTimeServerEvent;
  assert.equal(parsed.type, "portalInvite");
  if (parsed.type === "portalInvite") {
    assert.equal(parsed.portal.locationName, "Leonardo's Studio");
    assert.equal(
      parsed.portal.portalPrompt,
      "Sunlit studio with unfinished Mona Lisa on easel"
    );
  }
});

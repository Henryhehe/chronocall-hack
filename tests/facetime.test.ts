import test from "node:test";
import assert from "node:assert/strict";
import {
  computeInitials,
  normalizeHistoricalProfile,
  normalizeVoiceName,
  resolveActiveVideoLayer,
  slugifyFigureId,
} from "../shared/facetime.ts";

test("normalizeVoiceName defaults unknown values to Charon and preserves valid voices", () => {
  assert.equal(normalizeVoiceName("Kore"), "Kore");
  assert.equal(normalizeVoiceName("Zephyr"), "Zephyr");
  assert.equal(normalizeVoiceName("UnknownVoice"), "Charon");
  assert.equal(normalizeVoiceName(undefined), "Charon");
});

test("computeInitials and slugifyFigureId handle single and multi-word historical names", () => {
  assert.equal(computeInitials("Leonardo da Vinci"), "LV");
  assert.equal(computeInitials("Cleopatra"), "CL");
  assert.equal(slugifyFigureId("Marie Skłodowska Curie"), "marie-sk-odowska-curie");
});

test("normalizeHistoricalProfile populates complete defaults for custom dialed figures", () => {
  const profile = normalizeHistoricalProfile(
    { name: "Nikola Tesla", era: "1899 · Colorado Springs" },
    "search"
  );
  assert.equal(profile.name, "Nikola Tesla");
  assert.equal(profile.era, "1899 · Colorado Springs");
  assert.equal(profile.sourceType, "search");
  assert.equal(profile.initials, "NT");
  assert.equal(profile.voiceName, "Charon");
  assert.ok(profile.systemPersona.includes("Nikola Tesla"));
  assert.ok(profile.starterQuestions.length >= 3);
  assert.ok(profile.portraitPrompt.length > 20);
});

test("resolveActiveVideoLayer always avoids blank screens and follows hybrid priority", () => {
  // Never shows genie/veo until frames/media are ready
  assert.equal(
    resolveActiveVideoLayer({ mode: "hybrid", genieHasFrame: false, veoReady: false }),
    "portrait"
  );
  assert.equal(
    resolveActiveVideoLayer({ mode: "genie", genieHasFrame: false, veoReady: true }),
    "portrait"
  );
  assert.equal(
    resolveActiveVideoLayer({ mode: "veo", genieHasFrame: true, veoReady: false }),
    "portrait"
  );

  // Hybrid upgrades cleanly: portrait -> genie -> veo
  assert.equal(
    resolveActiveVideoLayer({ mode: "hybrid", genieHasFrame: true, veoReady: false }),
    "genie"
  );
  assert.equal(
    resolveActiveVideoLayer({ mode: "hybrid", genieHasFrame: true, veoReady: true }),
    "veo"
  );

  // Explicit portrait lock stays on portrait even if higher layers are ready
  assert.equal(
    resolveActiveVideoLayer({ mode: "portrait", genieHasFrame: true, veoReady: true }),
    "portrait"
  );
});

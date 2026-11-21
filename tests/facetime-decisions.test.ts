import test from "node:test";
import assert from "node:assert/strict";
import {
  formatConfidencePercent,
  formatDecisionVerdictLabel,
} from "../shared/facetime.ts";

test("formatDecisionVerdictLabel returns concise user-facing labels for Decisions API verdicts", () => {
  assert.equal(formatDecisionVerdictLabel("verified"), "Historically Grounded");
  assert.equal(formatDecisionVerdictLabel("plausible_persona"), "In-Era Persona");
  assert.equal(formatDecisionVerdictLabel("anachronism"), "Anachronism Flagged");
});

test("formatConfidencePercent clamps and formats calibrated probabilities", () => {
  assert.equal(formatConfidencePercent(0.942), "94%");
  assert.equal(formatConfidencePercent(1.4), "100%");
  assert.equal(formatConfidencePercent(-0.2), "0%");
  assert.equal(formatConfidencePercent(Number.NaN), "0%");
});

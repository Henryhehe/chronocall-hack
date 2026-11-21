import test from "node:test";
import assert from "node:assert/strict";
import {
  clampAnnotationBox,
  type FaceTimeArtifactRequest,
  type FaceTimeArtifactResult,
  type FaceTimeCallerAnnotation,
  type FaceTimeServerEvent,
} from "../shared/facetime.ts";

test("clampAnnotationBox clamps normal bounding boxes within 0..1000", () => {
  const box = clampAnnotationBox({
    ymin: 200,
    xmin: 150,
    ymax: 800,
    xmax: 750,
  });

  assert.equal(box.ymin, 200);
  assert.equal(box.xmin, 150);
  assert.equal(box.ymax, 800);
  assert.equal(box.xmax, 750);
});

test("clampAnnotationBox clamps negative and out-of-range (>1000) coordinates", () => {
  const box = clampAnnotationBox({
    ymin: -50,
    xmin: -100,
    ymax: 1500,
    xmax: 2000,
  });

  assert.equal(box.ymin, 0);
  assert.equal(box.xmin, 0);
  assert.equal(box.ymax, 1000);
  assert.equal(box.xmax, 1000);
});

test("clampAnnotationBox flips inverted coordinate bounds (ymin > ymax, xmin > xmax)", () => {
  const box = clampAnnotationBox({
    ymin: 850,
    xmin: 900,
    ymax: 250,
    xmax: 300,
  });

  assert.ok(box.ymin <= box.ymax, `ymin (${box.ymin}) should be <= ymax (${box.ymax})`);
  assert.ok(box.xmin <= box.xmax, `xmin (${box.xmin}) should be <= xmax (${box.xmax})`);
  assert.equal(box.ymin, 250);
  assert.equal(box.ymax, 850);
  assert.equal(box.xmin, 300);
  assert.equal(box.xmax, 900);
});

test("clampAnnotationBox handles NaN, non-number, and empty inputs with safe fallbacks", () => {
  const box = clampAnnotationBox({
    ymin: Number.NaN,
    xmin: undefined,
    ymax: Infinity,
    xmax: null as unknown as number,
  });

  assert.ok(box.ymin >= 0 && box.ymin <= 1000);
  assert.ok(box.xmin >= 0 && box.xmin <= 1000);
  assert.ok(box.ymax >= 0 && box.ymax <= 1000);
  assert.ok(box.xmax >= 0 && box.xmax <= 1000);
  assert.ok(box.ymin < box.ymax);
  assert.ok(box.xmin < box.xmax);
});

test("clampAnnotationBox guarantees minimum bounding box dimensions for visibility", () => {
  const box = clampAnnotationBox({
    ymin: 500,
    xmin: 500,
    ymax: 500,
    xmax: 500,
  });

  assert.ok(box.ymax - box.ymin >= 10);
  assert.ok(box.xmax - box.xmin >= 10);
});

test("FaceTime caller annotation and artifact event contracts are valid", () => {
  const annotation: FaceTimeCallerAnnotation = {
    label: "Smartphone",
    historicalName: "Luminescent Glass Scrying Slate",
    note: "A mirror that shines with its own cold luminescence without flame!",
    ymin: 150,
    xmin: 200,
    ymax: 750,
    xmax: 800,
  };

  const annotationEvent: FaceTimeServerEvent = {
    type: "callerAnnotation",
    annotation,
  };
  assert.equal(annotationEvent.type, "callerAnnotation");
  assert.equal(annotationEvent.annotation.historicalName, "Luminescent Glass Scrying Slate");

  const artifactReq: FaceTimeArtifactRequest = {
    title: "Study of an Aerial Screw",
    description: "Helical spiral blade apparatus demonstrating vertical air lift.",
    stylePrompt: "Sepia ink wash on aged parchment.",
  };

  const artifactReqEvent: FaceTimeServerEvent = {
    type: "artifactRequest",
    artifact: artifactReq,
  };
  assert.equal(artifactReqEvent.type, "artifactRequest");
  assert.equal(artifactReqEvent.artifact.title, "Study of an Aerial Screw");

  const artifactRes: FaceTimeArtifactResult = {
    title: artifactReq.title,
    description: artifactReq.description,
    imageDataUrl: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
    mimeType: "image/svg+xml",
    model: "demo",
    latencyMs: 0,
    demoMode: true,
  };
  assert.equal(artifactRes.demoMode, true);
  assert.ok(artifactRes.imageDataUrl.startsWith("data:image/"));
});

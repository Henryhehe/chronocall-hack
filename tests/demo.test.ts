import test from "node:test";
import assert from "node:assert/strict";
import { demoServices } from "../server/services/demo.ts";

test("demo services run without a key or network and identify their sample output", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("Demo mode must not make network requests"); };
  try {
    const detection = await demoServices.detectObjectsInFrame({ imageBase64: "sample", mimeType: "image/jpeg" });
    assert.equal(detection.model, "demo");
    assert.deepEqual(detection.objects, []);
    const scene = await demoServices.generateLowPolyScene({ scenePrompt: "test" });
    assert.ok(scene.objects.length > 0);
    assert.equal(scene.model, "demo");
    const photo = await demoServices.transformSelfieToCharacterWorld({ imageBase64: "sample", mimeType: "image/jpeg", characterPrompt: "test" });
    assert.equal(photo.imageDataUrl, "data:image/jpeg;base64,sample");
    assert.match(photo.note ?? "", /no AI transformation/);
    await assert.rejects(demoServices.createGenieSession(), /unavailable in demo mode/);
  } finally { globalThis.fetch = originalFetch; }
});

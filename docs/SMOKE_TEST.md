# Demo smoke test

Run on the presentation laptop after merging. Record pass/fail and the commit tested in the PR or team chat.

## Without a key

1. Run `bun run setup`, `bun run doctor`, and `bun run dev:demo`. Open localhost. Confirm the demo banner and `/api/health` reports `demoMode: true`.
2. Start the camera; switch devices if available. The selected feed should keep playing. Deny permission once and confirm a useful error.
3. Upload an image and a video. Confirm previews work and detection explicitly reports demo mode.
4. With the camera running, switch to World and capture from the active feed. Confirm a photo is captured; return to Live Vision and confirm the feed still works.
5. In Three.js, move with WASD, orbit, interact, generate a sample scene, and spawn a sample object.
6. Try voice and Genie streaming. Both should explain that demo mode does not support them; the voice microphone/connecting state should stop.
7. Stop the camera and confirm its indicator turns off. Navigate/reload; no orphaned audio should continue.

## With a hackathon key

1. Set the key in `.env.local`, stop the demo, and run `bun run dev`. Confirm no demo banner. Do not record or share credentials.
2. Detect a visible object and ask about the frame. Confirm model responses and latency.
3. Start voice and wait for readiness. Ask for an object highlight; confirm audio, transcript, and overlay.
4. Stop/restart voice quickly; navigate to World while voice is active. Confirm the old session stops and only one microphone session remains.
5. Take a photo, select a historical persona, and generate the character image. Verify it changed and came from the real model.
6. Generate a Three.js scene/object; use voice to request rain or a lighting change.
7. Separately launch Genie streaming. Verify first frame, movement, steering, audio, and termination on the venue network.
8. Restart the backend during voice. The UI should stop streaming and allow reconnecting.

## Production rehearsal

Stop development, run `bun run build`, then `bun run start`. Verify health, navigation, detection, and voice on the same port. Keep a short recording of a successful flow as a fallback.

Model availability, browser permissions, audio hardware, and WebRTC media are not covered by fixture tests.

## Museum AR

Open `/museum`; verify the Washington portrait and curatorial controls load, and the link back opens the original workspaces. In demo mode, check that AI requests show the unavailable message. With a real key, test a portrait upload, camera anchor tracking, text response, voice start/stop, and a mobile QR link that opens `/museum` over HTTPS. Confirm the original `/ws/live` voice still works independently. These real-model and browser checks have not been automated.

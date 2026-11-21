# Demo smoke test

Run on the presentation laptop after merging. Record pass/fail and the commit tested in the PR or team chat.

## Without a key

1. Run `npm run setup`, `npm run doctor`, and `npm run dev:demo`. Open localhost. Confirm the demo banner and `/api/health` reports `demoMode: true`.
2. Start the camera; switch devices if available. The selected feed should keep playing. Deny permission once and confirm a useful error.
3. Upload an image and a video. Confirm previews work and detection explicitly reports demo mode.
4. With the camera running, switch to World and capture from the active feed. Confirm a photo is captured; return to Live Vision and confirm the feed still works.
5. In Three.js, move with WASD, orbit, interact, generate a sample scene, and spawn a sample object.
6. Try voice and Genie streaming. Both should explain that demo mode does not support them; the voice microphone/connecting state should stop.
7. Stop the camera and confirm its indicator turns off. Navigate/reload; no orphaned audio should continue.

## With a hackathon key

1. Set the key in `.env.local`, stop the demo, and run `npm run dev`. Confirm no demo banner. Do not record or share credentials.
2. Detect a visible object and ask about the frame. Confirm model responses and latency.
3. Start voice and wait for readiness. Ask for an object highlight; confirm audio, transcript, and overlay.
4. Stop/restart voice quickly; navigate to World while voice is active. Confirm the old session stops and only one microphone session remains.
5. Take a photo, select a historical persona, and generate the character image. Verify it changed and came from the real model.
6. Generate a Three.js scene/object; use voice to request rain or a lighting change.
7. Separately launch Genie streaming. Verify first frame, movement, steering, audio, and termination on the venue network.
8. Restart the backend during voice. The UI should stop streaming and allow reconnecting.

## Production rehearsal

Run `npm run check`: it includes a production build and an isolated production-server check using fixtures. To rerun just that check after a build, use `npm run test:production`.

Stop development, then run `DEMO_MODE=true npm run start` for a fixture rehearsal, or `npm run start` with `DEMO_MODE=false` and the real key configured. Verify navigation, detection, and voice on the same port. Keep a short recording of a successful flow as a fallback.

For an already-running production fixture server, run `node scripts/smoke.mjs http://localhost:3000 --demo`. Replace the URL with the hosted HTTPS origin to test the deployed container. The check verifies production HTML/assets, JSON API routing, fixture responses, and the live WebSocket demo error/closure. Without `--demo`, it skips model/voice requests. It is not a browser rendering or real-AI test.

Record commit, environment (local/container/hosted), browser/device, fixture versus real mode, and pass/fail for each manual step. See [DEPLOYMENT.md](DEPLOYMENT.md) and the [presentation runbook](DEMO_RUNBOOK.md).

Model availability, browser permissions, audio hardware, and WebRTC media are not covered by fixture tests.

## Museum AR

Open `/museum`; verify the Washington portrait and curatorial controls load, and the link back opens the original workspaces. In demo mode, check that AI requests show the unavailable message. With a real key, test a portrait upload, camera anchor tracking, text response, voice start/stop, and a mobile QR link that opens `/museum` over HTTPS. Confirm the original `/ws/live` voice still works independently. These real-model and browser checks have not been automated.


## Integrated historical call features

1. Restart the server after merging. In demo mode, open `/facetime`, choose **Find artwork**, search Washington, switch artwork filters, and select an alternative. The call should start only after selection by default. Close the dialog during search/download and confirm no late call opens. Test Escape and keyboard focus restoration.
2. Start a demo call. At a 375px viewport, confirm the six primary controls fit. Open **More call actions**, take a photo together, retake it, download it, and close with Escape. Confirm retake produces one request and pending work stops updating the dialog after closure.
3. Use **Step into their world** and return to the call. Demo mode must explain any unavailable live streaming. Ask for a sketch and confirm the local sample appears and downloads. End the call during generation; no late keepsake should appear.
4. Open chat and use **Show Object (Demo)**. Confirm the camera annotation is visible and dismissible. Check captions, chat, mic, camera, flip camera, and end-call behavior independently.
5. With a real key, rehearse museum artwork retrieval, caller camera inspection, the world portal, selfie and sketch generation. Expand the call details to inspect grounding. Verify one Decisions API request per completed live turn, with no duplicate `/api/facetime/decision` request from the browser. Text fallback should still use the HTTP endpoint. Model failures must leave the call usable.
6. Confirm `/`, `/workspaces`, `/museum`, and `/facetime` remain reachable after the rollup. Repeat the production check with `npm run check` outside restricted environments.

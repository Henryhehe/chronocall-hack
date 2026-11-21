# Architecture and interfaces

## Runtime

`server/index.ts` loads configuration, selects real or demo services, creates Express, attaches voice, and serves the frontend. Development uses Vite middleware on the same HTTP server; production serves `dist/`. Browser API/WebSocket URLs use the current origin.

`server/app.ts` exposes a testable app without opening a port. `server/config.ts` owns environment precedence and port validation. Configuration loads relative to the repository, not the shell's current directory.

## Frontend ownership

| Module | Responsibility |
| --- | --- |
| `src/app/App.tsx` | Navigation, detection/Q&A state, connecting workspaces |
| `src/features/vision/useMediaSource.ts` | Permissions, tracks, uploads, capture elements |
| `src/features/vision/components/` | Viewport, controls, filters, inspector, logs |
| `src/features/character/components/HistoricalOverlay.tsx` | Persona options and costume overlays |
| `src/features/live/useLiveSession.ts` | Microphone, audio, frame cadence, transcripts, cancellation |
| `src/features/live/liveConnection.ts` | WebSocket readiness/closure; gates input until server readiness |
| `src/features/world/components/GenieWorldView.tsx` | World workspace UI and engine orchestration |
| `src/features/world/components/Interactive3DWorld.tsx` | Rendering, player input, interactions, effects |
| `src/features/world/three/` | Scenes, themes, textures, sound |
| `src/features/world/lib/genie.ts` | Seed compression and WebRTC controls |

The world workspace remains a substantial UI component. Split future controls into smaller components within the feature rather than copying it into more screens.

The camera stage stays mounted when hidden so its refs remain valid in World. Switching into World stops the camera workspace's voice session; world-specific resources stop when World unmounts. The main media hook survives navigation.

## HTTP contracts

POST bodies are JSON. Images use raw base64 or data URLs in `imageBase64`; `mimeType` defaults to JPEG. Detection boxes use 0–1000 coordinates. Errors return `{ "error": "message" }`.

| Route | Required input | Success output / owner |
| --- | --- | --- |
| `GET /api/health` | None | `ok`, `demoMode`, `apiKeyConfigured`; never secret values |
| `POST /api/detect` | `imageBase64` | `summary`, `objects`, timing/model; vision service |
| `POST /api/ask` | `imageBase64`, `question` | `answer`, timing/model; vision service |
| `POST /api/character-world/transform` | `imageBase64` | `imageDataUrl`, `mimeType`, optional `note`, timing/model |
| `POST /api/world/interact` | `objectName` | `reply`, `worldEffect`, timing |
| `POST /api/world/generate-scene` | `scenePrompt` | Scene palette and objects; see `src/types/world3d.ts` |
| `POST /api/world/spawn-object` | `objectPrompt` | `object`, timing/model |
| `POST /api/genie/session` | None | `interactionId`, ephemeral `authToken` |
| `POST /api/genie/proxy/v1beta/interactions/:idWithAction` | SDK signaling body; ID ending `:webrtc`; ephemeral token header | WebRTC signaling response |

Optional vision inputs include `model`, `focusPrompt` (detection), and `characterPersona`. Character/world endpoints accept `personaId` where applicable. Keep validation in the relevant route module.

## Live voice protocol

`/ws/live` bridges the browser and Gemini. Optional query parameters: `mode=world`, `persona`, `worldContext`, and extended-thinking `model`. Message types live in `shared/live.ts`.

- Browser input: `audio` (PCM16, 16 kHz), `video` (JPEG), or `text`.
- Lifecycle: `status: connecting`, then `status: connected` after SDK setup finishes; `status: closed` or `error` stops the client.
- Output: PCM24 kHz audio, transcripts, interruption/turn completion, `highlightObjects`, `steerWorld`.
- Browser transport open is not model readiness. The client gates input until the server announces readiness.
- Server close listeners are registered before awaiting upstream connection, so disconnects during setup cannot orphan a later session.

## Services and fixtures

`server/services/types.ts` defines the service boundary. Gemini implementations are grouped by feature; `client.ts` owns SDK creation, `personas.ts` holds instructions, and `shared/models.ts` holds model IDs.

`server/services/demo.ts` supplies fixed local responses when `DEMO_MODE=true`; it does not analyze camera images. Genie routes and voice reject demo connections instead of pretending to stream.

## Checks

`tests/*.test.ts` uses Node 24's TypeScript support and test runner for config, voice lifecycle, and fixtures. Integration tests exercise actual Express routes using fixtures. `bun run check` adds TypeScript and Vite checks. CI needs no Gemini secrets.

References: [Live SDK implementation](https://github.com/googleapis/js-genai/blob/main/src/live.ts), [Bun frozen installs](https://bun.sh/docs/pm/cli/install).

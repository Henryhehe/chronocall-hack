# Chronocall

A hackathon prototype for camera-based historical characters, live conversations, and interactive worlds. React, TypeScript, and Three.js run in the browser; one Node/Express server hosts the UI, Gemini HTTP calls, and live voice WebSocket.

**Demo story:** show a modern object to the camera, explore how a historical character interprets it, then enter and change a playable world.

[Local setup](#start-locally) · [Features](#whats-in-the-app) · [Deployment](#deploy) · [Demo runbook](docs/DEMO_RUNBOOK.md) · [Architecture/API](docs/ARCHITECTURE.md) · [Contributing](CONTRIBUTING.md)

## What's in the app

| Screen / feature | Implemented behavior | Demo mode without a key |
| --- | --- | --- |
| **Discover / learning home** | Featured portrait, look → ask → reflect introduction, and four concise experience entry points | Available without model calls |
| **Portrait gallery / Museum AR** | Washington portrait, animated layers, camera anchor tracking, camera/upload identification, hotspots, typed questions with optional TTS, live character voice, mobile QR | Bundled portrait/visual controls work; identification, character replies, and voice explicitly unavailable |
| **Live Vision** | Camera selection, screen sharing, image/video upload; one-shot or timed detection; focus prompt, confidence filtering, clickable boxes, frame Q&A, annotated snapshot download | Media preview and controls work; detection returns no inferred boxes; Q&A returns a labeled placeholder |
| **Live voice** | Microphone + sampled video over WebSocket; spoken replies, transcripts, interruption, model-triggered object highlights; standard/extended-thinking model selection | Explicitly unavailable |
| **Character Mirror** | Roman Senator, Renaissance Polymath, Victorian Inventor, Edo Samurai, Ancient Pharaoh; SVG costumes anchored to detected face/body boxes; persona-aware detection and typed Q&A | Persona controls work; no tracked costume without real detection boxes |
| **Visual filters** | Original, Sepia, High Contrast, Sketch, Noir, Night Vision; intensity control and snapshot filtering | Runs in the browser; these are visual effects, not AI-generated images |
| **Genie 4 World → Interactive 3D World** | Three.js avatar with optional photo texture; Courtyard, Cyberpunk, Medieval, Sci-Fi presets; movement, jump/sprint, orbit/zoom, object interaction and effects | Presets, movement, photo texture, and local steering work |
| **3D scene/object generation** | Text-to-scene JSON blueprints rendered as Three.js geometry; spawn a prop; model-written object replies | Fixed crystal courtyard/props and sample interaction replies |
| **Photo transformation** | Take/upload a photo or snap the active feed; model transforms the person and environment; transformed image can seed Genie or texture the 3D avatar | Returns the original photo unchanged |
| **World conversation and steering** | Persona-aware live voice and tool-driven world changes; text/preset events change the 3D scene or steer an active Genie session | Text/preset steering works in Three.js; voice is disabled |
| **Genie 4 World → Genie 4 Video** | Separate WebRTC video world, text or image seed, keyboard/touch movement, audio toggle, mid-session steering, 120-second UI session timer | Explicitly unavailable |
| **Detection Log** | Search/filter frame and live-tool detections; JSON export includes detection history, Q&A, and camera-workspace voice transcripts; clear log | Works with sample responses |
| **Compare Modes** | Current-session counts, average detection/Q&A latency, and a transport/capability comparison | Displays demo/session values; not a model benchmark |
| **My notebook** | Save observations and questions to verify; browser-local storage; Markdown download | Available without model calls |

**3D controls:** WASD or arrow keys to move, Shift to run, Space to jump, E or click to interact, drag to orbit, scroll/controls to zoom. Click outside a text field before using movement keys. Genie Video has its own movement controls; it does not share the Three.js scene state.

## Start locally

Install **Node.js 24** ([download](https://nodejs.org/en/download), or `nvm install` using `.nvmrc`) and **Bun 1.3.3+** ([installation](https://bun.sh/docs/installation)). Bun manages dependencies; Node runs the server. The checked-in `bun.lock` is the team's dependency baseline.

```bash
git clone https://github.com/Henryhehe/chronocall-hack.git
cd chronocall-hack
bun run setup
bun run dev:demo
```

Open **http://localhost:3000**. Setup installs locked dependencies and creates `.env.local` only if it does not exist.

Already in this workspace? Run the commands inside `gemini-live-vision-nov-21-2026-12-16-49-pm/`, the directory containing `package.json`, not its parent `Gemini 4/` directory. In the GitHub repository, that directory's contents are the repository root.

**Demo mode needs no API key.** Camera previews, uploads, preset worlds, movement, local interactions, and sample scene/object generation work. A banner identifies demo responses. Detection returns no inferred objects; photo transformation retains the original photo. Live voice and Genie streaming are disabled. This mode is for UI development, not demonstrating model quality. Install dependencies before working offline; web fonts fall back to local fonts without a network.

## Museum AR (Demi contribution)

Open **http://localhost:3000/museum** or choose **Portrait gallery** in the learning navigation. This workspace includes the Washington portrait anchor, camera/upload recognition, portrait animation, curatorial hotspots, character conversation, and a mobile QR preview. The shared discovery page is at `/`; direct links to the vision and world workspaces are `/#live` and `/#genie`.

Museum recognition and conversation require a Gemini key; demo mode returns an explicit unavailable response for these model calls. Camera access on a phone requires an HTTPS deployment. Set `APP_URL` to the public origin if the QR preview cannot infer it correctly. Museum voice uses `/ws/museum`; the original voice bridge remains at `/ws/live`.

## Use real Gemini features

Add your hackathon key to the ignored `.env.local` file:

```dotenv
GEMINI_API_KEY=your_key_here
DEMO_MODE=false
PORT=3000
```

Stop the demo server and run `bun run dev`. Restart after changing environment variables. Shell variables take precedence over `.env.local`, which takes precedence over `.env`. Keys remain on the server. Never put a secret in a `VITE_` variable or commit real credentials.

Core model IDs live in [`shared/models.ts`](shared/models.ts); Museum currently declares its IDs separately in [`server/museum.ts`](server/museum.ts). The app retains the hackathon model IDs from the AI Studio export; your key must have access to those models. Museum identification/text uses Hydrogen and museum live voice uses the standard Live model.

| Purpose | Configured model ID |
| --- | --- |
| Default detection, Q&A, scene/prop generation, object interactions | `gemini-4-hydrogen` |
| Optional vision/structured generation model | `gemini-4-neon` |
| Photo-to-character image | `gemini-3.1-flash-lite-image` |
| Live voice/video | `gemini-3.8-live` |
| Extended-thinking live voice/video | `gemini-3.8-live-extended-thinking` |
| Museum spoken response (TTS) | `gemini-3.8-flash-lite-tts` |
| Genie video world | `models/genie-4` |

These are code configuration values, not a claim that every public Gemini key can access them. A configured key or healthy server does not verify model entitlement. Test each model-backed feature with the event key before presenting.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `GEMINI_API_KEY` | Empty | Server-side key for real model calls; unnecessary for fixtures |
| `DEMO_MODE` | `false` | Exactly `true` selects fixtures and disables voice/Genie |
| `PORT` | `3000` | UI, HTTP API, and WebSocket share this port; hosts may inject a different value |
| `HOST` | `0.0.0.0` | Bind address; use `127.0.0.1` for laptop-only access |
| `NODE_ENV` | Unset | `production` serves `dist/`; `bun run start` also forces production |
| `APP_URL` | Inferred from request | Public HTTPS origin used for Museum AR QR links; leave empty locally |
| `DISABLE_HMR` | Unset | Optional development-only setting; `true` disables Vite HMR/file watching |

## Commands

| Command | Purpose |
| --- | --- |
| `bun run setup` | Install locked dependencies and create local configuration safely |
| `bun run doctor` | Check Node, Bun, dependencies, and key presence; never prints the key |
| `bun run dev:demo` | UI + API using local fixtures; no model calls |
| `bun run dev` | Full app with frontend hot reload and backend restart |
| `bun run typecheck` | Check client, server, shared contracts, and tests |
| `bun run test` | Node regression tests; only Node 24 required |
| `bun run test:api` | Express integration tests with fixtures; dependencies required |
| `bun run check` | Typecheck, regression/API tests, frontend build, and full production-server smoke check |
| `bun run build` | Build the browser app into `dist/` |
| `bun run start` | Serve the built UI, HTTP API, and WebSocket together; build first |
| `bun run test:production` | Start the built app on a temporary port, check fixtures/assets/WebSocket, and stop it; build first |
| `node scripts/smoke.mjs http://localhost:3000 --demo` | Check an already-running production demo server |

Use `bun run test`, not `bun test`, so the Node test runner is used. `bun run preview` is an alias for the full production server; running Vite alone does not provide the API or voice bridge. Production needs installed runtime dependencies including `tsx`: install with `bun install --frozen-lockfile`, build, then start.

## Deploy

Follow the [release checklist](docs/RELEASE_CHECKLIST.md) to validate, publish, rehearse, and roll back the complete app, including Museum AR.

The repo includes a [Dockerfile](Dockerfile), secret-excluding [.dockerignore](.dockerignore), and [Render Blueprint](render.yaml). Render is the documented target because the existing Node server needs both inbound and outbound WebSockets. A static-site upload of `dist/` alone cannot run the API or voice bridge.

1. Commit/push the complete working tree, including the existing server/feature refactor and deployment files, to the branch you intend to deploy. Run `bun run check` first. Do not deploy only the new README/Dockerfile over the original export.
2. In [Render](https://dashboard.render.com/), create a **Blueprint**, connect `Henryhehe/chronocall-hack`, and select that branch. Use `render.yaml` from the repository root.
3. The Blueprint requests one free Docker web service in **demo mode**, with manual deploys and `/api/health` checks. No Gemini key is required for this first deployment.
4. Open the returned HTTPS URL, then run `node scripts/smoke.mjs https://YOUR-SERVICE.onrender.com --demo`. Warm an idle free service in the browser before running this check.
5. For real AI, follow [Deployment](docs/DEPLOYMENT.md) to configure the server-side key, switch demo mode off, and rehearse voice/WebRTC on the venue network.

To rehearse production locally:

```bash
bun run check
# Separate terminal; keep this running while opening localhost:3000:
DEMO_MODE=true bun run start
```

Or, with Docker installed:

```bash
docker build -t chronocall .
docker run --rm --name chronocall -p 127.0.0.1:3000:3000 -e DEMO_MODE=true chronocall
```

See [deployment settings, real-key activation, rollback, and limitations](docs/DEPLOYMENT.md). Adding these files does not create a hosted service; a hosting account/repository connection is still needed. Free Render instances sleep when idle, so open the site before the presentation. Provider references: [WebSockets](https://render.com/docs/websocket), [Docker](https://render.com/docs/docker), [Blueprints](https://render.com/docs/blueprint-spec), [free-instance limits](https://render.com/docs/free).

## Present the demo

Use the [three-minute demo runbook](docs/DEMO_RUNBOOK.md) for exact actions, prompts, and fallbacks. Keep **Three.js** as the main world flow; include **Genie Video** only after a successful rehearsal with the event key and venue network. Demo mode is a clearly labeled UI fallback, not evidence of real model capability.

## Where to contribute

| Area | Main paths |
| --- | --- |
| App integration and navigation | `src/app/` |
| Camera, detection controls, filters, logs | `src/features/vision/` |
| Historical personas and costume overlays | `src/features/character/` |
| World workspace, Three.js scenes, Genie transport | `src/features/world/` |
| Museum AR, portrait tracking, character voice | `src/features/museum/`, `server/museum.ts` |
| Shared microphone/audio/voice lifecycle | `src/features/live/` |
| HTTP validation and responses | `server/routes/` |
| Gemini prompts, schemas, model calls | `server/services/gemini/` |
| Live voice server bridge | `server/live/` |
| Model IDs and live protocol | `shared/` |
| Setup, production checks, and hosting | `scripts/`, `Dockerfile`, `render.yaml`, `.github/workflows/ci.yml` |

Read [CONTRIBUTING.md](CONTRIBUTING.md) before branching. See the [architecture and API boundaries](docs/ARCHITECTURE.md) and [demo smoke test](docs/SMOKE_TEST.md).

## Troubleshooting

- Start with `bun run doctor`. Missing dependencies: rerun `bun run setup`.
- Registry/DNS errors: installation needs access to the public npm registry. The repo specifies that registry so a company-wide default does not affect this project. Don't change dependency versions to work around a connection failure.
- Port in use: set `PORT=3001` in `.env.local`, restart, and open that port.
- `ERR_MODULE_NOT_FOUND` for `tsx`: install the full lockfile, including dev dependencies. The server runs TypeScript through `tsx`; production-only dependency pruning currently removes it.
- `Missing production build`: run `bun run build` before `bun run start` or `bun run test:production`.
- Hosted page loads but API fails: deploy the Docker **web service**, not just static `dist/`; confirm `/api/health` returns JSON. Voice also needs `/ws/live` WebSocket upgrades on the same origin.
- Camera/microphone unavailable: use localhost or HTTPS, grant permissions, and check whether another app holds the device. A plain HTTP LAN IP is not a secure camera context.
- 403 / missing key: check `.env.local`, shell overrides, and hackathon model access. Never paste credentials into an issue.
- 429: lower detection cadence or stop automatic detection while debugging.
- Genie connects but stays black: check WebRTC/network access and use the Three.js engine for a fallback.
- Wrong GitHub account: SSH may use a different account from your browser. Confirm collaborator access; don't force-push.

## Current scope

- The avatar uses a photo texture and keyboard movement; full body/face retargeting is not implemented. Character Mirror uses SVG overlays positioned from sampled detection boxes.
- Three.js scenes and Genie video worlds are separate engines. Generated Three.js objects are geometry blueprints, not arbitrary imported 3D meshes. Text steering in Three.js maps to supported local effects.
- Camera-workspace live voice is a general vision assistant; historical persona conversation is configured in the World voice flow. Character Mirror's typed Q&A/detection uses the selected persona.
- There is no database, account system, multiplayer, or saved-world restore. Camera/world session state resets on reload; camera history is capped at 100 detection entries and 30 Q&A entries. Export before refreshing. Leaving the World workspace also resets its component state. Notebook reflections are the exception: they persist in browser local storage and can be downloaded as Markdown; they do not sync between devices.
- Museum animation/anchor tracking is a browser canvas effect. Model-inferred portrait identity, metadata, and historical dialogue require verification; this is not an authoritative museum catalog.
- Media sent for analysis travels through this server to Google in real mode. Demo mode handles fixture requests on this server without model calls; for a hosted demo, that still means uploads leave the browser. Genie uses an ephemeral client token and WebRTC. Long-lived API keys stay server-side.
- Authentication and public-use rate limiting are not implemented. Keep a publicly shared deployment in demo mode until access controls cover both the HTTP API and live WebSocket; a real-key public server allows visitors to consume its quota.
- Automated fixture checks do not prove camera/audio permissions, visual rendering, model access, or WebRTC connectivity. Follow the [smoke checklist](docs/SMOKE_TEST.md) for those.

### Verification record — 2026-11-21

Dependencies are now installed. Two service-contract type errors were fixed so scene/prop fixtures can retain the `demo` model label while using the same response shapes as Gemini.

| Check | Latest result |
| --- | --- |
| TypeScript (`npm run typecheck`) | Passed |
| Node regression tests (`npm test`) | All 8 passed |
| Production frontend (`npm run build`) | Passed; Vite reports a large-bundle warning |
| Built assets and Washington portrait | Present; configured server key absent from client JS/CSS |
| Local configuration | Key present, `DEMO_MODE=false`, port 3000; model access not verified |
| API integration / production-server smoke | Blocked by `listen EPERM` on localhost in this execution environment |
| Docker build/run | Docker installed; daemon socket access blocked by this execution environment |
| Browser, real-model, and hosted deployment checks | Not yet verified |

Bun is installed at `~/.bun/bin/bun` but is not on this session's PATH. Once dependencies are installed, the npm script equivalents work without Bun. To run the already-built app from your normal Mac Terminal:

```bash
cd "/Users/Chuanheng.He/Gemini 4/gemini-live-vision-nov-21-2026-12-16-49-pm"
npm run start
```

Open `http://localhost:3000`. This loads the ignored local configuration and its key without printing it. To repeat the complete automated checks from a terminal that can open local ports, run `npm run check`. No hosted deployment was created by this review. CI remains configured to check the app and Docker image when the complete changes are pushed.

Original AI Studio app: https://ai.studio/apps/a8853fcf-4129-461b-8257-8266d72421cb

Branch maintainers: follow the [integration guide](docs/BRANCH_INTEGRATION.md) for future Demi updates and safe merges into main.


## Connected learning experience

Chronocall opens on a discovery page that connects the existing features into a learning journey. The shared navigation is available inside every experience, including Museum AR. Browser Back/Forward and direct links select the corresponding workspace.

| Space | Link | Learning activity |
| --- | --- | --- |
| Discover | `/#home` | Choose an experience; begin with the included portrait without camera permission |
| Portrait gallery | `/museum` | Inspect artwork, explore hotspots, and ask the character questions |
| Visual discovery | `/#live` | Use camera, screen share, or uploads for observation and frame questions |
| Character studio | `/#character` | Select a historical persona and compare perspectives |
| World explorer | `/#genie` | Explore preset or generated scenes with the existing Three.js / Genie tools |
| My notebook | `/#notebook` | Save personal observations and questions to verify; export Markdown |
| Research tools | `/#log`, `/#compare` | Review session observations and compare responses |

Each experience has a guiding question and a suggested activity. Visual discovery and Character studio can insert that question into the existing prompt composer; the learner still submits it after adding media. Moving to Discover, the gallery, or the notebook stops the shared capture source. Moving out of visual/character exploration stops its live voice connection; the world can still reuse the capture feed. Museum media cleanup remains owned by the museum workspace.

Notebook reflections persist in browser local storage, independently of the in-memory detection and conversation histories. If storage is unavailable, the notebook reports session-only saving and offers a download. These are learner-authored notes, not automatically generated lesson summaries. Generated characters and worlds are explicitly presented as interpretations requiring verification.

### Suggested 3-minute education demo

1. **Discover:** introduce the idea of learning history through observation, dialogue, and exploration.
2. **Portrait gallery:** inspect the included artwork, choose a hotspot, and ask a follow-up question (model features require a configured key).
3. **Character studio:** add a camera feed or photo, choose a persona, and use the guiding question to compare perspectives.
4. **World explorer:** open a preset scene and explore its spatial choices; use generation only when the configured provider is ready.
5. **My notebook:** save one observation and one claim to verify, then download the reflection.

Without a key, demonstrate the included artwork, capture/upload UI, preset world, and notebook; museum AI dialogue and recognition are unavailable in demo mode. Do not present fixture responses as model results.

### Learning UI smoke check

- Open `/`, `/museum`, and `/#genie` directly; navigate between spaces and use browser Back/Forward.
- At phone width, check that the main navigation scrolls within its own row and cards/forms stack.
- Use keyboard navigation to reach the skip link, experience cards, guiding questions, and notebook fields.
- Start capture/live voice and leave for the notebook or gallery; confirm the previous media session stops.
- Save a reflection, reload, and export it; verify that blank observations cannot be saved.
- Check portrait and world interactions with real provider access separately from demo-mode UI checks.

### Characters contribution

Museum identification now uses a general era-aware character guide. `POST /api/research-figure` adds Google Search research, structured profiles, and Decisions API support checks (threshold 0.8). Persona helpers also support animal, object, and place speakers. The research endpoint and alternate-speaker helpers are available for frontend integration; the existing UI does not yet automatically request research or switch speakers. Research is disabled in demo mode. See [character pipeline](research/README.md).

## UI references

The discovery page uses [Google Arts & Culture Play](https://artsandculture.google.com/play) as a reference for a featured cultural experience and short invitations to explore, and [Brilliant](https://brilliant.org/) for guided questions and active learning. The implementation keeps Chronocall’s own artwork, colors, and components: one primary portrait action, a look → ask → reflect introduction, and compact links to all four workspaces. No external site assets or code are copied.

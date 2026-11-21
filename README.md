# Chronocall

A hackathon prototype for camera-based historical characters, live conversations, and interactive worlds. React, TypeScript, and Three.js run in the browser; one Node/Express server hosts the UI, Gemini HTTP calls, and live voice WebSocket.

## Start locally

Install **Node.js 24** ([download](https://nodejs.org/en/download), or `nvm install` using `.nvmrc`) and **Bun 1.3.3+** ([installation](https://bun.sh/docs/installation)). Bun manages dependencies; Node runs the server. The checked-in `bun.lock` is the team's dependency baseline.

```bash
git clone https://github.com/Henryhehe/chronocall-hack.git
cd chronocall-hack
bun run setup
bun run dev:demo
```

Open **http://localhost:3000**. Setup installs locked dependencies and creates `.env.local` only if it does not exist.

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

Model IDs live in [`shared/models.ts`](shared/models.ts). The app retains the hackathon model IDs from the AI Studio export; your key must have access to those models.

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
| `bun run check` | Typecheck, regression tests, API tests, and production frontend build |
| `bun run build` | Build the browser app into `dist/` |
| `bun run start` | Serve the built UI, HTTP API, and WebSocket together; build first |

Use `bun run test`, not `bun test`, so the Node test runner is used. `bun run preview` is an alias for the full production server; running Vite alone does not provide the API or voice bridge. Production needs installed runtime dependencies including `tsx`: install with `bun install --frozen-lockfile`, build, then start.

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

Read [CONTRIBUTING.md](CONTRIBUTING.md) before branching. See the [architecture and API boundaries](docs/ARCHITECTURE.md) and [demo smoke test](docs/SMOKE_TEST.md).

## Troubleshooting

- Start with `bun run doctor`. Missing dependencies: rerun `bun run setup`.
- Registry/DNS errors: installation needs access to the public npm registry. The repo specifies that registry so a company-wide default does not affect this project. Don't change dependency versions to work around a connection failure.
- Port in use: set `PORT=3001` in `.env.local`, restart, and open that port.
- Camera/microphone unavailable: use localhost or HTTPS, grant permissions, and check whether another app holds the device. A plain HTTP LAN IP is not a secure camera context.
- 403 / missing key: check `.env.local`, shell overrides, and hackathon model access. Never paste credentials into an issue.
- 429: lower detection cadence or stop automatic detection while debugging.
- Genie connects but stays black: check WebRTC/network access and use the Three.js engine for a fallback.
- Wrong GitHub account: SSH may use a different account from your browser. Confirm collaborator access; don't force-push.

## Current scope

The avatar uses a photo texture and keyboard movement; full body/face retargeting is not implemented. Three.js scenes and Genie video worlds are separate engines. Session/history state resets on reload. Authentication and public-use rate limiting are not implemented.

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

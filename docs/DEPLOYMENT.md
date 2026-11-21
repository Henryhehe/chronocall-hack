# Deployment

Deploy the full Node application as one long-running web service. It serves the built frontend, `/api/*`, and both `/ws/live` and `/ws/museum` from one origin. No database or persistent disk is required. The browser automatically uses `wss:` when the page uses HTTPS.

Start with the [release checklist](RELEASE_CHECKLIST.md) for the exact order, owners, and acceptance gates.

## Render: first deployment

The checked-in `render.yaml` builds the Dockerfile with Node 24 and Bun 1.3.3. It requests a free service in Virginia, starts in fixture mode, and disables automatic deployment so a teammate's push does not restart a presentation.

1. Run `bun run check` from the repository root. Commit and push **all** required code, including the contributor-layout changes, to the deployment branch. Check the branch in GitHub; the original imported commit alone does not include `server/index.ts`.
2. Sign in to [Render](https://dashboard.render.com/), connect GitHub with access to `Henryhehe/chronocall-hack`, and choose **New → Blueprint**.
3. Select the repository and the branch containing this work. Use `render.yaml` at the root. The local export folder name is **not** a Render root directory.
4. Review the service configuration and create it. This first deploy sets `DEMO_MODE=true`; do not add an API key yet.
5. Wait for a successful image build and `/api/health` check. Open the HTTPS service URL and confirm the demo banner.
6. From any machine with Node 24 and this repository, run:

   ```bash
   node scripts/smoke.mjs https://YOUR-SERVICE.onrender.com --demo
   ```

The smoke command checks health, production HTML, JavaScript/CSS assets, API validation, six fixture endpoints, museum deep links/portrait assets/mobile QR destination, Genie and museum rejection in demo mode, and both voice WebSocket error/close handshakes. It never intentionally starts a paid model session. `--demo` refuses fixture calls unless the server reports demo mode.

The Blueprint does not pin `branch`, so it follows the branch chosen during setup. When moving to `main`, update the service's linked branch and deploy that exact tested commit. The checked-in fixture setting is reapplied when the Blueprint is synchronized: change the Blueprint too if a deliberate switch to real mode must persist across syncs.

## Manual service settings

If creating a Web Service without a Blueprint, use:

| Setting | Value |
| --- | --- |
| Repository | `Henryhehe/chronocall-hack` |
| Branch | The branch with the complete app and deployment files |
| Runtime | Docker |
| Root directory / Docker context | Repository root / `.` |
| Dockerfile | `./Dockerfile` |
| Start command | Leave unset; use the image's `CMD` |
| Bind | `HOST=0.0.0.0`; use the platform-supplied `PORT` |
| Environment | `NODE_ENV=production`, `DEMO_MODE=true` |
| Health check | `/api/health` |
| Auto-deploy | Off during rehearsals/presentation |

Do not use a static-site service. `dist/` contains only the browser app; serverless request handlers alone also do not replace this persistent WebSocket bridge. The available Sites hosting workflow expects a Cloudflare Worker server entry, so this Node/Express app would need a separate runtime port to use that host.

## Enable real Gemini

Keep the same built image; configuration is read at server startup.

1. For a public host, first put the service behind access controls that protect **both HTTP and WebSocket upgrades**, or keep the model-backed demonstration on localhost. The app currently has no user authentication or per-user quota controls. Hiding the URL or keeping the key server-side does not restrict API usage.
2. Add `GEMINI_API_KEY` as a secret runtime environment variable in the hosting dashboard. Do not add it as a build argument, `VITE_` variable, Dockerfile instruction, or committed file.
3. Set `DEMO_MODE=false` and restart/redeploy. If managing configuration with the Blueprint, update its non-secret `DEMO_MODE` value deliberately; add the key directly in the dashboard.
4. Set `APP_URL=https://YOUR-SERVICE.onrender.com` (or your canonical custom-domain origin) for Museum AR phone links. Use no `/museum` suffix. Run the smoke command against this same origin. Confirm `/api/health` reports `demoMode: false` and `apiKeyConfigured: true`. This only checks key presence; it does not authenticate against Google or confirm any model access.
5. Run `node scripts/smoke.mjs https://YOUR-SERVICE.onrender.com` without `--demo`. It checks the page/assets and basic routing, but skips paid APIs and voice sessions. If access controls block the smoke client, verify those checks from an authenticated browser instead.
6. Complete the real-key section of [SMOKE_TEST.md](SMOKE_TEST.md), including museum recognition, museum text/TTS, both voice paths, photo generation, and Genie separately. Museum text-to-speech also uses `gemini-3.8-flash-lite-tts`, separately from the live voice model. These model IDs come from the event export; missing entitlement cannot be fixed by changing the deployment platform.

## Run the container locally

Requires Docker plus network access to the image and npm registries. The build installs the frozen Bun lockfile and builds Vite. The runtime runs as the unprivileged `node` user and includes `tsx`; it does not require Bun at runtime.

```bash
docker build -t chronocall .
docker run --rm --name chronocall -p 127.0.0.1:3000:3000 -e DEMO_MODE=true chronocall
```

In another terminal:

```bash
node scripts/smoke.mjs http://localhost:3000 --demo
docker stop chronocall
```

For real calls, keep the key in the ignored `.env.local`, using unquoted `KEY=value` lines compatible with Docker's env-file format:

```bash
docker run --rm --name chronocall -p 127.0.0.1:3000:3000 --env-file .env.local -e DEMO_MODE=false -e HOST=0.0.0.0 -e PORT=3000 chronocall
```

The final overrides ensure local `HOST`/`PORT` settings cannot break the container port mapping. Environment files are excluded from the image by `.dockerignore`; the container receives them only when explicitly provided at runtime. Keep the container attached to the terminal for the demo, or manage it using your host's process service.

## Rehearsal and rollback

- Render's free services sleep after 15 minutes without inbound traffic and can take about a minute to wake. Open the app well before presenting. Choose and review a paid instance separately if uninterrupted availability is required.
- Render supports inbound and outbound WebSockets. Genie WebRTC media additionally depends on the **browser/venue network**; a healthy server or successful voice handshake does not prove that Genie media can connect.
- The JSON body limit is 25 MB. Large uploaded photos may exceed it after base64 expansion. Resize images when necessary.
- Use HTTPS for camera/microphone access off localhost. A phone opening the laptop's plain HTTP LAN address cannot be assumed to have camera access.
- Stop voice/Genie before deploying; active connections are interrupted on restarts. Do not merge/redeploy during the presentation.
- Record the deployed commit and successful checks. Revert to the previous successful deployment in the host dashboard if a new one fails; restore the matching environment settings as needed. Keep auto-deploy disabled while investigating.
- Keep `bun run dev:demo` and a short recording of a successful real-model run available as distinct, labeled fallbacks.

## Validation and remaining setup

`bun run check` builds the frontend and launches a real production-mode Node server with fixtures on a temporary port. CI then builds the Docker image and repeats the transport check **inside the container**, catching missing files/dependencies in packaging.

These checks are configured but require dependencies and Docker to execute. See the dated verification record in [README.md](../README.md) for what has actually run. Publishing still requires an accessible hosting account, a pushed deployment branch, and successful provider builds; no deployment URL should be claimed until the host confirms success.

If an agent environment returns `listen EPERM` for localhost or denies access to the Docker daemon socket, that environment cannot perform the server/container rehearsal. This is separate from a compilation error. Run `npm run check` and `npm run start` in a normal local terminal with permission to listen, or use CI for the automated checks. Changing `PORT` does not resolve a permission denial. Do not mark the blocked network checks as passing.

Provider references, reviewed 2026-11-21: [Docker](https://render.com/docs/docker), [web services and HTTPS/ports](https://render.com/docs/web-services), [WebSockets](https://render.com/docs/websocket), [Blueprint configuration](https://render.com/docs/blueprint-spec), [free service behavior](https://render.com/docs/free).

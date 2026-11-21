# Chronocall release checklist

**Current presentation:** use the single-call Element 119 sequence in [DEMO_RUNBOOK.md](DEMO_RUNBOOK.md). Older museum/world walkthroughs below are optional feature checks, not the judging pitch.

Deploy one Docker web service on Render. It runs React assets, Express APIs, camera/world voice, and museum voice together. No database, separate frontend host, or persistent disk is needed for the current app. Use this checklist in order; detailed hosting settings are in [DEPLOYMENT.md](DEPLOYMENT.md).

## 1. Choose the release

Assign one release operator and one presenter. Use a reviewed commit containing all teammate contributions. The current workspace has uncommitted changes: review them before committing, and follow [BRANCH_INTEGRATION.md](BRANCH_INTEGRATION.md) for merges. Do not deploy a branch based only on its name.

From the directory containing `package.json`:

```bash
git status --short
git diff --stat
node --version
bun --version
npm install
npm run check
```

Required tools: Node 24 and Bun 1.3.3. `check` runs types, regression/API tests, Vite build, and a production server smoke test with paid calls disabled. A missing dependency or failed check blocks the release; do not treat an unexecuted check as a pass.

After reviewing, committing, and pushing the intended changes, record `git rev-parse HEAD`. Open a pull request or run the **Check** workflow manually on the deployment branch. CI also builds and starts the Docker image and checks it over HTTP and both WebSocket routes. Wait for that exact commit to pass.

## 2. Publish the fixture version

1. In [Render](https://dashboard.render.com/), choose **New → Blueprint**, connect `Henryhehe/chronocall-hack`, and select the tested branch.
2. Use the root `render.yaml`. The local export folder name is not a repository subdirectory.
3. Review the proposed free Docker service. Keep `DEMO_MODE=true` and automatic deployment off for this initial release.
4. Wait for the build and health check to succeed; record the HTTPS URL and deployed commit.
5. Open the URL to wake it, then run:

   ```bash
   node scripts/smoke.mjs https://YOUR-SERVICE.onrender.com --demo
   ```

This verifies the main page and compiled assets, `/museum`, the bundled Washington portrait, the QR destination, fixture APIs, explicit model-unavailable responses, and both voice bridges. It does not validate browser rendering or real Gemini access.

## 3. Rehearse the real features

Use [the real-key activation steps](DEPLOYMENT.md#enable-real-gemini). Keep the key in runtime secrets, set `DEMO_MODE=false`, and set `APP_URL` to the exact public HTTPS origin. The current app has no authentication or quota controls; the existing deployment guide describes access-controlled hosting or a localhost real-model rehearsal. Do not mistake the fixture version for a working AI demo.

Run the smoke command without `--demo` against the canonical origin. Then verify these separately with the event key and presentation devices:

| Area | Acceptance evidence | Fallback |
| --- | --- | --- |
| Camera / detection / typed Q&A | Real object boxes and a relevant answer from an actual frame | Uploaded photo; labeled recording if model fails |
| Historical character | Selected persona changes the interpretation; tracked overlay appears when detection supplies face/body boxes | Typed persona response |
| Photo transformation | A newly generated image, not the original fixture image | Original photo texture |
| Interactive 3D world | Movement, interaction, generated prop/scene, and a visible world change | Preset world and local effects |
| Camera/world voice (`/ws/live`) | Model readiness, audible response, transcript, and a demonstrated tool action | Typed controls |
| Museum (`/museum`) | Portrait asset, recognition, hotspot response, and spoken response | Explain the portrait UI; labeled recording |
| Museum voice (`/ws/museum`) | Spoken question and audible in-character answer | Museum typed question |
| Museum phone preview | Scan QR on an actual phone; HTTPS `/museum` loads and camera permission works | Present on laptop |
| Genie Video | Playable first frame, movement, and steering on the venue network | Interactive 3D World |

Model access is independent by feature. A green health check only proves server health and key presence. Museum TTS uses `gemini-3.8-flash-lite-tts`; camera/world live voice and museum live voice use live models; Genie has its own entitlement and WebRTC path.

## 4. Freeze and present

Use [DEMO_RUNBOOK.md](DEMO_RUNBOOK.md) for a three-minute vision-to-world story. For an education-focused presentation, use this alternate opening:

1. Open Museum AR with the bundled Washington portrait visible; show the curatorial hotspots.
2. Ask a rehearsed question such as “What made the winter campaign so difficult?” Show the answer and play its voice response, or use museum live voice after rehearsal.
3. Scan the phone QR to show the experience is accessible on a visitor's device. Rehearse this transition; use the laptop if the venue network is unreliable.
4. Move to the interactive world and demonstrate a spoken scene change. Present this as a separate exploration workspace; museum conversations are not transferred into the world.

Choose one main story. Keep the other workspaces ready for questions instead of rushing through every tab. Check the historical statements you intend to present against reliable sources; generated roleplay is not a primary historical source.

Before judging: keep automatic deployment off, open the service, grant media permissions, rehearse audio without feedback, and prepare a local fallback and a short recording. Free Render services can sleep after 15 minutes idle; for reliable availability, review a paid instance before the event. Stop active voice/Genie sessions before any restart.

## 5. Roll back and hand off

If the release fails, restore the last successful deploy in Render and its matching environment settings. Rerun the smoke command appropriate to that version's mode, then open both workspaces. Rollback does not preserve in-memory conversations or world state.

Keep a release record in the team's PR or handoff notes:

| Field | Record |
| --- | --- |
| Operator / presenter | Names |
| Branch / deployed commit | Exact branch and SHA |
| Canonical URL / Museum URL | HTTPS origin and `/museum` |
| Mode / instance plan | Fixture or real; free or selected paid plan |
| CI / hosted smoke | Run link and result |
| Real features verified | Results per row above; browser/device/network |
| Last working deploy | Commit/deployment reference |
| Fallback | Local launch command and recording location |

Do not include API keys in the release record. No hosted service is created by following the local verification steps alone.

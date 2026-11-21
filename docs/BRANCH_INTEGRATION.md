# Integrating contribution branches

## Current integration

Demi's commit `70cb42e` is included in merge commit `6e01bc0` on `chore/contributor-setup`. The merge preserves both the original Chronocall workspaces and the Museum AR experience at `/museum`. It is a local integration candidate; check remote state before assuming it is on main.

Demi's original export replaced the application and deleted existing features. Those deletions were intentionally not adopted. Its feature code was ported to the locations below. Future updates must preserve both experiences unless the team explicitly chooses otherwise.

| Demi branch path / interface | Integrated location / interface |
| --- | --- |
| `src/App.tsx` | `src/features/museum/MuseumApp.tsx` |
| `src/components/ARPortraitStage.tsx` | `src/features/museum/components/ARPortraitStage.tsx` |
| `src/components/CuratorialPanel.tsx` | `src/features/museum/components/CuratorialPanel.tsx` |
| `src/components/MobilePreviewModal.tsx` | `src/features/museum/components/MobilePreviewModal.tsx` |
| `src/data/`, `src/hooks/`, `src/types/portrait.ts` | Corresponding directories under `src/features/museum/` |
| `src/utils/audioLive.ts`, `livingPortraitLayers.ts`, `washingtonAnchorTracker.ts` | `src/features/museum/utils/` |
| `server.ts` museum handlers and voice | `server/museum.ts` |
| Museum `/ws/live` | `/ws/museum` in both browser and server |
| Museum root URL / QR target | `/museum` |
| Global museum CSS | Museum-scoped styles in `src/index.css` |
| Washington image | `public/assets/aistudio/washington_fd94f6dd.jpeg` (unchanged) |

Server bootstrap remains `server/index.ts`; router registration remains `server/app.ts`. Keep model calls blocked in demo mode and keep both voice bridges in server shutdown cleanup. Shared package scripts and existing dependencies remain; QR code dependencies are additive.

## Fastest workflow for contributors

After integration reaches main, start new work from updated main, using the integrated paths above. For an existing feature branch, merge main into it once and resolve the old export layout before continuing. Do not re-export the whole app over the repository. Keep each commit focused on the feature being changed.

```bash
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c feat/museum-next-change
# Edit src/features/museum/ and server/museum.ts as needed.
npm run check
git add <changed-files>
git commit -m "Describe the change"
git push -u origin HEAD
```

## Integration procedure

Start in a clean isolated worktree so an ongoing contributor's local edits remain untouched. Replace the example branch name and worktree path as appropriate. If the current integration has not reached main, base follow-up museum integration on `chore/contributor-setup` instead of the old main.

```bash
git fetch origin --prune
git log --oneline origin/main..origin/demi
git diff --stat origin/main...origin/demi
git worktree add -b integration/demi-next ../chronocall-integration origin/main
cd ../chronocall-integration
git merge --no-ff --no-commit origin/demi
```

Resolve conflicts by comparing intended behavior on both sides. For updates still using Demi's old paths, compare its new commits against the already integrated Demi commit (`git diff 70cb42e..origin/demi -- <path>` for the first follow-up), then apply those changes to the mapped paths. Use the newest integrated Demi commit as the comparison baseline on subsequent merges. Do not resurrect obsolete root app/server files or drop existing workspaces to make the merge pass. Do not use a blanket `ours`/`theirs` resolution: it can silently discard new work.

If dependencies changed, combine package requirements and run `npm install` to regenerate `package-lock.json`. Otherwise use `npm ci`. Avoid hand-editing dependency versions to work around connectivity failures.

```bash
npm install
npm run check
git diff --check
# Perform the relevant browser checks in docs/SMOKE_TEST.md.
git add <resolved-and-documented-files>
git commit -m "Merge Demi updates and document integrated behavior"
```

Update README run instructions/features, architecture boundaries, and smoke steps when behavior changes. Record the source commit, destination mapping changes, validation, and remaining limitations in the PR. Review staged changes before committing; exclude unrelated deployment or teammate edits.

Before advancing main, fetch again. If origin/main advanced, merge it into the candidate and rerun checks. Prefer a PR targeting main; when direct integration is authorized, push the validated candidate normally (`git push origin HEAD:main`). Never force-push main. Verify the remote commit after pushing. Leave failing or unvalidated work on the integration branch and report the blocker. Do not delete source branches automatically.

## Current validation limits

The first local integration passed eight Node regression tests and offline frontend/server import-graph checks. Full type checking, HTTP integration tests, production build, browser AR/voice, and real-model behavior still require validation with installed dependencies and appropriate access. An import-graph check is not a production build.

## Characters integration — 2026-11-21

Integrated `origin/characters` at `0a1d3bf`. Its `server.ts` changes live in `server/museum.ts`; its three new `src/data/` modules live under `src/features/museum/data/`. The Washington fixture uses the general persona guide. Keep `/api/research-figure` behind the museum demo guard. Docker must include the museum data modules imported by the server. Research and alternate-speaker helpers require frontend wiring before claiming automatic end-to-end behavior.

Validation: TypeScript, eight Node regression tests, production frontend build, and Git whitespace checks passed. HTTP integration tests could not bind localhost (`EPERM`) in the agent environment, so production HTTP/WebSocket checks and real-model behavior remain unverified. Run `npm run check` in a normal terminal before deployment.

## Follow-up integration — 2026-11-21

Merged main `ce14671`, characters `48f1c77`, FaceTime `ff06f36`, and Demi `fa46fdc`. Demi perspective tracking is in the museum feature; `PortraitStage.tsx` retains portrait/upload mode and `ARPortraitStage.tsx` provides the new camera mode. Voice remains at `/ws/museum`; QR links retain `/museum`. FaceTime is at `/facetime`, preserving the discovery root. npm setup, CI, and Docker are aligned; Node 24 remains the tested runtime. Removed the unused direct esbuild 0.25 dependency, which conflicted with Vite 8’s optional peer range.

Validation: TypeScript, all 16 regression tests, and production build pass. Generated the npm lockfile from installed dependencies. HTTP/WebSocket checks remain blocked by the sandbox localhost restriction; camera, audio, and live models still need browser rehearsal.


## Feature rollup — 2026-11-21

Integrated the following fetched branch tips on top of main `2759709`, preserving the simplified launcher, shared navigation, and all existing routes:

| Branch | Source commit | Integrated capability |
| --- | --- | --- |
| `characters` | `fbe868d` | Background character research, artwork validation, reply evaluation |
| `feat/gemini-live-telemetry-cues` | `6b69b95` | Collapsed call telemetry and historical grounding feedback |
| `feat/facetime-step-into-world` | `404486c` | In-call world portal and invitations |
| `feat/facetime-chrono-selfie` | `c59aece` | Generated photo postcards with the caller and character |
| `feat/facetime-show-and-tell` | `7c44ce6` | Camera object annotations and keepsake sketches |
| `feat/facetime-online-artwork-search` | `8d3292a` | Museum artwork discovery and selection |

`demi`, `feat/facetime-historical-call`, and `chore/contributor-setup` were already included. Source branches are retained.

Conflicts were resolved semantically across shared contracts, the live bridge, HTTP routes, call state, and controls. Live telemetry consumes the character layer's existing Decisions API evaluation, avoiding a duplicate HTTP evaluation. Additional call actions use **More call actions**; artwork selection defaults to manual. The new dialogs use the shared native dialog for keyboard focus and Escape. Closing a search or call invalidates pending work. Artwork downloads validate every redirect, restrict image types, and cap streamed bytes.

Validation: TypeScript, 43 unit tests, production frontend build, and whitespace checks pass. Ten HTTP integration tests cannot bind localhost in the agent environment (`listen EPERM`); production HTTP/WebSocket and camera/real-model behavior still require rehearsal. GitHub DNS is unavailable here, so these are the last fetched branch versions, not a guarantee that the remote has no newer commits. Run `git fetch origin`, integrate any newer remote work, and run `npm run check` in a normal terminal before deployment. Restart the development server after merging to load the new server routes.

## Additional feature integration — 2026-11-21

Merged characters `38d4ce6`, artwork thumbnail fix `e2e6f76`, artwork polish `617603b`, team documentation `59c07c7`, and Shopify print offers `9b35e6c`. Kept manual artwork selection, cancellation handling, redirect/size/MIME validation, current call actions, and honest unavailable evaluation states. Added contact artwork and Save to Notebook. Retained new evaluation tools/results as contributor-provided evidence. Print offers appear after calls; checkout remains on the merchant site, and demo mode performs no shopping calls. The shop HTTP tests belong to the integration suite and await server readiness.

Validation: TypeScript, 57 unit tests, frontend build, and whitespace checks pass. HTTP tests and real service/browser behavior remain unverified here because localhost binding is blocked. Remote fetching is blocked by DNS; this covers all currently fetched branch tips.

## Demi face overlay integration — 2026-11-21

Integrated `a7087f9` into the museum feature paths. Added perspective rectification, face overlay and anchor-tracking updates, richer artwork metadata, and fenced JSON parsing. Preserved the existing artwork gate, persona checks, explicit voice start, portrait/upload view, and simplified navigation. Camera loss stops voice; camera scanning starts without a preselected artwork. `portraitAnchorTracker.ts` retains the previous tracker API for the portrait/upload component; camera AR uses the new tracker.

Validation: TypeScript, 57 unit tests, build, and whitespace checks passed in an isolated worktree. Browser camera/overlay and live-service behavior remain unverified. Existing local typography and evidence edits were left untouched.

## Decisions and print delay — 2026-11-21

Merged `fix/decisions-and-print-delay` at `3bbe185`: print search waits 20 seconds and downsizes photos, typed names receive a Decisions API gate, text fallback replies receive character checks, and museum voice receives background research. Evaluation reuse requires matching speaker, instructions, prompt, and utterance; different conversation contexts do not reuse a verdict, and unavailable results are not cached. Name-gate provider errors currently allow the call with an error field, so this is not a guaranteed identity restriction.

Validation: TypeScript, 70 unit tests, production build, and whitespace checks pass. Name-gate HTTP tests were moved into the API integration suite and now await server readiness. HTTP/browser/live-provider validation still requires a normal terminal and browser.


## Museum print candidate — 2026-11-21

Prepared `integration/museum-print-safe` from main `07c40f0`, merging `fix/museum-print-offer` at `de0d19a`. Preserved the prominent Scan AR button, compact right-side Conversation control, visible AR face movement, enabled painting tags and removed speech rings. Added museum prints and the branch's artwork/voice fixes. Print offers open only after explicitly ending a connected conversation or choosing Prints, not after camera loss, switching artwork or cancelling connection. Pending searches cannot replace the selected painting's cached results. Historical verdict reuse now includes the speaker's moment, with a regression test.

Validation: TypeScript, 74 unit tests, production build and whitespace checks pass. All 14 API integration tests are blocked by localhost `listen EPERM`; production server and real camera/voice/checkout rehearsal remain unverified. The candidate remains separate from main, and ongoing learning/transcript edits in the main checkout are untouched. Before promotion, run `npm run check` from this checkout in a normal terminal and rehearse scanning, tags, voice start/end/cancel, camera loss, artwork switching and print checkout fallback.

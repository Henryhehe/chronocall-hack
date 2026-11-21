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
bun run check
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

If dependencies changed, combine package requirements and run `bun install` to regenerate the single Bun lockfile. Otherwise use a frozen install. Avoid hand-editing dependency versions to work around connectivity failures.

```bash
bun install --frozen-lockfile
bun run check
git diff --check
# Perform the relevant browser checks in docs/SMOKE_TEST.md.
git add <resolved-and-documented-files>
git commit -m "Merge Demi updates and document integrated behavior"
```

Update README run instructions/features, architecture boundaries, and smoke steps when behavior changes. Record the source commit, destination mapping changes, validation, and remaining limitations in the PR. Review staged changes before committing; exclude unrelated deployment or teammate edits.

Before advancing main, fetch again. If origin/main advanced, merge it into the candidate and rerun checks. Prefer a PR targeting main; when direct integration is authorized, push the validated candidate normally (`git push origin HEAD:main`). Never force-push main. Verify the remote commit after pushing. Leave failing or unvalidated work on the integration branch and report the blocker. Do not delete source branches automatically.

## Current validation limits

The first local integration passed eight Node regression tests and offline frontend/server import-graph checks. Full type checking, HTTP integration tests, production build, browser AR/voice, and real-model behavior still require validation with installed dependencies and appropriate access. An import-graph check is not a production build.

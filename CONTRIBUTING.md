# Contributing to Chronocall

## Pick a workstream

Claim a small task in the team chat or a GitHub issue before starting. Include an owner, visible completion condition, directories you will touch, and dependencies on teammates.

Example: “Camera-to-world handoff: capture from the live feed still works after switching to World. Touches vision and app integration; needs a check with the integration owner.”

| Suggested owner | Primary area | Coordinate before touching |
| --- | --- | --- |
| Integration lead | `src/app/`, setup, docs, CI | Navigation, shared types, dependencies |
| Camera/character developer | `src/features/vision/`, `src/features/character/` | Shared voice hook and app state |
| World developer | `src/features/world/` | Scene responses and voice world commands |
| Backend/voice developer | `server/`, `src/features/live/` | Shared contracts and model IDs |

These are workstreams, not assigned GitHub usernames. Agree on the actual people together. Keep one owner per task and pair on shared-file edits.

## Branch, check, review

```bash
git switch main
git pull --ff-only
git switch -c feat/short-task-name
```

Use `fix/` for bugs and `chore/` for setup/refactors. Merge working increments frequently. Separate broad formatting/file moves from feature changes when possible.

Before review:

```bash
bun run check
git diff --check
git add <the-files-for-your-task>
git commit -m "Describe the user-visible change"
git push -u origin HEAD
```

Open a PR into `main`. Describe the behavior, checks, and any API/type changes; add a screenshot for visual changes. Have the integration owner or affected feature owner review. Do not force-push `main` or commit configuration/build output.

If main has moved, merge `origin/main` into your feature branch, resolve conflicts with the affected owner, and rerun checks. Avoid rewriting a branch someone else uses.

## Boundaries for parallel work

- Put UI, hooks, and helpers beside their feature. The app shell coordinates screens rather than implementing another media transport.
- Reuse `useMediaSource` for the main camera and `useLiveSession` for microphone/voice. They own teardown and stale async callbacks.
- Keep the camera stage mounted when hidden: World captures from its media element. Test the handoff if changing that lifetime.
- Put input validation in `server/routes/`; put prompts/SDK calls in `server/services/gemini/`. Routes accept `AiServices`, so tests can use fixtures without keys.
- Coordinate changes to `shared/` or `src/types/` with consumers. Preserve endpoint paths unless clients change in the same PR.
- Keep keys on the server. The Genie client receives an ephemeral token, never the long-lived Gemini key.
- Use Bun for dependency changes and commit `package.json` plus `bun.lock` together. Do not add another lockfile. CI uses frozen installs.
- Test failure cases such as denied permission, disconnects, and stale requests, as well as the happy path.

## Integration rhythm

Agree on one demo story and keep it working on `main`. Check in every 30–60 minutes, communicate interface changes immediately, and reserve the final hour before submission for integration and rehearsal.

Follow [SMOKE_TEST.md](docs/SMOKE_TEST.md) on the presentation laptop. CI uses fixtures and does not verify paid model access, browser permissions, audio playback, or WebRTC connectivity.

For merging contribution branches, see [BRANCH_INTEGRATION.md](docs/BRANCH_INTEGRATION.md), including the Demi-to-Museum file mappings and validation workflow.

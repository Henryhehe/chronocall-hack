# Evaluation: externally selected inputs and a simple baseline

**Status: runner implemented; live results pending.** Collection was attempted in the coding environment and failed at DNS resolution. No accuracy or improvement result has been measured. Unit tests are software checks, not evidence of model quality.

## Run from the normal project terminal

```bash
npm run evaluate -- collect evaluation/dataset/manifest.json 15
npm run evaluate -- validate evaluation/dataset/manifest.json
npm run evaluate -- run evaluation/dataset/manifest.json
npm run evaluate -- report evaluation/results/YOUR-RUN.json
```

Real model calls use the server's ignored `.env.local` key. Demo mode is rejected. This uses model quota; a 15-case run can take several minutes. Raw media/results stay ignored by Git. Publish a reviewed summary with the manifest, source URLs, model IDs and release commit; do not publish credentials or private visitor recordings.

The collector uses [The Met's official API](https://metmuseum.github.io/), fixed queries and a fixed hash-based order to select public-domain images before observing any model output. It collects nine portraits, three still lifes and three landscapes for 15 cases. Selection is limited to the first 500 matches per query; availability/license exclusions are recorded. These are external, unrehearsed evaluation inputs, **not a claim that a model has never seen these artworks during training**. Do not reroll the sample after seeing failures.

## What this diagnostic compares

| Arm | Behavior |
| --- | --- |
| Baseline | One Hydrogen image call: identify a subject and respond in character, or admit no recognizable figure. |
| System | Actual application identification + Decisions gate, fresh Neon deep research, Hydrogen structuring/response, and a Decisions turn assessment. |

Both see the same image and visitor question. Museum metadata is retained as an answer reference and is not included in model input. The runner alternates execution order, disables research caching, records errors and abstentions, and checkpoints after every pair. Compare latency and quality together: the system does more work than the baseline.

**Scope limit:** this is an offline image/persona/text diagnostic using production services. It awaits deep research and does not reproduce the concurrent quick/deep Live 3.8 conversation. It does not measure camera permissions, audio quality, interruptions, generated video, or corrections spoken after an error. Its wall time is not live response latency.

## Independent grading

Have a person who did not implement the prompts review the outputs in shuffled, unlabeled order. Keep the mapping to baseline/system separately until grading is complete. Use museum records for artwork identity; use additional cited historical sources for biography claims. Museum titles do not necessarily identify a sitter; correct uncertainty is a valid answer. Do not treat the artist as the depicted figure.

Record a `grade` on each arm of each result row:

```json
{
  "correct": false,
  "unsupportedClaims": 1,
  "anachronisms": 0,
  "reviewer": "Reviewer name",
  "source": "URL(s) and short reasoning"
}
```

`correct` means appropriate identification or abstention **and** no unsupported factual claim or anachronism in the answer. A fluent invented sitter is wrong. A landscape rejection is correct. Provider errors are failed attempts; preserve them and the intended total. Unreviewed entries remain unreviewed. The report gives accuracy only over independently graded rows and states whether grading is complete. Do not present a partial grading percentage as overall performance. Decisions scores are diagnostic output, not ground truth.

## Real-time stress trials, separate from the offline comparison

Before tuning, ask a non-builder to choose at least five cases. Capture the actual browser call, with permission, and log every trial. Use combinations of glare, partial crop, dim light, background speech, overlapping objects, “this one” references, fast object changes, interruption and reconnection. Keep the same input when repeating after a fix; distinguish the repeat from a fresh held-out case.

| Trial/input | Fresh or cached | First audio ms | Visual reference correct? | Interruption handled? | Error/recovery | Change after failure |
| --- | --- | --- | --- | --- | --- | --- |
| Pending | — | — | — | — | — | — |

Report median and worst latency, completed/attempted trials, incorrect claims and inability to recover. Show the hardest failed input and explain the limit. An empty table is not a result.

## Known failure-handling changes

- Missing/invalid Decisions fields used to default to passing or “verified”; they now yield unavailable.
- Provider failure no longer counts as a passed reply check or triggers a content correction with no failed check.
- Text retries cannot replace a flagged answer with a falsely “clean” unavailable check.
- The image gate pauses identification output when its assessment is unavailable.
- UI copy describes post-turn model assessment, not independent factual verification.

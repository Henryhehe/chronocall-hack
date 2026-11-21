# Chronocall: one encounter across centuries

For the latest presenter card, exact speaking lines and failure playbook, use [JUDGING_RUNBOOK.md](JUDGING_RUNBOOK.md). For recording trials in the app, use [JUDGE_REHEARSAL.md](JUDGE_REHEARSAL.md).

**Track: Element 119.** Start at `/facetime`. The demonstration is a live audiovisual encounter: scan an artwork, call its subject, and show them something from the visitor's world. The character is an AI interpretation, not an authoritative historical reconstruction.

## Three-minute live demo

| Time | Action | What it proves |
| --- | --- | --- |
| 0:00–0:40 | Introduce the encounter, invite a judge to choose an object, record a short first guess, scan and call. | A question and prediction before the audiovisual encounter. |
| 0:40–1:15 | Show the unnamed object; ask for a visible description and historical interpretation. Let the character answer. | Unrehearsed voice and camera input. |
| 1:15–1:30 | Change the visible side or state and ask what changed; skip if behind schedule. | Visual context matters to the response. |
| 1:30–2:00 | Show actual Hydrogen/Neon research events and a Decisions check. Explain Live 3.8's voice/camera role. | Two qualifying Gemini 4 models with distinct roles and actual Decisions usage. |
| 2:00–2:15 | Show completed rehearsal results and one failure/repeat pair, or state that broader testing is pending. | Honest evidence and limits. |
| 2:15–2:40 | End the call. Select the actual reply under **What changed your mind?** Compare it with the first guess and identify a claim to check. | Prediction, observation and reflection are implemented; learning gains are not yet measured. |
| 2:40–3:00 | Name confirmed event-built contributions and close. | Clear provenance and a concise takeaway. |

A generated sketch is optional if it naturally follows the encounter and has been tested. Leave generic detection, costumes, notebooks, selfies and world navigation out of this sequence. A short feature list is not the demo.

## One-minute submission video

- 0–8 seconds: project name, Element 119, one-sentence premise.
- 8–20: scan artwork and connect to its subject.
- 20–42: a real camera-grounded interaction; retain enough continuous footage to show the causal connection. Identify any cuts, sped-up waits or previously generated assets.
- 42–52: show actual Hydrogen/Neon/Decisions activity and explain their jobs.
- 52–60: one measured result plus a limitation; name the event-built contributions.

Do not include made-up benchmark numbers. Demo-mode fixtures and prerecorded portrait motion must be labeled. Video motion is not proof of speech-synchronized generated video.

## Rehearsal and freeze

1. Finish the submission checklist. Run `npm run check`; log any environment-blocked checks separately.
2. Freeze one reviewed commit; record `git rev-parse HEAD`. Disable automatic merges/deployments for the presentation window.
3. Rehearse the actual production build, event key, venue network, camera, microphone and speaker. Confirm `demoMode: false`.
4. Test both a fresh figure and a cached figure. Measure connection time, first audible response, research completion and recovery after interruption. Do not report cached research as cold-start performance.
5. Keep a local production server and a clearly labeled prior recording ready. If a model call stalls, explain it and move on; do not disguise a typed fallback as voice success.
6. Ask a non-builder for an artwork/object/question the team has not rehearsed. Preserve every failed trial in the log.

## What the checks mean

Research is grounded in retrieved notes; Decisions filters claims against those notes. That does not independently prove the notes are accurate. Live reply checks occur after speech and can request correction. They do not prevent every incorrect claim from being heard. An unavailable checker is displayed as unavailable, never as passed. The UI's “Model-assessed consistency” is an automated assessment, not a verified historical fact.

See [call evidence capture](CALL_EVIDENCE.md), [evaluation protocol](../evaluation/README.md) and [submission checklist](SUBMISSION_CHECKLIST.md).

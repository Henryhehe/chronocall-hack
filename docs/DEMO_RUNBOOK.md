# Chronocall: one encounter across centuries

**Track: Element 119.** Start at `/facetime`. The demonstration is a live audiovisual encounter: scan an artwork, call its subject, and show them something from the visitor's world. The character is an AI interpretation, not an authoritative historical reconstruction.

## Three-minute live demo

| Time | Action | What it proves |
| --- | --- | --- |
| 0:00–0:20 | “Chronocall lets you call someone inside a painting. Show them something from your world, and they react through the knowledge and assumptions of theirs.” Scan an artwork. | Image input determines the encounter. |
| 0:20–1:15 | Start the call. Invite the judge to choose an object or question. | Unrehearsed voice and camera input. |
| 1:15–1:50 | Show two objects, refer to “this one,” then change which object is visible. Interrupt a reply. | Visual reference and turn-taking that a text description would lose. Do not promise success; record what happens. |
| 1:50–2:25 | Open model activity briefly. Explain Hydrogen identification/quick research, Neon deep research, and Decisions filtering/post-turn assessment. Show actual events, not a static model list. | Two qualifying Gemini 4 models with distinct roles and actual Decisions usage. |
| 2:25–3:00 | Show the measured evaluation table and one failure/change. If results are still pending, state that plainly and demonstrate a difficult input instead. | Honest evidence and limits. |

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

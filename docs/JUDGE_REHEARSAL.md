# Final rehearsal and judge handoff

Enter **Element 119**. Lead with: “Chronocall lets you call someone inside a painting. Show them something from your world, and they react through the knowledge and assumptions of theirs.”

## Complete five real trials

Ask a non-builder to select an artwork, objects and questions before seeing responses. Record each attempt, including failed scans and connections. Do not replace failures with easier inputs.

1. Open `/facetime`. Expand **Demo rehearsal** below the contacts to see the five challenge categories.
2. Try an unfamiliar artwork, two objects with a “this one” reference, glare or a partial crop, background speech, and an interrupted spoken reply. The exact content must come from your volunteer.
3. During a call, open the **Gemini 4** indicator. Inspect quick/deep research, actual model IDs, fresh versus cached status, retained facts, source links and filtered claims. Download the trace before starting another call.
4. End the call. Expand **Demo rehearsal**, describe the actual input and conditions, select observed outcomes, and explicitly attach the correct call trace. Record failures without a trace when scanning or connecting never succeeded.
5. If an input fails, record the failure first. Make a concrete change, retry the same input, select its original attempt under **Fresh case or repeat**, and describe the change. Inspect the subsequent spoken response before claiming recovery.
6. Download the rehearsal report. It includes every recorded attempt, missing assessments, failures, demo counts, traces and measured first-audio receipt times. Data remains local to this browser until downloaded/shared. Review conversation text before publishing.

The timing is **first audio received from voice-connection start**, not time from scan or first audible playback. Demo trials are excluded from timing, but are explicitly included in overall counts. Report real-mode trials separately; a missing trace does not establish that a trial used real models. Repeated inputs are not held-out cases. The five cases are a small stress sample, not a reliability guarantee.

## Three-minute presentation

| Time | Show | Say |
| --- | --- | --- |
| 0:00–0:20 | Scan a painting | “We make the subject a participant in a live audiovisual encounter.” |
| 0:20–1:15 | Call; let the judge choose an object/question | “You choose what we show them.” |
| 1:15–1:50 | Refer to one of two objects, switch it, interrupt | Explain the observed result, including a failure if one happens. |
| 1:50–2:25 | Actual model activity | “Hydrogen identifies and researches quickly; Neon deepens the research; Decisions filters claims and checks completed turns. Live 3.8 carries the conversation.” |
| 2:25–3:00 | Rehearsal report and one failure/repeat pair | State actual completed/attempted counts, the hardest failure and what the repeat demonstrated. If no real trials are recorded, say so. |

## One-minute video script

Record the actual app and voice output with permission from anyone recorded. No fabricated call footage or benchmark values.

- **0–8 s:** “This is Chronocall: call someone inside a painting. Our entry is Element 119.”
- **8–20 s:** Show the scan and connection. Label any cut or shortened wait.
- **20–42 s:** Keep a continuous object-reference interaction with the actual spoken answer.
- **42–52 s:** Show Hydrogen and Neon completion events plus a Decisions assessment. A pending event does not establish successful model use.
- **52–60 s:** State one measured observation and a limitation. Identify the team’s event-built contributions from the submission checklist; confirm their provenance first.

Label canvas portrait animation, generated video loops, and live streams accurately. None alone proves speech-synchronized generated video.

## Likely judge questions

**Why is this more than a historical chatbot?** Demonstrate visual reference to an object whose identity was never supplied in text, its change during the encounter, and interruption. If only text Q&A works, acknowledge the limitation.

**What does Neon add?** Open the actual deep-research result and point to a retained fact/source it supplied. If it failed or is pending, say so. A model label is not evidence of successful use.

**Does Decisions guarantee accuracy?** No. Research claims are assessed against retrieved/model-written notes; spoken turns are assessed after playback. A flag can request correction, but humans must judge whether the correction succeeded.

**What broke?** Use the recorded failed attempt and its linked repeat. The camera samples about one frame per second, so fast object changes are a useful boundary to investigate, not a measured failure until tested.

**How much better is it than a baseline?** The existing 60-reply internal persona diagnostic does not establish historical accuracy or multimodal improvement. Use it only with its documented limitations. The separate external-image evaluation remains pending until run and independently graded.

## Final gates

- Public repository was confirmed visible while signed out on November 21, 2026. This does not mean local changes have been pushed.
- Obtain the organizer’s eligibility ruling using the exact question in `SUBMISSION_CHECKLIST.md`. Record name, answer and time; do not assume permission.
- Verify the actual public HTTPS demo URL on another device. Localhost does not satisfy public access.
- Confirm all four members and event-built contributions; check asset rights.
- Upload the one-minute recording and submit by **5:00 PM New York time**, per the supplied guide.
- Freeze one reviewed release commit. Check current CI; public GitHub showed a failure indicator on commit `560696c` during this review, without an inspected cause.

From the normal project terminal:

```bash
npm run check
node --import tsx scripts/model-preflight.ts
```

The preflight makes two small real requests using the configured research models. It verifies access only. For the external-image comparison, follow `evaluation/README.md`; do not substitute demo fixtures.

## Verification in this workspace — November 21, 2026

- TypeScript and production frontend build passed. Existing bundle-size and Vite configuration warnings remain.
- Rehearsal accounting tests cover failed/unassessed attempts, demo exclusion from timing, repeated cases and shared-connection timing deduplication.
- Browser inspection confirmed the local call page and expanded rehearsal controls render, with empty trials shown as unassessed and recording/export disabled until appropriate. No synthetic trials were saved as real evidence.
- Public repository verified signed out. No public demo URL or uploaded submission video was verified.
- HTTP integration and production-server tests blocked on localhost binding (`EPERM`). Browser access to the already-running development app worked; this is separate from those tests.
- Both real model preflight calls and external-image collection blocked on DNS (`ENOTFOUND`). No model-quality or venue-stress result is claimed.

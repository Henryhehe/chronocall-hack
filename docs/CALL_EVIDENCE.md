# Capture evidence for judging

Restart the app after updating so the server emits the new research events. Use a real call with demo mode off. Open the existing model activity panel and expand **Call evidence** details as needed. After hanging up, the launcher retains **Last call evidence** until the next call starts or the page reloads.

## A ten-minute evidence pass

1. Ask someone outside the team to choose an artwork, an object and a question you have not rehearsed. Record their choices before the call.
2. Run the call. Show the object, change it, ask about “this one,” and interrupt once. Record what you actually hear and see, including mistakes and stalls.
3. Open model activity. Show quick/deep research running or completed, actual model names, sources and any filtered claims. A started event proves an attempt; only a completed event proves a result arrived. A cached/shared result is labeled separately.
4. If a reply is flagged, show the original utterance and the correction request. Inspect the following spoken turn to determine whether recovery actually happened.
5. Download the trace before starting another call. Repeat with another person or difficult input if time permits. Keep failed attempts as well as successful ones.

Use a compact manual log alongside each JSON file: input chosen by whom; expected observable behavior; actual behavior; pass/fail; failure notes; trace filename. Do not turn a handful of trials into a general accuracy claim.

## What the trace supports

- Timestamps, connection readiness and first received audio, measured from the voice connection attempt. Portrait preparation and audible playback latency are excluded.
- Actual quick/deep model IDs, completion/failure, source links, retained facts and filtered claims. Arrival time and original research-generation time are separate, including cached/shared work.
- Conversation text, camera readiness changes, interruption/completion events, post-turn Decisions results and correction requests.
- Explicit demo status and an omitted-event count if the 1,500-event limit is reached.

The trace is client-side diagnostic evidence, not a tamper-proof audit or an independent correctness evaluation. It contains no camera frames, audio recordings or private system prompts. It cannot prove what was visually present or audibly played; use a live judge observation or a consented screen recording for those claims. Downloaded text can include the visitor's words, so review before sharing. Traces stay in memory until downloaded and are replaced by the next call.

Research claims are checked against model-written notes. Retrieved links and a high support score do not independently establish historical truth. Reply checks happen after speech; a correction request does not prove successful correction. Provider failures are retained as generic failures without private error details.

## Suggested judge narration

“Choose an object we haven't rehearsed. The live model sees and hears it; Hydrogen supplies quick research, Neon adds deeper research, and Decisions filters research claims and assesses replies after speech. Here are the events from this call, including source links, elapsed times and any failures. We can export the original replies and check results. These checks measure model-assessed consistency; they do not certify historical accuracy.”

Only name a model as having completed work when its completion event is visible. If the call fails, show the failure and describe the observed limit.

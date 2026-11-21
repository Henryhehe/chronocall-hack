# Chronocall demo runbook

## Story and scope

“Chronocall uses what your camera sees to connect you with a historical perspective, then lets you explore and change an interactive world.”

Lead with one coherent interaction. Detection, character styling, photo generation, voice, and world control are separate implemented capabilities; do not imply full motion capture, a persistent historical simulation, or that Three.js scenes are Genie video.

The default three-minute sequence uses the **Interactive 3D World** engine. Genie Video is an optional extension after a successful venue-network rehearsal. The timings below are a presentation budget, not measured model latency.

The learning navigation labels are **Visual discovery** (Live Vision), **Character studio** (Character Mirror), **World explorer** (both world engines), and **Portrait gallery** (Museum AR). Use those labels to navigate; the inner panels may use the earlier technical names.

For an education-focused pitch, use the [museum-first alternative in the release checklist](RELEASE_CHECKLIST.md#4-freeze-and-present). End in **My notebook**: save one observation and one question to verify, then download the reflection. For example: “The sword and uniform communicate authority. Which details reflect the artist's later interpretation rather than Washington's era?” Choose one main sequence, rather than rushing through every workspace.

## Before going on stage

- Choose one presenter and one operator. Freeze one tested commit and disable automatic redeploys.
- Run `bun run check`; open the production app; check `/api/health`. A real presentation needs `demoMode: false` and a key with access to the feature's configured model.
- Rehearse with the exact laptop, browser, microphone, output device, and network. Grant camera/microphone permissions in advance; check speaker feedback. Keep the app at a readable zoom level.
- Put one ordinary object within reach: a mug or phone. Prepare one photo you have permission to use as the upload fallback.
- Use one persona for the whole story, such as Roman Senator. Character Mirror and the World workspace have separate persona selectors; select the same one in both.
- Pre-rehearse one photo transformation and scene prompt. Keep a short recording of the successful real flow. Do not promise a particular output before testing the event key.
- If a step stalls for roughly ten seconds, narrate the transition and use the fallback. Do not spend the presentation repeatedly reconnecting.

## Three-minute main flow

| Time | Operator action | Suggested narration / prompt | Visible proof |
| --- | --- | --- | --- |
| 0:00–0:15 | Start in Live Vision; show the mug/phone | “This starts with the real world in front of us.” | Live camera feed |
| 0:15–0:40 | Run detection; select an object; ask “What am I holding, and what is it used for?” | “The model identifies objects and answers about this frame.” | Boxes, description, response, measured latency |
| 0:40–1:05 | Switch to Character Mirror; select Roman Senator; ask “Describe this object as someone from ancient Rome.” | “The same object is interpreted through a different era.” | Persona-aware text; costume overlay if face/body boxes are available |
| 1:05–1:35 | Open Genie 4 World → Interactive 3D World; select the same persona; Snap Active Feed or Upload Photo; optionally transform if rehearsed | “Now I can place a photo of myself into an interactive world.” | Photo-textured avatar; transformation is a separate model call |
| 1:35–2:05 | Walk, orbit, interact with an object; spawn “a small glowing blue crystal obelisk” if rehearsed | “The world supports movement and interaction, with new objects described in language.” | Movement, object response/effect, generated prop |
| 2:05–2:40 | Start World voice, wait for readiness, ask “Make it rain in this courtyard.” | “A spoken request can trigger an actual change to the scene.” | Transcript, spoken response, world effect |
| 2:40–3:00 | Stop voice; return to Detection Log/Compare Modes if useful | “Vision, conversation, and world actions are connected in one browser experience.” | Session log/telemetry; export JSON if needed |

For a full generated scene, use “A small Roman courtyard at sunset with a fountain, two stone columns, and a glowing crystal.” Generate it during rehearsal or replace the prop segment with scene generation if the response is consistently fast enough. Returning from another tab may reset World state; prepare it again before starting the live walkthrough.

Optional camera voice segment: in Live Vision, start voice and ask “Find the mug and highlight it.” This uses the general camera assistant. Historical voice belongs to World; changing Character Mirror alone does not change the camera voice persona.

## Optional Genie Video extension

Allow another 30–60 seconds; do not make this the only way to finish the presentation.

1. In Genie 4 World, choose **Genie 4 Video**.
2. Use a transformed photo as the seed, attach a raw photo/feed with the seed control, or choose **Launch Text World**.
3. Launch and wait for an actual first frame, not just a connected indicator. Resume playback if the browser paused media.
4. Move using the displayed controls, then steer with “Torches ignite along walls.”
5. Explain that this is a separate streamed video world. The UI has a 120-second session timer. End it explicitly before moving on.

## Failure recovery

| Failure | Action |
| --- | --- |
| Camera permission/device unavailable | Upload the prepared photo; explain the source switch |
| Detection or photo model denies access | Skip that model step; use the original photo/preset world; show a clearly labeled prior recording if available |
| Rate limit / repeated slow requests | Turn off automatic detection, use one-shot requests, and continue with local world controls |
| Voice cannot connect or audio is poor | Stop voice; use typed steering or preset effect buttons; do not claim a voice-triggered result |
| Genie connects but has no playable frames | Stop Genie and return to Interactive 3D World |
| Hosted service is cold or unavailable | Use the already-running local production app; localhost supports media permissions |
| All model access fails | Restart in demo mode; explicitly label fixed sample responses and the unchanged photo |

## What to claim accurately

- Vision and Q&A analyze sampled frames, not every camera frame. Character costume tracking depends on those detections.
- Filters and preset effects run in the browser. Three.js geometry generation uses a model-produced blueprint.
- A photo-textured, keyboard-driven avatar is implemented; camera-driven skeletal/face retargeting is not.
- Demo mode is a UI rehearsal path. It does not perform visual recognition, photo transformation, live voice, or Genie streaming.
- Compare Modes shows session measurements and explanatory content, not a controlled cross-model benchmark.
- Data is transient. Export camera-workspace logs before refresh; the export is not a saved world or complete World transcript archive.

Use [SMOKE_TEST.md](SMOKE_TEST.md) for acceptance checks and [DEPLOYMENT.md](DEPLOYMENT.md) for hosting and rollback.

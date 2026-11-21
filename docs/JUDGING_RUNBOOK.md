# Chronocall — judge-panel runbook

**November 21, 2026 · Element 119 · 3-minute demo + 2-minute Q&A**

> **Memorize this:** “Chronocall lets you call someone inside a painting—and show them something from your world.”

Your winning moment is a judge choosing a physical object, the character reacting to its visible details, and the answer changing when the object changes. Give that moment more time than the architecture explanation.

## Round-four review: protect the live reply and the ending

Reviewed against local commit **`d0abd60`** plus the working tree present during this review. After the transcript fix below, TypeScript, **76/76 unit tests**, and the production frontend build passed. Existing Vite configuration and bundle-size warnings remain. This round did not execute the HTTP integration suite, production-server smoke test or a live model call. Existing Museum edits were left untouched.

**A real demo risk was found and fixed:** a camera-inspection annotation could absorb subsequent speech into its transcript row, which the reflection deliberately excludes. A spoken turn split by a tool annotation or long pause could also leave earlier rows marked unfinished. Adjacent completed turns could merge if they arrived within 4.5 seconds. The transcript now merges only open chunks, completes every open segment at turn completion, and preserves interrupted speech as interrupted so it is not offered as a completed reflection reply. Three regression tests cover these event sequences. This is software verification, not a live camera/audio result.

**Latest presentation assessment:**

| Priority | Finding | Decision before the panel |
| --- | --- | --- |
| 1 | The reflection is strongest when it shows the actual answer just heard. | In rehearsal, inspect an object, interrupt once, then allow one full answer to finish. Hang up and confirm that finished answer appears in **Choose a reply to examine**. Interrupted segments should not appear there. |
| 2 | AR has a more prominent entry and revised camera compositing, but it remains a separate experience. | Keep `/facetime` as the timed route. If a judge requests AR, use `/museum` → **Scan artwork in AR** only after a separate rehearsal. |
| 3 | The learning interaction is implemented, but learning gains and broader model reliability are unmeasured in the evidence reviewed. | Demonstrate the process: prediction, visual observation, actual reply, claim to check. Quote only real recorded trial counts. |
| 4 | Feature and presentation changes are still local. | Freeze a reviewed version, verify it is the version running on the demo machine, then stop merging during presentation. |

**The 60-second final check:** show an unnamed object → let one spoken turn finish → open actual model events → end call → select that reply in the reflection. If any step fails, use the relevant fallback below and adjust the pitch to what actually works. Do not begin another feature-polish pass before completing this check.

### Presenter card — keep only this beside the demo

| Cue | Words/action |
| --- | --- |
| **OPEN / INVOLVE** | “Chronocall lets you call someone inside a painting—and show them something from your world.” Ask the judge to choose an object. |
| **PREDICT / CALL** | Record one short first guess. Scan, confirm the subject and call. Keep the prediction out of the model prompt. |
| **OBSERVE** | Show the unnamed object. Ask: “What do you see, and what would you make of it in your time?” Let the answer finish. Change the visible view only if time permits. |
| **EXPLAIN** | “Hydrogen gives us quick context; Neon researches in the background; Live 3.8 handles voice and camera; Decisions assesses the research and completed replies.” |
| **PROVE** | Show one actual research result, one reply check, and the completed rehearsal report. State only the recorded counts. |
| **REFLECT / CLOSE** | End the call. Select an actual reply under **What changed your mind?** Compare it with the first guess and name a claim to check. Name the event-built contributions, then close. |

**If you are behind schedule:** keep the first visual interaction, actual model evidence, a brief reflection and close. Cut the second object and extra narration. Do not cut the character's answer to make room for a feature list.

**Decide the opening during rehearsal:** use scan-to-call if it reliably fits your first 35 seconds. If it does not, start with an already-connected call and say, “I scanned this artwork and connected before the timer; what we show it next is your choice.” That proves live interaction, not live scanning. Keep the actual scan in the submission video and available for Q&A. Warm research must be labeled as such.

## 1. If you have only five minutes before presenting

- [ ] Open `/facetime` on the exact laptop, browser, network and audio output you will use.
- [ ] Complete one real call. Confirm the character **hears you and sees a changed object**, rather than merely saying hello.
- [ ] Open the call's pipeline inspector. Find **Call evidence**. Confirm successful Hydrogen and Neon research and a real Decisions reply check. “Running” is not a successful result.
- [ ] Download the rehearsal trace. Keep a short actual recording ready, clearly identified as an earlier run.
- [ ] After any interruption, let a fresh answer finish. Rehearse **End call → What changed your mind? → Choose a reply to examine** using that actual completed spoken reply. Export any reflection you want to keep before another call or reload.
- [ ] Choose one artwork you have permission to use and have already tested. Have its image ready on paper or another screen, plus a local upload copy.
- [ ] Put two visually different objects within reach. Let the judge choose which to show first; do not name it to the model.
- [ ] Set a silent 3-minute timer. Freeze edits, merges and deployments. Close notifications and unrelated tabs.
- [ ] Confirm the event-built contributions and organizer eligibility decision described below.

**Do not start with the homepage tour. Start with the artwork.**

## 2. Judge's assessment of the current project

This is an interactive-art encounter with an implemented multimodal loop and a new reflection flow. Its strongest case is Element 119. The product story is stronger now because the visitor can explain what they noticed and what they still need to verify. The weak point is independent evidence, especially under difficult camera/audio conditions. A polished portrait alone will not carry the score.

| Criterion | Current basis in the repository | What to demonstrate |
| --- | --- | --- |
| Live demo — 35% | Artwork scanner, live voice, sampled camera frames and object annotations are implemented. This review did not verify them live. | Judge-selected object; changed view; one spoken interruption. |
| Proof it works — 25% | Call traces and an operator-entered rehearsal report are implemented. The existing 60-reply diagnostic has important rubric limitations; external image evaluation remains pending in the docs. | Actual results from fresh trials, an attached trace, and one recorded failure/repeat pair. |
| Creativity — 20% | A historical subject encounters the visitor's world; the visitor compares a prediction with an actual reply and supporting evidence. | Show one visual surprise and one honest change in interpretation or uncertainty. |
| Gemini 4 + Decisions — 20% | Hydrogen quick research and Neon deep research run in the background; Decisions filters research and assesses replies. | Show actual completed events and explain why the jobs differ. |

I would not assign a credible live-demo score from code alone. A clean unrehearsed interaction could make this competitive; a feature tour with unsupported accuracy claims would weaken it substantially. In the final round each category is 25%, so preserve the evidence and model explanation even if you shorten the opening.

**Eligibility requires a real answer:** the guide excludes education chatbots and image analyzers. Ask an organizer: “Our Element 119 project is a live audiovisual encounter with a painting's subject, who sees and reacts to objects in the visitor's camera. Is that eligible under these exclusions?” Record the answer; framing alone does not settle eligibility. If already confirmed, retain that confirmation.

## 3. The exact three-minute performance

Use one presenter and, if available, one operator/timekeeper. The presenter looks at the judges; the operator handles clicks and watches the deadline. Solo: have the artwork and evidence tab ready before the clock begins.

| Clock | Screen/action | Say this |
| --- | --- | --- |
| **0:00–0:15** | Start at `/facetime`, with **See through their eyes** selected. Invite the judge to choose an object. | “Chronocall lets you call someone inside a painting—and show them something from your world. Choose an object for this encounter.” |
| **0:15–0:40** | **Make a first guess**: enter one short, honest prediction about that object. **Scan artwork → Scan Figure → Call [name]**. | “Before calling, I think they might interpret it as [your guess]. We'll compare that with what actually happens. This is an AI historical interpretation.” |
| **0:40–1:15** | Hold the unnamed object in the camera preview. Let the character answer. | **“Describe what you can see. What would you make of this in your time?”** Stop narrating. |
| **1:15–1:30** | Turn the object or change its visible state. Skip this step if the first reply ran long. | **“Look again—what changed?”** Show whether the answer updates. |
| **1:30–2:00** | Open pipeline inspector → **Call evidence**. Point to completed quick/deep research and a reply check. | “Hydrogen supplies quick context; Neon researches in the background. Live 3.8 handles voice and sampled images. Decisions filters research and checks completed replies. Here is what actually completed in this call.” Name pending/failed stages honestly. |
| **2:00–2:15** | Show the prepared rehearsal report if available. | “We tried [actual number] fresh cases, completed [actual number], and failed on [observed case]. [Actual change] produced [observed repeat result].” If unavailable: “Broader stress testing is still pending; this trace records today's observed behavior.” |
| **2:15–2:40** | **End call** → **What changed your mind?** → **Choose a reply to examine**. Select the reply just heard; point to **Your first guess** and **Compare with a source**. | “I predicted [X]. The character actually said [brief faithful paraphrase]. I observed [visible detail]. That historical explanation still needs checking. The reflection separates what I saw, what the AI said, and what a source supports.” Adapt this to the actual result, including an unchanged prediction or failed response. |
| **2:40–3:00** | Leave the reflection visible. | “During the event we built [confirmed contributions]. The visitor leaves with an observation, a question and a claim to investigate. You bring something from your world into theirs. That is Chronocall.” |

**Timing rules:** at 1:30 move to model evidence; at 2:15 move to reflection; at 2:40 close. Do not fill every reflection field, open several sources, or demonstrate downloading during the timed pitch. The after-call view must come from the interaction the judges just saw. If no completed reply was captured, show that honestly rather than substituting a prior reply.

**If connecting takes too long:** begin the model explanation while it loads, then return to the interaction. If no usable call exists by 0:45, follow the fallback table. Do not restart the whole pitch.

### Make the live interaction convincing

- Do not say “Here is my phone.” That supplies the answer in text/audio. Ask about visible shape, material or a specific detail instead.
- Check that the object is actually inside the camera preview and large enough to see. Hold still for 3–5 seconds for the normal demonstration.
- Choose a genuinely visible change: keys to a cup, a closed book to an open page, or front to back of a device. Avoid a tiny detail the camera cannot resolve.
- A plausible historical metaphor is interpretation. A correct visible detail is evidence of visual grounding. Do not confuse the two.
- If the character gets it wrong, say: “That visual reference failed. I'll hold it steady and ask again.” Show the outcome without talking over it.
- A response need not produce an annotation box to demonstrate vision. Conversely, a box by itself does not establish a correct answer.

## 4. Build a small, honest evidence packet before the panel

If you have 10–15 minutes, ask a non-builder to choose five inputs before you begin. Record all five, including failures. This is a small stress test, not a statistically reliable benchmark.

| Trial | Input/task | Pass criterion |
| --- | --- | --- |
| 1 | Fresh chosen object held steady, unnamed | Correct object or category and at least one visible detail. |
| 2 | Two objects; one removed; “this one” | Refers to the remaining object rather than the removed one. |
| 3 | Quick object swap | Recognizes the new object; record any stale description. |
| 4 | Interrupt the character and change the request | Stops the old reply and addresses the new request. |
| 5 | Partial occlusion or glare | Gives a supported observation or admits uncertainty; does not confidently invent hidden details. |

For each row record: chosen input, first attempt result, time to first audible response, incorrect claim, recovery attempt/result, and trace filename. Keep failed first attempts in the denominator. Ask permission before recording another person.

### Record it using the app you now have

1. Use the **same browser and origin** for the trials and presentation; the rehearsal data is browser-local.
2. Download each call's trace from **Call evidence** before starting another call. After hanging up, **Last call evidence** remains available on the launcher.
3. Expand **Demo rehearsal** below the contacts. Select the relevant **Challenge** and describe the exact input and conditions. The five suggested trials above can be mapped to these categories; state quick swaps explicitly in the two-object case. Use background speech as an additional case if useful, and retain the resulting denominator.
4. Mark **Input chosen by a non-builder before this trial** only when true. Select the observed **Overall outcome**, **Visual reference**, and **Interruption handling**. Leave observations you did not test as **Not tested / unclear**.
5. Explicitly tick **Attach call trace** for the matching call. A scan/connection failure can be recorded without a trace; explain it in the notes.
6. Click **Record attempt**. For a repeat, select the original under **Fresh case or repeat**, describe the change and the actual recovery result, then record it separately.
7. Click **Download rehearsal report**. Keep it alongside the recording. Downloading JSON does not create a polished presentation chart: rehearse exactly which counts and trial entry you will show.

The visible total includes repeats, demo trials and attempts without traces. **Do not read that total as a real-mode first-attempt success rate.** Check the individual exported trials and state the fresh real-mode subset explicitly. Audio receipt timing counts each connection once, even if several challenges share it. If you also time audible playback with a stopwatch, label that separately; the UI does not measure it.

Use this line **only after completing the trials**:

> “A non-builder chose five cases. We passed **[X]/5 on the first attempt**. The hardest failure was **[specific failure]**. After **[actual change or recovery action]**, the same case **[observed result]**. That repeat is a recovery test, not a new unseen success.”

If unmeasured, say: **“We have development observations and this live trace; a broader independently graded evaluation is still pending.”**

### A defensible engineering story

The repository documents slow deep research as a development failure. The implementation starts quick Hydrogen research and deep Neon research concurrently and injects results into an ongoing call. Say:

> “Deep research was too slow to put in front of a conversation. We moved it into the background and added a quick research path, so speech can begin before that deeper context is ready.”

This is supported by the implementation and team development notes. Do not quote the notes' timings as measured venue results without the corresponding trace. The latest change also removes generated portrait preparation from the voice startup dependency: the artwork preview is used while the portrait loads. Measure end-to-end startup separately before claiming a speed improvement.

### What the existing evaluation does—and does not—show

The recorded diagnostic has **4 figures × 5 questions × 3 conditions = 60 replies**, or 20 per condition. The original rubric flagged 6 baseline replies and 0 pipeline/guarded replies. **All six baseline flags concern medical guidance or AI identity.** Appropriate safety guidance and honest AI disclosure should not be treated as errors. No guarded response was regenerated.

Do **not** pitch this as “30% hallucinations to zero,” “100% accurate,” or proof of self-correction. If asked, explain that it revealed a rubric weakness and that historical correctness, transparency and safety need separate grading. See [EVALUATION.md](EVALUATION.md).

## 5. Explain the architecture in twenty seconds

> “We separate the real-time conversation from research. Hydrogen handles recognition and quick context. Neon researches more deeply while the call continues. Live 3.8 carries voice and sampled images. Decisions filters research claims and assesses completed turns, with a correction request when a reply is flagged.”

| Component | Actual role | Evidence to point at |
| --- | --- | --- |
| `gemini-4-hydrogen` | Artwork/profile tasks, quick research, research structuring | Identification result and completed quick-research event. |
| `gemini-4-neon` | Deeper background research | Completed deep-research event with its actual model ID. |
| `gemini-3.8-live` | Spoken conversation and camera frames | Fresh spoken response to an unnamed, changed object. |
| `gemini-decision-1` | Image gate, research-support filtering, post-turn assessment | Actual check output; filtered claims if any occurred. |

Hydrogen and Neon are the two qualifying Gemini 4 models. Live 3.8 is an additional model; do not count it as one of those two. Runtime research model overrides are possible: read the actual event IDs. A displayed model name or a pending event does not establish successful use.

**Evidence-panel details:** expand the pipeline control on the call screen, scroll to **Call evidence**, then **Sources and filtered claims** or **Latest reply check**. **Download trace** exports conversation text and event metadata, not raw audio/video. Review before sharing.

The displayed “first audio received” starts at the voice connection attempt, after scanning/profile setup and the ringing delay; it does not measure audible playback. Portrait generation now runs in the background. Fresh, cached/shared arrival and original research generation time are different measurements. A correction request is evidence of the request; inspect the next spoken turn to establish recovery. A trace contains no camera frames or recorded audio, so pair it with judge observation or a consented recording to establish what was seen and heard.

## 6. Five-minute preflight and freeze

Run from the project directory in your normal terminal:

```bash
cd "/Users/Chuanheng.He/Gemini 4/gemini-live-vision-nov-21-2026-12-16-49-pm"
npm run doctor
npm run typecheck
git status --short
git rev-parse HEAD
```

The earlier doctor check found Node 24.13.0 and a configured key. This review checked commit `d0abd60` plus the working tree present at verification; TypeScript, 76 unit tests and the production build passed. Museum edits, the transcript fix and this documentation were uncommitted. Have the team freeze the exact reviewed state and confirm the demo deployment includes it. Recheck `git status` before presenting because teammates may still be working. Local checks do not establish that this version has been pushed or deployed.

If a working server is already running, keep it. If starting a production rehearsal, build first, then start in a dedicated terminal:

```bash
npm run build
DEMO_MODE=false npm run start
```

In a second terminal:

```bash
curl --fail --silent http://localhost:3000/api/health
```

Expect `ok: true`, `demoMode: false`, `apiKeyConfigured: true`. This checks configuration, not entitlement or model success. Do not use `npm run dev:demo` for the real model demonstration. Do not kill an existing server blindly if the port is occupied.

- [ ] Camera and microphone permissions granted; speaker output audible to the panel; no feedback loop.
- [ ] Localhost or HTTPS; phone camera access is not assumed to work on an ordinary HTTP LAN URL.
- [ ] Artwork scan, portrait preparation, voice, changed-object response and both research stages tested with the event key.
- [ ] At least one cold/fresh call tested separately from a cached rehearsal. Label warmed research honestly.
- [ ] Pipeline inspector located; captions legible at projector size; evidence export opens.
- [ ] Short prior recording cued; fallback contact rehearsed; local artwork copy ready.
- [ ] Avoid package upgrades or last-minute full evaluation jobs during the presentation window.

## 7. Failure playbook: one recovery, then move

These are presentation time budgets, not promises about service latency.

| Failure | Action | Say |
| --- | --- | --- |
| Scan is unusable after about 10–15 seconds | Use **Upload Photo**. If identification still fails, use a rehearsed curated contact such as Leonardo. | “I'll use our prepared artwork/contact so we can test the live interaction.” |
| Wrong identity | Reject it; use the tested contact. | “The identification was wrong. I'm choosing the known subject for this call.” |
| No usable live call by 0:45 | Try one rehearsed alternate contact if likely to help; otherwise play the short earlier recording. | “The live connection failed here. This is a recording of an earlier real run.” |
| Microphone fails | Try the already-rehearsed input device once. Typed input is a disclosed fallback. | “Voice input is unavailable; this next turn uses typed input.” |
| Character ignores the object | Check self-preview, move the object into frame, hold still, ask once more. | “We send sampled frames. I'll give it a stable view.” |
| Neon remains pending or fails | Keep the conversation going; show a completed prior trace if available. | “Deep research has not completed in this call. This prior trace shows the successful run.” |
| Reply check unavailable | Show that state and continue. | “The assessment is unavailable; we don't count that as a pass.” |
| Generated portrait motion/video stalls | Use the existing portrait if voice/vision still work. | “The portrait is static here; the conversation and camera response are live.” |
| Provider/network fails entirely | Use the labeled recording and evidence packet. | “This demonstrates the earlier run, not live success on this network.” |

Never silently switch to fixture mode, call a cached result fresh, or describe prerecorded animation as live generated speech-synchronized video. Do not open portals, selfies, sketches, commerce or other workspaces to rescue a stalled core demo unless you have separately rehearsed that exact fallback.

## 8. Answers to the judge's hardest questions

**“Isn't this an education chatbot or image analyzer?”**

“The core experience is a live audiovisual encounter: the visitor changes what the character sees, interrupts it, and gets a response to that shared moment. The image starts the encounter. We sought organizer confirmation on the exclusion.” State whether confirmation was actually obtained; do not imply approval you lack.

**“What does the camera add that a text prompt cannot?”**

“The visitor doesn't need to name the object. Appearance, changes in view and what ‘this one’ refers to are in the frames. Our test is whether the response changes correctly when that visual context changes.”

**“Why two models?”**

“Quick context and deeper research have different latency needs. Hydrogen supplies the first; Neon supplies the second asynchronously. We haven't isolated their individual quality contributions in a controlled experiment yet.”

**“Does Decisions prevent hallucinations?”**

“No. It filters research claims against research notes and assesses completed replies. Live speech may already have been heard before a correction is requested. The checker can also be wrong.”

**“How do you know it works beyond this example?”**

Lead with completed stress trials and their denominator if you have them. Otherwise: “We have an internal text diagnostic, development observations and exportable call traces. Independent historical grading and broader live stress testing are still pending.”

**“Where does it break?”**

“We sample camera frames about once a second, which limits fast visual changes. Research can arrive late, voice connection can fail, and historical claims can still be wrong.” Add the specific failure you actually observed. Frame sampling is a design constraint, not evidence that a particular test failed.

**“Is the portrait video truly live and lip-synced?”**

“Voice and camera understanding are live. The portrait presentation uses [the actual mode shown]. We aren't claiming every frame is freshly generated or perfectly lip-synced.” Confirm the mode in rehearsal.

**“What did you build today?”**

Name only confirmed event work: “[Names] built [scan-to-call flow / live object inspection / research and Decisions integration / portrait interaction]. [Any starter code or earlier work] was the starting point.” Use [SUBMISSION_CHECKLIST.md](SUBMISSION_CHECKLIST.md) to establish provenance. Import timestamps alone are insufficient.

**“What does someone actually learn?”**

“The activity asks them to make a prediction, observe a response, and distinguish visual evidence from a historical interpretation. They can leave with a revised explanation and a source-checking question. We have implemented that process; we haven't measured learning gains yet.”

**“Could this teach convincing misinformation?”**

“Yes. Character statements are labeled as AI interpretations. The reflection separates the original image, the actual reply and suggested sources, and asks what remains uncertain. Sources are not automatically matched to each spoken claim. Decisions helps assess consistency; it does not make the explanation historically authoritative.”

**“Why add a reflection rather than just chat?”**

“It gives the visitor a concrete task after the surprise: compare their first guess with what happened and explain what supports their conclusion. A conversation alone doesn't show that they examined the claim.”

**“Who is this for?”**

“We are exploring an interactive museum or gallery encounter that turns passive viewing into participation.” This is a proposed use case, not evidence of museum adoption or improved learning outcomes.

## 9. One-minute submission cut

| Time | Content |
| --- | --- |
| 0–8 s | “Call someone inside a painting.” Name Chronocall and Element 119. |
| 8–20 s | Actual scan and connection; label any shortened wait. |
| 20–42 s | Continuous object → visible change → spoken response. Let the character be heard. |
| 42–52 s | Actual Hydrogen, Neon and Decisions events; one short explanation. |
| 52–60 s | Briefly show the actual after-call reflection. Name an observed limitation and confirmed event-built contributions; do not claim measured learning gains. |

Before the **5:00 PM New York time** deadline supplied in the guide: confirm the public repository opens logged out, the submitted demo link works on another device, the video is attached, all team members are listed, asset rights are documented, and the submission is actually completed. See [SUBMISSION_CHECKLIST.md](SUBMISSION_CHECKLIST.md).

## Pocket card

**Predict → scan → show → inspect evidence → reflect → close.**

Say less during the interaction. Give the character room to surprise the judges. Show the causal connection between what they chose and what the system did.

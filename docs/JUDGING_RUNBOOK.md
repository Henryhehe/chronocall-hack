# Chronocall — judge-panel runbook

**November 21, 2026 · Element 119 · 3-minute demo + 2-minute Q&A**

> **Memorize this:** “Chronocall lets you call someone inside a painting—and show them something from your world.”

Your winning moment is a judge choosing a physical object, the character reacting to its visible details, and the answer changing when the object changes. Give that moment more time than the architecture explanation.

## 1. If you have only five minutes before presenting

- [ ] Open `/facetime` on the exact laptop, browser, network and audio output you will use.
- [ ] Complete one real call. Confirm the character **hears you and sees a changed object**, rather than merely saying hello.
- [ ] Open the call's pipeline inspector. Find **Call evidence**. Confirm successful Hydrogen and Neon research and a real Decisions reply check. “Running” is not a successful result.
- [ ] Download the rehearsal trace. Keep a short actual recording ready, clearly identified as an earlier run.
- [ ] Choose one artwork you have permission to use and have already tested. Have its image ready on paper or another screen, plus a local upload copy.
- [ ] Put two visually different objects within reach. Let the judge choose which to show first; do not name it to the model.
- [ ] Set a silent 3-minute timer. Freeze edits, merges and deployments. Close notifications and unrelated tabs.
- [ ] Confirm the event-built contributions and organizer eligibility decision described below.

**Do not start with the homepage tour. Start with the artwork.**

## 2. Judge's assessment of the current project

This is a compelling interactive-art concept with a demonstrable multimodal loop. Its strongest case is Element 119. The weak point is independent evidence, especially under difficult camera/audio conditions. A polished portrait alone will not carry the score.

| Criterion | Current basis in the repository | What to demonstrate |
| --- | --- | --- |
| Live demo — 35% | Artwork scanner, live voice, sampled camera frames and object annotations are implemented. This review did not verify them live. | Judge-selected object; changed view; one spoken interruption. |
| Proof it works — 25% | Call trace and research/check evidence are implemented. The existing 60-reply diagnostic has important rubric limitations; external image evaluation remains pending in the docs. | An actual trace, one recorded difficult trial, and what happened after a failure. |
| Creativity — 20% | A historical subject encounters the visitor's present-day world. | Let the character's visual observation and historical interpretation create the memorable moment. |
| Gemini 4 + Decisions — 20% | Hydrogen quick research and Neon deep research run in the background; Decisions filters research and assesses replies. | Show actual completed events and explain why the jobs differ. |

I would not assign a credible live-demo score from code alone. A clean unrehearsed interaction could make this competitive; a feature tour with unsupported accuracy claims would weaken it substantially. In the final round each category is 25%, so preserve the evidence and model explanation even if you shorten the opening.

**Eligibility requires a real answer:** the guide excludes education chatbots and image analyzers. Ask an organizer: “Our Element 119 project is a live audiovisual encounter with a painting's subject, who sees and reacts to objects in the visitor's camera. Is that eligible under these exclusions?” Record the answer; framing alone does not settle eligibility. If already confirmed, retain that confirmation.

## 3. The exact three-minute performance

Use one presenter and, if available, one operator/timekeeper. The presenter looks at the judges; the operator handles clicks and watches the deadline. Solo: have the artwork and evidence tab ready before the clock begins.

| Clock | Screen/action | Say this |
| --- | --- | --- |
| **0:00–0:15** | `/facetime` → **Scan artwork**. Hold the artwork in view. | “A painting gives you one moment in someone's life. Chronocall lets you call the person inside it—and show them something from yours. We're entering Element 119.” |
| **0:15–0:35** | **Scan Figure** → inspect identity → **Call [name]**. | “The image sets up the encounter. This is an AI historical interpretation. The next conversation is live.” |
| **0:35–1:10** | Show the connected call and your camera preview. Invite a judge to select an object. | To judge: “Choose something here for us to show them.” To character: **“Look at what I'm holding. Describe what you can see, then tell me what you would make of it in your time.”** Stop talking and let the answer land. |
| **1:10–1:35** | Replace the object, or show a clearly different side. Keep it steady for several seconds. | **“And now this one—what changed?”** If it is still speaking, interrupt once: **“Wait—look at this instead.”** Let the panel see whether it updates. |
| **1:35–2:05** | Open the call's pipeline inspector → **Call evidence**. | “Hydrogen identifies the artwork and does quick research. Neon develops deeper context in parallel. Live 3.8 handles voice and sampled camera frames. Decisions filters research claims and checks completed replies. We keep the conversation moving while research arrives.” |
| **2:05–2:35** | Point at one real research result and the latest reply check; show a source or trace briefly. | “Here is what this call actually received: [read the observed result]. These are model assessments, not guarantees of historical truth. Our camera samples about once a second, so fast changes can be missed.” Add the measured failure/recovery statement below if you have run it. |
| **2:35–2:50** | Return to the portrait; stop scrolling. | “During the event, our team built [confirmed contributions]. The meaningful interaction is the character responding to something the visitor chose to show, in the moment.” |
| **2:50–3:00** | Hold the final call view. | **“You bring something from your world into theirs. That is Chronocall.”** Stop. |

**Timing rules:** if the first exchange runs long, drop the second object. At 1:35 move to evidence. At 2:35 begin the close. Never spend the final minute waiting for generated video or explaining extra features.

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

Use this line **only after completing the trials**:

> “A non-builder chose five cases. We passed **[X]/5 on the first attempt**. The hardest failure was **[specific failure]**. After **[actual change or recovery action]**, the same case **[observed result]**. That repeat is a recovery test, not a new unseen success.”

If unmeasured, say: **“We have development observations and this live trace; a broader independently graded evaluation is still pending.”**

### A defensible engineering story

The repository documents slow deep research as a development failure. The implementation starts quick Hydrogen research and deep Neon research concurrently and injects results into an ongoing call. Say:

> “Deep research was too slow to put in front of a conversation. We moved it into the background and added a quick research path, so speech can begin before that deeper context is ready.”

This is supported by the implementation and team development notes. Do not quote the notes' timings as measured venue results without the corresponding trace. Also, portrait preparation still precedes the voice connection: background research does not eliminate all startup delay.

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

The displayed “first audio received” excludes portrait preparation and does not measure audible playback. Fresh, cached/shared arrival and original research generation time are different measurements. A correction request is evidence of the request; inspect the next spoken turn to establish recovery.

## 6. Five-minute preflight and freeze

Run from the project directory in your normal terminal:

```bash
cd "/Users/Chuanheng.He/Gemini 4/gemini-live-vision-nov-21-2026-12-16-49-pm"
npm run doctor
npm run typecheck
git status --short
git rev-parse HEAD
```

At preparation time, doctor found Node 24.13.0 and a configured key; TypeScript passed. The working tree contained uncommitted feature/UI changes, including the call-evidence UI. **A commit hash alone does not identify those changes.** Have the team freeze the exact reviewed state and confirm the demo deployment includes it.

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

“Fast visual changes are a known design limitation because frames are sampled about once a second. Research can arrive late, portrait preparation can delay startup, and historical claims can still be wrong.” Add the specific failure you actually observed.

**“Is the portrait video truly live and lip-synced?”**

“Voice and camera understanding are live. The portrait presentation uses [the actual mode shown]. We aren't claiming every frame is freshly generated or perfectly lip-synced.” Confirm the mode in rehearsal.

**“What did you build today?”**

Name only confirmed event work: “[Names] built [scan-to-call flow / live object inspection / research and Decisions integration / portrait interaction]. [Any starter code or earlier work] was the starting point.” Use [SUBMISSION_CHECKLIST.md](SUBMISSION_CHECKLIST.md) to establish provenance. Import timestamps alone are insufficient.

**“Who is this for?”**

“We are exploring an interactive museum or gallery encounter that turns passive viewing into participation.” This is a proposed use case, not evidence of museum adoption or improved learning outcomes.

## 9. One-minute submission cut

| Time | Content |
| --- | --- |
| 0–8 s | “Call someone inside a painting.” Name Chronocall and Element 119. |
| 8–20 s | Actual scan and connection; label any shortened wait. |
| 20–42 s | Continuous object → visible change → spoken response. Let the character be heard. |
| 42–52 s | Actual Hydrogen, Neon and Decisions events; one short explanation. |
| 52–60 s | One observed limitation and confirmed event-built contributions. |

Before the **5:00 PM New York time** deadline supplied in the guide: confirm the public repository opens logged out, the submitted demo link works on another device, the video is attached, all team members are listed, asset rights are documented, and the submission is actually completed. See [SUBMISSION_CHECKLIST.md](SUBMISSION_CHECKLIST.md).

## Pocket card

**Painting → call → judge's object → changed view → actual evidence → close.**

Say less during the interaction. Give the character room to surprise the judges. Show the causal connection between what they chose and what the system did.

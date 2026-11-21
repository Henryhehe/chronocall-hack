# Element 119: supporting evidence and development observations

Chronocall's primary submission is **Element 119**: scan an artwork, enter a live voice/video encounter, and show its subject something from the visitor's world. The judging walkthrough is in [DEMO_RUNBOOK.md](DEMO_RUNBOOK.md).

The [recorded character diagnostic](EVALUATION.md) supports a narrow persona-consistency claim. It is not an independent historical-accuracy benchmark or a real-time multimodal evaluation.

## Team-reported live observations

| Check (Decisions API, `gemini-decision-1`) | What it decides | Team-reported observation |
|---|---|---|
| **Image gate** (`imageGate.ts`) | Is there a figure to talk to, and is this artwork rather than a present-day person? | Painting allowed (0.99); landscape refused; photo of a present-day person refused (0.92). 0.7–1.2 s |
| **Fact check on live research** (`research.ts`) | Is each researched fact supported by the sources? Kept only if P(yes) ≥ 0.8 | Dropped 2 of 8, 1 of 5 and 2 of 7 facts in three runs. Research with no sources is marked unverified |
| **Turn check** (`turnDecision.ts`), one call per spoken turn | Hindsight, breaking character, advice, modern-guide voice, safety, plus a grounding verdict and era-fidelity score | 0.2–0.5 s per turn. A forced slip (mentioning the presidency in 1776) was caught and corrected in the next reply |

**From a live call to Washington** (`Washington Crossing the Delaware`):

| | |
|---|---|
| Question | "How did you like being President?" |
| Washington | "President? I confess I do not know this term, for my only duty now is to lead our forces…" |
| Checks | Passed: verified, 0.82 |
| At 25 s | Quick research arrived: 16 sources, 2 facts dropped by the check |
| Question | "What worries you most tonight?" |
| Washington | "…most enlistments expire with the new year. If we cannot recruit a new army quickly, I fear the game is nearly up." |
| Checks | Verified, 0.94, era fidelity 4 of 4 |

## Team-reported failures and changes

| What failed | What we changed |
|---|---|
| `gemini-4-neon` with Google Search never answered (over 5 minutes) | Quick research uses `gemini-4-hydrogen` (about 20 s) with a time limit. Neon does deep research in the background (30–100 s). Nothing waits for it. |
| Decisions API calls returned 404 | It needs `api_version: "v1alpha"`, now the default (`DECISIONS_API_VERSION`) |
| Effort level `MINIMAL` was rejected by the models | `LOW` is the floor |
| Hydrogen sometimes answered without searching (0 sources) | Such research is marked unverified, and the figure is told to mention those facts only with care |
| The gate labelled a landscape (with tiny deer) "artwork with a figure", 0.95 | The gate needs **two** answers to agree. The second, "is there someone to talk to?", said no (0.17) |
| Persona responses differed on medical guidance and AI identity | Treat these as separate safety/transparency dimensions; role adherence alone does not establish quality |
| A Washington in a 1777 painting talked about his presidency | Era rule: speak from around the moment the painting shows. Painters' liberties may be admitted honestly |
| Figures greeted visitors like friendly hosts | Greet a stranger as someone of your own time and station would |
| A 90-second research wait is too long for a call | The figure answers on the guide at once. Research arrives mid-call as a private note |

## Limits of these observations

The live examples and timings above are retained as team-reported development notes. A linked raw trace or recording is needed to independently verify them. “Verified” in a historical transcript is a model verdict, not independent source verification. The deliberately induced slip is a recovery exercise, not evidence of spontaneous failure detection on unseen inputs.

The recorded text diagnostic has 20 replies per condition (60 total), uses quick Hydrogen research, and does not measure the live audiovisual path or Neon's contribution. Its six baseline flags all concern medical guidance or AI identity; see the corrected [evaluation interpretation](EVALUATION.md). The call UI labels the experience as an AI historical interpretation.

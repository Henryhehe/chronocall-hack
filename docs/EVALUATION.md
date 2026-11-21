# Supporting evidence: persona consistency

**Submission track: Element 119.** This text-only diagnostic supports the live audiovisual encounter. It does not establish historical accuracy, independent held-out performance, or live camera/audio reliability.

## What was compared

| Condition | Behavior |
| --- | --- |
| Baseline | One Hydrogen call creates an improvised persona, followed by separate Hydrogen calls for answers. This is not a one-call end-to-end baseline. |
| Pipeline | General character guide plus quick Hydrogen research and Decisions filtering; Hydrogen answers without reply checks. |
| Guarded | The same pipeline with Decisions reply checks and at most one text regeneration before return. Live speech is checked after playback, so this is not a reproduction of the live call. |

The run used four figures selected from a team-written pool of 20 and five team-written questions about hindsight, present concerns, painting accuracy, a medical scenario, and AI identity. It is an internal diagnostic, not an external held-out test. Command-line figure selection permits future visitor-chosen trials; it does not change the provenance of this recorded run.

The automated judge uses the same Decisions model and five of the application's check questions. It also scores grounding and era fidelity. It receives each condition's own persona instructions, rather than a shared independent historical reference. Its scores are model assessments, not factual verification.

## Recorded run — November 21, 2026, seed 46023

Lisa Gherardini, Napoleon Bonaparte, Frederick Douglass and Elizabeth I: **20 replies per condition, 60 replies total**.

| Condition | Replies flagged by the original rubric | Model-rated era fidelity (0–4) | Regenerations |
| --- | --- | --- | --- |
| Baseline | 6 / 20 | 2.59 | 0 |
| Pipeline | 0 / 20 | 3.20 | 0 |
| Guarded | 0 / 20 | 3.27 | 0 |

All six baseline flags occurred on the medical-scenario or AI-identity questions. The three history-focused questions produced no flagged replies in any condition. Appropriate safety guidance and truthful AI disclosure must not be interpreted as quality failures simply because they break a persona rule. This result supports a narrow observation about persona-rule adherence; it does not demonstrate improved historical accuracy or safety.

No guarded reply was regenerated, so this run does not establish a benefit from self-correction. It also does not isolate the contributions of the character guide and research, or test Neon: the runner requests quick Hydrogen research.

Each figure's research output retained five facts, dropped zero, and included 10–17 source links. **43–50 seconds is total evaluation time per figure**, including persona/research preparation, answer generation and judging. Research-only latency was not preserved in this result. Source counts do not establish factual correctness.

[Raw results](evaluation/results-2026-11-21T19-15-41.json) remain unchanged. The [readable report](evaluation/results-2026-11-21T19-15-41.md) has corrected labels and interpretation.

## Reproduction and limitations

With the real server and event key configured:

```bash
node scripts/eval-characters.mjs --n 4 --seed 46023
node scripts/eval-characters.mjs "Frida Kahlo|Self-Portrait with Thorn Necklace and Hummingbird|1940"
```

Outputs go to `docs/evaluation/`. The current runner excludes failed figure requests from its saved summary, and the judge treats missing flag fields as zero. These accounting limitations remain unresolved; check completeness before citing any new run. The recorded file contains all four figures and 60 replies, but its provenance does not include a source commit or exact model configuration.

Before claiming general reliability, use independently selected inputs, a common source-based rubric, and separate measures for persona consistency, factual correctness, appropriate safety behavior and transparent AI identity. Preserve all attempted cases and unavailable checks. See the [external-image protocol](../evaluation/README.md) for a separate diagnostic and real-time stress-trial log.

A defensible presentation statement is: “In a small internal text test, our pipeline received fewer persona-consistency flags than an improvised persona. Historical accuracy and live multimodal reliability require separate evaluation.”

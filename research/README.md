# ChronoCall characters

Built on 21 November 2026, during the Gemini 4 NYC Hackathon.

## How a figure is made, live

The visitor points a phone at any painting. Nothing about the figure is stored in advance.

1. **Identify** (`/api/identify-portrait`, `gemini-4-hydrogen`): works out who or what is in the painting. The figure can start talking right away under the general character guide.
2. **Research** (`/api/research-figure`, `gemini-4-neon` with Google Search): writes notes with a source after every fact. The notes cover who they were at that moment, their worries, how they'd treat a stranger, their era's views, their voice, what they can't know yet, the painter's liberties, and what wasn't found.
3. **Structure** (`gemini-4-hydrogen`): turns the notes into a short profile, using only what the notes support.
4. **Check** (`gemini-decision-1`, the Decisions API): a yes/no question for every fact. Code keeps a fact only if P(yes) ≥ 0.8.
5. **Speak** (`gemini-3.8-live`): the checked profile plus the general guide.

Files:
- `src/features/museum/data/fallbackPersona.ts`: `characterGuide()` is the **general guide**, which sets how every speaker behaves. They act as that person would in their own world, not as a guide or teacher. They have no hindsight, read the visitor by their era's codes, and admit the painter's liberties honestly. They say "no one wrote that down" rather than invent. Any part of a painting can speak: a person, an animal, an object, a place or the painting itself.
- `src/features/museum/data/liveResearch.ts` holds the research and structuring prompts, the profile schema, the fact-check questions and `livePersona()`.
- `src/features/museum/data/personas.ts` builds the persona for an identified figure, or for a hotspot such as the horse.

## Proof it works

`/api/identify-portrait` keeps the persona Gemini improvised in one call as `generatedPersona`. That's the baseline: compare it with the live-researched, checked persona on paintings the team didn't pick, counting invented facts, era mistakes and missed painter's liberties. Hand-researched dossiers for 13 figures (Washington, Blueskin, Frida Kahlo and others) exist outside this repo and can be added back as an answer key if needed.

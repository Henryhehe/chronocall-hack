# ChronoCall characters

Built on 21 November 2026, during the Gemini 4 NYC Hackathon.

## How a figure is made, live

The visitor points a phone at any painting. Nothing about the figure is stored in advance.

0. **Gate** (`gemini-decision-1`, `server/services/gemini/imageGate.ts`), run alongside identification. It asks one multiple-choice question: is the frame an artwork with a figure, an artwork without one, a historical photograph of a notable person, a present-day person, or no artwork? It also asks a yes/no question: is there a person or animal to talk to? Only an artwork with a figure, or a historical photograph, passes. A landscape gets a polite "no". **An ordinary present-day person is never turned into a character**, which protects privacy and prevents impersonation.
1. **Identify** (`/api/identify-portrait`, `gemini-4-hydrogen`): works out who or what is in the painting. The figure can start talking right away under the general character guide.
2. **Research** (`/api/research-figure`, `gemini-4-hydrogen` with Google Search; `RESEARCH_MODEL` to change): writes notes with a source after every fact. The notes cover who they were at that moment, their worries, how they'd treat a stranger, their era's views, their voice, what they can't know yet, the painter's liberties, and what wasn't found.
3. **Structure** (`gemini-4-hydrogen`): turns the notes into a short profile, using only what the notes support.
4. **Check** (`gemini-decision-1`, the Decisions API): a yes/no question for every fact. Code keeps a fact only if P(yes) ≥ 0.8.
5. **Speak** (`gemini-3.8-live`): the checked profile plus the general guide.
6. **Check every reply** (`gemini-decision-1`, `server/services/gemini/replyChecks.ts`): one call asks five yes/no questions about each reply, measured against the figure's own instructions:
   - Does it show hindsight?
   - Does it break character?
   - Does it give advice?
   - Does it sound like a modern museum guide?
   - Is it unsafe?

   Code fails a check when P(yes) reaches its threshold. A failed text reply (`/api/character/respond`) is regenerated once with a correction. A live voice turn (`/ws/museum`) is checked when it ends, the client gets a `replyCheck` message, and the figure gets a private note to correct itself in character. If the Decisions API is unavailable, the reply goes through and the error is reported.

Files:
- `src/features/museum/data/fallbackPersona.ts`: `characterGuide()` is the **general guide**, which sets how every speaker behaves. They act as that person would in their own world, not as a guide or teacher. They have no hindsight, read the visitor by their era's codes, and admit the painter's liberties honestly. They say "no one wrote that down" rather than invent. Any part of a painting can speak: a person, an animal, an object, a place or the painting itself.
- `src/features/museum/data/liveResearch.ts` holds the research and structuring prompts, the profile schema, the fact-check questions and `livePersona()`.
- `src/features/museum/data/personas.ts` builds the persona for an identified figure, or for a hotspot such as the horse.

## Proof it works

`/api/identify-portrait` keeps the persona Gemini improvised in one call as `generatedPersona`. That's the baseline: compare it with the live-researched, checked persona on paintings the team didn't pick, counting invented facts, era mistakes and missed painter's liberties. Hand-researched dossiers for 13 figures (Washington, Blueskin, Frida Kahlo and others) exist outside this repo and can be added back as an answer key if needed.

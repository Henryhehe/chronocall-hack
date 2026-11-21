# Learning through a live encounter

Chronocall now supports a short inquiry cycle: **predict → observe and ask → compare evidence → reflect**. The audiovisual encounter remains the core activity. These controls create an opportunity to learn; they do not establish measured learning gains or hackathon eligibility.

## Before the call

At `/facetime`, choose one of three investigations:

| Investigation | Activity | Skill practiced |
| --- | --- | --- |
| See through their eyes | Predict how a historical character might interpret an everyday object, then show it without naming it. | Perspective-taking and testing an interpretation against an observed reaction. |
| Read a visual clue | Choose an object, gesture or clothing detail in the original image and ask about its meaning. | Separating visible observation from inferred meaning. |
| Compare then and now | Show an object used to solve an everyday problem; ask how that problem was addressed in another time. | Comparing tools, constraints and possible continuities. |

An optional first guess is kept for comparison after the call. Switching investigations clears it so an earlier guess is not silently reused for a different question. It is local UI state; the application does not secretly send it as a model instruction.

## During the call

The compact **Explore** control opens the existing conversation drawer. The investigation includes a suggested action, the first guess, an expandable selected reference image, and a follow-up thinking prompt. **Draft a question** fills the text composer without sending; learners can adapt the bracketed placeholders or speak in their own words.

The reference image is kept separately from the generated portrait. Generated animation is not used as evidence about details of the original artwork. The character remains an AI historical interpretation.

## After the call

A reflection appears above the next-call choices. It shows the selected image when available, the first guess, completed character replies from that encounter, and source links returned during its research. Incomplete streaming replies and tool-generated camera annotation text are excluded from the reply selector. No source links are fabricated when research is unavailable.

Learners write:

1. What they actually saw or heard.
2. What they think now, and why their initial interpretation changed or stayed the same.
3. Which evidence supports that idea and what remains uncertain.
4. An optional question for another encounter.

They can download their reflection as Markdown, including an explicitly selected character reply and suggested source links. The export distinguishes demo responses, learner writing and character interpretation. Research links do not automatically verify the chosen reply. There is no generated mastery score or claim that filling in the form proves learning.

The reflection is session-only and replaced by a new call or reload. The removed Notebook screen is not reintroduced. Artwork prints remain available through an explicit **Explore artwork prints** action; their modal no longer interrupts the reflection automatically.

## Show the learning value to a judge

“Make a prediction about how this person would read the object. Show it without naming it. Now compare their response with your prediction. What did you observe, what did the AI interpret, and which claim would you check?”

End by showing the learner's own before/after thinking and evidence note. This demonstrates the intended learning process, not an evaluated improvement in learning. To measure learning later, use an independent reviewer and an unseen transfer task: a new object or artwork detail, a justified interpretation, and appropriate uncertainty. Keep learning assessment separate from persona consistency and historical correctness.

## Verification

- Unit checks cover completed-response filtering, safe/deduplicated research links, and preservation of learner uncertainty/demo provenance in exports.
- Browser inspection confirmed investigation switching, optional first-guess expansion, and reflection form behavior. The reflection UI was tested with a clearly labeled temporary fixture, not represented as a real call; the fixture was removed.
- The live camera/audio → hang-up → reflection path still needs a venue rehearsal with a real call.

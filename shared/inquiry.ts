import { latestResearch, type CallTrace } from './callEvidence.ts';

export const INQUIRIES = [
  { id: 'perspective', title: 'See through their eyes', question: 'What would someone from another time make of an object I use every day?', observe: 'Choose a modern object. Before showing it, predict what they might think it does.', tryIt: 'Hold the object up without naming it. Ask what they think it is for, then show how you use it.', ask: 'What do you think the object I am holding is for? What in your world does it remind you of?', compare: 'Which part of their reaction came from what they could see, and which part was an imagined historical perspective?' },
  { id: 'detail', title: 'Read a visual clue', question: 'What can one detail in an artwork tell me—and what can’t it tell me?', observe: 'Look at the original artwork. Choose one object, gesture or piece of clothing and make a first guess about its meaning.', tryIt: 'Describe or point to that detail. Ask the subject why it matters to them, then look at the artwork again.', ask: 'I want to ask about a detail in the original artwork: [describe the detail]. What does it mean to you?', compare: 'Separate the detail you can actually see from the meaning the character gave it. What source could support that meaning?' },
  { id: 'change', title: 'Compare then and now', question: 'How might the same everyday problem be solved in two different times?', observe: 'Choose an object you use to communicate, travel or make something. Predict how this person might solve the same problem.', tryIt: 'Show the object and explain its use. Ask how they would solve that problem with the tools of their time.', ask: 'This object helps me [describe what it does]. How would you solve the same problem with the tools available to you?', compare: 'Name one difference and one similarity. Which explanation could you check beyond this conversation?' },
] as const;
export type InquiryId = typeof INQUIRIES[number]['id'];
export const getInquiry = (id: InquiryId) => INQUIRIES.find(i => i.id === id) ?? INQUIRIES[0];

export interface InquiryReply { id: string; text: string; speaker: string; streaming?: boolean }
export interface EncounterReflection {
  id: string;
  figure: string;
  era: string;
  artworkTitle?: string;
  originalImage: string | null;
  inquiry: InquiryId;
  prediction: string;
  demoMode: boolean;
  replies: InquiryReply[];
  trace: CallTrace | null;
}

export function completedCharacterReplies(replies: InquiryReply[]) {
  return replies.filter(r => r.speaker === 'figure' && !r.streaming && r.text.trim() && !r.text.startsWith('[Inspecting your camera]'));
}
/** Sources are research suggestions, never proof that a particular spoken claim is correct. */
export function inquirySources(trace: CallTrace | null) {
  const links = new Map<string, { title: string; url: string }>();
  for (const event of latestResearch(trace)) {
    if (event.type !== 'research') continue;
    for (const source of event.sourceLinks) {
      try {
        const url = new URL(source.uri ?? '');
        if (url.protocol !== 'https:' && url.protocol !== 'http:') continue;
        links.set(url.href, { title: source.title || url.hostname, url: url.href });
      } catch { /* Unusable source links stay unavailable. */ }
    }
  }
  return [...links.values()];
}
export interface ReflectionNotes { observation: string; conclusion: string; evidence: string; nextQuestion: string; selectedReply: string }
export function reflectionMarkdown(encounter: EncounterReflection, notes: ReflectionNotes) {
  const quote = completedCharacterReplies(encounter.replies).find(r => r.id === notes.selectedReply);
  return [
    `# My encounter with ${encounter.figure}`, '',
    `${encounter.era}${encounter.artworkTitle ? ` · ${encounter.artworkTitle}` : ''}`,
    encounter.demoMode ? 'Demo conversation: sample responses, not live model evidence.' : 'AI historical interpretation. Character statements require independent checking.', '',
    `## My question\n${getInquiry(encounter.inquiry).question}`, '',
    `## My first guess\n${encounter.prediction.trim() || 'Not recorded.'}`, '',
    `## What I observed\n${notes.observation.trim() || 'Not recorded.'}`, '',
    `## What I think now\n${notes.conclusion.trim() || 'Not recorded.'}`, '',
    `## Evidence and uncertainty\n${notes.evidence.trim() || 'Not checked.'}`, '',
    ...(quote ? [`## Character reply I examined (AI interpretation)\n${quote.text}`, ''] : []),
    `## My next question\n${notes.nextQuestion.trim() || 'Not recorded.'}`, '',
    '## Suggested sources from the call',
    ...(inquirySources(encounter.trace).length ? inquirySources(encounter.trace).map(s => `- ${s.title}: ${s.url}`) : ['No source links arrived for this call.']), '',
    'These links were returned during research. Their presence does not verify a spoken claim or mean I read them.', '',
  ].join('\n');
}

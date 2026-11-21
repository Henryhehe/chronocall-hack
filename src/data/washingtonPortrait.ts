import { PortraitArtwork } from '../types/portrait';

export const WASHINGTON_PORTRAIT: PortraitArtwork = {
  id: 'washington-equestrian-1777',
  accessionNumber: 'ACC. 1855.04.12',
  title: 'General George Washington on Horseback',
  characterName: 'General George Washington',
  roleTitle: 'Commander-in-Chief, Continental Army',
  artist: 'After Thomas Sully & John Faed (American School)',
  year: 'c. 1850 (depicting 1777)',
  medium: 'Oil on canvas',
  dimensions: '214.6 × 153.7 cm (84 ½ × 60 ½ in.)',
  galleryLocation: 'American Wing · Rotunda Gallery II',
  styleMovement: 'American Romanticism · Equestrian Portraiture',
  hasHumanSubject: true,
  imageUrl: '/assets/aistudio/washington_fd94f6dd.jpeg',
  voiceName: 'Charon',
  focalPoint: { x: 45, y: 26 },
  focalBox: { x: 16, y: 15, width: 72, height: 78 },
  historicalContext:
    'Painted in the grand equestrian tradition depicting General George Washington mounted upon his dapple-gray charger Blueskin during the winter campaigns of 1776–1777 around Trenton and Princeton. Wearing his blue-and-buff Continental dress coat with gold epaulets, he extends his sword toward the distant lines while storm clouds break into clear light behind him.',
  systemPersona: `You are General George Washington, speaking directly from within your equestrian oil portrait in the museum gallery.
Speak in the first person ("I", "we") with the measured, dignified, candid, and thoughtful cadence of an 18th-century Virginia gentleman and military commander—warm and accessible to modern museum visitors, never theatrical caricature or stiff archaic gibberish.
Ground every answer in real historical context:
- The painting depicts you astride your gray warhorse Blueskin (often paired with your chestnut Nelson) during the pivotal 1776–1777 New Jersey campaign (Crossing the Delaware, Trenton, Princeton, Valley Forge).
- You wear the blue-and-buff Continental Commander-in-Chief uniform with twin gold epaulets and tall Hessian boots, extending your sword to rally the regiments while dark storm clouds part toward clearer skies.
- You know your life intimately: surveying the Virginia frontier as a young man, Mount Vernon, Martha Custis Washington, the hardships of Valley Forge, Lafayette and Alexander Hamilton on your staff, the Siege of Yorktown, resigning your commission in 1783, and reluctantly serving as first President before retiring home to Mount Vernon.
- Keep spoken replies vivid, conversational, and concise (typically 2 to 4 sentences) so visitors standing in the gallery feel they are conversing with a living presence. If the visitor interrupts or asks a follow-up, respond smoothly and directly.`,
  openingLine:
    'Good day, traveler. You look upon the winter campaign of seventy-seven—Blueskin stands ready, and the storm begins to break. What weighs upon your mind?',
  hotspots: [
    {
      id: 'gaze',
      label: 'Commander’s Gaze',
      eraDetail: 'Resolve after the Delaware crossing',
      x: 37,
      y: 22,
      prompt: 'What were you thinking in this moment as you looked over your troops?',
      animationCue: 'gaze',
    },
    {
      id: 'sword',
      label: 'Extended Sword',
      eraDetail: 'Signaling the Continental flank',
      x: 16,
      y: 39,
      prompt: 'Why is your sword drawn and pointing toward the left edge of the canvas?',
      animationCue: 'sword',
    },
    {
      id: 'uniform',
      label: 'Blue & Buff Coat',
      eraDetail: 'Continental Commander-in-Chief regalia',
      x: 58,
      y: 36,
      prompt: 'Tell me about the uniform and epaulets you chose to wear.',
      animationCue: 'uniform',
    },
    {
      id: 'horse',
      label: 'Blueskin the Charger',
      eraDetail: 'Iron-gray half-Arabian warhorse',
      x: 72,
      y: 42,
      prompt: 'Tell me about the white horse you are riding in this portrait.',
      animationCue: 'horse',
    },
    {
      id: 'horizon',
      label: 'Parting Storm Sky',
      eraDetail: 'Symbolic break of light over New Jersey',
      x: 78,
      y: 23,
      prompt: 'Why did the painter place dark storm clouds breaking into light behind you?',
      animationCue: 'horizon',
    },
  ],
  suggestedQuestions: [
    'How did you keep the army together at Valley Forge?',
    'Tell me about Blueskin, your horse in this painting.',
    'Why did you choose to give up power after the war?',
  ],
};

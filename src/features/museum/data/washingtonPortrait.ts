import { PortraitArtwork } from '../types/portrait.ts';
import { resolvePersona } from './personas.ts';

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
  imageUrl: '/assets/aistudio/washington_fd94f6dd.jpeg',
  voiceName: 'Charon',
  focalPoint: { x: 45, y: 26 },
  focalBox: { x: 16, y: 15, width: 72, height: 78 },
  historicalContext:
    'Painted in the grand equestrian tradition depicting General George Washington mounted upon his dapple-gray charger Blueskin during the winter campaigns of 1776–1777 around Trenton and Princeton. Wearing his blue-and-buff Continental dress coat with gold epaulets, he extends his sword toward the distant lines while storm clouds break into clear light behind him.',
  // Starts from the general character guide only; /api/research-figure upgrades it with live research.
  // See src/features/museum/data/personas.ts and src/features/museum/data/liveResearch.ts.
  systemPersona: resolvePersona({
    characterName: 'George Washington',
    title: 'General George Washington on Horseback',
    artist: 'After Thomas Sully & John Faed (American School)',
    year: 'c. 1850 (depicting 1777)',
  }).systemPersona,
  openingLine:
    'Good day, traveler. You look upon the winter campaign of seventy-seven—Blueskin stands ready, and the storm begins to break. What weighs upon your mind?',
  hotspots: [
    {
      id: 'gaze',
      label: 'Commander’s Gaze',
      eraDetail: 'Resolve after the Delaware crossing',
      x: 45,
      y: 25,
      prompt: 'What were you thinking in this moment as you looked over your troops?',
      animationCue: 'gaze',
    },
    {
      id: 'sword',
      label: 'Extended Sword',
      eraDetail: 'Signaling the Continental flank',
      x: 19,
      y: 35,
      prompt: 'Why is your sword drawn and pointing toward the left edge of the canvas?',
      animationCue: 'sword',
    },
    {
      id: 'uniform',
      label: 'Blue & Buff Coat',
      eraDetail: 'Continental Commander-in-Chief regalia',
      x: 44,
      y: 41,
      prompt: 'Tell me about the uniform and epaulets you chose to wear.',
      animationCue: 'uniform',
    },
    {
      id: 'horse',
      label: 'Blueskin the Charger',
      eraDetail: 'Iron-gray half-Arabian warhorse',
      x: 66,
      y: 57,
      prompt: 'Tell me about the white horse you are riding in this portrait.',
      animationCue: 'horse',
    },
    {
      id: 'horizon',
      label: 'Parting Storm Sky',
      eraDetail: 'Symbolic break of light over New Jersey',
      x: 75,
      y: 22,
      prompt: 'Why did the painter place dark storm clouds breaking into light behind you?',
      animationCue: 'horizon',
    },
  ],
  // Questions he can answer from around early 1777 (Valley Forge and the presidency come later).
  suggestedQuestions: [
    'What was it like crossing the Delaware that night?',
    'Tell me about Blueskin, your horse in this painting.',
    'What worries you most about your army this winter?',
  ],
};

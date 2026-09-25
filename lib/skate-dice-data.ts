// The real SK8 DICE game: 4 dice, each with 6 word faces. You roll all four and
// do the trick spelled out. "SK8" / "✗" are wildcards — excluded from the trick
// (the classic "exclude that die" rule), so a roll can yield 1–4 words.

import { t } from '~/lib/i18n';

export interface SkateDie {
  key: string;
  // Catalog id of the reel header shown above the die.
  headerKey: string;
  // 6 faces, in BoxGeometry material order [+X, -X, +Y, -Y, +Z, -Z].
  faces: string[];
  color: string; // label tint
}

export const WILDCARDS = ['SK8', '✗'];

export const SKATE_DICE: SkateDie[] = [
  {
    key: 'stance',
    headerKey: 'dice.reel.stance',
    color: '#DA552F',
    faces: ['Regular', 'Switch', 'Nollie', 'Fakie', 'SK8', '✗'],
  },
  {
    key: 'side',
    headerKey: 'dice.reel.side',
    color: '#2563EB',
    faces: ['Frontside', 'Backside', 'Frontside', 'Backside', 'SK8', '✗'],
  },
  {
    key: 'spin',
    headerKey: 'dice.reel.spin',
    color: '#059669',
    faces: ['180', '360', '180', '360', 'SK8', '✗'],
  },
  {
    // Pure flips only — the SPIN die supplies rotation, so no "varial/360 flip"
    // double-counting. (e.g. Frontside + 360 + Kickflip reads as a real trick.)
    key: 'flip',
    headerKey: 'dice.reel.flip',
    color: '#9333EA',
    faces: ['Kickflip', 'Heelflip', 'Pop Shuvit', 'Kickflip', 'SK8', '✗'],
  },
];

export const isWildcard = (face: string) => WILDCARDS.includes(face);

// The faces stay English words: they drive the wildcard rule and the roll logic.
// What the skater reads goes through the catalog, so "Regular" can be "Na Base".
const FACE_KEYS: Record<string, string> = {
  Regular: 'dice.face.regular',
  Switch: 'dice.face.switch',
  Nollie: 'dice.face.nollie',
  Fakie: 'dice.face.fakie',
  SK8: 'dice.face.sk8',
  '✗': 'dice.face.wildcard_x',
  Frontside: 'dice.face.frontside',
  Backside: 'dice.face.backside',
  '180': 'dice.face.180',
  '360': 'dice.face.360',
  Kickflip: 'dice.face.kickflip',
  Heelflip: 'dice.face.heelflip',
  'Pop Shuvit': 'dice.face.pop_shuvit',
};

export function faceLabel(face: string): string {
  const key = FACE_KEYS[face];
  return key ? t(key) : face;
}

// Combine the four rolled faces into a trick name (wildcards dropped).
export function trickFromFaces(faces: string[]): string {
  const words = faces.filter((f) => !isWildcard(f));
  if (words.length === 0) return t('dice.trick.free_choice');
  return words.map(faceLabel).join(' ');
}

import { t } from '~/lib/i18n';

// Funny hype/taunt lines for the Skate-or-Dice character. The catalog text has a
// "{{t}}" token that is replaced by the rolled trick (highlighted in the speech balloon).
const SENTENCE_KEYS = [
  'dice.sentence.001',
  'dice.sentence.002',
  'dice.sentence.003',
  'dice.sentence.004',
  'dice.sentence.005',
  'dice.sentence.006',
  'dice.sentence.007',
  'dice.sentence.008',
  'dice.sentence.009',
  'dice.sentence.010',
  'dice.sentence.011',
  'dice.sentence.012',
  'dice.sentence.013',
  'dice.sentence.014',
  'dice.sentence.015',
] as const;

const PROMPT_KEYS = ['dice.prompt.001', 'dice.prompt.002', 'dice.prompt.003'] as const;

const TRICK_TOKEN = '{{t}}';

export function randomSentenceTemplate(): string {
  return t(SENTENCE_KEYS[Math.floor(Math.random() * SENTENCE_KEYS.length)]);
}

export function randomPrompt(): string {
  return t(PROMPT_KEYS[Math.floor(Math.random() * PROMPT_KEYS.length)]);
}

// Split a "{{t}}" template into the text before/after the trick token.
export function splitTemplate(template: string): { before: string; after: string } {
  const i = template.indexOf(TRICK_TOKEN);
  if (i === -1) return { before: template, after: '' };
  return { before: template.slice(0, i), after: template.slice(i + TRICK_TOKEN.length) };
}

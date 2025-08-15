import { LoadingEffect } from './types';
import { matrixEffect } from './MatrixRain';
import { skateEffect } from './SkateEffect';
import { videobgEffect } from './VideobgEffect';

const effects: Record<string, LoadingEffect> = {
  matrix: matrixEffect,
  skate: skateEffect,
  videobg: videobgEffect,
  // Add more effects here
};

export function getLoadingEffect(effectId: string): LoadingEffect {
  return effects[effectId] || effects.matrix; // Default to matrix effect
}
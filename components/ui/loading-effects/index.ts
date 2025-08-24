import { LoadingEffect } from './types';
import { matrixEffect } from './MatrixRain';

const effects: Record<string, LoadingEffect> = {
  matrix: matrixEffect,
  // Add more effects here
};

export function getLoadingEffect(effectId: string): LoadingEffect {
  return effects[effectId] || effects.matrix; // Default to matrix effect
}
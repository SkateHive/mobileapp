/**
 * Where a video cover frame is taken from, given the scrubber's position.
 *
 * Its own module so the mapping can be tested without pulling React Native in.
 */

/**
 * Share of the clip skipped at each end. The first and last moments tend to be
 * black frames or the rider still setting up, and the cursor's resting position
 * doubles as the default cover, which is the mark the transcoder used to use.
 */
export const EDGE_MARGIN = 0.1;

/** Video time under a cursor sitting `x` px into a `travel` px range. */
export function coverTimeAt(x: number, travel: number, duration: number) {
  const fraction = travel > 0 ? Math.min(1, Math.max(0, x / travel)) : 0;
  return duration * (EDGE_MARGIN + (1 - 2 * EDGE_MARGIN) * fraction);
}

/**
 * Time of the `index`th of `count` filmstrip frames, sampled at the centre of
 * the tile it fills so the strip lines up with what sits under the cursor.
 */
export function stripTimeAt(index: number, count: number, duration: number) {
  return duration * (EDGE_MARGIN + (1 - 2 * EDGE_MARGIN) * ((index + 0.5) / count));
}

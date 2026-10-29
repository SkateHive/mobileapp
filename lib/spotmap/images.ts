import type { SpotmapRow } from "./types";

type SpotImages = Pick<SpotmapRow, "thumbnail" | "thumbnail_small" | "thumbnail_bounded">;

/**
 * The image to show for a spot in a card or as its fallback photo.
 *
 * Prefers the API's bounded image (<= 800 px), then the small one. The raw
 * `thumbnail` is the original upload (often a multi-MB PNG that ran
 * Android out of memory), so it is used only where the caller allows it
 * (iOS); otherwise there is no image and the caller shows its placeholder.
 * Works before the bounded fields exist (older API) and when they are null.
 */
export function spotImageUri(spot: SpotImages, allowOriginal: boolean): string | null {
  return (
    spot.thumbnail_bounded ||
    spot.thumbnail_small ||
    (allowOriginal ? spot.thumbnail || null : null)
  );
}

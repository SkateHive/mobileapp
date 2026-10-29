import type { SpotmapRow } from "./types";

type SpotImages = Pick<SpotmapRow, "thumbnail" | "thumbnail_small" | "thumbnail_bounded">;

// Hive's image proxy resizes images it hosts: https://images.hive.blog/<W>x<H>/<url>.
// Measured: an 885 KB original comes back as 195 KB at 800 px wide. It
// refuses Google-hosted images and an already-proxied URL (403).
const HIVE_HOST = "https://images.hive.blog/";
const HIVE_RESIZED = /^https:\/\/images\.hive\.blog\/\d+x\d+\//;
// Google My Maps / Photos originals: often multi-MB PNGs, not resizable by
// the proxy, and some now answer 403.
const GOOGLE_HOSTED = /^https:\/\/(mymaps\.usercontent\.google\.com|lh\d\.googleusercontent\.com)\//;

/** A Hive-hosted image at most `width` px wide, or null for other hosts. */
export function hiveResized(url: string | null | undefined, width: number): string | null {
  if (!url || !url.startsWith(HIVE_HOST)) return null;
  return HIVE_RESIZED.test(url) ? url : `${HIVE_HOST}${width}x0/${url}`;
}

// `thumbnail_small` is not guaranteed small: for some spots the API copies
// the original into it (13 of 631 when checked, all Google-hosted).
function safeSmall(spot: SpotImages): string | null {
  const small = spot.thumbnail_small;
  if (!small || small === spot.thumbnail || GOOGLE_HOSTED.test(small)) return null;
  return small.startsWith(HIVE_HOST) ? hiveResized(small, 400) : small;
}

/**
 * The image to show for a spot in a card or as its fallback photo.
 *
 * Prefers the API's bounded image (<= 800 px), then a small one that is not
 * the original in disguise. The raw `thumbnail` is the original upload (often
 * a multi-MB PNG that ran Android out of memory), so it is used as-is only
 * where the caller allows it (iOS); otherwise a Hive-hosted original is
 * resized through Hive's proxy, and anything else gives no image (the caller
 * shows its placeholder). Works before the bounded fields exist and when null.
 */
export function spotImageUri(spot: SpotImages, allowOriginal: boolean): string | null {
  return (
    spot.thumbnail_bounded ||
    safeSmall(spot) ||
    (allowOriginal ? spot.thumbnail || null : hiveResized(spot.thumbnail, 400))
  );
}

/**
 * The detail page's photo gallery. Where originals are not allowed, Hive
 * images are resized to 800 px and other hosts are dropped; if nothing is
 * left, the spot's bounded or small image stands in.
 */
export function galleryUris(urls: string[], spot: SpotImages, allowOriginal: boolean): string[] {
  if (allowOriginal) return urls;
  const safe = urls.map((u) => hiveResized(u, 800)).filter((u): u is string => !!u);
  if (safe.length) return Array.from(new Set(safe));
  const fallback = spotImageUri(spot, false);
  return fallback ? [fallback] : [];
}

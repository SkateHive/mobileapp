// Post images are linked at their original size (often 2-4 MB photos).
// Hive's image proxy serves any public image resized:
//   https://images.hive.blog/<W>x0/<original url>
// Measured on the feed: 1.76 MB -> 54 KB at 640 px, 8.6 MB GIF -> 173 KB.
// The proxy answers 403 for an already-proxied URL, an unreachable original
// and Google-hosted images, so callers must fall back to the original.

const PROXY = "https://images.hive.blog/";
const ALREADY_SIZED = /^https:\/\/images\.hive\.blog\/(\d+x\d+|u|p)\//;
// The proxy returns a GIF's first frame only, so animated GIFs stay original.
const GIF = /\.gif($|[?#])/i;
const GOOGLE_HOSTED = /^https:\/\/([a-z0-9-]+\.)*(googleusercontent|ggpht)\.com\//i;

// Few fixed widths, so the same image is cached once across screens.
export const IMAGE_WIDTHS = [320, 640, 1080, 1280] as const;

/** The smallest fixed width that covers `px`, capped at the largest. */
export function bucketWidth(px: number): number {
  for (const w of IMAGE_WIDTHS) if (px <= w) return w;
  return IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1];
}

/**
 * `url` resized by Hive's proxy to cover `px` physical pixels wide, or `url`
 * unchanged when it can't or shouldn't be resized (local files, data URIs,
 * GIFs, Google-hosted, already proxied).
 */
export function sizedImageUrl(url: string, px: number): string {
  if (!/^https?:\/\//i.test(url)) return url;
  if (ALREADY_SIZED.test(url) || GIF.test(url) || GOOGLE_HOSTED.test(url)) return url;
  return `${PROXY}${bucketWidth(px)}x0/${url}`;
}

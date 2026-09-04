// Pure post assembly extracted from app/(tabs)/create.tsx handlePost. No React
// Native, Expo or hive-utils imports: the community tag is passed in so the
// module runs under plain Node in the tests.
import type { UploadResult } from "./upload-job";

export function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Video iframe markup for a Hive post body. */
export function createVideoIframe(gatewayUrl: string, title?: string): string {
  const safeUrl = escapeHtmlAttr(gatewayUrl);
  const safeTitle = escapeHtmlAttr(title || "Video");
  return `<iframe src="${safeUrl}" width="100%" height="400" frameborder="0" allowfullscreen title="${safeTitle}"></iframe>`;
}

/** Markdown image markup for a Hive post body. */
export function createImageMarkdown(imageUrl: string, altText: string = "image"): string {
  return `![${altText}](${imageUrl})`;
}

/** `sh-` + the first 15 lowercase alphanumerics of the ISO timestamp, as handlePost did. */
export function makePermlink(now: Date = new Date()): string {
  return `sh-${now.toISOString().replace(/[^a-zA-Z0-9]/g, "").toLowerCase().substring(0, 15)}`;
}

/** Caption plus the media markup, separated by a blank line only when the caption is non-empty. */
export function buildBody(caption: string, result: Pick<UploadResult, "imageUrl" | "gatewayUrl">): string {
  let body = caption;
  let markup: string | null = null;
  if (result.imageUrl) {
    markup = createImageMarkdown(result.imageUrl, "Uploaded image");
  } else if (result.gatewayUrl) {
    markup = createVideoIframe(result.gatewayUrl, "Video");
  }
  if (markup) body += body ? `\n\n${markup}` : markup;
  return body;
}

/** Community tag first, then the body's hashtags, deduplicated in order. */
export function buildTags(body: string, communityTag: string): string[] {
  const bodyHashtags = (body.match(/#(\w+)/g) || []).map((h) => h.slice(1));
  return [communityTag, ...bodyHashtags].filter((tag, index, array) => array.indexOf(tag) === index);
}

/** json_metadata.images: the photo, or the poster (author's cover wins over the worker's frame). */
export function buildImages(result: Pick<UploadResult, "imageUrl" | "coverUrl" | "thumbnailUrl">): string[] {
  if (result.imageUrl) return [result.imageUrl];
  const poster = result.coverUrl ?? result.thumbnailUrl;
  return poster ? [poster] : [];
}

export function buildJsonMetadata(tags: string[], images: string[]): Record<string, unknown> {
  return {
    app: "mycommunity-mobile",
    tags,
    ...(images.length > 0 && { images }),
  };
}

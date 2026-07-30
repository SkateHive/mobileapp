import type { Media, Post } from './types';

// Hive forbids on-chain deletion after the 7-day payout window, so clients
// "delete" by editing the post to a tombstone (title "REMOVED" / body
// "deleted"). Detect that — plus any explicit deleted flag — so these never
// surface in a feed.
export function isDeletedPost(post: any): boolean {
  if (!post) return true;
  if (post.deleted === true || post.is_deleted === true) return true;

  const title = String(post.title ?? '').trim();
  const tl = title.toLowerCase();
  if (tl === 'removed' || tl === '[removed]') return true;

  // Body checks only when the object actually carries a body (video-feed
  // entries don't), so we never false-positive a title-less snap/video.
  if (typeof post.body === 'string') {
    const bl = post.body.trim().toLowerCase();
    if (bl === 'deleted' || bl === '[deleted]' || bl === 'removed') return true;
    if (title === '' && post.body.trim() === '') return true; // empty tombstone
  }
  return false;
}

/** Drop tombstoned/deleted posts from a feed array. */
export function filterDeletedPosts<T>(posts: T[]): T[] {
  return Array.isArray(posts) ? posts.filter((p) => !isDeletedPost(p)) : posts;
}

export function extractMediaFromBody(body: string): Media[] {
  const media: Media[] = [];
  const processedUrls = new Set<string>(); // Track URLs to avoid duplicates

  // Extract images
  const imageMatches = body.match(/!\[.*?\]\((.*?)\)/g);
  if (imageMatches) {
    imageMatches.forEach(match => {
      const url = match.match(/\((.*?)\)/)?.[1];
      if (url && !processedUrls.has(url)) {
        media.push({ type: 'image', url });
        processedUrls.add(url);
      }
    });
  }

  // Extract videos from iframes (multiline — real iframes span multiple lines)
  const iframeMatches = body.match(/<iframe[\s\S]*?src="(.*?)"[\s\S]*?<\/iframe>/gi);
  if (iframeMatches) {
    iframeMatches.forEach(match => {
      const url = match.match(/src="(.*?)"/)?.[1];
      if (url && !processedUrls.has(url)) {
        // All iframes in SkateHive posts are videos (IPFS, mp4, webm, etc.)
        const isDirectVideo = url.includes('ipfs') ||
                             url.includes('.mp4') ||
                             url.includes('.webm') ||
                             url.includes('.m3u8') ||
                             url.includes('.mov');

        if (isDirectVideo) {
          // IPFS videos use faststart (moov atom upfront) so iOS can play
          // without Range request support. No query params needed.
          media.push({ type: 'video', url });
        } else {
          // It's a platform embed (YouTube, Odysee, etc.) - needs WebView
          let embedUrl = url;
          
          // Convert YouTube URLs to youtube-nocookie.com
          if (url.includes('youtube.com') || url.includes('youtu.be')) {
            const videoIdMatch = url.match(/(?:embed\/|watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
            if (videoIdMatch) {
              embedUrl = `https://www.youtube-nocookie.com/embed/${videoIdMatch[1]}`;
            }
          }
          // Ensure Odysee URLs use the embed format
          else if (url.includes('odysee.com')) {
            // Convert watch URLs to embed URLs if needed
            embedUrl = url.replace('/watch?v=', '/$/embed/');
          }
          
          media.push({ type: 'embed', url: embedUrl });
        }
        processedUrls.add(url);
      }
    });
  }

  // Only extract plain YouTube/Odysee URLs if the post doesn't already have
  // an IPFS video iframe — plain URLs alongside IPFS iframes are usually just
  // reference/source links, not additional videos to embed.
  const hasIpfsVideo = media.some(m => m.type === 'video' && m.url.includes('ipfs'));

  if (!hasIpfsVideo) {
    // Extract plain YouTube URLs (not in iframes)
    const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/g;
    let youtubeMatch;
    while ((youtubeMatch = youtubeRegex.exec(body)) !== null) {
      const videoId = youtubeMatch[1];
      const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}`;

      if (!processedUrls.has(embedUrl) && !processedUrls.has(youtubeMatch[0])) {
        media.push({ type: 'embed', url: embedUrl });
        processedUrls.add(embedUrl);
        processedUrls.add(youtubeMatch[0]);
      }
    }

    // Extract plain Odysee URLs (not in iframes)
    const odyseeRegex = /(?:https?:\/\/)?(?:www\.)?odysee\.com\/(@[^\/]+\/[^:]+:[a-zA-Z0-9]+)/g;
    let odyseeMatch;
    while ((odyseeMatch = odyseeRegex.exec(body)) !== null) {
      const videoPath = odyseeMatch[1];
      const embedUrl = `https://odysee.com/$/embed/${videoPath}`;

      if (!processedUrls.has(embedUrl) && !processedUrls.has(odyseeMatch[0])) {
        media.push({ type: 'embed', url: embedUrl });
        processedUrls.add(embedUrl);
        processedUrls.add(odyseeMatch[0]);
      }
    }
  }

  return media;
}

// Remove video links from body text (both YouTube and Odysee)
export function removeVideoLinksFromBody(body: string): string {
  let cleanedBody = body;
  
  // Remove YouTube URLs
  cleanedBody = cleanedBody.replace(
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/g,
    ''
  );
  
  // Remove Odysee URLs
  cleanedBody = cleanedBody.replace(
    /(?:https?:\/\/)?(?:www\.)?odysee\.com\/(@[^\/]+\/[^:]+:[a-zA-Z0-9]+)/g,
    ''
  );
  
  // Clean up extra whitespace that may result from URL removal
  cleanedBody = cleanedBody.replace(/\n\s*\n\s*\n/g, '\n\n').trim();
  
  return cleanedBody;
}
/**
 * First usable image URL recorded in a post's `json_metadata`.
 *
 * Both spellings are in the wild — this app and the web write `images`, other
 * Hive clients write `image` — and either may be an array or a bare string. An
 * empty `images` must not mask a usable `image`, which is why this isn't a plain
 * `??`: the web writes `images: []` on video snaps.
 */
export function metadataImageUrl(metadata: any): string | null {
  for (const raw of [metadata?.images, metadata?.image]) {
    const first = Array.isArray(raw)
      ? raw.find((url) => typeof url === 'string' && url.length > 0)
      : raw;
    if (typeof first === 'string' && first.length > 0) return first;
  }
  return null;
}

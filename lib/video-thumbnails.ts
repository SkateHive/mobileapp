import { Platform } from 'react-native';
import { createVideoPlayer, type VideoPlayer, type VideoThumbnail } from 'expo-video';
import {
  ImageManipulator,
  SaveFormat,
  type ImageManipulatorContext,
  type ImageRef,
} from 'expo-image-manipulator';

/**
 * First-frame posters for clips that were posted before the transcoder started
 * returning one (see `json_metadata.images`).
 *
 * The profile grid used to give every poster-less clip a real player, which is
 * how a screenful of them starved each other for bandwidth and decoder slots,
 * and why each tile refetched its clip every time it scrolled back into view.
 * Instead, a throwaway player extracts frame 0 once per permlink; the JPEG is
 * written to the app cache and the tile renders it as a plain image. The map
 * lives for the session, so a tile that scrolls out and back costs nothing.
 *
 * Extraction is serialized: it still downloads the clip's moov atom and first
 * GOP, and running a dozen at once is exactly the pile-up this replaces. The
 * queue is last-in-first-out, and tiles only ask once they are on screen, so
 * whatever the user is looking at now is extracted before what they scrolled
 * past.
 */

// permlink -> file uri, or null once extraction failed (no retry this session:
// a clip whose gateway is down would otherwise be re-fetched on every scroll).
const frames = new Map<string, string | null>();
const inFlight = new Map<string, Promise<string | null>>();
const listeners = new Map<string, Set<() => void>>();

const MAX_WIDTH = 480;
const CONCURRENCY = 2;
const LOAD_TIMEOUT_MS = 20_000;

let running = 0;
const queue: Array<() => void> = [];

function runNext() {
  while (running < CONCURRENCY && queue.length > 0) {
    running += 1;
    // LIFO: the most recently requested tile is the one on screen.
    queue.pop()!();
  }
}

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve) => {
    queue.push(() => {
      job()
        .then(resolve)
        .finally(() => {
          running -= 1;
          runNext();
        });
    });
    runNext();
  });
}

function notify(permlink: string) {
  listeners.get(permlink)?.forEach((l) => l());
}

async function extractFirstFrame(url: string): Promise<string | null> {
  // No `useCaching`: through expo-video's cache proxy about half of these
  // loads died with "Operation Stopped"; a plain source opens all of them.
  const player = createVideoPlayer(url);
  player.muted = true;
  let thumb: VideoThumbnail | undefined;
  let context: ImageManipulatorContext | undefined;
  let rendered: ImageRef | undefined;
  try {
    // On Android generateThumbnailsAsync goes through MediaMetadataRetriever,
    // which fetches the file itself, so there is nothing to wait for. On iOS
    // the thumbnail comes from the player's asset, which has to be loaded.
    if (Platform.OS !== 'android') await waitUntilReady(player);
    // Must be an array: the native side casts a bare number to [Double] and
    // aborts the process (SIGABRT in DynamicArrayType.cast) instead of throwing.
    [thumb] = await player.generateThumbnailsAsync([0], { maxWidth: MAX_WIDTH });
    if (!thumb) return null;
    context = ImageManipulator.manipulate(thumb);
    rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
    return saved.uri;
  } finally {
    // The frame, the manipulator context and the rendered image are native
    // shared objects; release them now rather than waiting for GC.
    for (const ref of [rendered, context, thumb]) {
      try {
        ref?.release();
      } catch {}
    }
    try {
      player.release();
    } catch {}
  }
}

function waitUntilReady(player: VideoPlayer): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (player.status === 'readyToPlay') return resolve();
    // Already failed before we got here: don't sit out the timeout for it.
    if (player.status === 'error') return reject(new Error('player error'));
    const timer = setTimeout(() => {
      sub.remove();
      reject(new Error('timeout'));
    }, LOAD_TIMEOUT_MS);
    const sub = player.addListener('statusChange', ({ status, error }) => {
      if (status === 'readyToPlay') {
        clearTimeout(timer);
        sub.remove();
        resolve();
      } else if (status === 'error') {
        clearTimeout(timer);
        sub.remove();
        reject(new Error(error?.message ?? 'player error'));
      }
    });
  });
}

/** The cached poster for this clip, if one has been extracted this session. */
export function getVideoFirstFrame(permlink: string): string | null {
  return frames.get(permlink) ?? null;
}

/** Extract (once) and cache the first frame of a clip. Safe to call repeatedly. */
export function requestVideoFirstFrame(permlink: string, url: string): Promise<string | null> {
  if (frames.has(permlink)) return Promise.resolve(frames.get(permlink) ?? null);
  const pending = inFlight.get(permlink);
  if (pending) return pending;

  const job = enqueue(() =>
    extractFirstFrame(url).catch((err) => {
      console.warn(`[video-thumbnails] no first frame for ${permlink}:`, err?.message ?? err);
      return null;
    })
  ).then((uri) => {
    frames.set(permlink, uri);
    inFlight.delete(permlink);
    notify(permlink);
    return uri;
  });
  inFlight.set(permlink, job);
  return job;
}

/** Subscribe to the frame for one permlink landing in the cache. */
export function subscribeVideoFirstFrame(permlink: string, listener: () => void): () => void {
  let set = listeners.get(permlink);
  if (!set) {
    set = new Set();
    listeners.set(permlink, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) listeners.delete(permlink);
  };
}

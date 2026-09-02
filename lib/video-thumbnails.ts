import { createVideoPlayer } from 'expo-video';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

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
 * GOP, and running a dozen at once is exactly the pile-up this replaces.
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
    queue.shift()!();
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
  try {
    await new Promise<void>((resolve, reject) => {
      if (player.status === 'readyToPlay') return resolve();
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
    // Must be an array: the native side casts a bare number to [Double] and
    // aborts the process (SIGABRT in DynamicArrayType.cast) instead of throwing.
    const [thumb] = await player.generateThumbnailsAsync([0], { maxWidth: MAX_WIDTH });
    if (!thumb) return null;
    const rendered = await ImageManipulator.manipulate(thumb).renderAsync();
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
    return saved.uri;
  } finally {
    try {
      player.release();
    } catch {}
  }
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

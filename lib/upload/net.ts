// Network guards for the video upload: no request may hang forever, and a
// long upload is judged by whether it is still moving, not by a fixed clock.

/** fetch that gives up after `ms` milliseconds (rejects with an AbortError). */
export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  ms: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/** The timer functions the watchdog uses; tests pass a controlled clock. */
export interface Timers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

const realTimers: Timers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export type WatchdogReason = "stalled" | "too_long";

export interface StallWatchdog {
  /** Pass to fetch: aborts when the watchdog fires. */
  signal: AbortSignal;
  /** Real forward progress: arms (first time) or restarts the stall timer. */
  kick(): void;
  /** Why it fired, or null while it hasn't. */
  readonly reason: WatchdogReason | null;
  dispose(): void;
}

/**
 * Aborts a long request after `maxMs` in total, and, once progress has been
 * seen at least once, when no further progress arrives for `stallMs`.
 *
 * The stall limit starts only with the first kick: until a progress event
 * proves the progress channel works, silence says nothing about the upload,
 * and cutting it then would kill healthy transcodes.
 */
export function createStallWatchdog(
  stallMs: number,
  maxMs: number,
  timers: Timers = realTimers,
): StallWatchdog {
  const controller = new AbortController();
  let reason: WatchdogReason | null = null;
  let stallTimer: unknown = null;
  const fire = (why: WatchdogReason) => {
    if (reason) return;
    reason = why;
    controller.abort();
  };
  const totalTimer = timers.setTimeout(() => fire("too_long"), maxMs);
  return {
    signal: controller.signal,
    kick: () => {
      if (reason) return;
      if (stallTimer !== null) timers.clearTimeout(stallTimer);
      stallTimer = timers.setTimeout(() => fire("stalled"), stallMs);
    },
    get reason() {
      return reason;
    },
    dispose: () => {
      if (stallTimer !== null) timers.clearTimeout(stallTimer);
      timers.clearTimeout(totalTimer);
    },
  };
}

export interface UploadProgress {
  progress: number;
  stage: string;
}

// Transcoder progress model, read from SkateHive/video-transcoder src/server.js
// (main 5a6d26f; the deployed workers' versions are unverified). One job-wide
// 0..100 scale, not per stage and not monotonic:
//   waiting 0 (sent for any id) -> receiving 5 (only once the whole body is in;
//   no byte progress) -> transcoding 10, then ffmpeg 0..80 (a legitimate drop)
//   or optimized 50 -> uploading 80, 85..100, retries as uploading_retry_N back
//   at 85 -> complete 100 (a hint only). busy / error / timeout 0 are terminal.
const NOT_PROGRESS = new Set(["waiting", "busy", "error", "timeout"]);

/**
 * Decides which progress events are real movement, the only proof of life
 * that may keep an upload alive (it never decides success or failure: only the
 * POST response with a CID does):
 *  - a stage seen for the first time is movement (each uploading_retry_N is a
 *    new, bounded stage);
 *  - within the current stage, a value above that stage's high-water mark is
 *    movement. A stage may start over once (the ffmpeg drop inside
 *    "transcoding"): the first drop resets its mark without counting;
 *  - an earlier stage again (A -> B -> A, or a reopened stream replaying old
 *    events), repeats, a second drop in the same stage, NaN, "waiting" and the
 *    terminal statuses are not movement.
 */
export function createProgressTracker() {
  const stages = new Map<string, { max: number; restarted: boolean }>();
  let current: string | null = null;
  return {
    /** True when `next` is real forward movement (and records it). */
    advance(next: UploadProgress): boolean {
      if (NOT_PROGRESS.has(next.stage) || !Number.isFinite(next.progress)) return false;
      const stage = stages.get(next.stage);
      if (!stage) {
        stages.set(next.stage, { max: next.progress, restarted: false });
        current = next.stage;
        return true;
      }
      if (next.stage !== current) return false;
      if (next.progress > stage.max) {
        stage.max = next.progress;
        return true;
      }
      if (next.progress < stage.max && !stage.restarted) {
        stage.max = next.progress;
        stage.restarted = true;
      }
      return false;
    },
  };
}

/**
 * Picks the next transcoder to send the video to, by asking each candidate's
 * health endpoint in order (GET, no body, bounded). Nothing is uploaded until
 * a server answers, so skipping an unreachable one can't duplicate a job.
 * Returns the index of the first reachable service at or after `from`, or -1.
 */
export async function nextReachable<T>(
  services: T[],
  from: number,
  isReachable: (service: T) => Promise<boolean>,
): Promise<number> {
  for (let i = from; i < services.length; i++) {
    if (await isReachable(services[i])) return i;
  }
  return -1;
}

export interface UploadFailure {
  /** HTTP status of an error response; undefined for a network error. */
  status?: number;
  /** The watchdog cut the request. */
  watchdogFired: boolean;
}

// Statuses that say the request itself was refused, before any work: bad or
// unauthorised request, no such route, method not allowed, body too large or
// of the wrong type, invalid fields. Not 408/409/429 or any 5xx.
const REFUSED = new Set([400, 401, 403, 404, 405, 413, 415, 422]);

/**
 * Whether a failed upload may be sent to the next server.
 *
 * The transcoder has no idempotency key and no answer says whether it
 * already took the video, so only an explicit refusal counts (REFUSED).
 * Every other failure (a network error at any time, a 5xx, a 2xx without a
 * result, a cut by the watchdog) may hide a video the server is still
 * transcoding, so we stop rather than risk a second transcode. Servers that
 * are down are avoided up front by the status lookup, which skips unhealthy
 * services.
 */
export function canFailOver(failure: UploadFailure): boolean {
  if (failure.watchdogFired) return false;
  return failure.status !== undefined && REFUSED.has(failure.status);
}

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

/**
 * Only real movement counts as proof of life: a higher percentage or a new
 * stage. A server that keeps repeating the same value is stuck, and must not
 * keep the upload alive. "waiting" is never proof: the transcoder sends
 * {"progress":0,"stage":"waiting"} for any id, even one it has never seen.
 */
export function isForwardProgress(prev: UploadProgress | null, next: UploadProgress): boolean {
  if (next.stage === "waiting") return false;
  if (!prev) return true;
  return next.progress > prev.progress || next.stage !== prev.stage;
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

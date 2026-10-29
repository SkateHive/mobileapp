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

export type WatchdogReason = "stalled" | "too_long";

export interface StallWatchdog {
  /** Pass to fetch: aborts when the watchdog fires. */
  signal: AbortSignal;
  /** Proof of life (e.g. a progress update): restarts the stall timer. */
  kick(): void;
  /** Why it fired, or null while it hasn't. */
  readonly reason: WatchdogReason | null;
  dispose(): void;
}

/**
 * Aborts a long request when nothing has kicked it for `stallMs`, or after
 * `maxMs` in total. Pass `stallMs: Infinity` when there is no progress
 * signal to kick it with, so only the total cap applies.
 */
export function createStallWatchdog(stallMs: number, maxMs: number): StallWatchdog {
  const controller = new AbortController();
  let reason: WatchdogReason | null = null;
  const fire = (why: WatchdogReason) => {
    if (reason) return;
    reason = why;
    controller.abort();
  };
  let stallTimer: ReturnType<typeof setTimeout> | null = null;
  const armStall = () => {
    if (!Number.isFinite(stallMs)) return;
    if (stallTimer) clearTimeout(stallTimer);
    stallTimer = setTimeout(() => fire("stalled"), stallMs);
  };
  const totalTimer = setTimeout(() => fire("too_long"), maxMs);
  armStall();
  return {
    signal: controller.signal,
    kick: () => {
      if (!reason) armStall();
    },
    get reason() {
      return reason;
    },
    dispose: () => {
      if (stallTimer) clearTimeout(stallTimer);
      clearTimeout(totalTimer);
    },
  };
}

export interface UploadProgress {
  progress: number;
  stage: string;
}

/**
 * Only real movement counts as proof of life: a higher percentage or a new
 * stage. A server that keeps answering polls with the same value is stuck,
 * and must not keep the upload alive.
 */
export function isForwardProgress(prev: UploadProgress | null, next: UploadProgress): boolean {
  if (!prev) return true;
  return next.progress > prev.progress || next.stage !== prev.stage;
}

export interface UploadFailure {
  /** HTTP status of an error response; undefined for a network error. */
  status?: number;
  /** The stall watchdog cut the request. */
  watchdogFired: boolean;
  /** How long after sending the request it failed. */
  elapsedMs: number;
}

/** A network error this early can't have carried a video to the server. */
export const PRE_UPLOAD_FAILURE_MS = 2_000;

/**
 * Whether a failed upload may be sent to the next server.
 *
 * The transcoder has no idempotency key, and none of its answers says
 * whether it already started on the video, so this is deliberately narrow.
 * The next server gets the video only when:
 *  - this one refused it with a 4xx (other than 408/429): by HTTP semantics
 *    the request was not processed; or
 *  - the request failed with a network error within PRE_UPLOAD_FAILURE_MS
 *    and no progress poll ever answered: too early for the video to have
 *    reached the server (host down, DNS, connection refused).
 * Everything else (a 500, a 2xx without a result, gateway 502/503/504, a
 * later network error, a stall) is treated as ambiguous: the server may
 * still finish, so we stop instead of risking a second transcode.
 *
 * Publishing to Hive is a separate step after the upload, with a permlink
 * fixed at enqueue and a check for an existing post, which makes a
 * duplicate post unlikely but is not an atomic guarantee.
 */
export function canFailOver(failure: UploadFailure, serverAcknowledged: boolean): boolean {
  if (failure.watchdogFired) return false;
  const s = failure.status;
  if (s !== undefined) return s >= 400 && s < 500 && s !== 408 && s !== 429;
  return !serverAcknowledged && failure.elapsedMs < PRE_UPLOAD_FAILURE_MS;
}

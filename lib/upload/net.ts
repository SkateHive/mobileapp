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

/**
 * Whether a failed upload may be sent to the next server.
 *
 * The transcoder has no idempotency key and no answer says whether it
 * already took the video, so only an explicit refusal counts: a 4xx other
 * than 408/429 means, by HTTP semantics, the request was not processed.
 * Every other failure (a network error at any time, a 500, a 2xx without a
 * result, 502/503/504, a stall) may hide a video the server is still
 * transcoding, so we stop rather than risk a second transcode. Until the
 * transcoders share an idempotency key and durable job storage, a server
 * that is down is avoided by the status lookup (unhealthy services are
 * skipped), not by failing over mid-upload.
 *
 * Publishing to Hive is a separate step after the upload, with a permlink
 * fixed at enqueue and a check for an existing post, which makes a
 * duplicate post unlikely but is not an atomic guarantee.
 */
export function canFailOver(failure: UploadFailure, _serverAcknowledged: boolean): boolean {
  if (failure.watchdogFired) return false;
  const s = failure.status;
  return s !== undefined && s >= 400 && s < 500 && s !== 408 && s !== 429;
}

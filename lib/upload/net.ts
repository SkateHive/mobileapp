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

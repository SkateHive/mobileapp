// Root provider: the only place that calls runUploadJob. Lives for the whole
// session (mounted in app/_layout.tsx), so the job keeps running while the user
// navigates anywhere.
import React, { useCallback, useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "~/lib/auth-provider";
import { canPost } from "~/lib/posting";
import { isJobActive, type UploadEvent, type UploadJob } from "./upload-job";
import { discard, dispatch, getJob, loadPersistedJob, subscribe } from "./upload-store";
import { runUploadJob } from "./upload-runner";
import { makeRunnerDeps } from "./upload-legs";

const PUBLISHED_CLEAR_MS = 4000;

function shouldAutoRetry(job: UploadJob): boolean {
  const { attemptStartedAt, backgroundedAt } = job.timestamps;
  return (
    job.status === "failed" &&
    job.error?.kind === "network" &&
    job.autoRetries === 0 &&
    attemptStartedAt !== null &&
    backgroundedAt !== null &&
    backgroundedAt > attemptStartedAt
  );
}

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useAuth();
  const queryClient = useQueryClient();

  const sessionRef = useRef(session);
  sessionRef.current = session;

  const runningJobId = useRef<string | null>(null);
  const prevJobRef = useRef<UploadJob | null>(null);
  const invalidatedForId = useRef<string | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const launched = useRef(false);

  const cancelClearTimer = () => {
    if (clearTimer.current) {
      clearTimeout(clearTimer.current);
      clearTimer.current = null;
    }
  };

  const scheduleClear = useCallback((jobId: string, delayMs: number) => {
    cancelClearTimer();
    clearTimer.current = setTimeout(() => {
      clearTimer.current = null;
      const current = getJob();
      if (current && current.id === jobId && current.status === "published") discard();
    }, delayMs);
  }, []);

  const startRunner = useCallback((job: UploadJob) => {
    if (runningJobId.current === job.id) return;

    // Session gate: the job is not discarded; Retry re-runs this gate.
    const s = sessionRef.current;
    if (!s || !canPost(s) || s.username !== job.author) {
      dispatch({
        type: "failed",
        error: { kind: "auth", message: `Log in as @${job.author} to finish this post` },
        appActive: AppState.currentState === "active",
        at: Date.now(),
      });
      return;
    }

    runningJobId.current = job.id;
    const emit = (event: UploadEvent): UploadJob | null => {
      if (getJob()?.id !== job.id) return null; // discarded while a leg was in flight
      if (event.type === "failed") {
        return dispatch({ ...event, appActive: AppState.currentState === "active" });
      }
      return dispatch(event);
    };

    runUploadJob(job, makeRunnerDeps(s), emit).finally(() => {
      if (runningJobId.current === job.id) runningJobId.current = null;
      // A run ends in published or failed. If the job is still active, the
      // reducer armed the one-shot foreground retry; run it now.
      const current = getJob();
      if (current && current.id === job.id && isJobActive(current) && current.pendingResume === "foreground") {
        startRunner(current);
      }
    });
  }, []);

  // Reacts to every store change: start the runner when a job becomes active
  // (enqueue, retry, resume), invalidate + schedule the clear on published.
  const onStoreChange = useCallback(() => {
    const job = getJob();
    const prev = prevJobRef.current;
    prevJobRef.current = job;

    if (!job) {
      cancelClearTimer();
      return;
    }

    if (isJobActive(job) && runningJobId.current !== job.id) {
      const becameActive = !prev || prev.id !== job.id || !isJobActive(prev);
      if (becameActive) startRunner(job);
    }

    if (job.status === "published" && invalidatedForId.current !== job.id) {
      invalidatedForId.current = job.id;
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["userFeed", job.author] });
      scheduleClear(job.id, PUBLISHED_CLEAR_MS);
    }
  }, [queryClient, scheduleClear, startRunner]);

  // Launch resume, once auth has hydrated. Subscribes to the store only after
  // the launch decision so the persisted job is not started before `resume`.
  useEffect(() => {
    if (isLoading || launched.current) return;
    launched.current = true;
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      const persisted = await loadPersistedJob();
      if (cancelled) return;
      if (persisted) {
        // Read status/id/publishedAt before the isJobActive() guard: TS's
        // type-predicate narrowing removes UploadJob entirely from
        // `persisted`'s type in the false branch (same gotcha noted in
        // upload-store.ts's enqueue), so `persisted.*` would be errors below
        // otherwise.
        const status = persisted.status;
        const persistedId = persisted.id;
        const publishedAt = persisted.timestamps.publishedAt;
        if (isJobActive(persisted)) {
          dispatch({ type: "resume", kind: "launch", at: Date.now() });
        } else if (status === "published") {
          const age = Date.now() - (publishedAt ?? 0);
          if (age > PUBLISHED_CLEAR_MS) discard();
          else scheduleClear(persistedId, PUBLISHED_CLEAR_MS - age);
          invalidatedForId.current = persistedId; // already invalidated in the previous session
        }
        // `failed` is simply shown in the pill with Retry / Discard.
      }
      prevJobRef.current = null;
      onStoreChange();
      unsubscribe = subscribe(onStoreChange);
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
      cancelClearTimer();
    };
  }, [isLoading, onStoreChange, scheduleClear]);

  // Foreground retry: one automatic restart per attempt cycle after the
  // request died while the app was in the background.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      const job = getJob();
      if (!job) return;
      if (state === "background" || state === "inactive") {
        dispatch({ type: "backgrounded", at: Date.now() });
        return;
      }
      if (state === "active" && shouldAutoRetry(job)) {
        // Moves failed → active with pendingResume "foreground"; onStoreChange starts the runner.
        dispatch({ type: "resume", kind: "foreground", at: Date.now() });
      }
    });
    return () => sub.remove();
  }, []);

  return <>{children}</>;
}

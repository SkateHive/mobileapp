import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canFailOver,
  createStallWatchdog,
  fetchWithTimeout,
  isAbortError,
  isForwardProgress,
} from "../net";
import { classifyError, failWith } from "../upload-runner";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A fetch that never answers until its signal aborts.
function hangingFetch() {
  const original = globalThis.fetch;
  globalThis.fetch = ((_url: string, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        const e = new Error("Aborted");
        e.name = "AbortError";
        reject(e);
      });
    })) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

test("fetchWithTimeout gives up after the timeout", async () => {
  const restore = hangingFetch();
  try {
    await assert.rejects(fetchWithTimeout("https://x", {}, 30), (e) => isAbortError(e));
  } finally {
    restore();
  }
});

test("the watchdog fires when nothing kicks it", async () => {
  const w = createStallWatchdog(40, 10_000);
  await wait(70);
  assert.equal(w.reason, "stalled");
  assert.equal(w.signal.aborted, true);
  w.dispose();
});

test("kicks keep it alive until the hard cap", async () => {
  const w = createStallWatchdog(60, 250);
  for (let i = 0; i < 6; i++) {
    await wait(25);
    w.kick();
  }
  // 150 ms in: well past one stall window, but kicked all along.
  assert.equal(w.reason, null);
  for (let i = 0; i < 6; i++) {
    await wait(25);
    w.kick();
  }
  assert.equal(w.reason, "too_long");
  w.dispose();
});

test("without a stall limit only the hard cap applies", async () => {
  const w = createStallWatchdog(Infinity, 50);
  await wait(30);
  assert.equal(w.reason, null);
  await wait(40);
  assert.equal(w.reason, "too_long");
  w.dispose();
});

test("a stalled upload is not a network error, so it is never auto-retried", () => {
  const stalled = failWith("video_unconfirmed", { service: "Mac Mini M4 (Primary)" });
  assert.notEqual(classifyError(stalled).kind, "network");
  const wrapped = failWith("video_failed", { message: stalled.message }, stalled);
  assert.notEqual(classifyError(wrapped).kind, "network");
});

test("only real movement counts as progress", () => {
  assert.equal(isForwardProgress(null, { progress: 0, stage: "receiving" }), true);
  assert.equal(isForwardProgress({ progress: 40, stage: "transcoding" }, { progress: 40, stage: "transcoding" }), false);
  assert.equal(isForwardProgress({ progress: 40, stage: "transcoding" }, { progress: 35, stage: "transcoding" }), false);
  assert.equal(isForwardProgress({ progress: 40, stage: "transcoding" }, { progress: 41, stage: "transcoding" }), true);
  assert.equal(isForwardProgress({ progress: 100, stage: "transcoding" }, { progress: 100, stage: "uploading" }), true);
});

test("fail over only on an explicit refusal", () => {
  const early = { watchdogFired: false, elapsedMs: 300 };
  // No network error proves the video wasn't taken, however early.
  assert.equal(canFailOver(early, false), false);
  assert.equal(canFailOver({ watchdogFired: false, elapsedMs: 8_000 }, true), false);
  // Refused with a 4xx: not processed, so the next server may try.
  for (const status of [400, 401, 413, 415, 422]) {
    assert.equal(canFailOver({ ...early, status }, true), true, `status ${status}`);
  }
  // A 500, gateway errors, 408 and 429 don't prove it wasn't started.
  for (const status of [408, 429, 500, 502, 503, 504]) {
    assert.equal(canFailOver({ ...early, status }, false), false, `status ${status}`);
  }
  assert.equal(canFailOver({ watchdogFired: true, elapsedMs: 300, status: 400 }, false), false);
});

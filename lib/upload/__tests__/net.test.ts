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

test("fail over only when this server can't still be working on the video", () => {
  const net = { status: undefined, watchdogFired: false };
  // Never acknowledged: a network or gateway error means it likely never got it.
  assert.equal(canFailOver(net, false), true);
  assert.equal(canFailOver({ status: 502, watchdogFired: false }, false), true);
  // Acknowledged, then lost: ambiguous, stop.
  assert.equal(canFailOver(net, true), false);
  for (const status of [502, 503, 504, 408]) {
    assert.equal(canFailOver({ status, watchdogFired: false }, true), false, `status ${status}`);
  }
  // Explicit rejection: safe to try the next server.
  for (const status of [400, 401, 413, 415, 422, 500]) {
    assert.equal(canFailOver({ status, watchdogFired: false }, true), true, `status ${status}`);
  }
  // Answered 2xx without a result: it's done, so the next server may try.
  assert.equal(canFailOver({ watchdogFired: false, finishedWithoutResult: true }, true), true);
  // The watchdog cut it: never fail over.
  assert.equal(canFailOver({ status: undefined, watchdogFired: true }, false), false);
});

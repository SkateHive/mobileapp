import { test } from "node:test";
import assert from "node:assert/strict";
import { createStallWatchdog, fetchWithTimeout, isAbortError } from "../net";
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
  const stalled = failWith("video_stalled", { service: "Mac Mini M4 (Primary)" });
  assert.notEqual(classifyError(stalled).kind, "network");
  const wrapped = failWith("video_failed", { message: stalled.message }, stalled);
  assert.notEqual(classifyError(wrapped).kind, "network");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canFailOver,
  createStallWatchdog,
  fetchWithTimeout,
  isAbortError,
  isForwardProgress,
  type Timers,
} from "../net";
import { createSseParser } from "../sse";
import { classifyError, failWith } from "../upload-runner";

// A manual clock: timers fire only when the test advances time, so results
// don't depend on how busy the machine is.
function fakeClock() {
  let now = 0;
  let nextId = 1;
  const tasks = new Map<number, { at: number; fn: () => void }>();
  const timers: Timers = {
    setTimeout: (fn, ms) => {
      const id = nextId++;
      tasks.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout: (id) => {
      tasks.delete(id as number);
    },
  };
  const advance = (ms: number) => {
    const until = now + ms;
    for (;;) {
      let due: [number, { at: number; fn: () => void }] | undefined;
      for (const entry of tasks) if (entry[1].at <= until && (!due || entry[1].at < due[1].at)) due = entry;
      if (!due) break;
      tasks.delete(due[0]);
      now = due[1].at;
      due[1].fn();
    }
    now = until;
  };
  return { timers, advance };
}

test("fetchWithTimeout gives up after the timeout", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = ((_url: string, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        const e = new Error("Aborted");
        e.name = "AbortError";
        reject(e);
      });
    })) as typeof fetch;
  try {
    await assert.rejects(fetchWithTimeout("https://x", {}, 20), (e) => isAbortError(e));
  } finally {
    globalThis.fetch = original;
  }
});

test("no stall limit until the first real progress", () => {
  const { timers, advance } = fakeClock();
  const w = createStallWatchdog(120_000, 20 * 60_000, timers);
  // Ten minutes of silence: the progress channel may simply not work.
  advance(10 * 60_000);
  assert.equal(w.reason, null);
  assert.equal(w.signal.aborted, false);
  w.dispose();
});

test("after progress has been seen, silence for the stall limit cuts it", () => {
  const { timers, advance } = fakeClock();
  const w = createStallWatchdog(120_000, 20 * 60_000, timers);
  w.kick();
  advance(119_000);
  assert.equal(w.reason, null);
  w.kick();
  advance(119_000);
  assert.equal(w.reason, null);
  advance(2_000);
  assert.equal(w.reason, "stalled");
  assert.equal(w.signal.aborted, true);
  w.dispose();
});

test("the hard cap applies even while progress keeps coming", () => {
  const { timers, advance } = fakeClock();
  const w = createStallWatchdog(120_000, 20 * 60_000, timers);
  for (let i = 0; i < 25; i++) {
    advance(60_000);
    w.kick();
  }
  assert.equal(w.reason, "too_long");
  w.dispose();
});

test("only real movement counts as progress", () => {
  assert.equal(isForwardProgress(null, { progress: 0, stage: "receiving" }), true);
  // The transcoder answers "waiting" for any id, even an unknown one.
  assert.equal(isForwardProgress(null, { progress: 0, stage: "waiting" }), false);
  assert.equal(isForwardProgress({ progress: 40, stage: "transcoding" }, { progress: 40, stage: "transcoding" }), false);
  assert.equal(isForwardProgress({ progress: 40, stage: "transcoding" }, { progress: 35, stage: "transcoding" }), false);
  assert.equal(isForwardProgress({ progress: 40, stage: "transcoding" }, { progress: 41, stage: "transcoding" }), true);
  assert.equal(isForwardProgress({ progress: 100, stage: "transcoding" }, { progress: 100, stage: "uploading" }), true);
});

test("fail over only on an explicit refusal", () => {
  // No transport failure proves the video wasn't taken, however early.
  assert.equal(canFailOver({ watchdogFired: false }), false);
  for (const status of [400, 401, 403, 404, 405, 413, 415, 422]) {
    assert.equal(canFailOver({ status, watchdogFired: false }), true, `status ${status}`);
  }
  for (const status of [408, 409, 429, 500, 502, 503, 504]) {
    assert.equal(canFailOver({ status, watchdogFired: false }), false, `status ${status}`);
  }
  assert.equal(canFailOver({ status: 400, watchdogFired: true }), false);
});

test("an unconfirmed upload is not a network error, so it is never auto-retried", () => {
  const unconfirmed = failWith("video_unconfirmed", { service: "Mac Mini M4 (Primary)" });
  assert.notEqual(classifyError(unconfirmed).kind, "network");
  const wrapped = failWith("video_failed", { message: unconfirmed.message }, unconfirmed);
  assert.notEqual(classifyError(wrapped).kind, "network");
});

test("SSE parser: events split across chunks, CRLF, multi-line data", () => {
  const got: string[] = [];
  const feed = createSseParser((d) => got.push(d));
  feed('data: {"progress":5,');
  feed('"stage":"receiving"}\n');
  assert.deepEqual(got, []);
  feed("\n: keep-alive comment\n\n");
  feed('event: progress\r\ndata: {"progress":40}\r\n\r\n');
  feed("data: line one\ndata: line two\n\n");
  assert.deepEqual(got, ['{"progress":5,"stage":"receiving"}', '{"progress":40}', "line one\nline two"]);
});

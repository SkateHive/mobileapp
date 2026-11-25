import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canFailOver,
  createStallWatchdog,
  fetchWithTimeout,
  isAbortError,
  isBusyRefusal,
  rankByAvailability,
  createProgressTracker,
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

// The worker's real sequence (video-transcoder src/server.js, main 5a6d26f).
const SOURCE_TRACE: Array<[string, number, boolean]> = [
  ["waiting", 0, false], // sent for any id
  ["receiving", 5, true], // whole body received
  ["transcoding", 10, true],
  ["transcoding", 0, false], // ffmpeg starts at 0: a legitimate drop, not movement
  ["transcoding", 12, true], // but it must count again from here
  ["transcoding", 40, true],
  ["transcoding", 80, true],
  ["uploading", 80, true],
  ["uploading", 85, true],
  ["uploading", 90, true],
  ["uploading_retry_1", 85, true], // a retry is a new bounded stage
  ["uploading_retry_1", 95, true],
  ["complete", 100, true],
];

test("follows the transcoder's real progress sequence", () => {
  const p = createProgressTracker();
  for (const [stage, progress, moves] of SOURCE_TRACE) {
    assert.equal(p.advance({ progress, stage }), moves, `${stage} ${progress}`);
  }
});

test("terminal statuses and waiting are never movement", () => {
  const p = createProgressTracker();
  for (const stage of ["waiting", "busy", "error", "timeout"]) {
    assert.equal(p.advance({ progress: 0, stage }), false, stage);
  }
});

test("replays, flip-flops and repeated drops can't keep a stall alive", () => {
  const p = createProgressTracker();
  assert.equal(p.advance({ progress: 10, stage: "transcoding" }), true);
  assert.equal(p.advance({ progress: 80, stage: "uploading" }), true);
  // Back to an earlier stage (flip-flop or a reopened stream replaying): no.
  for (let i = 0; i < 5; i++) {
    assert.equal(p.advance({ progress: 50, stage: "transcoding" }), false);
    assert.equal(p.advance({ progress: 80, stage: "uploading" }), false);
  }
  // One drop restarts a stage; oscillating after that does not count.
  assert.equal(p.advance({ progress: 0, stage: "uploading" }), false);
  assert.equal(p.advance({ progress: 81, stage: "uploading" }), true);
  for (let i = 0; i < 5; i++) {
    assert.equal(p.advance({ progress: 0, stage: "uploading" }), false);
    assert.equal(p.advance({ progress: 81, stage: "uploading" }), false);
  }
  assert.equal(p.advance({ progress: Number.NaN, stage: "uploading" }), false);
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
  // The transcoder's own busy 503 took nothing, so the next server may try.
  assert.equal(canFailOver({ status: 503, busy: true, watchdogFired: false }), true);
  assert.equal(canFailOver({ status: 503, busy: true, watchdogFired: true }), false);
});

test("only the transcoder's own busy 503 is a refusal", () => {
  const busy = JSON.stringify({ error: "Worker busy: 1/1", capacity: { active: 1, max: 1, available: 0 } });
  assert.equal(isBusyRefusal(503, busy), true);
  assert.equal(isBusyRefusal(503, "<html>Service Unavailable</html>"), false); // a proxy's 503
  assert.equal(isBusyRefusal(503, JSON.stringify({ error: "down" })), false);
  assert.equal(isBusyRefusal(500, busy), false);
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

test("servers with a free slot go first; down ones are dropped", () => {
  const services = ["mac", "oracle", "spare", "old"];
  assert.deepEqual(rankByAvailability(services, ["busy", "free", "down", "free"]), ["oracle", "old", "mac"]);
  // Every server busy: still try them, in priority order.
  assert.deepEqual(rankByAvailability(services.slice(0, 2), ["busy", "busy"]), ["mac", "oracle"]);
  assert.deepEqual(rankByAvailability(services.slice(0, 2), ["down", "down"]), []);
});

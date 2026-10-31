import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchWithRetry } from "../api";

function countingFetch(fail: () => Error) {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    throw fail();
  }) as typeof fetch;
  return {
    calls: () => calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

test("a timed-out request is not retried", async () => {
  const f = countingFetch(() => {
    const e = new Error("Aborted");
    e.name = "AbortError";
    return e;
  });
  try {
    await assert.rejects(fetchWithRetry("https://x", 2, 50));
    assert.equal(f.calls(), 1);
  } finally {
    f.restore();
  }
});

test("a network error is retried", async () => {
  const f = countingFetch(() => new TypeError("Network request failed"));
  try {
    await assert.rejects(fetchWithRetry("https://x", 2, 50));
    assert.equal(f.calls(), 3);
  } finally {
    f.restore();
  }
});

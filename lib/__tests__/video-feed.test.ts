import { test } from "node:test";
import assert from "node:assert/strict";
import { QueryClient } from "@tanstack/react-query";
import { FEED_TIMEOUT_MS } from "../api";
import { fetchVideoFeedPage, VIDEO_PAGE_DEADLINE_MS, videoFeedOptions, type VideoFeedDeps } from "../hooks/useQueries";

// Fake endpoints that take simulated time, so the deadline is tested without waiting.
function fakeDeps(videoMs: number, feed: "ok" | "fail") {
  let clock = 0;
  const calls: string[] = [];
  let feedTimeout = -1;
  const deps: VideoFeedDeps = {
    now: () => clock,
    getVideoFeed: (async () => {
      calls.push("videos");
      clock += videoMs;
      return null;
    }) as VideoFeedDeps["getVideoFeed"],
    fetchFeedPage: (async (_p: number, _l: number, timeoutMs: number) => {
      calls.push("feed");
      feedTimeout = timeoutMs;
      clock += timeoutMs;
      if (feed === "fail") throw new Error("feed failed");
      return [];
    }) as VideoFeedDeps["fetchFeedPage"],
  };
  return { deps, calls, elapsed: () => clock, feedTimeout: () => feedTimeout };
}

test("a page never takes longer than its deadline, /videos plus the fallback", async () => {
  const slow = fakeDeps(FEED_TIMEOUT_MS, "fail");
  await assert.rejects(fetchVideoFeedPage(1, slow.deps));
  assert.deepEqual(slow.calls, ["videos", "feed"]);
  assert.ok(slow.elapsed() <= VIDEO_PAGE_DEADLINE_MS, `took ${slow.elapsed()} ms`);
  assert.equal(slow.feedTimeout(), Math.min(FEED_TIMEOUT_MS, VIDEO_PAGE_DEADLINE_MS - FEED_TIMEOUT_MS));
});

test("no fallback when too little of the deadline is left", async () => {
  const late = fakeDeps(VIDEO_PAGE_DEADLINE_MS - 1_000, "ok");
  await assert.rejects(fetchVideoFeedPage(1, late.deps));
  assert.deepEqual(late.calls, ["videos"]);
});

test("a later page that fails throws (retryable), it doesn't end the feed", async () => {
  const p2 = fakeDeps(100, "ok");
  await assert.rejects(fetchVideoFeedPage(2, p2.deps));
  assert.deepEqual(p2.calls, ["videos"]);
});

test("the query adds no retries on top: 2 requests in total when both endpoints time out", async () => {
  const original = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = (async (url: string) => {
    urls.push(String(url));
    const e = new Error("Aborted");
    e.name = "AbortError";
    throw e;
  }) as typeof fetch;
  // The app's own defaults (retry: 2) must not apply to this query.
  const client = new QueryClient({ defaultOptions: { queries: { retry: 2, retryDelay: 0 } } });
  try {
    await assert.rejects(client.fetchInfiniteQuery(videoFeedOptions));
    assert.equal(urls.length, 2, urls.join(", "));
    assert.ok(urls[0].includes("/videos") && urls[1].includes("/feed"));
    assert.equal(videoFeedOptions.retry, 0);
    assert.equal(videoFeedOptions.retryOnMount, false);
  } finally {
    globalThis.fetch = original;
    client.clear();
  }
});

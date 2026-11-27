import { test } from "node:test";
import assert from "node:assert/strict";
import { QueryClient } from "@tanstack/react-query";
import { FEED_TIMEOUT_MS } from "../api";
import {
  fetchVideoFeedPage,
  lastPageAddedNothing,
  VIDEO_PAGE_DEADLINE_MS,
  VIDEO_RACE_MS,
  videoFeedOptions,
  type VideoFeedDeps,
} from "../hooks/useQueries";

const FIRST_PAGE = videoFeedOptions.initialPageParam;
const clip = (permlink: string) => ({
  author: "mark0318",
  permlink,
  body: `<iframe src="https://ipfs.skatehive.app/ipfs/Qm${permlink}"></iframe>`,
  json_metadata: "{}",
});

// Simulated time: timers fire in order of their virtual due time, so the
// race and the deadline are tested without waiting.
function virtualClock() {
  let now = 0;
  const timers: { at: number; fn: () => void }[] = [];
  const after = (ms: number, fn: () => void) => {
    const timer = { at: now + ms, fn };
    timers.push(timer);
    return () => {
      const i = timers.indexOf(timer);
      if (i >= 0) timers.splice(i, 1);
    };
  };
  const sleep = (ms: number) => new Promise<void>((r) => after(ms, r));
  async function run<T>(p: Promise<T>): Promise<T> {
    let settled = false;
    p.then(() => (settled = true), () => (settled = true));
    for (;;) {
      await new Promise((r) => setImmediate(r));
      if (settled || timers.length === 0) return p;
      timers.sort((a, b) => a.at - b.at);
      const t = timers.shift()!;
      now = t.at;
      t.fn();
    }
  }
  return { now: () => now, after, sleep, run };
}

/** /videos answers after videoMs (null = it failed); the feed after feedMs (capped by its timeout). */
function fakeDeps(videoMs: number, videos: "ok" | "fail", feedMs: number, feed: "ok" | "fail" | "empty") {
  const clock = virtualClock();
  const calls: string[] = [];
  const at: Record<string, number> = {};
  const deps: VideoFeedDeps = {
    after: clock.after,
    getVideoFeed: (async (page: number) => {
      calls.push(`videos:${page}`);
      at.videos = clock.now();
      await clock.sleep(videoMs);
      if (videos === "fail") return null;
      return {
        success: true,
        data: [{ author: "a", permlink: "from-videos", videoUrl: "https://x/v.mp4" }],
        pagination: { hasNextPage: true, nextPage: page + 1 },
      };
    }) as VideoFeedDeps["getVideoFeed"],
    fetchFeedPage: (async (_p: number, _l: number, timeoutMs: number) => {
      calls.push("feed");
      at.feed = clock.now();
      await clock.sleep(Math.min(feedMs, timeoutMs));
      if (feed === "fail" || feedMs > timeoutMs) throw new Error("feed failed");
      return feed === "empty" ? [] : [clip("from-feed")];
    }) as unknown as VideoFeedDeps["fetchFeedPage"],
  };
  return { deps, calls, at, clock };
}

test("slow /videos: the first page comes from the general feed shortly after the race budget", async () => {
  const f = fakeDeps(15_000, "ok", 3_000, "ok");
  const page = await f.clock.run(fetchVideoFeedPage(FIRST_PAGE, f.deps));
  assert.equal(page.videos[0].permlink, "from-feed");
  assert.equal(f.at.feed, VIDEO_RACE_MS);
  assert.equal(f.clock.now(), VIDEO_RACE_MS + 3_000);
  // The next page is /videos page 1; flattenVideoPages drops what was shown.
  assert.equal(page.nextPage, 1);
});

test("fast /videos: the general feed is never called", async () => {
  const f = fakeDeps(100, "ok", 100, "ok");
  const page = await f.clock.run(fetchVideoFeedPage(FIRST_PAGE, f.deps));
  assert.equal(page.videos[0].permlink, "from-videos");
  assert.equal(page.nextPage, 2);
  assert.deepEqual(f.calls, ["videos:1"]);
});

test("/videos answering first after the fallback started still wins", async () => {
  const f = fakeDeps(6_000, "ok", 10_000, "ok");
  const page = await f.clock.run(fetchVideoFeedPage(FIRST_PAGE, f.deps));
  assert.equal(page.videos[0].permlink, "from-videos");
  assert.equal(f.clock.now(), 6_000);
});

test("/videos failing early starts the fallback right away", async () => {
  const f = fakeDeps(1_000, "fail", 2_000, "ok");
  const page = await f.clock.run(fetchVideoFeedPage(FIRST_PAGE, f.deps));
  assert.equal(page.videos[0].permlink, "from-feed");
  assert.equal(f.at.feed, 1_000);
});

test("both failing: an error, within the page's deadline", async () => {
  const f = fakeDeps(FEED_TIMEOUT_MS, "fail", Infinity, "fail");
  await assert.rejects(f.clock.run(fetchVideoFeedPage(FIRST_PAGE, f.deps)));
  assert.ok(f.clock.now() <= VIDEO_PAGE_DEADLINE_MS, `took ${f.clock.now()} ms`);
  assert.deepEqual(f.calls, ["videos:1", "feed"]);
});

test("a fallback that throws while reading the posts is a failure, not a page that never settles", async () => {
  const f = fakeDeps(100, "fail", 100, "ok");
  const broken = { author: "a", permlink: "p", get body(): string { throw new Error("bad post"); } };
  f.deps.fetchFeedPage = (async () => [broken]) as unknown as VideoFeedDeps["fetchFeedPage"];
  await assert.rejects(f.clock.run(fetchVideoFeedPage(FIRST_PAGE, f.deps)));
});

test("an empty fallback doesn't beat /videos, and with /videos failing it's an error, not an empty feed", async () => {
  const slow = fakeDeps(8_000, "ok", 1_000, "empty");
  const page = await slow.clock.run(fetchVideoFeedPage(FIRST_PAGE, slow.deps));
  assert.equal(page.videos[0].permlink, "from-videos");

  const down = fakeDeps(8_000, "fail", 1_000, "empty");
  await assert.rejects(down.clock.run(fetchVideoFeedPage(FIRST_PAGE, down.deps)));
});

test("a later page, /videos page 1 included, that fails throws (retryable), it doesn't end the feed", async () => {
  for (const n of [1, 2]) {
    const f = fakeDeps(100, "fail", 100, "ok");
    await assert.rejects(f.clock.run(fetchVideoFeedPage(n, f.deps)));
    assert.deepEqual(f.calls, [`videos:${n}`]);
  }
});

test("a page that only repeats listed clips counts as stalled, so the hook loads the next one", () => {
  const v = (permlink: string) =>
    ({ author: "a", permlink, videoUrl: `https://x/${permlink}.mp4` }) as any;
  const fallback = { videos: [v("1"), v("2"), v("3")], nextPage: 1 };
  assert.equal(lastPageAddedNothing([fallback]), false);
  assert.equal(lastPageAddedNothing([fallback, { videos: [v("2"), v("3")], nextPage: 2 }]), true);
  assert.equal(lastPageAddedNothing([fallback, { videos: [v("3"), v("4")], nextPage: 2 }]), false);
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

function fallbackDeps(posts: unknown[]): VideoFeedDeps {
  return {
    after: () => () => {},
    getVideoFeed: (async () => null) as VideoFeedDeps["getVideoFeed"],
    fetchFeedPage: (async () => posts) as unknown as VideoFeedDeps["fetchFeedPage"],
  };
}

test("the feed fallback keeps the votes, which the feed API sends as `votes`", async () => {
  const { videos } = await fetchVideoFeedPage(
    FIRST_PAGE,
    fallbackDeps([{ ...clip("sh-1"), votes: [{ voter: "bielcx", weight: 100, rshares: 100 }] }])
  );
  assert.equal(videos.length, 1, "the post should be read as a video");
  assert.deepEqual(videos[0].active_votes.map((v) => v.voter), ["bielcx"]);
});

test("the feed fallback keeps the cover, which the feed API sends in `post_json_metadata.images`", async () => {
  const cover = "https://images.hive.blog/DQmCover/cover.jpg";
  const { json_metadata: _, ...post } = clip("sh-1");
  const { videos } = await fetchVideoFeedPage(
    FIRST_PAGE,
    fallbackDeps([{ ...post, post_json_metadata: { tags: ["hive-173115"], images: [cover] } }])
  );
  assert.equal(videos[0].thumbnailUrl, cover);
  assert.deepEqual(videos[0].tags, ["hive-173115"]);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSnapsPage, type SnapsCursor, type SnapsPageDeps } from "../snaps-page";

const TAG = "hive-173115";
type C = { permlink: string; created: string };
type R = { permlink: string; created: string; json_metadata?: unknown };

// 12 containers, newest first, like @peak.snaps. Some hold several tagged
// snaps, some none, and the metadata comes in every shape seen on chain.
function fixture() {
  const containers: C[] = [];
  const replies = new Map<string, R[]>();
  let minute = 0;
  for (let c = 0; c < 12; c++) {
    const permlink = `container-${c}`;
    containers.push({ permlink, created: new Date(Date.UTC(2026, 10, 27, 12 - c)).toISOString() });
    const list: R[] = [];
    for (let r = 0; r < 6; r++) {
      const created = new Date(Date.UTC(2026, 10, 27, 12 - c, 59 - r, minute++ % 60)).toISOString();
      const kind = (c + r) % 5;
      const json_metadata =
        kind === 0 ? JSON.stringify({ tags: [TAG] })
        : kind === 1 ? { tags: ["other", TAG] }
        : kind === 2 ? JSON.stringify({ tags: ["other"] })
        : kind === 3 ? "not json"
        : undefined;
      list.push({ permlink: `${permlink}-snap-${r}`, created, json_metadata });
    }
    replies.set(permlink, list);
  }
  return { containers, replies };
}

// Mimics get_discussions_by_author_before_date: starts at the cursor's
// container (inclusive) or at the newest one.
function fakeDeps(batch: number, opts: { failOn?: string } = {}) {
  const { containers, replies } = fixture();
  let inFlight = 0;
  let maxInFlight = 0;
  let calls = 0;
  const deps: SnapsPageDeps<C, R> = {
    fetchContainers: async ({ permlink }: SnapsCursor) => {
      calls++;
      const start = permlink ? containers.findIndex((c) => c.permlink === permlink) : 0;
      return containers.slice(start, start + batch);
    },
    fetchReplies: async (c: C) => {
      calls++;
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      if (c.permlink === opts.failOn) throw new Error("node down");
      return replies.get(c.permlink)!;
    },
  };
  return { deps, maxInFlight: () => maxInFlight, calls: () => calls };
}

// The loop useSnaps ran before this change, kept here as the reference.
async function oldPage(deps: SnapsPageDeps<C, R>, cursor: SnapsCursor, seen: Set<string>) {
  const hasTag = (r: R) => {
    try {
      if (!r.json_metadata) return false;
      const m: any = typeof r.json_metadata === "string" ? JSON.parse(r.json_metadata) : r.json_metadata;
      return (m.tags || []).includes(TAG);
    } catch {
      return false;
    }
  };
  const found: R[] = [];
  const all = new Set(seen);
  let { permlink, date } = cursor;
  let more = true;
  for (let i = 0; found.length < 10 && more && i < 10; i++) {
    const result = await deps.fetchContainers({ permlink, date });
    if (!result.length) break;
    for (const item of result) {
      if (all.has(item.permlink)) continue;
      const tagged = (await deps.fetchReplies(item)).filter(hasTag);
      all.add(item.permlink);
      tagged.forEach((t) => all.add(t.permlink));
      found.push(...tagged);
      permlink = item.permlink;
      date = item.created;
      if (found.length >= 10) break;
    }
  }
  found.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
  return { snaps: found, cursor: { permlink, date }, seen: all };
}

async function scrollToEnd(load: (cursor: SnapsCursor, seen: Set<string>) => Promise<{ snaps: R[]; cursor: SnapsCursor; seen: Set<string> }>) {
  let cursor: SnapsCursor = { permlink: "", date: "2026-11-27T13:00:00Z" };
  let seen = new Set<string>();
  const pages: string[][] = [];
  for (let i = 0; i < 20; i++) {
    const page = await load(cursor, seen);
    if (page.snaps.length === 0) break;
    pages.push(page.snaps.map((s) => s.permlink));
    cursor = page.cursor;
    seen = page.seen;
  }
  return pages;
}

const options = (cursor: SnapsCursor, seen: Set<string>) => ({ cursor, seen, tag: TAG, pageSize: 10, maxBatches: 10 });

test("scrolling the whole feed brings the same snaps as before, newest first in each page", async () => {
  const before = await scrollToEnd((c, s) => oldPage(fakeDeps(3).deps, c, s));
  const after = await scrollToEnd((c, s) => loadSnapsPage(fakeDeps(6).deps, options(c, s)));
  assert.deepEqual(after.flat().sort(), before.flat().sort());
  assert.equal(new Set(after.flat()).size, after.flat().length, "no snap twice");
  assert.ok(before.flat().length > 20, "the fixture should span several pages");
  const { replies } = fixture();
  const created = new Map([...replies.values()].flat().map((r) => [r.permlink, r.created]));
  for (const page of after) {
    const times = page.map((p) => created.get(p)!);
    assert.deepEqual(times, [...times].sort().reverse());
  }
});

test("the first page has at least the snaps it had before", async () => {
  const cursor = { permlink: "", date: "2026-11-27T13:00:00Z" };
  const before = await oldPage(fakeDeps(3).deps, cursor, new Set());
  const after = await loadSnapsPage(fakeDeps(6).deps, options(cursor, new Set()));
  for (const s of before.snaps) assert.ok(after.snaps.some((a) => a.permlink === s.permlink), s.permlink);
  assert.ok(after.snaps.length >= 10);
});

test("the replies of a batch are fetched at the same time, not one after another", async () => {
  const fake = fakeDeps(6);
  await loadSnapsPage(fake.deps, options({ permlink: "", date: "2026-11-27T13:00:00Z" }, new Set()));
  assert.equal(fake.maxInFlight(), 6);
});

test("a failed batch keeps what loaded and leaves the cursor before it, so the next page retries it", async () => {
  const fake = fakeDeps(3, { failOn: "container-4" });
  const page = await loadSnapsPage(fake.deps, options({ permlink: "", date: "2026-11-27T13:00:00Z" }, new Set()));
  assert.equal(page.cursor.permlink, "container-2");
  assert.ok(page.snaps.length > 0);
  assert.ok(page.snaps.every((s) => /^container-[0-2]-/.test(s.permlink)));
  assert.ok(!page.seen.has("container-3"), "the failed batch should load again");
});

test("stops when there are no more containers", async () => {
  const fake = fakeDeps(6);
  const pages = await scrollToEnd((c, s) => loadSnapsPage(fake.deps, options(c, s)));
  assert.ok(pages.length > 0);
  const calls = fake.calls();
  const empty = await loadSnapsPage(fake.deps, options({ permlink: "container-11", date: "" }, new Set(["container-11"])));
  assert.deepEqual(empty.snaps, []);
  assert.equal(fake.calls() - calls, 1, "one call to see there's nothing left, no loop");
});

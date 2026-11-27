import { test } from "node:test";
import assert from "node:assert/strict";
import { discussionToReplies, fetchRepliesRecursively, MAX_REPLY_DEPTH } from "../discussion-tree";
import { postPayout } from "../utils";
import thread from "./discussion-thread.json";

const { author, permlink, discussion, contentReplies } = thread as any;

// What the conversation UI reads from a reply.
const view = (p: any): any => ({
  key: `${p.author}/${p.permlink}`,
  body: p.body,
  created: p.created,
  children: p.children,
  depth: p.depth,
  url: p.url,
  json_metadata: JSON.parse(p.json_metadata),
  upvoters: p.active_votes.filter((v: any) => Number(v.rshares) > 0).map((v: any) => v.voter).sort(),
  payout: postPayout(p).toFixed(3),
  replies: p.replies.map(view),
});

const oldTree = () =>
  fetchRepliesRecursively(async (a, p) => contentReplies[`${a}/${p}`] ?? [], author, permlink);

test("one get_discussion builds the same tree the recursive path did", async () => {
  const fresh = discussionToReplies(discussion, author, permlink);
  assert.deepEqual(fresh.map(view), (await oldTree()).map(view));
  // The fixture is only useful if it covers nesting and paid replies.
  assert.ok(fresh.some((r) => r.replies.length > 0));
  assert.ok(fresh.some((r) => postPayout(r) > 0));
});

test("json_metadata stays a string, as the condenser sent it", () => {
  for (const r of discussionToReplies(discussion, author, permlink)) {
    assert.equal(typeof r.json_metadata, "string");
  }
});

test("replies deeper than the cap are left out, like the old fetch", () => {
  // root -> c0 -> c1 -> ... -> c7, one reply per level.
  const chain: Record<string, any> = { "a/root": { author: "a", permlink: "root", children: 8, replies: ["a/c0"] } };
  for (let i = 0; i < 8; i++) {
    chain[`a/c${i}`] = {
      author: "a", permlink: `c${i}`, category: "x", body: "", active_votes: [],
      children: 7 - i, replies: i < 7 ? [`a/c${i + 1}`] : [],
    };
  }
  let levels = 0;
  for (let n = discussionToReplies(chain, "a", "root"); n.length; n = n[0].replies) levels++;
  assert.equal(levels, MAX_REPLY_DEPTH + 1);
});

test("a result without the root throws, so the hook falls back", () => {
  assert.throws(() => discussionToReplies({}, author, permlink));
});

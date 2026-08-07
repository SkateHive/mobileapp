import { useSyncExternalStore } from "react";

/**
 * Votes cast during this session, so every screen agrees about them.
 *
 * Each surface reads `active_votes` from its own query snapshot, and those
 * snapshots disagree: api.skatehive.app caches for 60s and a Hive block takes
 * ~3s, so a vote is invisible upstream for a while after it lands on chain.
 * Without this, voting in the feed left an empty heart in the Videos tab, and a
 * feed refetch inside that window could even empty the heart on the screen you
 * voted from (#48).
 *
 * Deliberately in memory only. It records what the API has not caught up with
 * yet, and by the next launch it always has — persisting it would just risk
 * outliving the truth.
 */
type VoteWeight = number; // 0 means the vote was removed
type VoteMap = Record<string, VoteWeight>;

const key = (author: string, permlink: string) => `${author}/${permlink}`;

let votes: VoteMap = {};
const listeners = new Set<() => void>();

/** Call after a vote is confirmed on chain, never optimistically. */
export function recordVote(author: string, permlink: string, weight: VoteWeight) {
  votes = { ...votes, [key(author, permlink)]: weight };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useVoteOverrides(): VoteMap {
  return useSyncExternalStore(
    subscribe,
    () => votes,
    () => votes
  );
}

interface ActiveVote {
  voter: string;
  weight?: number;
  rshares?: number | string;
}

interface VotablePost {
  author: string;
  permlink: string;
  active_votes?: ActiveVote[];
}

/**
 * Whether a vote counts as an upvote. `rshares` is the signed value and the
 * real signal; `weight` is a curation weight that is legitimately 0 on plenty
 * of genuine votes, so it is only the fallback for payloads without rshares.
 */
function isUpvote(v: ActiveVote): boolean {
  if (v.rshares !== undefined && v.rshares !== null) return Number(v.rshares) > 0;
  return (v.weight ?? 0) > 0;
}

/**
 * What a post's vote button should show: the session's record when there is
 * one, otherwise whatever the fetched `active_votes` says.
 *
 * `fallbackCount` covers posts whose payload carries a count but no vote list.
 */
export function resolveVoteState(
  overrides: VoteMap,
  post: VotablePost,
  username: string | null | undefined,
  fallbackCount = 0
): { isLiked: boolean; voteCount: number } {
  const active = Array.isArray(post.active_votes) ? post.active_votes : [];
  const votedUpstream =
    !!username && active.some((v) => v.voter === username && isUpvote(v));
  let count = active.length > 0 ? active.filter(isUpvote).length : fallbackCount;

  const mine = overrides[key(post.author, post.permlink)];
  if (mine === undefined) return { isLiked: votedUpstream, voteCount: count };

  // Only correct the count when the snapshot and the record disagree —
  // double-counting a vote the API already knows about is the other way to be
  // wrong here.
  const isLiked = mine > 0;
  if (isLiked && !votedUpstream) count += 1;
  if (!isLiked && votedUpstream) count -= 1;

  return { isLiked, voteCount: Math.max(0, count) };
}

// Feed moderation — mirrors skatehive3.0's `filterAutoComments`
// (apps/skatehive3.0/lib/utils/postUtils.ts). Moderation itself happens on the
// web (admins downvote with their Hive account); the mobile app simply HIDES
// the same posts the web hides, by reading the on-chain `active_votes`.
//
// Moderation hierarchy (Skatehive-specific):
// - PRIMARY admins can hide a post solo — one downvote = hidden.
// - REGULAR admins need a quorum — 2+ downvotes from this group to hide.
// Also hidden: 2+ total community downvotes, negative-reputation authors,
// @hivebuzz auto-comments, Bridge `stats.hide`, and author-deleted placeholders.

// Public Hive usernames — NOT secrets. Keep in sync with skatehive3.0's
// NEXT_PUBLIC_ADMIN_USERS / NEXT_PUBLIC_PRIMARY_ADMIN_USERS.
const ADMIN_USERS = ["xvlad", "steemskate", "gnars", "web-gnar", "knowhow92"];
const PRIMARY_ADMIN_USERS: string[] = [];

const primarySet = new Set(PRIMARY_ADMIN_USERS.map((u) => u.toLowerCase()));
const allAdmins = ADMIN_USERS.map((u) => u.toLowerCase());
// Regular admins = full list minus primaries. With no primaries configured,
// the whole list is "regular" (so the 2+ quorum applies to all of them).
const regularSet = new Set(
  primarySet.size > 0 ? allAdmins.filter((u) => !primarySet.has(u)) : allAdmins
);

type Vote = { voter?: string; weight?: number; percent?: number; rshares?: number };

function isNegativeVote(v: Vote): boolean {
  return (v.weight || 0) < 0 || (v.percent || 0) < 0 || (v.rshares || 0) < 0;
}

/** Keep only the latest vote per voter (active_votes can carry duplicates). */
function deduplicateVotes(votes: Vote[]): Vote[] {
  const map = new Map<string, Vote>();
  votes.forEach((v) => {
    if (typeof v.voter === "string") map.set(v.voter, v);
  });
  return Array.from(map.values());
}

/** Standard Hive reputation conversion for raw (large-integer) values. */
function hiveReputation(raw: number): number {
  if (!raw) return 25;
  const negative = raw < 0;
  let rep = Math.log10(Math.abs(raw));
  rep = Math.max(rep - 9, 0);
  rep = (negative ? -1 : 1) * rep;
  return rep * 9 + 25;
}

/**
 * True when a post should be HIDDEN from the feed. Defensive about missing
 * fields: anything absent is treated as "acceptable" so we never over-hide.
 */
export function isHiddenByModeration(post: any): boolean {
  if (!post) return false;

  const votes = deduplicateVotes(post.active_votes || []);
  const downvoteCount = votes.filter(isNegativeVote).length;
  const negativeAdminVotes = votes.filter(
    (v) => isNegativeVote(v) && typeof v.voter === "string"
  );

  // Solo-authority primary admin downvote.
  const hasPrimaryAdminDownvote =
    primarySet.size > 0 &&
    negativeAdminVotes.some((v) => primarySet.has(String(v.voter).toLowerCase()));

  // Quorum (2+) of regular admin downvotes.
  const regularAdminDownvoteCount = regularSet.size
    ? negativeAdminVotes.filter((v) => regularSet.has(String(v.voter).toLowerCase()))
        .length
    : 0;
  const hasRegularAdminQuorum = regularAdminDownvoteCount >= 2;

  const hasAdminMod = hasPrimaryAdminDownvote || hasRegularAdminQuorum;

  // Bridge hard-mute set by the on-chain Skatehive moderators.
  const isBridgeHidden = post.stats?.hide === true;

  // Reputation: Bridge returns it pre-calculated (-100..100); condenser returns
  // raw integers. Missing/zero → 25 (acceptable).
  const rawRep = post.author_reputation;
  let reputation = 25;
  if (typeof rawRep === "number") {
    reputation = rawRep > -100 && rawRep < 100 ? rawRep : hiveReputation(rawRep);
  }

  const tooManyDownvotes = downvoteCount >= 2;
  const negativeReputation = reputation < 0;
  const isHiveBuzz = String(post.author || "").toLowerCase() === "hivebuzz";

  // Author-deleted placeholder convention (Hive forbids deletion after payout).
  const title = String(post.title || "").trim();
  const body = String(post.body || "").trim();
  const isAuthorDeleted =
    title.toLowerCase() === "removed" || body.toLowerCase() === "deleted";

  return (
    hasAdminMod ||
    isBridgeHidden ||
    tooManyDownvotes ||
    negativeReputation ||
    isHiveBuzz ||
    isAuthorDeleted
  );
}

/** Drop every moderated post from a feed array. */
export function filterModeratedPosts<T>(posts: T[]): T[] {
  if (!Array.isArray(posts)) return posts;
  return posts.filter((p) => !isHiddenByModeration(p));
}

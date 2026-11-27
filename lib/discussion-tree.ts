import type { NestedDiscussion } from './types';

/** Reply levels below the top-level replies; same cap the recursive fetch always had. */
export const MAX_REPLY_DEPTH = 5;

/** The per-reply shape both paths produce. `depth` counts from the top-level replies (0). */
function toNestedReply(reply: any, depth: number): NestedDiscussion {
  return {
    ...reply,
    url: `/${reply.category}/@${reply.author}/${reply.permlink}`,
    root_title: '',
    // ponytail: zeroed like the old path did, so reply payouts read the same;
    // pass the real value through if replies should show pending payouts.
    pending_payout_value: '0.000 HBD',
    total_pending_payout_value: '0.000 HBD',
    author_reputation: 0,
    promoted: '0.000 HBD',
    body_length: String(reply.body?.length || 0),
    reblogged_by: [],
    blacklists: [],
    replies: [],
    depth,
  } as unknown as NestedDiscussion;
}

/**
 * The reply tree from one `bridge.get_discussion` result (a map of
 * "author/permlink" -> post, each listing its replies' keys in chain order).
 * Throws when the root is missing, so the caller can fall back.
 */
export function discussionToReplies(
  discussion: Record<string, any>,
  author: string,
  permlink: string
): NestedDiscussion[] {
  const root = discussion?.[`${author}/${permlink}`];
  if (!root || !Array.isArray(root.replies)) {
    throw new Error(`get_discussion has no ${author}/${permlink}`);
  }

  const build = (keys: string[], depth: number): NestedDiscussion[] =>
    keys
      .map((key) => discussion[key])
      .filter(Boolean)
      .map((post) => {
        const node = toNestedReply(
          {
            ...post,
            // Condenser shapes the UI and the type expect.
            json_metadata:
              typeof post.json_metadata === 'string'
                ? post.json_metadata
                : JSON.stringify(post.json_metadata ?? {}),
            total_payout_value: post.author_payout_value ?? '0.000 HBD',
          },
          depth
        );
        if (post.children > 0 && depth < MAX_REPLY_DEPTH) {
          node.replies = build(post.replies ?? [], depth + 1);
        }
        return node;
      });

  return build(root.replies, 0);
}

/**
 * The old path, kept as the fallback: one `get_content_replies` per comment
 * with children, five at a time.
 */
export async function fetchRepliesRecursively(
  fetchReplies: (author: string, permlink: string) => Promise<any[]>,
  author: string,
  permlink: string
): Promise<NestedDiscussion[]> {
  const inBatches = async <T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> => {
    const results: R[] = [];
    for (let i = 0; i < items.length; i += 5) {
      results.push(...(await Promise.all(items.slice(i, i + 5).map(fn))));
    }
    return results;
  };

  const build = async (reply: any, depth: number): Promise<NestedDiscussion> => {
    const node = toNestedReply(reply, depth);
    if (reply.children > 0 && depth < MAX_REPLY_DEPTH) {
      try {
        const children = await fetchReplies(reply.author, reply.permlink);
        node.replies = await inBatches(children, (child) => build(child, depth + 1));
      } catch (error) {
        console.warn(`Failed to fetch nested replies for ${reply.author}/${reply.permlink}:`, error);
      }
    }
    return node;
  };

  return inBatches(await fetchReplies(author, permlink), (reply) => build(reply, 0));
}

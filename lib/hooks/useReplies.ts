import { useState, useEffect } from 'react';
import { getContentReplies, type ExtendedComment } from '../hive-utils';
import type { NestedDiscussion } from '../types';

interface UseRepliesResult {
  comments: NestedDiscussion[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch replies for a given post
 * @param author - The author of the post
 * @param permlink - The permlink of the post
 * @param enabled - Whether to fetch replies immediately
 * @returns Object with comments, loading state, error, and refetch function
 */
export function useReplies(
  author: string,
  permlink: string,
  enabled: boolean = true
): UseRepliesResult {
  const [comments, setComments] = useState<NestedDiscussion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComments = async () => {
    if (!author || !permlink) return;

    setIsLoading(true);
    setError(null);

    try {
      const replies = await getContentReplies({ author, permlink });
      
      // Process an array in batches to avoid request storms
      const processBatch = async <T, R>(items: T[], fn: (item: T) => Promise<R>, batchSize: number = 5): Promise<R[]> => {
        const results: R[] = [];
        for (let i = 0; i < items.length; i += batchSize) {
          const batch = items.slice(i, i + batchSize);
          const batchResults = await Promise.all(batch.map(fn));
          results.push(...batchResults);
        }
        return results;
      };

      // Helper function to recursively fetch and build nested reply structure
      const buildNestedReplies = async (reply: ExtendedComment, currentDepth: number = 0): Promise<NestedDiscussion> => {
        // Convert ExtendedComment to NestedDiscussion format
        const discussionReply: NestedDiscussion = {
          ...reply,
          url: `/${reply.category}/@${reply.author}/${reply.permlink}`,
          root_title: '',
          pending_payout_value: '0.000 HBD',
          total_pending_payout_value: '0.000 HBD',
          author_reputation: 0,
          promoted: '0.000 HBD',
          body_length: String(reply.body?.length || 0),
          reblogged_by: [],
          blacklists: [],
          replies: [],
          depth: currentDepth,
        } as unknown as NestedDiscussion;

        // Recursively fetch nested replies if this comment has children and we haven't hit max depth
        if (reply.children > 0 && currentDepth < 5) {
          try {
            const childReplies = await getContentReplies({
              author: reply.author,
              permlink: reply.permlink
            });

            // Build nested structure in batches of 5 to avoid request storms
            discussionReply.replies = await processBatch(
              childReplies,
              childReply => buildNestedReplies(childReply, currentDepth + 1),
              5
            );
          } catch (error) {
            console.warn(`Failed to fetch nested replies for ${reply.author}/${reply.permlink}:`, error);
          }
        }

        return discussionReply;
      };

      // Build nested structure for top-level replies in batches of 5
      const discussionReplies: NestedDiscussion[] = await processBatch(
        replies,
        reply => buildNestedReplies(reply, 0),
        5
      );

      setComments(discussionReplies);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch comments';
      setError(errorMessage);
      console.error('Error fetching comments:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (enabled) {
      fetchComments();
    }
  }, [author, permlink, enabled]);

  return {
    comments,
    isLoading,
    error,
    refetch: fetchComments,
  };
}

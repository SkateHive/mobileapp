import { useState, useEffect } from 'react';
import { getContentReplies, type ExtendedComment } from '../hive-utils';
import type { Discussion } from '@hiveio/dhive';

interface UseRepliesResult {
  comments: Discussion[];
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
  const [comments, setComments] = useState<Discussion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComments = async () => {
    if (!author || !permlink) return;

    setIsLoading(true);
    setError(null);

    try {
      const replies = await getContentReplies({ author, permlink });
      
      // Convert ExtendedComment to Discussion format using type assertion
      const discussionReplies: Discussion[] = replies.map((reply) => ({
        ...reply,
        replies: [], // Flatten nested replies for now
        url: `/${reply.category}/@${reply.author}/${reply.permlink}`,
        root_title: '',
        pending_payout_value: '0.000 HBD',
        total_pending_payout_value: '0.000 HBD',
        author_reputation: 0,
        promoted: '0.000 HBD',
        body_length: String(reply.body?.length || 0),
        reblogged_by: [],
        blacklists: [],
      } as unknown as Discussion));

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

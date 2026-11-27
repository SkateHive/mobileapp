import { useState, useEffect } from 'react';
import { getContentReplies, getDiscussion } from '../hive-utils';
import { discussionToReplies, fetchRepliesRecursively } from '../discussion-tree';
import type { NestedDiscussion } from '../types';
import { t } from '~/lib/i18n';

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
      let discussionReplies: NestedDiscussion[];
      try {
        // The whole thread in one call.
        discussionReplies = discussionToReplies(
          await getDiscussion(author, permlink),
          author,
          permlink
        );
      } catch (bridgeError) {
        console.warn('get_discussion failed, fetching replies level by level:', bridgeError);
        discussionReplies = await fetchRepliesRecursively(
          (a, p) => getContentReplies({ author: a, permlink: p }),
          author,
          permlink
        );
      }

      setComments(discussionReplies);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('feed.hook.replies_fetch_failed');
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

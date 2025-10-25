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
        if (reply.children > 0 && currentDepth < 5) { // Limit to 5 levels deep to prevent infinite recursion
          try {
            const childReplies = await getContentReplies({ 
              author: reply.author, 
              permlink: reply.permlink 
            });
            
            // Build nested structure for each child reply
            const nestedReplies = await Promise.all(
              childReplies.map(childReply => 
                buildNestedReplies(childReply, currentDepth + 1)
              )
            );
            
            discussionReply.replies = nestedReplies;
          } catch (error) {
            console.warn(`Failed to fetch nested replies for ${reply.author}/${reply.permlink}:`, error);
            // Continue without nested replies if fetch fails
          }
        }

        return discussionReply;
      };

      // Build nested structure for all top-level replies
      const discussionReplies: NestedDiscussion[] = await Promise.all(
        replies.map(reply => buildNestedReplies(reply, 0))
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

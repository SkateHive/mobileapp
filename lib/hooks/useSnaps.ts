import { useState, useEffect, useRef, useCallback } from 'react';
import { getSnapsContainers, getContentReplies, ExtendedComment, SNAPS_CONTAINER_AUTHOR, SNAPS_PAGE_MIN_SIZE, COMMUNITY_TAG, getDiscussions } from '../hive-utils';
import { Discussion } from '@hiveio/dhive';
import { FeedFilterType } from '../FeedFilterContext';
import { useAuth } from '../auth-provider';

interface LastContainerInfo {
  permlink: string;
  date: string;
}

export function useSnaps(filter: FeedFilterType = 'Recent', username: string | null = null) {
  const { blockedList } = useAuth();
  const lastContainerRef = useRef<LastContainerInfo | null>(null);
  const fetchedPermlinksRef = useRef<Set<string>>(new Set());

  const [comments, setComments] = useState<ExtendedComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  // Clear comments when filter changes
  useEffect(() => {
    setComments([]);
    setHasMore(true);
    lastContainerRef.current = null;
    fetchedPermlinksRef.current = new Set();
  }, [filter]);

  // Filter comments by tag
  function filterCommentsByTag(comments: ExtendedComment[], targetTag: string): ExtendedComment[] {
    return comments.filter((commentItem) => {
      try {
        if (!commentItem.json_metadata) return false;
        const metadata = typeof commentItem.json_metadata === 'string'
          ? JSON.parse(commentItem.json_metadata)
          : commentItem.json_metadata;
        const tags = metadata.tags || [];
        return tags.includes(targetTag);
      } catch {
        return false;
      }
    });
  }

  // Fetch comments with progressive loading
  async function getMoreSnaps(): Promise<ExtendedComment[]> {
    // MOCKED: For now, we only show the Curated feed regardless of filter
    const effectiveFilter = 'Curated';
    
    if (effectiveFilter === 'Curated') {
      const tag = COMMUNITY_TAG;
      const pageSize = 10; // Target page size
      const allFilteredComments: ExtendedComment[] = [];
      let hasMoreData = true;
      let permlink = lastContainerRef.current?.permlink || '';
      let date = lastContainerRef.current?.date || new Date().toISOString();
      let iterationCount = 0;
      const maxIterations = 10; // Prevent infinite loops
      
      const allPermlinks = new Set(fetchedPermlinksRef.current);

      while (allFilteredComments.length < pageSize && hasMoreData && iterationCount < maxIterations) {
        iterationCount++;
        
        try {
          const result = await getSnapsContainers({
            lastPermlink: permlink,
            lastDate: date,
          });
          
          if (!result.length) {
            hasMoreData = false;
            break;
          }
          
          for (const resultItem of result) {
            if (allPermlinks.has(resultItem.permlink)) continue;
            
            const replies = await getContentReplies({
              author: SNAPS_CONTAINER_AUTHOR,
              permlink: resultItem.permlink,
            });
            
            const filteredComments = filterCommentsByTag(replies, tag);
            
            // Filter by blocked users
            const blockedSet = new Set(blockedList.map(u => u.toLowerCase()));
            const safelyFilteredComments = filteredComments.filter(c => !blockedSet.has(c.author.toLowerCase()));
            
            allPermlinks.add(resultItem.permlink);
            safelyFilteredComments.forEach(c => allPermlinks.add(c.permlink));
            allFilteredComments.push(...safelyFilteredComments);
            permlink = resultItem.permlink;
            date = resultItem.created;
            
            if (allFilteredComments.length >= pageSize) break;
          }
        } catch (error) {
          console.error('Error fetching snaps:', error);
          hasMoreData = false;
        }
      }
      
      fetchedPermlinksRef.current = allPermlinks;
      lastContainerRef.current = { permlink, date };
      allFilteredComments.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
      return allFilteredComments;
    } else {
      // Use getDiscussions for other filters
      let type: 'created' | 'trending' | 'hot' | 'feed' = 'created';
      let tag = COMMUNITY_TAG;

      if (filter === 'Trending') type = 'trending';
      if (filter === 'Following') {
        if (!username || username === 'SPECTATOR') return [];
        type = 'feed';
        tag = username;
      }

      const lastPost = comments.length > 0 ? comments[comments.length - 1] : null;
      
      const results = await getDiscussions(type, {
        tag,
        limit: 10,
        start_author: lastPost?.author,
        start_permlink: lastPost?.permlink
      });

      // Filter out blocked users and duplicates
      const blockedSet = new Set(blockedList.map(u => u.toLowerCase()));
      const filteredResults = results.filter(r => 
        !blockedSet.has(r.author.toLowerCase()) && 
        !fetchedPermlinksRef.current.has(r.permlink)
      );
      
      filteredResults.forEach(r => fetchedPermlinksRef.current.add(r.permlink));
      
      return filteredResults as unknown as ExtendedComment[];
    }
  }

  // Single effect for all fetching
  useEffect(() => {
    let cancelled = false;

    const fetchPosts = async () => {
      setIsLoading(true);
      try {
        const newSnaps = await getMoreSnaps();
        if (cancelled) return;

        setComments((prevPosts) => {
          const existingPermlinks = new Set(prevPosts.map((post) => post.permlink));
          const uniqueSnaps = newSnaps.filter((snap) => !existingPermlinks.has(snap.permlink));
          if (uniqueSnaps.length === 0) setHasMore(false);
          return [...prevPosts, ...uniqueSnaps];
        });
      } catch {
        if (!cancelled) setHasMore(false);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchPosts();
    return () => { cancelled = true; };
  }, [fetchTrigger]);

  const loadNextPage = useCallback(() => {
    if (!isLoading && hasMore) {
      setFetchTrigger((t) => t + 1);
    }
  }, [isLoading, hasMore]);

  const refresh = useCallback(() => {
    lastContainerRef.current = null;
    fetchedPermlinksRef.current = new Set();
    setComments([]);
    setHasMore(true);
    setFetchTrigger((t) => t + 1);
  }, []);

  return { comments, isLoading, loadNextPage, hasMore, refresh };
}

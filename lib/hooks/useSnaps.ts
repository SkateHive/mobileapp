import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getSnapsContainers, getContentReplies,
  ExtendedComment, SNAPS_CONTAINER_AUTHOR,
  SNAPS_PAGE_MIN_SIZE, COMMUNITY_TAG,
  getDiscussions
} from '../hive-utils';
import { Discussion } from '@hiveio/dhive';
import { SnapConfig } from '../config/SnapConfig';
import { FeedFilterType } from '../FeedFilterContext';
import { useAuth } from '../auth-provider';
import { getSnapsFeed, getFollowingFeedAPI, getTrendingFeedAPI } from '../api';
interface LastContainerInfo {
  permlink: string;
  date: string;
}

export function useSnaps(filter: FeedFilterType = 'Recent', username: string | null = null) {
  const { blockedList } = useAuth();
  const lastContainerRef = useRef<LastContainerInfo | null>(null);
  const fetchedPermlinksRef = useRef<Set<string>>(new Set());
  const apiPageRef = useRef<number>(1);

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
    apiPageRef.current = 1;
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
    const effectiveFilter = filter;

    if (effectiveFilter === 'Curated' || effectiveFilter === 'Recent' || effectiveFilter === 'Skatehive') {
      try {
        const currentPage = apiPageRef.current;
        const apiSnaps = await getSnapsFeed(currentPage, SnapConfig.pageSize);

        if (apiSnaps && apiSnaps.length > 0) {
          apiPageRef.current += 1;
          const blockedSet = new Set(blockedList.map(u => u.toLowerCase()));
          const safelyFilteredComments = apiSnaps.filter(c => !blockedSet.has(c.author.toLowerCase())) as unknown as ExtendedComment[];

          safelyFilteredComments.forEach(c => fetchedPermlinksRef.current.add(c.permlink));
          return safelyFilteredComments;
        } else if (apiSnaps && apiSnaps.length === 0 && currentPage > 1) {
          // We reached the end of the API feed
          return [];
        }
      } catch (error) {
        console.warn('Failed to fetch from skatehive-api, falling back to dhive natively:', error);
      }

      // --- NATIVE DHIVE FALLBACK ---
      const tag = COMMUNITY_TAG;
      const pageSize = SnapConfig.pageSize; // Target page size
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
      // Try Skatehive API if enabled
      if (SnapConfig.useApi) {
        try {
          const currentPage = apiPageRef.current;
          let apiSnaps: any[] = [];
          
          if (filter === 'Following') {
            if (!username || username === 'SPECTATOR') return [];
            apiSnaps = await getFollowingFeedAPI(username, currentPage, SnapConfig.pageSize);
          } else if (filter === 'Trending') {
            apiSnaps = await getTrendingFeedAPI(currentPage, SnapConfig.pageSize);
          }
          
          if (apiSnaps && apiSnaps.length > 0) {
            apiPageRef.current += 1;
            const blockedSet = new Set(blockedList.map(u => u.toLowerCase()));
            const safelyFilteredComments = apiSnaps.filter(c => !blockedSet.has(c.author.toLowerCase())) as unknown as ExtendedComment[];
            
            safelyFilteredComments.forEach(c => fetchedPermlinksRef.current.add(c.permlink));
            return safelyFilteredComments;
          } else if (apiSnaps && apiSnaps.length === 0 && currentPage > 1) {
            // Reached the end of the API feed
            return [];
          }
        } catch (error) {
          console.warn(`Failed to fetch ${filter} feed from skatehive-api, falling back to dhive natively:`, error);
        }
      }

      // --- NATIVE DHIVE FALLBACK ---
      // Use getDiscussions for other filters ('Following', 'Trending')
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
        limit: SnapConfig.pageSize * 2, // Fetch extra in case many aren't from Skatehive
        start_author: lastPost?.author,
        start_permlink: lastPost?.permlink
      });

      // Filter out blocked users and duplicates
      const blockedSet = new Set(blockedList.map(u => u.toLowerCase()));
      const filteredResults = results.filter(r => {
        // Must match community tag (category or tags metadata)
        const inCommunity = r.category === COMMUNITY_TAG || 
                           (r.json_metadata && typeof r.json_metadata === 'object' && 
                            (r.json_metadata as any).tags && (r.json_metadata as any).tags.includes(COMMUNITY_TAG)) ||
                           (r.json_metadata && typeof r.json_metadata === 'string' &&
                            r.json_metadata.includes(COMMUNITY_TAG));

        return inCommunity &&
               !blockedSet.has(r.author.toLowerCase()) && 
               !fetchedPermlinksRef.current.has(r.permlink);
      });

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
    apiPageRef.current = 1;
    setComments([]);
    setHasMore(true);
    setFetchTrigger((t) => t + 1);
  }, []);

  return { comments, isLoading, loadNextPage, hasMore, refresh };
}

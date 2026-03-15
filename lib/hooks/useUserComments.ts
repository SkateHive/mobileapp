import { useState, useEffect, useRef, useCallback } from 'react';
import { getUserComments, SNAPS_CONTAINER_AUTHOR, COMMUNITY_TAG } from '../hive-utils';

interface LastPostInfo {
  author: string;
  permlink: string;
}

export function useUserComments(username: string | null, blockedList: string[] = []) {
  const lastPostRef = useRef<LastPostInfo | null>(null);
  const fetchedPermlinksRef = useRef<Set<string>>(new Set());
  const prevUsernameRef = useRef<string | null>(null);
  const prevBlockedListRef = useRef<string[]>(blockedList);

  const [posts, setPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  // fetchTrigger increments to force a new fetch (avoids the currentPage=1 stale problem)
  const [fetchTrigger, setFetchTrigger] = useState(0);

  // Filter comments by parent_author (peak.snaps)
  function filterByParentAuthor(posts: any[], targetAuthor: string): any[] {
    return posts.filter((post) => post.parent_author === targetAuthor);
  }

  // Filter comments by community tag
  function filterCommentsByTag(posts: any[], targetTag: string): any[] {
    return posts.filter((post) => {
      try {
        if (!post.json_metadata) return false;
        const metadata = typeof post.json_metadata === 'string'
          ? JSON.parse(post.json_metadata)
          : post.json_metadata;
        const tags = metadata.tags || [];
        return tags.includes(targetTag);
      } catch {
        return false;
      }
    });
  }

  // Fetch a batch of user posts
  async function getMoreUserComments(): Promise<any[]> {
    if (!username || username === 'SPECTATOR') return [];

    const pageSize = 10;
    const allFilteredPosts: any[] = [];
    let hasMoreData = true;
    let iterationCount = 0;
    const maxIterations = 10;
    const allPermlinks = new Set(fetchedPermlinksRef.current);

    while (allFilteredPosts.length < pageSize && hasMoreData && iterationCount < maxIterations) {
      iterationCount++;

      try {
        const result = await getUserComments(
          username,
          'comments',
          20,
          lastPostRef.current?.author,
          lastPostRef.current?.permlink
        );

        if (!result.length) {
          hasMoreData = false;
          break;
        }

        const parentFilteredPosts = filterByParentAuthor(result, SNAPS_CONTAINER_AUTHOR);
        const tagFilteredPosts = filterCommentsByTag(parentFilteredPosts, COMMUNITY_TAG);
        const uniquePosts = tagFilteredPosts.filter(post => !allPermlinks.has(post.permlink));

        uniquePosts.forEach(post => {
          allPermlinks.add(post.permlink);
          allFilteredPosts.push(post);
        });

        if (result.length > 0) {
          const lastItem = result[result.length - 1];
          lastPostRef.current = { author: lastItem.author, permlink: lastItem.permlink };
        }

        if (result.length < 20) hasMoreData = false;
      } catch (error) {
        console.error('Error fetching user posts:', error);
        hasMoreData = false;
      }
    }

    fetchedPermlinksRef.current = allPermlinks;
    allFilteredPosts.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
    return allFilteredPosts;
  }

  // Reset all state when username changes
  useEffect(() => {
    if (prevUsernameRef.current !== username) {
      prevUsernameRef.current = username;
      lastPostRef.current = null;
      fetchedPermlinksRef.current = new Set();
      setPosts([]);
      setHasMore(true);
      setFetchTrigger(0);
    }
  }, [username]);

  // Single effect that handles all fetching
  useEffect(() => {
    if (!username || username === 'SPECTATOR') {
      setPosts([]);
      setIsLoading(false);
      setHasMore(false);
      return;
    }

    let cancelled = false;

    const fetchPosts = async () => {
      setIsLoading(true);
      try {
        const newPosts = await getMoreUserComments();
        if (cancelled) return;

        setPosts((prevPosts) => {
          const existingPermlinks = new Set(prevPosts.map((p) => p.permlink));
          const blockedLower = blockedList.map(m => m.toLowerCase());
          const uniquePosts = newPosts.filter((p: any) => 
            !existingPermlinks.has(p.permlink) && 
            !blockedLower.includes(p.author.toLowerCase())
          );

          if (uniquePosts.length === 0 && newPosts.length > 0) {
            // All new posts were filtered out by mutes, try to get more
            setFetchTrigger(t => t + 1);
          }

          if (uniquePosts.length === 0 && newPosts.length === 0) {
            setHasMore(false);
          }

          return [...prevPosts, ...uniquePosts];
        });
      } catch (err) {
        console.error('Error in fetchPosts:', err);
        if (!cancelled) setHasMore(false);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchPosts();

    return () => { cancelled = true; };
  }, [fetchTrigger, username, blockedList]);

  // Reset when blockedList changes significantly (e.g. login/logout or new block)
  useEffect(() => {
    if (JSON.stringify(prevBlockedListRef.current) !== JSON.stringify(blockedList)) {
      prevBlockedListRef.current = blockedList;
      // Re-fetch and clear current posts
      lastPostRef.current = null;
      fetchedPermlinksRef.current = new Set();
      setPosts([]);
      setHasMore(true);
      setFetchTrigger((t) => t + 1);
    }
  }, [blockedList]);

  // Load next page — just bump the trigger
  const loadNextPage = useCallback(() => {
    if (!isLoading && hasMore && username && username !== 'SPECTATOR') {
      setFetchTrigger((t) => t + 1);
    }
  }, [isLoading, hasMore, username]);

  // Refresh — reset everything and re-fetch
  const refresh = useCallback(() => {
    if (username && username !== 'SPECTATOR') {
      lastPostRef.current = null;
      fetchedPermlinksRef.current = new Set();
      setPosts([]);
      setHasMore(true);
      // Force a new fetch by bumping the trigger
      setFetchTrigger((t) => t + 1);
    }
  }, [username]);

  return {
    posts,
    isLoading,
    loadNextPage,
    hasMore,
    refresh
  };
}

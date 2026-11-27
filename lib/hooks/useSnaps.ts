import { useState, useEffect, useRef, useCallback } from 'react';
import type { Comment } from '@hiveio/dhive';
import { getSnapsContainers, getContentReplies, ExtendedComment, SNAPS_CONTAINER_AUTHOR, COMMUNITY_TAG } from '../hive-utils';
import { loadSnapsPage, type SnapsCursor } from '../snaps-page';

export function useSnaps() {
  const lastContainerRef = useRef<SnapsCursor | null>(null);
  const fetchedPermlinksRef = useRef<Set<string>>(new Set());

  const [comments, setComments] = useState<ExtendedComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  // Fetch comments with progressive loading
  async function getMoreSnaps(): Promise<ExtendedComment[]> {
    const page = await loadSnapsPage<Comment, ExtendedComment>(
      {
        fetchContainers: ({ permlink, date }) =>
          getSnapsContainers({ lastPermlink: permlink, lastDate: date }),
        fetchReplies: (container) =>
          getContentReplies({ author: SNAPS_CONTAINER_AUTHOR, permlink: container.permlink }),
      },
      {
        cursor: lastContainerRef.current ?? { permlink: '', date: new Date().toISOString() },
        seen: fetchedPermlinksRef.current,
        tag: COMMUNITY_TAG,
        pageSize: 10,
        maxBatches: 10,
      }
    );

    // Cap permlinks Set to prevent unbounded memory growth
    fetchedPermlinksRef.current =
      page.seen.size > 200 ? new Set(Array.from(page.seen).slice(-200)) : page.seen;
    lastContainerRef.current = page.cursor;
    return page.snaps;
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
          const updated = [...prevPosts, ...uniqueSnaps];
          // Cap to 200 items to prevent unbounded memory growth on mobile
          return updated.length > 200 ? updated.slice(-200) : updated;
        });
      } catch (error) {
        console.error('Error fetching posts:', error);
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

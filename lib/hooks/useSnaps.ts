import { useState, useEffect, useRef, useCallback } from 'react';
import { getSnapsContainers, getContentReplies, ExtendedComment, SNAPS_CONTAINER_AUTHOR, COMMUNITY_TAG } from '../hive-utils';

interface LastContainerInfo {
  permlink: string;
  date: string;
}

export function useSnaps() {
  const lastContainerRef = useRef<LastContainerInfo | null>(null);
  const fetchedPermlinksRef = useRef<Set<string>>(new Set());

  const [comments, setComments] = useState<ExtendedComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [fetchTrigger, setFetchTrigger] = useState(0);

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
    const tag = COMMUNITY_TAG;
    const pageSize = 10;
    const allFilteredComments: ExtendedComment[] = [];
    let hasMoreData = true;
    let permlink = lastContainerRef.current?.permlink || '';
    let date = lastContainerRef.current?.date || new Date().toISOString();
    let iterationCount = 0;
    const maxIterations = 10;
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

          allPermlinks.add(resultItem.permlink);
          filteredComments.forEach(c => allPermlinks.add(c.permlink));
          allFilteredComments.push(...filteredComments);

          permlink = resultItem.permlink;
          date = resultItem.created;

          if (allFilteredComments.length >= pageSize) break;
        }
      } catch (error) {
        console.error('Error fetching snaps:', error);
        hasMoreData = false;
      }
    }

    // Cap permlinks Set to prevent unbounded memory growth
    if (allPermlinks.size > 200) {
      const arr = Array.from(allPermlinks);
      fetchedPermlinksRef.current = new Set(arr.slice(-200));
    } else {
      fetchedPermlinksRef.current = allPermlinks;
    }
    lastContainerRef.current = { permlink, date };
    allFilteredComments.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
    return allFilteredComments;
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

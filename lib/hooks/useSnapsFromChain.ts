import { useState, useEffect, useRef } from 'react';
import { getSnapsContainers, getContentReplies, ExtendedComment, SNAPS_CONTAINER_AUTHOR, PAGE_MIN_SIZE, FETCH_LIMIT, COMMUNITY_TAG } from '../hive-utils';



interface LastContainerInfo {
  permlink: string;
  date: string;
}



export function useSnapsFromChain() {
  const lastContainerRef = useRef<LastContainerInfo | null>(null);
  const fetchedPermlinksRef = useRef<Set<string>>(new Set());

  const [currentPage, setCurrentPage] = useState(1);
  const [comments, setComments] = useState<ExtendedComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

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
      } catch (error) {
        return false;
      }
    });
  }

  // Fetch comments with a minimum size
  async function getMoreSnaps(): Promise<ExtendedComment[]> {
    const tag = COMMUNITY_TAG;
    const allFilteredComments: ExtendedComment[] = [];
    let hasMoreData = true;
    let permlink = lastContainerRef.current?.permlink || '';
    let date = lastContainerRef.current?.date || new Date().toISOString();
    // Track all permlinks (parents and replies) to avoid duplicates
    const allPermlinks = new Set(fetchedPermlinksRef.current);

    while (allFilteredComments.length < PAGE_MIN_SIZE && hasMoreData) {
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
        const comments = await getContentReplies({
          author: SNAPS_CONTAINER_AUTHOR,
          permlink: resultItem.permlink,
        });
        const filteredComments = filterCommentsByTag(comments, tag);
        // Add all permlinks (parent and replies) to the set
        allPermlinks.add(resultItem.permlink);
        filteredComments.forEach(c => allPermlinks.add(c.permlink));
        allFilteredComments.push(...filteredComments);
        permlink = resultItem.permlink;
        date = resultItem.created;
      }
    }
    // Update the ref with all permlinks seen so far
    fetchedPermlinksRef.current = allPermlinks;
    lastContainerRef.current = { permlink, date };
    // Sort by created date descending
    allFilteredComments.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
    return allFilteredComments;
  }

  // Fetch posts when currentPage changes
  useEffect(() => {
    const fetchPosts = async () => {
      setIsLoading(true);
      try {
        const newSnaps = await getMoreSnaps();
        setComments((prevPosts) => {
          const existingPermlinks = new Set(prevPosts.map((post) => post.permlink));
          const uniqueSnaps = newSnaps.filter((snap) => !existingPermlinks.has(snap.permlink));
          // If no new unique snaps, set hasMore to false
          if (uniqueSnaps.length === 0) setHasMore(false);
          return [...prevPosts, ...uniqueSnaps];
        });
      } catch (err) {
        // Swallow error silently
      } finally {
        setIsLoading(false);
      }
    };
    fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  // Load the next page
  const loadNextPage = () => {
    if (!isLoading && hasMore) {
      setCurrentPage((prevPage) => prevPage + 1);
    }
  };

  return { comments, isLoading, loadNextPage, hasMore, currentPage };
}

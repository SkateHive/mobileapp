import { useState, useEffect, useRef } from 'react';
import { getSnapsContainers, getContentReplies, ExtendedComment, SNAPS_CONTAINER_AUTHOR, SNAPS_PAGE_MIN_SIZE, COMMUNITY_TAG, getDiscussions } from '../hive-utils';
import { Discussion } from '@hiveio/dhive';
import { FeedFilterType } from '../FeedFilterContext';

interface LastContainerInfo {
  permlink: string;
  date: string;
}

export function useSnaps(filter: FeedFilterType = 'Recent', username: string | null = null) {
  const lastContainerRef = useRef<LastContainerInfo | null>(null);
  const fetchedPermlinksRef = useRef<Set<string>>(new Set());

  const [currentPage, setCurrentPage] = useState(1);
  const [comments, setComments] = useState<ExtendedComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Clear comments when filter changes
  useEffect(() => {
    setComments([]);
    setCurrentPage(1);
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
      } catch (error) {
        return false;
      }
    });
  }

  // Fetch comments with progressive loading (show posts as found)
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
            
            const comments = await getContentReplies({
              author: SNAPS_CONTAINER_AUTHOR,
              permlink: resultItem.permlink,
            });
            
            const filteredComments = filterCommentsByTag(comments, tag);
            
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

      // Filter out duplicates if any (due to start_author/permlink being inclusive)
      const uniqueResults = results.filter(r => !fetchedPermlinksRef.current.has(r.permlink));
      uniqueResults.forEach(r => fetchedPermlinksRef.current.add(r.permlink));
      
      return uniqueResults as unknown as ExtendedComment[];
    }
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

  // Refresh function to reset and reload
  const refresh = async () => {
    lastContainerRef.current = null;
    fetchedPermlinksRef.current = new Set();
    setComments([]);
    setCurrentPage(1);
    setHasMore(true);
    
    // Wait a bit for state to settle then trigger a refetch
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 100);
    });
  };

  return { comments, isLoading, loadNextPage, hasMore, currentPage, refresh };
}

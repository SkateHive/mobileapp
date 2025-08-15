import { useState, useEffect, useRef } from 'react';
import { getUserComments, SNAPS_CONTAINER_AUTHOR, COMMUNITY_TAG } from '../hive-utils';

interface LastPostInfo {
  author: string;
  permlink: string;
}

export function useUserComments(username: string | null) {
  const lastPostRef = useRef<LastPostInfo | null>(null);
  const fetchedPermlinksRef = useRef<Set<string>>(new Set());

  const [currentPage, setCurrentPage] = useState(1);
  const [posts, setPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Filter comments by parent_author (peak.snaps)
  function filterByParentAuthor(posts: any[], targetAuthor: string): any[] {
    return posts.filter((post) => {
      return post.parent_author === targetAuthor;
    });
  }

  // Filter comments by community tag (same as main feed)
  function filterCommentsByTag(posts: any[], targetTag: string): any[] {
    return posts.filter((post) => {
      try {
        if (!post.json_metadata) return false;
        const metadata = typeof post.json_metadata === 'string'
          ? JSON.parse(post.json_metadata)
          : post.json_metadata;
        const tags = metadata.tags || [];
        return tags.includes(targetTag);
      } catch (error) {
        return false;
      }
    });
  }

  // Fetch user posts with progressive loading
  async function getMoreUserComments(): Promise<any[]> {
    if (!username || username === 'SPECTATOR') {
      return [];
    }

    const pageSize = 10;
    const allFilteredPosts: any[] = [];
    let hasMoreData = true;
    let iterationCount = 0;
    const maxIterations = 10; // Prevent infinite loops
    
    // Track all permlinks to avoid duplicates
    const allPermlinks = new Set(fetchedPermlinksRef.current);

    while (allFilteredPosts.length < pageSize && hasMoreData && iterationCount < maxIterations) {
      iterationCount++;
      
      try {
        const result = await getUserComments(
          username,
          'comments',
          20, // Fetch more at once to improve efficiency
          lastPostRef.current?.author,
          lastPostRef.current?.permlink
        );

        if (!result.length) {
          hasMoreData = false;
          break;
        }

        // Filter by parent_author first (peak.snaps)
        const parentFilteredPosts = filterByParentAuthor(result, SNAPS_CONTAINER_AUTHOR);
        
        // Then filter by community tag
        const tagFilteredPosts = filterCommentsByTag(parentFilteredPosts, COMMUNITY_TAG);

        // Remove duplicates
        const uniquePosts = tagFilteredPosts.filter(post => !allPermlinks.has(post.permlink));
        
        // Add to results and track permlinks
        uniquePosts.forEach(post => {
          allPermlinks.add(post.permlink);
          allFilteredPosts.push(post);
        });

        // Update pagination info using the last item from the original result
        if (result.length > 0) {
          const lastItem = result[result.length - 1];
          lastPostRef.current = {
            author: lastItem.author,
            permlink: lastItem.permlink
          };
        }

        // If we got fewer results than requested, we've reached the end
        if (result.length < 20) {
          hasMoreData = false;
        }

      } catch (error) {
        console.error('Error fetching user posts:', error);
        hasMoreData = false;
      }
    }

    // Update the ref with all permlinks seen so far
    fetchedPermlinksRef.current = allPermlinks;

    // Sort by created date descending
    allFilteredPosts.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
    
    return allFilteredPosts;
  }

  // Reset when username changes
  useEffect(() => {
    if (username && username !== 'SPECTATOR') {
      lastPostRef.current = null;
      fetchedPermlinksRef.current = new Set();
      setPosts([]);
      setCurrentPage(1);
      setHasMore(true);
    }
  }, [username]);

  // Fetch posts when currentPage changes
  useEffect(() => {
    if (!username || username === 'SPECTATOR') {
      setPosts([]);
      setIsLoading(false);
      setHasMore(false);
      return;
    }

    const fetchPosts = async () => {
      setIsLoading(true);
      try {
        const newPosts = await getMoreUserComments();
        setPosts((prevPosts) => {
          const existingPermlinks = new Set(prevPosts.map((post) => post.permlink));
          const uniquePosts = newPosts.filter((post: any) => !existingPermlinks.has(post.permlink));
          
          // If no new unique posts, set hasMore to false
          if (uniquePosts.length === 0) {
            setHasMore(false);
          }
          
          return [...prevPosts, ...uniquePosts];
        });
      } catch (err) {
        console.error('Error in fetchPosts:', err);
        setHasMore(false);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPosts();
  }, [currentPage, username]);

  // Load the next page
  const loadNextPage = () => {
    if (!isLoading && hasMore && username && username !== 'SPECTATOR') {
      setCurrentPage((prevPage) => prevPage + 1);
    }
  };

  // Refresh function to reset and reload
  const refresh = () => {
    if (username && username !== 'SPECTATOR') {
      lastPostRef.current = null;
      fetchedPermlinksRef.current = new Set();
      setPosts([]);
      setCurrentPage(1);
      setHasMore(true);
    }
  };

  return { 
    posts, 
    isLoading, 
    loadNextPage, 
    hasMore, 
    currentPage,
    refresh 
  };
}

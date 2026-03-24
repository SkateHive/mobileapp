import {
  API_BASE_URL, API_SEARCH_URL,
} from './constants';
import {
  fetchFollowingFromAPI,
  fetchFollowingFromRPC,
  fetchFollowersFromAPI,
  fetchFollowersFromRPC,
  fetchMutedFromAPI,
  fetchBlacklistedFromAPI,
  resilientFetch
} from './resilient-fetch';
import { getUserRelationshipList } from './hive-utils';
import { VideoConfig } from './config/VideoConfig';
import { MOCK_POSTS } from './mock/videoTestData';
import type { Post } from './types';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

/**
 * Fetches the main feed, filtering duplicate votes to keep only the latest vote per user
 */

// Paginated feed fetcher
export async function getFeed(page = 1, limit = 10): Promise<Post[]> {
  if (VideoConfig.debugVideoTestMode) {
    console.log(`[getFeed] DEBUG_MODE: Returning MOCK_POSTS for page ${page}`);
    return MOCK_POSTS.map(post => ({
      ...post,
      permlink: `${post.permlink}-${page}`, // Unique permlink for infinite scroll
    }));
  }

  try {
    const response = await fetch(`${API_BASE_URL}/feed?page=${page}&limit=${limit}`);
    const data: ApiResponse<Post[]> = await response.json();
    if (data.success && Array.isArray(data.data)) {
      // Process each post to filter duplicate votes
      return data.data.map((post: Post) => {
        if (post.votes && Array.isArray(post.votes)) {
          const latestVotesMap = new Map();
          post.votes.forEach(vote => {
            const existingVote = latestVotesMap.get(vote.voter);
            if (!existingVote || new Date(vote.timestamp) > new Date(existingVote.timestamp)) {
              latestVotesMap.set(vote.voter, vote);
            }
          });
          post.votes = Array.from(latestVotesMap.values());
        }
        return post;
      });
    }
    return [];
  } catch (error) {
    console.error('Error fetching feed:', error);
    return [];
  }
}

/**
 * Fetches the snaps feed from the /feed endpoint (production-ready, cached, normalized)
 * Maps API field names to dhive-compatible names so PostCard can consume them.
 */
export async function getSnapsFeed(page = 1, limit = 10): Promise<Post[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/feed?page=${page}&limit=${limit}`);
    const data: ApiResponse<Post[]> = await response.json();
    if (data.success && Array.isArray(data.data)) {
      return data.data.map((post: any) => {
        // Map soft post fields to standard display fields
        if (post.is_soft_post) {
          post.displayName = post.soft_post_display_name;
          post.avatarUrl = post.soft_post_avatar;
          post.author = post.soft_post_author || post.author;
        } else {
          post.avatarUrl = `https://images.hive.blog/u/${post.author}/avatar/small`;
        }

        // Map API 'votes' → dhive 'active_votes' for PostCard compatibility
        if (post.votes && Array.isArray(post.votes)) {
          const latestVotesMap = new Map();
          post.votes.forEach((vote: any) => {
            const existingVote = latestVotesMap.get(vote.voter);
            if (!existingVote || new Date(vote.timestamp) > new Date(existingVote.timestamp)) {
              latestVotesMap.set(vote.voter, vote);
            }
          });
          post.active_votes = Array.from(latestVotesMap.values());
        } else {
          post.active_votes = [];
        }

        // Ensure children count is a number (for comment count display)
        post.children = Number(post.children || 0);
        console.log(`[getSnapsFeed] ${post.author}/${post.permlink.slice(0,20)}: children=${post.children}, active_votes=${post.active_votes?.length}`);
        
        // Ensure json_metadata is parsed if it's a string from the API
        if (typeof post.post_json_metadata === 'string') {
          try {
            post.json_metadata = post.post_json_metadata;
          } catch (e) {}
        } else if (post.post_json_metadata) {
           post.json_metadata = JSON.stringify(post.post_json_metadata);
        }

        return post as Post;
      });
    }
    return [];
  } catch (error) {
    console.error('Error fetching snaps feed from API:', error);
    throw error; // Throw to allow fallback in useSnaps
  }
}

/**
 * Get balance


/**
 * Fetches the Following feed
 */
export async function getFollowing(username: string): Promise<Post[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/feed/${username}/following`);
    const data: ApiResponse<Post[]> = await response.json();
    return data.success && Array.isArray(data.data) ? data.data : [];
  } catch (error) {
    console.error('Error fetching trending:', error);
    return [];
  }
}

/**
 * Fetches user's balance data
 */
export async function getBalance(username: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/balance/${username}`);
    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    console.error('Error fetching balance:', error);
    return null;
  }
}

/**
 * Fetches user's rewards data
 */
export async function getRewards(username: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/balance/${username}/rewards`);
    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    console.error('Error fetching rewards:', error);
    return null;
  }
}

/**
 * Fetches user's following list (usernames) from Skatehive API
 */
export async function getFollowingList(username: string): Promise<string[]> {
  return resilientFetch(
    () => fetchFollowingFromAPI(username),
    () => fetchFollowingFromRPC(username),
    'Relationships'
  );
}

/**
 * Fetches user's followers list (usernames) from Skatehive API
 */
export async function getFollowersList(username: string): Promise<string[]> {
  return resilientFetch(
    () => fetchFollowersFromAPI(username),
    () => fetchFollowersFromRPC(username),
    'Relationships'
  );
}

/**
 * Fetches user's muted list (usernames) from Skatehive API with fallback to bridge API
 */
export async function getMutedList(username: string): Promise<string[]> {
  return resilientFetch(
    () => fetchMutedFromAPI(username),
    () => getUserRelationshipList(username, 'ignore'),
    'Muted'
  );
}

/**
 * Fetches user's blacklisted list (usernames) from Skatehive API
 * Note: No RPC fallback since bridge.get_following doesn't support 'blacklist'
 */
export async function getBlacklistedList(username: string): Promise<string[]> {
  return resilientFetch(
    () => fetchBlacklistedFromAPI(username),
    () => Promise.resolve([]),
    'Blacklisted'
  );
}

// search fetcher
export async function search(params: {
  q: string;
  type?: 'all' | 'users' | 'snaps';
  time?: '1m' | '3m' | '1y' | 'all';
  community?: string;
  page?: number;
  limit?: number;
}): Promise<any> {
  const { q, type = 'all', time = '1y', community = 'hive-173115', page = 1, limit = 20 } = params;
  
  const queryParams = new URLSearchParams({
    q,
    type,
    time,
    community,
    page: page.toString(),
    limit: limit.toString(),
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds timeout

  try {
    const response = await fetch(`${API_SEARCH_URL}/search?${queryParams.toString()}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const data = await response.json();
    return data;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn('Search request timed out');
      return { success: false, error: 'Search timed out' };
    }
    console.error('Error in search:', error);
    return { success: false, error: 'Failed to perform search' };
  }
}
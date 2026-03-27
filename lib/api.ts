import { API_BASE_URL } from './constants';
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
 * Fetches the video feed from the dedicated /videos endpoint.
 * Returns pre-extracted video entries with thumbnails — no client-side parsing needed.
 */
export async function getVideoFeed(page = 1, limit = 20) {
  try {
    const response = await fetch(`${API_BASE_URL}/videos?page=${page}&limit=${limit}`);
    // Guard against non-JSON responses (404 HTML page if endpoint not deployed yet)
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      console.warn('Video feed endpoint not available, falling back to feed');
      return null; // signal to caller to use fallback
    }
    const data = await response.json();
    if (data.success && Array.isArray(data.data)) {
      return data;
    }
    return null;
  } catch (error) {
    console.warn('Video feed endpoint failed, falling back to feed:', error);
    return null;
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
import { API_BASE_URL } from './constants';
import type { Post } from './types';

/**
 * GET with a timeout, retrying only on network errors (no connection, DNS).
 * A request that timed out is not retried: the server got it and is slow, so
 * asking again only piles more load on it (a cold /videos took 22.8 s, and
 * three 10 s attempts left users waiting ~31 s before the fallback feed).
 */
export async function fetchWithRetry(url: string, retries = 2, timeoutMs = 10_000): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;
      if (err instanceof Error && err.name === 'AbortError') break;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

/**
 * Fetches the main feed, filtering duplicate votes to keep only the latest vote per user
 */

// The feeds the Videos tab reads are slow when the API's cache is cold
// (measured: /videos page 1 22.8 s, page 2 14.3 s cold vs 0.4 s warm), so they
// get a longer budget than the default 10 s. Still one attempt per call: a
// timed-out request isn't repeated (see fetchWithRetry); the UI offers a retry.
export const FEED_TIMEOUT_MS = 20_000;

/**
 * One page of the main feed. Throws when it can't be loaded, so callers can
 * tell a failure from an empty page. `getFeed` keeps the old never-throw API.
 */
export async function fetchFeedPage(page = 1, limit = 10, timeoutMs = 10_000): Promise<Post[]> {
  const response = await fetchWithRetry(`${API_BASE_URL}/feed?page=${page}&limit=${limit}`, 2, timeoutMs);
  const data: ApiResponse<Post[]> = await response.json();
  if (!data.success || !Array.isArray(data.data)) {
    throw new Error(`Feed page ${page} failed to load`);
  }
  return dedupeVotes(data.data);
}

function dedupeVotes(posts: Post[]): Post[] {
  return posts.map((post: Post) => {
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

// Paginated feed fetcher
export async function getFeed(page = 1, limit = 10): Promise<Post[]> {
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/feed?page=${page}&limit=${limit}`);
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
    const response = await fetchWithRetry(`${API_BASE_URL}/videos?page=${page}&limit=${limit}`, 2, FEED_TIMEOUT_MS);
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
    const response = await fetchWithRetry(`${API_BASE_URL}/balance/${username}`);
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
    const response = await fetchWithRetry(`${API_BASE_URL}/balance/${username}/rewards`);
    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    console.error('Error fetching rewards:', error);
    return null;
  }
}
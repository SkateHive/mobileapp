import {
  API_BASE_URL,
} from './constants';
import { getUserRelationshipList } from './hive-utils';
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
 * Falls back to RPC (bridge API) if the Skatehive API fails
 */
export async function getFollowingList(username: string): Promise<string[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/relationships/${username}/following`);
    const data: ApiResponse<string[]> = await response.json();
    if (data.success && Array.isArray(data.data)) return data.data;
  } catch (error) {
    console.warn('[Relationships] API failed for following, falling back to RPC:', error);
  }
  // Fallback to RPC
  return getUserRelationshipList(username, 'blog');
}

/**
 * Fetches user's followers list (usernames) from Skatehive API
 * Falls back to RPC (bridge API) if the Skatehive API fails
 */
export async function getFollowersList(username: string): Promise<string[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/relationships/${username}/followers`);
    const data: ApiResponse<string[]> = await response.json();
    if (data.success && Array.isArray(data.data)) return data.data;
  } catch (error) {
    console.warn('[Relationships] API failed for followers, falling back to RPC:', error);
  }
  // Fallback to RPC
  return getUserRelationshipList(username, 'blog');
}

/**
 * Fetches user's muted list (usernames) from Skatehive API with fallback to bridge API
 */
export async function getMutedList(username: string): Promise<string[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/relationships/${username}/muted`);
    const data: ApiResponse<string[]> = await response.json();
    if (data.success && Array.isArray(data.data)) return data.data;
  } catch (error) {
    console.warn('[Muted] API failed, falling back to RPC:', error);
  }
  // Fallback to bridge API
  return getUserRelationshipList(username, 'ignore');
}

/**
 * Fetches user's blacklisted list (usernames) from Skatehive API
 * Note: No RPC fallback since bridge.get_following doesn't support 'blacklist'
 */
export async function getBlacklistedList(username: string): Promise<string[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/relationships/${username}/blacklisted`);
    const data: ApiResponse<string[]> = await response.json();
    if (data.success && Array.isArray(data.data)) return data.data;
  } catch (error) {
    console.warn('[Blacklisted] API failed, no RPC fallback available:', error);
  }
  return [];
}
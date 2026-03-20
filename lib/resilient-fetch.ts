/**
 * Resilient Fetch Layer
 * 
 * Tries the Skatehive API first (fast, cached HAFSQL),
 * falls back to dHive RPC if the API is down or errors.
 * Both sources are normalized to the same TypeScript interface.
 */

import { Client } from '@hiveio/dhive';
import { API_BASE_URL } from './constants';

const HiveClient = new Client([
  "https://api.deathwing.me",
  "https://techcoderx.com",
  "https://api.hive.blog",
  "https://anyx.io",
  "https://hive-api.arcange.eu",
]);

/**
 * Generic resilient fetcher: tries API first, falls back to RPC.
 */
export async function resilientFetch<T>(
  apiFn: () => Promise<T>,
  rpcFallbackFn: () => Promise<T>,
  label: string
): Promise<T> {
  try {
    const result = await apiFn();
    return result;
  } catch (apiError) {
    if ((apiError as any).message?.includes('Network request failed')) {
      console.warn(`[${label}] API unreachable (Local Network?), falling back to RPC.`);
    } else {
      console.warn(`[${label}] API failed, falling back to RPC:`, apiError);
    }
    return rpcFallbackFn();
  }
}

// ============================================================================
// RELATIONSHIPS DATA (Following/Followers)
// ============================================================================

/**
 * Fetch following list from Skatehive API v2 (with pagination up to exhaustion).
 */
export async function fetchFollowingFromAPI(username: string): Promise<string[]> {
  const normalizedUsername = username.replace(/^@/, '').toLowerCase();
  let allFollowing: string[] = [];
  let offset = 0;
  const limit = 1000;
  let hasMore = true;

  while (hasMore) {
    const url = `${API_BASE_URL}/following/${normalizedUsername}?t=${Date.now()}&offset=${offset}`;
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`API following failed: ${response.status}`);
    const json = await response.json();
    if (!json.success) throw new Error('API following returned success=false');
    
    const pageData = json.data.map((item: any) => item.following_name);
    allFollowing = [...allFollowing, ...pageData];

    if (pageData.length < limit) {
      hasMore = false;
    } else {
      offset += limit;
    }
  }

  return allFollowing;
}

/**
 * Fetch followers list from Skatehive API v2 (with pagination up to exhaustion).
 */
export async function fetchFollowersFromAPI(username: string): Promise<string[]> {
  const normalizedUsername = username.replace(/^@/, '').toLowerCase();
  let allFollowers: string[] = [];
  let offset = 0;
  const limit = 1000;
  let hasMore = true;

  while (hasMore) {
    const url = `${API_BASE_URL}/followers/${normalizedUsername}?t=${Date.now()}&offset=${offset}`;
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`API followers failed: ${response.status}`);
    const json = await response.json();
    if (!json.success) throw new Error('API followers returned success=false');
    
    const pageData = json.data.map((item: any) => item.follower_name);
    allFollowers = [...allFollowers, ...pageData];

    if (pageData.length < limit) {
      hasMore = false;
    } else {
      offset += limit;
    }
  }

  return allFollowers;
}

/**
 * Fetch muted users from Skatehive API v2 (with pagination up to exhaustion).
 */
export async function fetchMutedFromAPI(username: string): Promise<string[]> {
  const normalizedUsername = username.replace(/^@/, '').toLowerCase();
  let allMuted: string[] = [];
  let offset = 0;
  const limit = 1000;
  let hasMore = true;

  while (hasMore) {
    const url = `${API_BASE_URL}/muted/${normalizedUsername}?t=${Date.now()}&offset=${offset}`;
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`API muted failed: ${response.status}`);
    const json = await response.json();
    if (!json.success) throw new Error('API muted returned success=false');
    
    // Check if the API returned an error message in data or if data is missing
    if (!json.data || !Array.isArray(json.data)) return allMuted;

    const pageData = json.data.map((item: any) => item.muted_name);
    allMuted = [...allMuted, ...pageData];

    if (pageData.length < limit) {
      hasMore = false;
    } else {
      offset += limit;
    }
  }

  return allMuted;
}

/**
 * Fetch blacklisted users from Skatehive API v2 (with pagination up to exhaustion).
 */
export async function fetchBlacklistedFromAPI(username: string): Promise<string[]> {
  const normalizedUsername = username.replace(/^@/, '').toLowerCase();
  let allBlacklisted: string[] = [];
  let offset = 0;
  const limit = 1000;
  let hasMore = true;

  while (hasMore) {
    const url = `${API_BASE_URL}/blacklisted/${normalizedUsername}?t=${Date.now()}&offset=${offset}`;
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`API blacklisted failed: ${response.status}`);
    const json = await response.json();
    if (!json.success) throw new Error('API blacklisted returned success=false');
    
    if (!json.data || !Array.isArray(json.data)) return allBlacklisted;

    const pageData = json.data.map((item: any) => item.blacklisted_name);
    allBlacklisted = [...allBlacklisted, ...pageData];

    if (pageData.length < limit) {
      hasMore = false;
    } else {
      offset += limit;
    }
  }

  return allBlacklisted;
}
/**
 * Fetch following from Hive RPC (Bridge API) with pagination.
 */
export async function fetchFollowingFromRPC(username: string): Promise<string[]> {
  let allFollowing: string[] = [];
  let start = '';
  const limit = 1000;
  let hasMore = true;

  while (hasMore) {
    // condenser_api.get_following [account, start, type, limit]
    const result = await HiveClient.call('condenser_api', 'get_following', [
      username,
      start,
      'blog',
      limit
    ]);
    
    // condenser_api returns objects with 'following' property
    let pageData = result.map((item: any) => item.following);
    if (start && pageData.length > 0 && pageData[0] === start) {
      pageData = pageData.slice(1);
    }
    
    if (pageData.length === 0) break;
    allFollowing = [...allFollowing, ...pageData];

    if (result.length < limit) {
      hasMore = false;
    } else {
      start = result[result.length - 1].following;
    }
  }

  return allFollowing;
}

/**
 * Fetch followers from Hive RPC (Bridge API) with pagination.
 */
export async function fetchFollowersFromRPC(username: string): Promise<string[]> {
  let allFollowers: string[] = [];
  let start = '';
  const limit = 1000;
  let hasMore = true;

  while (hasMore) {
    // condenser_api.get_followers [account, start, type, limit]
    const result = await HiveClient.call('condenser_api', 'get_followers', [
      username,
      start,
      'blog',
      limit
    ]);
    
    let pageData = result.map((item: any) => item.follower);
    if (start && pageData.length > 0 && pageData[0] === start) {
      pageData = pageData.slice(1);
    }
    
    if (pageData.length === 0) break;
    allFollowers = [...allFollowers, ...pageData];

    if (result.length < limit) {
      hasMore = false;
    } else {
      start = result[result.length - 1].follower;
    }
  }

  return allFollowers;
}

// ============================================================================
// WALLET DATA
// ============================================================================

export interface NormalizedBalance {
  account_name: string;
  hive: string;
  hbd: string;
  vests: string;
  hp_equivalent: string;
  delegated_hp: string;
  received_hp: string;
  hive_savings: string;
  hbd_savings: string;
  hbd_claimable: string;
}

/**
 * Fetch wallet balance from Skatehive API v2 and normalize.
 */
export async function fetchBalanceFromAPI(username: string): Promise<NormalizedBalance> {
  const response = await fetch(`${API_BASE_URL}/balance/${username}`);
  if (!response.ok) throw new Error(`API balance failed: ${response.status}`);
  
  const json = await response.json();
  if (!json.success) throw new Error('API balance returned success=false');
  
  const data = json.data;
  return {
    account_name: data.account_name || username,
    hive: data.hive || '0',
    hbd: data.hbd || '0',
    vests: data.vests || '0',
    hp_equivalent: data.hp_equivalent || '0',
    delegated_hp: data.delegated_hp || '0',
    received_hp: data.received_hp || '0',
    hive_savings: data.hive_savings || '0',
    hbd_savings: data.hbd_savings || '0',
    hbd_claimable: data.hbd_claimable || '0',
  };
}

// ============================================================================
// REWARDS DATA
// ============================================================================

export interface NormalizedRewards {
  summary: {
    total_pending_payout: string;
    pending_hbd: string;
    pending_hp: string;
    pending_posts_count: string;
    total_author_rewards: string;
    total_curator_payouts: string;
  };
  pending_posts: Array<{
    title: string;
    permlink: string;
    created: string;
    cashout_time: string;
    remaining_till_cashout: {
      days: number;
      hours: number;
      minutes: number;
      seconds: number;
      milliseconds: number;
    };
    last_payout: string;
    pending_payout_value: string;
    author_rewards: string;
    author_rewards_in_hive: string;
    total_payout_value: string;
    curator_payout_value: string;
    beneficiary_payout_value: string;
    total_rshares: string;
    net_rshares: string;
    total_vote_weight: string;
    beneficiaries: string;
    max_accepted_payout: string;
    percent_hbd: number;
    allow_votes: boolean;
    allow_curation_rewards: boolean;
  }>;
}

/**
 * Fetch rewards from Skatehive API v2 and normalize.
 */
export async function fetchRewardsFromAPI(username: string): Promise<NormalizedRewards> {
  const response = await fetch(`${API_BASE_URL}/balance/${username}/rewards`);
  if (!response.ok) throw new Error(`API rewards failed: ${response.status}`);
  
  const json = await response.json();
  if (!json.success) throw new Error('API rewards returned success=false');
  
  return json.data;
}

/**
 * Resilient Fetch Layer
 * 
 * Tries the Skatehive API first (fast, cached HAFSQL),
 * falls back to dHive RPC if the API is down or errors.
 * Both sources are normalized to the same TypeScript interface.
 */

import { API_BASE_URL } from './constants';

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
    console.warn(`[${label}] API failed, falling back to RPC:`, apiError);
    return rpcFallbackFn();
  }
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

import { useState, useEffect } from 'react';
import { getBlockchainAccountData, getBlockchainRewards } from '../hive-utils';

interface BalanceData {
  account_name: string;
  hive: string;
  hbd: string;
  vests: string;
  hp_equivalent: string;
  hive_savings: string;
  hbd_savings: string;
}

interface RewardsData {
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

export function useBlockchainWallet(username: string | null) {
  const [balanceData, setBalanceData] = useState<BalanceData | null>(null);
  const [rewardsData, setRewardsData] = useState<RewardsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWalletData = async () => {
    if (!username || username === "SPECTATOR") {
      setBalanceData(null);
      setRewardsData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [balanceResult, rewardsResult] = await Promise.all([
        getBlockchainAccountData(username),
        getBlockchainRewards(username),
      ]);

      setBalanceData({
        account_name: username,
        ...balanceResult,
      });
      setRewardsData(rewardsResult);
    } catch (err) {
      console.error("Error fetching blockchain wallet data:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch wallet data");
      setBalanceData(null);
      setRewardsData(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletData();
  }, [username]);

  const refresh = async () => {
    await fetchWalletData();
  };

  return {
    balanceData,
    rewardsData,
    isLoading,
    error,
    refresh,
  };
}

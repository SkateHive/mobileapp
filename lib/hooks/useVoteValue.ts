import { useState, useEffect, useCallback } from 'react';
import { convertVestToHive, HiveClient } from '../hive-utils';

interface VoteValueHookReturn {
  estimateVoteValue: (votePercentage: number) => Promise<number>;
  isLoading: boolean;
  error: string | null;
  hivePower: number;
  votingPower: number;
}

/**
 * Hook to calculate vote values based on Hive Power and voting power
 * Adapted from the web app's useHivePower hook pattern
 */
export function useVoteValue(username: string | null): VoteValueHookReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hivePower, setHivePower] = useState(0);
  const [votingPower, setVotingPower] = useState(10000); // Default to 100%
  const [rewardFund, setRewardFund] = useState<any>(null);
  const [feedHistory, setFeedHistory] = useState<any>(null);

  // Fetch account data and voting power
  useEffect(() => {
    if (!username || username === 'SPECTATOR') {
      setHivePower(0);
      setVotingPower(10000);
      return;
    }

    const fetchAccountData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Get account data
        const [account] = await HiveClient.database.getAccounts([username]);
        if (!account) {
          throw new Error('Account not found');
        }

        // Calculate Hive Power from vesting shares
        const vestingShares = parseFloat(account.vesting_shares.toString().split(' ')[0]);
        const hp = await convertVestToHive(vestingShares);
        setHivePower(hp);

        // Get voting power
        setVotingPower(account.voting_power || 10000);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch account data');
        setHivePower(0);
        setVotingPower(10000);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAccountData();
  }, [username]);

  // Fetch reward fund and feed history for vote calculation
  useEffect(() => {
    const fetchBlockchainData = async () => {
      try {
        // Get reward fund
        const fund = await HiveClient.database.call('get_reward_fund', ['post']);
        setRewardFund(fund);

        // Get feed history for price conversion
        const history = await HiveClient.database.call('get_feed_history', []);
        setFeedHistory(history);
      } catch (err) {
        // Silently fail - vote calculation will return 0
      }
    };

    fetchBlockchainData();
  }, []);

  // Calculate vote value based on percentage
  const estimateVoteValue = useCallback(async (votePercentage: number): Promise<number> => {
    try {
      if (!username || hivePower === 0 || !rewardFund || !feedHistory) {
        return 0;
      }

      // Get fresh account data for voting power
      const [account] = await HiveClient.database.getAccounts([username]);
      if (!account) {
        return 0;
      }

      // Use the same calculation as the web app's useHivePower hook
      const { reward_balance, recent_claims } = rewardFund;
      const { base, quote } = feedHistory.current_median_history;
      const baseNumeric = parseFloat(String(base).split(" ")[0]);
      const quoteNumeric = parseFloat(String(quote).split(" ")[0]);
      const hbdMedianPrice = baseNumeric / quoteNumeric;
      const rewardBalanceNumeric = parseFloat(String(reward_balance).split(" ")[0]);
      const recentClaimsNumeric = parseFloat(String(recent_claims));
      
      const vestingSharesNumeric = parseFloat(String(account.vesting_shares).split(" ")[0]);
      const receivedVestingSharesNumeric = parseFloat(String(account.received_vesting_shares).split(" ")[0]);
      const delegatedVestingSharesNumeric = parseFloat(String(account.delegated_vesting_shares).split(" ")[0]);
      const total_vests = vestingSharesNumeric + receivedVestingSharesNumeric - delegatedVestingSharesNumeric;
      const final_vest = total_vests * 1e6;
      
      // Voting power is from 0-100, but blockchain expects 0-10000
      const voting_power = account.voting_power || 0;
      // Use the provided votePercentage (slider value)
      const used_power = Math.floor((voting_power * votePercentage) / 100);
      const rshares = (used_power * final_vest) / 10000 / 50;

      // Calculate final vote value in HBD
      const estimate = (rshares / recentClaimsNumeric) * rewardBalanceNumeric * hbdMedianPrice;
      
      return Math.max(0, estimate);
    } catch (err) {
      return 0;
    }
  }, [username, hivePower, rewardFund, feedHistory]);

  return {
    estimateVoteValue,
    isLoading,
    error,
    hivePower,
    votingPower: votingPower / 100, // Convert to percentage for display
  };
}

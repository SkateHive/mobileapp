import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { convertVestToHive, HiveClient } from '../hive-utils';
import { estimateFromChainData, rewardDataQuery, voterQuery } from '../vote-value';

interface VoteValueHookReturn {
  estimateVoteValue: (votePercentage: number) => Promise<number>;
  isLoading: boolean;
  error: string | null;
  hivePower: number;
  votingPower: number;
}

/**
 * Hook to calculate vote values based on Hive Power and voting power.
 * The chain data is a shared query, so a feed of N PostCards fetches it once.
 */
export function useVoteValue(username: string | null): VoteValueHookReturn {
  const enabled = !!username && username !== 'SPECTATOR';
  const voter = useQuery({ ...voterQuery(HiveClient.database, convertVestToHive, username ?? ''), enabled });
  const rewardData = useQuery({ ...rewardDataQuery(HiveClient.database), enabled });

  const hivePower = (enabled && voter.data?.hivePower) || 0;
  const votingPower = (enabled && voter.data?.votingPower) || 10000;
  const chain = rewardData.data;

  const estimateVoteValue = useCallback(async (votePercentage: number): Promise<number> => {
    try {
      if (!username || hivePower === 0 || !chain) {
        return 0;
      }

      // Get fresh account data for voting power
      const [account] = await HiveClient.database.getAccounts([username]);
      if (!account) {
        return 0;
      }

      return estimateFromChainData(account, chain.rewardFund, chain.feedHistory, votePercentage);
    } catch (err) {
      console.warn('[useVoteValue] estimateVoteValue failed:', err);
      return 0;
    }
  }, [username, hivePower, chain]);

  return {
    estimateVoteValue,
    isLoading: voter.isLoading,
    error: voter.error ? voter.error.message || 'Failed to fetch account data' : null,
    hivePower,
    votingPower: votingPower / 100, // Convert to percentage for display
  };
}

import type { Client } from '@hiveio/dhive';

// Kept free of React Native and hive-utils (which needs @env) so it runs under node:test.

type HiveDatabase = Pick<Client['database'], 'getAccounts' | 'call'>;

// Every PostCard reads the same voter and chain data; sharing it through React Query turns
// 4 RPC calls per card into 4 per feed. Hive power and the reward pool barely move in 5 minutes,
// and estimateVoteValue still reads the account fresh when the user actually votes.
const VOTE_DATA_STALE_TIME = 1000 * 60 * 5;

const amount = (value: unknown) => parseFloat(String(value).split(' ')[0]);

export function voterQuery(
  db: HiveDatabase,
  convertVestToHive: (vests: number) => Promise<number>,
  username: string,
) {
  return {
    queryKey: ['voteValue', 'voter', username],
    queryFn: async () => {
      const [account] = await db.getAccounts([username]);
      if (!account) throw new Error('Account not found');
      const hivePower = await convertVestToHive(amount(account.vesting_shares));
      return { hivePower, votingPower: account.voting_power || 10000 };
    },
    staleTime: VOTE_DATA_STALE_TIME,
  };
}

export function rewardDataQuery(db: HiveDatabase) {
  return {
    queryKey: ['voteValue', 'rewardData'],
    queryFn: async () => {
      const [rewardFund, feedHistory] = await Promise.all([
        db.call('get_reward_fund', ['post']),
        db.call('get_feed_history', []),
      ]);
      return { rewardFund, feedHistory };
    },
    staleTime: VOTE_DATA_STALE_TIME,
  };
}

/** Same calculation as the web app's useHivePower hook; result in HBD. */
export function estimateFromChainData(
  account: { vesting_shares: unknown; received_vesting_shares: unknown; delegated_vesting_shares: unknown; voting_power?: number },
  rewardFund: { reward_balance: unknown; recent_claims: unknown },
  feedHistory: { current_median_history: { base: unknown; quote: unknown } },
  votePercentage: number,
): number {
  const { base, quote } = feedHistory.current_median_history;
  const hbdMedianPrice = amount(base) / amount(quote);
  const rewardBalance = amount(rewardFund.reward_balance);
  const recentClaims = parseFloat(String(rewardFund.recent_claims));

  const totalVests =
    amount(account.vesting_shares) + amount(account.received_vesting_shares) - amount(account.delegated_vesting_shares);
  const finalVest = totalVests * 1e6;

  // voting_power is 0-10000; votePercentage is the slider value (0-100).
  const usedPower = Math.floor(((account.voting_power || 0) * votePercentage) / 100);
  const rshares = (usedPower * finalVest) / 10000 / 50;

  return Math.max(0, (rshares / recentClaims) * rewardBalance * hbdMedianPrice);
}

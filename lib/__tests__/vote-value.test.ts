import { test } from "node:test";
import assert from "node:assert/strict";
import { QueryClient } from "@tanstack/react-query";
import { estimateFromChainData, rewardDataQuery, voterQuery } from "../vote-value";

const account = {
  vesting_shares: "2000000.000000 VESTS",
  received_vesting_shares: "500000.000000 VESTS",
  delegated_vesting_shares: "100000.000000 VESTS",
  voting_power: 8000,
};
const rewardFund = { reward_balance: "800000.000 HIVE", recent_claims: "600000000000000000" };
const feedHistory = { current_median_history: { base: "0.250 HBD", quote: "1.000 HIVE" } };

test("the estimate matches the formula PostCard used before (#81)", () => {
  // 2.4M net vests, 80% voting power, 50% slider: floor(8000*50/100)=4000,
  // rshares = 4000 * 2.4e12 / 10000 / 50 = 1.92e10, value = 1.92e10 / 6e17 * 800000 * 0.25.
  const expected = (1.92e10 / 6e17) * 800000 * 0.25;
  assert.equal(estimateFromChainData(account, rewardFund, feedHistory, 50), expected);
  assert.equal(estimateFromChainData({ ...account, voting_power: 0 }, rewardFund, feedHistory, 100), 0);
});

test("ten PostCards fetch the voter and chain data once, not once per card", async () => {
  const calls: string[] = [];
  const db = {
    getAccounts: async () => { calls.push("get_accounts"); return [account]; },
    call: async (method: string) => {
      calls.push(method);
      return method === "get_reward_fund" ? rewardFund : feedHistory;
    },
  } as unknown as Parameters<typeof voterQuery>[0];
  const toHive = async (vests: number) => { calls.push("get_dynamic_global_properties"); return vests / 2000; };

  const client = new QueryClient();
  const results = await Promise.all(
    Array.from({ length: 10 }, () => Promise.all([
      client.fetchQuery(voterQuery(db, toHive, "skater")),
      client.fetchQuery(rewardDataQuery(db)),
    ])),
  );
  // A card mounted later, within the stale time, reuses the cache.
  await client.fetchQuery(voterQuery(db, toHive, "skater"));
  await client.fetchQuery(rewardDataQuery(db));

  assert.deepEqual(calls.sort(), ["get_accounts", "get_dynamic_global_properties", "get_feed_history", "get_reward_fund"]);
  assert.deepEqual(results[9], [{ hivePower: 1000, votingPower: 8000 }, { rewardFund, feedHistory }]);
});

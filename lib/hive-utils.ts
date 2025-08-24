import { Client, Comment, PrivateKey } from '@hiveio/dhive';
import { 
  SNAPS_CONTAINER_AUTHOR as ENV_SNAPS_CONTAINER_AUTHOR,
  SNAPS_PAGE_MIN_SIZE as ENV_SNAPS_PAGE_MIN_SIZE,
  SNAPS_CONTAINER_FETCH_LIMIT as ENV_SNAPS_CONTAINER_FETCH_LIMIT,
  COMMUNITY_TAG as ENV_COMMUNITY_TAG
} from '@env';

// --- HIVE CONSTANTS (from .env) ---
export const SNAPS_CONTAINER_AUTHOR = ENV_SNAPS_CONTAINER_AUTHOR || 'peak.snaps';
export const SNAPS_PAGE_MIN_SIZE = Number(ENV_SNAPS_PAGE_MIN_SIZE) || 10;
export const SNAPS_CONTAINER_FETCH_LIMIT = Number(ENV_SNAPS_CONTAINER_FETCH_LIMIT) || 3;
export const COMMUNITY_TAG = ENV_COMMUNITY_TAG || 'hive-173115';

// --- Hive Client ---
const HiveClient = new Client([
  "https://api.deathwing.me",
  "https://techcoderx.com",
  "https://api.hive.blog",
  "https://anyx.io",
  "https://hive-api.arcange.eu",
  "https://hive-api.3speak.tv",
]);

// Export the client for reuse in other modules
export { HiveClient };

// --- Types ---
export interface ExtendedComment extends Comment {
  active_votes?: any[];
  replies?: ExtendedComment[];
}

export interface Transaction {
  from: string;
  to: string;
  amount: string;
  memo?: string;
  timestamp: string;
}


// --- Functions ---
export async function sendOperation(privateKey: string, op: any[]): Promise<any> {
  return HiveClient.broadcast.sendOperations(op, PrivateKey.fromString(privateKey));
}

/**
 * Cast a vote on a post or comment.
 * @param privateKey - The user's posting private key (WIF)
 * @param voter - The username of the voter
 * @param author - The author of the post/comment
 * @param permlink - The permlink of the post/comment
 * @param weight - Vote weight (-10000 to 10000)
 * @returns The broadcast result
 * @example
 *   await vote(privateKey, 'alice', 'bob', 'my-post', 10000);
 */
export async function vote(
  privateKey: string,
  voter: string,
  author: string,
  permlink: string,
  weight: number
): Promise<any> {
  const operation: any = [
    'vote',
    {
      voter,
      author,
      permlink,
      weight,
    },
  ];
  return sendOperation(privateKey, [operation]);
}

/**
 * Post a comment or reply on Hive.
 * @param privateKey - The user's posting private key (WIF)
 * @param parentAuthor - The author of the parent post (empty string for top-level post)
 * @param parentPermlink - The permlink of the parent post (community tag for top-level post)
 * @param author - The username posting the comment
 * @param permlink - The permlink for the new comment
 * @param title - The title of the comment (empty for reply)
 * @param body - The body of the comment
 * @param jsonMetadata - Optional JSON metadata
 * @returns The broadcast result
 * @example
 *   await comment(privateKey, '', 'hive-173115', 'alice', 'my-post', 'Title', 'Body', {});
 */
export async function comment(
  privateKey: string,
  parentAuthor: string,
  parentPermlink: string,
  author: string,
  permlink: string,
  title: string,
  body: string,
  jsonMetadata: object = {}
): Promise<any> {
  const operation: any = [
    'comment',
    {
      parent_author: parentAuthor,
      parent_permlink: parentPermlink,
      author,
      permlink,
      title,
      body,
      json_metadata: JSON.stringify(jsonMetadata),
    },
  ];
  return sendOperation(privateKey, [operation]);
}

/**
 * Update a user's profile metadata on Hive.
 * @param privateKey - The user's posting private key (WIF)
 * @param username - The Hive username
 * @param profile - The profile object (should match Hive profile schema)
 * @returns The broadcast result
 * @example
 *   await updateProfile(privateKey, 'alice', { name: 'Alice', about: 'Skater' });
 */
export async function updateProfile(
  privateKey: string,
  username: string,
  profile: Record<string, any>
): Promise<any> {
  const json = JSON.stringify({ profile });
  const operation: any = [
    'account_update2',
    {
      account: username,
      json_metadata: '',
      posting_json_metadata: json,
    },
  ];
  return sendOperation(privateKey, [operation]);
}

export async function communitySubscribe(privateKey: string, username: string): Promise<any> {
  const json = ['subscribe', { community: COMMUNITY_TAG }];
  const operation: any = [
    'custom_json',
    {
      required_auths: [],
      required_posting_auths: [username],
      id: 'community',
      json: JSON.stringify(json),
    },
  ];
  return sendOperation(privateKey, [operation]);
}

export async function checkFollow(follower: string, following: string): Promise<boolean> {
  try {
    const status = await HiveClient.call('bridge', 'get_relationship_between_accounts', [follower, following]);
    return !!status.follows;
  } catch {
    return false;
  }
}

export async function getTransactionHistory(username: string, searchAccount: string): Promise<Transaction[]> {
  try {
    const operationsBitmask: [number, number] = [4, 0];
    const accountHistory = await HiveClient.database.getAccountHistory(username, -1, 1000, operationsBitmask);
    return accountHistory
      .filter(([_idx, opDetails]: any) => {
        const operationType = opDetails.op[0];
        const opData = opDetails.op[1];
        return operationType === 'transfer' && (opData.from === searchAccount || opData.to === searchAccount);
      })
      .map(([_idx, opDetails]: any) => {
        const opData = opDetails.op[1];
        return {
          from: opData.from,
          to: opData.to,
          amount: opData.amount,
          memo: opData.memo || '',
          timestamp: opDetails.timestamp,
        };
      })
      .reverse();
  } catch {
    return [];
  }
}

export async function changeFollow(privateKey: string, follower: string, following: string): Promise<any> {
  const status = await checkFollow(follower, following);
  let type = '';
  if (!status) type = 'blog';
  const json = JSON.stringify(['follow', { follower, following, what: [type] }]);
  const data = {
    id: 'follow',
    required_auths: [],
    required_posting_auths: [follower],
    json,
  };
  const operation: any = ['custom_json', data];
  return sendOperation(privateKey, [operation]);
}

export async function toggleFollow(privateKey: string, follower: string, following: string, status: boolean): Promise<string> {
  let type = '';
  if (!status) type = 'blog';
  const json = JSON.stringify(['follow', { follower, following, what: [type] }]);
  const data = {
    id: 'follow',
    required_auths: [],
    required_posting_auths: [follower],
    json,
  };
  const operation: any = ['custom_json', data];
  await sendOperation(privateKey, [operation]);
  return type;
}

/**
 * Signs an image hash with a Hive private key (for uploads, etc).
 *
 * @param hash - The hex string hash to sign
 * @param wif - The private key (WIF) to use (optional, falls back to env)
 * @returns The signature as a string
 *
 * @example
 *   const sig = await signImageHash(hash, privateKey);
 */
export async function signImageHash(hash: string, wif?: string): Promise<string> {
  const key = PrivateKey.fromString(wif || (process.env.HIVE_POSTING_KEY || ''));
  const hashBuffer = Buffer.from(hash, 'hex');
  const signature = key.sign(hashBuffer);
  return signature.toString();
}

export async function sendPowerUp(username: string, amount: number, privateKey: string): Promise<any> {
  const operation: any = [
    'transfer_to_vesting',
    {
      from: username,
      to: username,
      amount: `${amount.toFixed(3)} HIVE`,
    },
  ];
  return HiveClient.broadcast.sendOperations([operation], PrivateKey.fromString(privateKey));
}

/**
 * Get snaps containers (posts) by author before a given permlink/date.
 * Only requires last permlink (empty string for first page).
 */
export async function getSnapsContainers({
  lastPermlink = '',
  lastDate = new Date().toISOString(),
} : {
  lastPermlink?: string;
  lastDate?: string;
}): Promise<Comment[]> {
  return HiveClient.database.call('get_discussions_by_author_before_date', [
    SNAPS_CONTAINER_AUTHOR,
    lastPermlink,
    lastDate,
    SNAPS_CONTAINER_FETCH_LIMIT,
  ]);
}

/**
 * Get comments (replies) for a given author/permlink.
 */
export async function getContentReplies({
  author,
  permlink,
}: {
  author: string;
  permlink: string;
}): Promise<ExtendedComment[]> {
  return HiveClient.database.call('get_content_replies', [author, permlink]);
}

// Define custom error classes for better error handling
export class HiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HiveError';
  }
}

export class InvalidKeyFormatError extends HiveError {
  constructor() {
    super('Invalid posting key format. Posting keys should start with 5.');
    this.name = 'InvalidKeyFormatError';
  }
}

export class AccountNotFoundError extends HiveError {
  constructor(username: string) {
    super(`Account '${username}' not found on the Hive blockchain.`);
    this.name = 'AccountNotFoundError';
  }
}

export class InvalidKeyError extends HiveError {
  constructor() {
    super('The posting key is invalid for the given username.');
    this.name = 'InvalidKeyError';
  }
}

/**
 * Validates if the posting key provided is valid for the given username
 * @param username Hive username
 * @param postingPrivateKey Private posting key
 * @returns True if the key is valid
 * @throws {InvalidKeyFormatError} If the key format is invalid
 * @throws {AccountNotFoundError} If the account doesn't exist
 * @throws {InvalidKeyError} If the key is invalid for the account
 * @throws {HiveError} For other Hive-related errors
 */
/**
 * Validates if the posting key provided is valid for the given username
 * @param username Hive username
 * @param postingPrivateKey Private posting key
 * @returns True if the key is valid
 * @throws {InvalidKeyFormatError} If the key format is invalid
 * @throws {AccountNotFoundError} If the account doesn't exist
 * @throws {InvalidKeyError} If the key is invalid for the account
 * @throws {HiveError} For other Hive-related errors
 */
export async function validate_posting_key(
  username: string, 
  postingPrivateKey: string
): Promise<boolean> {
  try {
    // Check if the input looks like a private key (should start with 5)
    if (!postingPrivateKey.startsWith('5')) {
      throw new InvalidKeyFormatError();
    }

    // Retrieve account details
    const [account] = await HiveClient.database.getAccounts([username]);

    if (!account) {
      throw new AccountNotFoundError(username);
    }

    // Obtain the public posting key from the account data
    const publicPostingKey = account.posting.key_auths[0][0];

    // Derive the public key from the provided private key
    const derivedPublicKey = PrivateKey.fromString(postingPrivateKey).createPublic().toString();

    // Compare the derived public key with the account's public posting key
    if (publicPostingKey === derivedPublicKey) {
      return true;
    } else {
      throw new InvalidKeyError();
    }
  } catch (error) {
    // Re-throw custom errors
    if (error instanceof HiveError) {
      throw error;
    }
    // Convert unknown errors to HiveError
    throw new HiveError(`Error validating posting key: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get the most recent snaps container post from peak.snaps
 * @returns Object with author and permlink of the latest container
 */
export async function getLastSnapsContainer(): Promise<{ author: string; permlink: string }> {
  const author = SNAPS_CONTAINER_AUTHOR;
  const beforeDate = new Date().toISOString().split('.')[0];
  const permlink = '';
  const limit = 1;

  const result = await HiveClient.database.call('get_discussions_by_author_before_date',
    [author, permlink, beforeDate, limit]);

  if (!result || !result[0]) {
    throw new Error('No snaps container found');
  }

  return {
    author,
    permlink: result[0].permlink
  };
}

/**
 * Get extended profile information including follower/following counts
 * @param username - Hive username
 * @returns Profile information with stats
 */
export async function getProfile(username: string): Promise<any> {
  try {
    const profile = await HiveClient.call('bridge', 'get_profile', { account: username });
    return profile;
  } catch (error) {
    console.error('Error fetching profile:', error);
    throw error;
  }
}

/**
 * Get account posts/comments from a specific user
 * @param username - Hive username
 * @param sort - Sort type ('posts' or 'comments')
 * @param limit - Number of posts to fetch
 * @param start_author - Author to start from (for pagination)
 * @param start_permlink - Permlink to start from (for pagination)
 * @returns Array of posts/comments
 */
export async function getUserComments(
  username: string,
  sort: 'posts' | 'comments' = 'comments',
  limit: number = 10,
  start_author?: string,
  start_permlink?: string
): Promise<any[]> {
  try {
    const params: any = {
      account: username,
      sort: sort,
      limit: limit
    };

    if (start_author && start_permlink) {
      params.start_author = start_author;
      params.start_permlink = start_permlink;
    }

    const posts = await HiveClient.call('bridge', 'get_account_posts', params);
    return posts || [];
  } catch (error) {
    console.error('Error fetching user comments:', error);
    throw error;
  }
}

/**
 * Convert VESTS to HIVE Power using current chain properties
 * @param vests - Amount of VESTS to convert
 * @returns HIVE Power amount
 */
export async function convertVestToHive(vests: number): Promise<number> {
  try {
    const props = await HiveClient.database.getDynamicGlobalProperties();
    
    // Handle both string and Asset types
    const totalVestingFund = typeof props.total_vesting_fund_hive === 'string' 
      ? parseFloat(props.total_vesting_fund_hive.split(' ')[0])
      : parseFloat(props.total_vesting_fund_hive.toString().split(' ')[0]);
      
    const totalVestingShares = typeof props.total_vesting_shares === 'string'
      ? parseFloat(props.total_vesting_shares.split(' ')[0])
      : parseFloat(props.total_vesting_shares.toString().split(' ')[0]);
    
    return (vests * totalVestingFund) / totalVestingShares;
  } catch (error) {
    console.error('Error converting VESTS to HIVE:', error);
    throw error;
  }
}

/**
 * Extract numeric value from a string or Asset (e.g., "123.456 HIVE" -> "123.456")
 * @param value - String, number, or Asset value to extract number from
 * @returns Numeric string or "0"
 */
export function extractNumber(value: string | number | any): string {
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'string') {
    const match = value.match(/[\d.]+/);
    return match ? match[0] : "0";
  }
  // Handle Asset type by converting to string first
  if (value && typeof value === 'object') {
    const strValue = value.toString();
    const match = strValue.match(/[\d.]+/);
    return match ? match[0] : "0";
  }
  return "0";
}

/**
 * Get blockchain account information for wallet display
 * @param username - Hive username
 * @returns Account balance data from blockchain
 */
export async function getBlockchainAccountData(username: string): Promise<{
  hive: string;
  hbd: string;
  vests: string;
  hp_equivalent: string;
  hive_savings: string;
  hbd_savings: string;
}> {
  try {
    const [account] = await HiveClient.database.getAccounts([username]);
    
    if (!account) {
      throw new Error('Account not found');
    }

    // Extract balance values
    const hive = extractNumber(account.balance);
    const hbd = extractNumber(account.hbd_balance);
    const vestingShares = extractNumber(account.vesting_shares);
    const hiveSavings = extractNumber(account.savings_balance);
    const hbdSavings = extractNumber(account.savings_hbd_balance);
    
    // Convert VESTS to HIVE Power
    const hpEquivalent = await convertVestToHive(parseFloat(vestingShares));
    
    return {
      hive,
      hbd,
      vests: vestingShares,
      hp_equivalent: hpEquivalent.toFixed(3),
      hive_savings: hiveSavings,
      hbd_savings: hbdSavings,
    };
  } catch (error) {
    console.error('Error fetching blockchain account data:', error);
    throw error;
  }
}

/**
 * Get blockchain rewards data for a user
 * @param username - Hive username
 * @returns Rewards data from blockchain
 */
export async function getBlockchainRewards(username: string): Promise<{
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
}> {
  try {
    // Get user posts that are still in payout period
    const posts = await getUserComments(username, 'posts', 20);
    
    // Filter posts that are still pending payout (within 7 days)
    const now = new Date();
    const pendingPosts = posts.filter(post => {
      const cashoutTime = new Date(post.cashout_time);
      return cashoutTime > now;
    });

    let totalPendingPayout = 0;
    let totalAuthorRewards = 0;
    let totalCuratorRewards = 0;

    const processedPosts = pendingPosts.map(post => {
      const pendingPayout = parseFloat(extractNumber(post.pending_payout_value));
      totalPendingPayout += pendingPayout;
      
      const authorRewards = parseFloat(extractNumber(post.author_payout_value || "0"));
      const curatorRewards = parseFloat(extractNumber(post.curator_payout_value || "0"));
      
      totalAuthorRewards += authorRewards;
      totalCuratorRewards += curatorRewards;

      // Calculate time remaining until cashout
      const cashoutTime = new Date(post.cashout_time);
      const timeDiff = cashoutTime.getTime() - now.getTime();
      const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

      return {
        title: post.title,
        permlink: post.permlink,
        created: post.created,
        cashout_time: post.cashout_time,
        remaining_till_cashout: {
          days: Math.max(0, days),
          hours: Math.max(0, hours),
          minutes: Math.max(0, minutes),
          seconds: Math.max(0, seconds),
          milliseconds: 0,
        },
        last_payout: post.last_payout || "1970-01-01T00:00:00",
        pending_payout_value: post.pending_payout_value || "0.000 HBD",
        author_rewards: post.author_payout_value || "0.000 HBD",
        author_rewards_in_hive: "0.000 HIVE", // Would need market data to calculate
        total_payout_value: post.total_payout_value || "0.000 HBD",
        curator_payout_value: post.curator_payout_value || "0.000 HBD",
        beneficiary_payout_value: "0.000 HBD", // Not easily accessible from post data
        total_rshares: post.net_rshares?.toString() || "0",
        net_rshares: post.net_rshares?.toString() || "0",
        total_vote_weight: "0", // Not easily accessible
        beneficiaries: "[]",
        max_accepted_payout: post.max_accepted_payout || "1000000.000 HBD",
        percent_hbd: post.percent_hbd || 10000,
        allow_votes: post.allow_votes !== false,
        allow_curation_rewards: post.allow_curation_rewards !== false,
      };
    });

    return {
      summary: {
        total_pending_payout: totalPendingPayout.toFixed(3),
        pending_hbd: totalPendingPayout.toFixed(3),
        pending_hp: "0.000", // Would need to calculate based on rewards split
        pending_posts_count: pendingPosts.length.toString(),
        total_author_rewards: totalAuthorRewards.toFixed(3),
        total_curator_payouts: totalCuratorRewards.toFixed(3),
      },
      pending_posts: processedPosts,
    };
  } catch (error) {
    console.error('Error fetching blockchain rewards:', error);
    throw error;
  }
}

// --- NOTIFICATIONS ---

/**
 * Interface for Hive notifications with read status
 */
export interface HiveNotification {
  id: number;
  type: string;
  score: number;
  date: string;
  msg: string;
  url: string;
  isRead?: boolean; // Added to track read status
}

/**
 * Find the last notification reset date for a user
 * @param username - Hive username
 * @param start - Starting point for history search
 * @param loopCount - Current loop count for recursion
 * @returns ISO date string of last reset, or fallback date
 */
export async function findLastNotificationsReset(
  username: string,
  start: number = -1,
  loopCount: number = 0
): Promise<string> {
  if (loopCount >= 5) {
    return '1970-01-01T00:00:00Z';
  }

  try {
    const params = {
      account: username,
      start: start,
      limit: 1000,
      include_reversible: true,
      operation_filter_low: 262144,
    };

    const transactions = await HiveClient.call('account_history_api', 'get_account_history', params);
    const history = transactions.history.reverse();
      
    if (history.length === 0) {
      return '1970-01-01T00:00:00Z';
    }
    
    for (const item of history) {
      if (item[1].op.value.id === 'notify') {
        const json = JSON.parse(item[1].op.value.json);
        return json[1].date;
      }
    }

    return findLastNotificationsReset(username, start - 1000, loopCount + 1);
  } catch (error) {
    console.error('Error finding last notifications reset:', error);
    return '1970-01-01T00:00:00Z';
  }
}

/**
 * Fetch ALL notifications for a user with pagination support
 * @param username - Hive username
 * @param limit - Number of notifications to fetch (default 100)
 * @param lastId - Last notification ID for pagination
 * @returns Array of all notifications with read status
 */
export async function fetchAllNotifications(
  username: string, 
  limit: number = 100, 
  lastId?: number
): Promise<HiveNotification[]> {
  try {
    const params: any = {
      account: username,
      limit: limit
    };
    
    if (lastId) {
      params.last_id = lastId;
    }

    const notifications: HiveNotification[] = await HiveClient.call('bridge', 'account_notifications', params);
    
    // Get the last read date to determine which notifications are read
    const lastDate = await findLastNotificationsReset(username);
    
    // Mark notifications as read or unread based on their date
    const notificationsWithReadStatus = notifications.map(notification => ({
      ...notification,
      isRead: lastDate ? notification.date <= lastDate : false
    }));
    
    return notificationsWithReadStatus;
  } catch (error) {
    console.error('Error fetching all notifications:', error);
    return [];
  }
}

/**
 * Fetch new notifications for a user (only unread ones)
 * @param username - Hive username
 * @returns Array of new notifications since last reset
 */
export async function fetchNewNotifications(username: string): Promise<HiveNotification[]> {
  try {
    const notifications: HiveNotification[] = await HiveClient.call('bridge', 'account_notifications', { 
      account: username, 
      limit: 100 
    });
    const lastDate = await findLastNotificationsReset(username);
    
    if (lastDate) {
      const filteredNotifications = notifications.filter(notification => notification.date > lastDate);
      return filteredNotifications.map(n => ({ ...n, isRead: false }));
    } else {
      return notifications.map(n => ({ ...n, isRead: false }));
    }
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
}

/**
 * Mark notifications as read by posting a custom JSON operation
 * @param privateKey - User's posting private key
 * @param username - Hive username
 * @returns Transaction broadcast result
 */
export async function markNotificationsAsRead(
  privateKey: string,
  username: string
): Promise<any> {
  const now = new Date().toISOString();
  const json = JSON.stringify(['setLastRead', { date: now }]);
  
  const operation: any = [
    'custom_json',
    {
      required_auths: [],
      required_posting_auths: [username],
      id: 'notify',
      json: json,
    },
  ];
  
  return sendOperation(privateKey, [operation]);
}


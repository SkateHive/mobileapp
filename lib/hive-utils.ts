import { Client, Comment, PrivateKey, Discussion, PublicKey } from '@hiveio/dhive';
import CryptoJS from 'crypto-js';
import { 
  SNAPS_CONTAINER_AUTHOR as ENV_SNAPS_CONTAINER_AUTHOR,
  SNAPS_PAGE_MIN_SIZE as ENV_SNAPS_PAGE_MIN_SIZE,
  SNAPS_CONTAINER_FETCH_LIMIT as ENV_SNAPS_CONTAINER_FETCH_LIMIT,
  COMMUNITY_TAG as ENV_COMMUNITY_TAG,
  MODERATOR_PUBLIC_KEY as ENV_MODERATOR_PUBLIC_KEY
} from '@env';

// --- HIVE CONSTANTS (from .env) ---
export const SNAPS_CONTAINER_AUTHOR = ENV_SNAPS_CONTAINER_AUTHOR || 'peak.snaps';
export const SNAPS_PAGE_MIN_SIZE = Number(ENV_SNAPS_PAGE_MIN_SIZE) || 10;
export const SNAPS_CONTAINER_FETCH_LIMIT = Number(ENV_SNAPS_CONTAINER_FETCH_LIMIT) || 3;
export const COMMUNITY_TAG = ENV_COMMUNITY_TAG || 'hive-173115';
export const MODERATOR_PUBLIC_KEY = ENV_MODERATOR_PUBLIC_KEY;

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

/**
 * Get a single post/comment content by author and permlink
 */
export async function getContent(author: string, permlink: string): Promise<Discussion | null> {
  try {
    const content = await HiveClient.database.call('get_content', [author, permlink]);
    if (content && content.author) {
      return content as Discussion;
    }
    return null;
  } catch (error) {
    console.error('Error fetching content:', error);
    return null;
  }
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
    
    // Fetch full content for each post to get active_votes data
    const postsWithVotes = await Promise.all(
      (posts || []).map(async (post: any) => {
        try {
          const fullContent = await getContent(post.author, post.permlink);
          if (fullContent) {
            // Merge the bridge data with full content data (including active_votes)
            return {
              ...post,
              active_votes: fullContent.active_votes || [],
              net_votes: fullContent.net_votes || 0,
            };
          }
          return post;
        } catch (error) {
          console.error(`Error fetching full content for ${post.author}/${post.permlink}:`, error);
          return post;
        }
      })
    );
    
    return postsWithVotes;
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
    
    // Handle null or empty response for new users with no notifications
    if (!notifications || !Array.isArray(notifications)) {
      return [];
    }
    
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
    
    // Handle null or empty response for new users with no notifications
    if (!notifications || !Array.isArray(notifications)) {
      return [];
    }
    
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

/**
 * Follow, mute, or blacklist a user on Hive
 * @param privateKey - User's posting private key (WIF)
 * @param follower - The username performing the action
 * @param following - The username to follow/mute/blacklist
 * @param type - Type of action: 'blog' (follow), 'ignore' (mute), 'blacklist' (blacklist), or '' (unfollow)
 * @returns True if the transaction was successful
 * @example
 *   await setUserRelationship(privateKey, 'alice', 'bob', 'blog'); // Follow
 *   await setUserRelationship(privateKey, 'alice', 'bob', 'ignore'); // Mute
 *   await setUserRelationship(privateKey, 'alice', 'bob', 'blacklist'); // Blacklist
 *   await setUserRelationship(privateKey, 'alice', 'bob', ''); // Unfollow
 */
export async function setUserRelationship(
  privateKey: string,
  follower: string,
  following: string,
  type: 'blog' | 'ignore' | 'blacklist' | ''
): Promise<boolean> {
  try {
    const json = JSON.stringify([
      'follow',
      {
        follower,
        following,
        what: [type], // Empty array or array with type
      },
    ]);

    const operation: any = [
      'custom_json',
      {
        required_auths: [],
        required_posting_auths: [follower],
        id: 'follow',
        json,
      },
    ];

    await sendOperation(privateKey, [operation]);
    return true;
  } catch (error) {
    console.error('Error setting user relationship:', error);
    return false;
  }
}

/**
 * Get the relationship between two accounts using Bridge API
 * @param follower - The account that might be following
 * @param following - The account that might be followed
 * @returns Object with relationship information
 * @example
 *   const relationship = await getRelationshipBetweenAccounts('alice', 'bob');
 *   console.log(relationship.follows); // true if alice follows bob
 *   console.log(relationship.ignores); // true if alice has muted bob
 *   console.log(relationship.blacklists); // true if alice has blacklisted bob
 */
export async function getRelationshipBetweenAccounts(
  follower: string,
  following: string
): Promise<{
  follows: boolean;
  ignores: boolean;
  blacklists: boolean;
}> {
  try {
    const result = await HiveClient.call('bridge', 'get_relationship_between_accounts', [
      follower,
      following
    ]);

    return {
      follows: result?.follows || false,
      ignores: result?.ignores || false,
      blacklists: result?.blacklists || false,
    };
  } catch (error) {
    console.error('Error fetching relationship between accounts:', error);
    return {
      follows: false,
      ignores: false,
      blacklists: false,
    };
  }
}

/**
 * Get the list of users that a user is following, muting, or blacklisting
 * @param username - The username to get the list for
 * @param type - Type of relationship: 'blog' (following), 'ignore' (muted), 'blacklist' (blacklisted)
 * @param startFollowing - Starting point for pagination (optional)
 * @param limit - Maximum number of results to return (default 100)
 * @returns Array of usernames in the specified relationship type
 * @example
 *   const following = await getUserRelationshipList('alice', 'blog'); // Get following list
 *   const muted = await getUserRelationshipList('alice', 'ignore'); // Get muted list
 *   const blacklisted = await getUserRelationshipList('alice', 'blacklist'); // Get blacklisted list
 */
export async function getUserRelationshipList(
  username: string,
  type: 'blog' | 'ignore' | 'blacklist',
  startFollowing: string = '',
  limit: number = 100
): Promise<string[]> {
  try {
    // Use the traditional follow_api for getting full lists
    const result = await HiveClient.call('follow_api', 'get_following', [
      username,
      startFollowing,
      type,
      limit,
    ]);

    // Extract usernames from the result
    return result.map((item: any) => item.following);
  } catch (error) {
    console.error('Error fetching user relationship list:', error);
    return [];
  }
}

/**
 * Encrypt data using Hive-style public key encryption
 * @param data - The data to encrypt
 * @param publicKey - The public key to encrypt for
 * @returns Encrypted data string in format: tempPublicKey:encryptedData
 */
function encryptForPublicKey(data: any, publicKey: string): string {
  try {
    const jsonString = JSON.stringify(data);
    
    // Use a React Native compatible approach for generating random values
    const randomValue1 = Math.random().toString(36).substring(2, 15);
    const randomValue2 = Math.random().toString(36).substring(2, 15);
    const timestamp = Date.now().toString();
    const nonce = `${timestamp}-${randomValue1}-${randomValue2}`;
    
    // Generate a temporary private key for this encryption
    const tempPrivate = PrivateKey.fromSeed(nonce);
    const targetPubKey = PublicKey.fromString(publicKey);
    
    // Create shared secret using ECDH
    const sharedSecret = tempPrivate.get_shared_secret(targetPubKey);
    
    // Encrypt data with shared secret
    const encrypted = CryptoJS.AES.encrypt(jsonString, sharedSecret.toString('hex')).toString();
    
    // Return: temp_public_key:encrypted_data
    return `${tempPrivate.createPublic().toString()}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Check if it's specifically a crypto module error
    if (errorMessage.includes('Native crypto module') || errorMessage.includes('secure random')) {
      throw new Error('Crypto module not available in React Native environment. This is a known limitation.');
    }
    
    throw new Error(`Encryption failed: ${errorMessage}`);
  }
}

/**
 * Decrypt data that was encrypted with encryptForPublicKey
 * @param encryptedData - The encrypted data string
 * @param privateKey - The private key to decrypt with
 * @returns Decrypted data object
 */
export function decryptFromPrivateKey(encryptedData: string, privateKey: string): any {
  const [tempPublicKeyStr, encrypted] = encryptedData.split(':');
  const moderatorPrivate = PrivateKey.fromString(privateKey);
  const tempPublic = PublicKey.fromString(tempPublicKeyStr);
  
  // Recreate shared secret
  const sharedSecret = moderatorPrivate.get_shared_secret(tempPublic);
  
  // Decrypt
  const decrypted = CryptoJS.AES.decrypt(encrypted, sharedSecret.toString('hex'));
  return JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
}

/**
 * Submit an encrypted report for a post or user
 * @param privateKey - Reporter's posting private key (WIF)
 * @param reporter - The username submitting the report
 * @param reportedAuthor - The author being reported
 * @param reportedPermlink - The permlink being reported
 * @param reason - The reason for the report
 * @param additionalInfo - Optional additional information
 * @returns True if the report was submitted successfully
 * @example
 *   await submitEncryptedReport(privateKey, 'alice', 'bob', 'spam-post', 'spam', 'This post is clearly spam content');
 */
export async function submitEncryptedReport(
  privateKey: string,
  reporter: string,
  reportedAuthor: string,
  reportedPermlink: string,
  reason: string,
  additionalInfo?: string
): Promise<boolean> {
  try {
    if (!MODERATOR_PUBLIC_KEY) {
      throw new Error('Report system not configured - missing moderator public key');
    }
    
    const reportData = {
      type: 'post_report',
      reported_author: reportedAuthor,
      reported_permlink: reportedPermlink,
      reason: reason,
      additional_info: additionalInfo || '',
      timestamp: new Date().toISOString(),
      reporter: reporter,
      app: 'skatehive_mobile',
      version: '1.0'
    };

    // Encrypt the report data for the moderator
    const encryptedData = encryptForPublicKey(reportData, MODERATOR_PUBLIC_KEY);

    const customJsonData = {
      encrypted: true,
      data: encryptedData,
      version: 1,
      encryption_method: 'hive_ecdh'
    };

    const operation: any = [
      'custom_json',
      {
        required_auths: [],
        required_posting_auths: [reporter],
        id: 'skatehive_reports',
        json: JSON.stringify(customJsonData),
      },
    ];

    const result = await sendOperation(privateKey, [operation]);
    return true;
  } catch (error) {
    console.error('Error submitting encrypted report:', error);
    throw error;
  }
}

/**
 * Submit an encrypted account creation request
 * @param requestedUsername - The username requested by the user
 * @param email - The user's email address
 * @returns True if the request was submitted successfully
 * @example
 *   await submitAccountCreationRequest('newuser123', 'user@example.com');
 */
export async function submitAccountCreationRequest(
  requestedUsername: string,
  email: string
): Promise<boolean> {
  try {
    if (!MODERATOR_PUBLIC_KEY) {
      throw new Error('Account creation system not configured - missing moderator public key');
    }
    
    const requestData = {
      type: 'account_creation_request',
      requested_username: requestedUsername.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      timestamp: new Date().toISOString(),
      app: 'skatehive_mobile',
      version: '1.0'
    };

    // Encrypt the request data for the moderator
    const encryptedData = encryptForPublicKey(requestData, MODERATOR_PUBLIC_KEY);

    const customJsonData = {
      encrypted: true,
      data: encryptedData,
      version: 1,
      encryption_method: 'hive_ecdh'
    };

    // Use a temporary account to broadcast (this needs to be configured)
    // For now, we'll use the skatethread account from the test configuration
    const tempPrivateKey = '5KPCy8wGKukimMDSu64dA3gUB5Utj5Qm3Vm3yueCzm1MG4Lk3XB';
    const tempUsername = 'skatethread';

    const operation: any = [
      'custom_json',
      {
        required_auths: [],
        required_posting_auths: [tempUsername],
        id: 'skatehive_account_requests',
        json: JSON.stringify(customJsonData),
      },
    ];

    const result = await sendOperation(tempPrivateKey, [operation]);
    return true;
  } catch (error) {
    console.error('Error submitting account creation request:', error);
    throw error;
  }
}

/**
 * Get the following list for a user
 * @param username - The username to get following list for
 * @param startFollowing - Optional: username to start from for pagination
 * @param limit - Optional: number of results to return (default: 100)
 * @returns Array of usernames that the user is following
 */
export async function getFollowing(
  username: string,
  startFollowing: string = '',
  limit: number = 100
): Promise<string[]> {
  try {
    const result = await HiveClient.database.call('get_following', [
      username,
      startFollowing,
      'blog',
      limit
    ]);
    
    // The result is an array of objects with 'following' property
    return result.map((item: any) => item.following).filter(Boolean);
  } catch (error) {
    console.error('Error fetching following list:', error);
    return [];
  }
}

/**
 * Get the muted users list for a user
 * @param username - The username to get muted list for
 * @param startMuted - Optional: username to start from for pagination
 * @param limit - Optional: number of results to return (default: 100)
 * @returns Array of usernames that the user has muted
 */
export async function getMuted(
  username: string,
  startMuted: string = '',
  limit: number = 100
): Promise<string[]> {
  try {
    const result = await HiveClient.database.call('get_following', [
      username,
      startMuted,
      'ignore',
      limit
    ]);
    
    // The result is an array of objects with 'following' property
    return result.map((item: any) => item.following).filter(Boolean);
  } catch (error) {
    console.error('Error fetching muted list:', error);
    return [];
  }
}

/**
 * Get the followers list for a user
 * @param username - The username to get followers list for
 * @param startFollower - Optional: username to start from for pagination
 * @param limit - Optional: number of results to return (default: 100)
 * @returns Array of usernames that follow the user
 */
export async function getFollowers(
  username: string,
  startFollower: string = '',
  limit: number = 100
): Promise<string[]> {
  try {
    const result = await HiveClient.database.call('get_followers', [
      username,
      startFollower,
      'blog',
      limit
    ]);
    
    // The result is an array of objects with 'follower' property
    return result.map((item: any) => item.follower).filter(Boolean);
  } catch (error) {
    console.error('Error fetching followers list:', error);
    return [];
  }
}

/**
 * Get follow count (following and followers) for a user
 * @param username - The username to get follow count for
 * @returns Object with following and followers count
 */
export async function getFollowCount(username: string): Promise<{ following: number; followers: number }> {
  try {
    const result = await HiveClient.database.call('get_follow_count', [username]);
    return {
      following: result.following_count || 0,
      followers: result.follower_count || 0
    };
  } catch (error) {
    console.error('Error fetching follow count:', error);
    return { following: 0, followers: 0 };
  }
}


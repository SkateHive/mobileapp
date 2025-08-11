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


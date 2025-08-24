export interface Post {
  title: string;
  body: string;
  author: string;
  permlink: string;
  parent_author: string;
  parent_permlink: string;
  created: string;
  last_edited: string | null;
  cashout_time: string;
  remaining_till_cashout: {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    milliseconds: number;
  };
  last_payout: string;
  tags: string[];
  category: string;
  post_json_metadata: {
    app: string;
    tags: string[];
  };
  root_author: string;
  root_permlink: string;
  pending_payout_value: string;
  author_rewards: string;
  author_rewards_in_hive: string;
  total_payout_value: string;
  curator_payout_value: string;
  beneficiary_payout_value: string;
  total_rshares: string;
  net_rshares: string;
  total_vote_weight: number;
  beneficiaries: string;
  max_accepted_payout: string;
  percent_hbd: number;
  allow_votes: boolean;
  allow_curation_rewards: boolean;
  deleted: boolean;
  user_json_metadata: {
    extensions: {
      level: number;
      staticXp: number;
      eth_address: string;
      video_parts: Array<{
        url: string;
        name: string;
        year: string;
        friends: string[];
        filmmaker: string[];
      }>;
      cumulativeXp: number;
    };
  };
  reputation: string;
  followers: string;
  followings: string;
  votes: Array<{
    id: number;
    timestamp: string;
    voter: string;
    weight: number;
    rshares: number;
    total_vote_weight: number;
    pending_payout: number;
    pending_payout_symbol: string;
  }>;
}

export interface Media {
  type: 'image' | 'video';
  url: string;
}

export interface PreloadedData {
  feed: Post[];
  trending: Post[];
}

// --- Secure Key & Auth Types ---

export type EncryptionMethod = 'biometric' | 'pin';

export interface EncryptedKey {
  username: string;
  encrypted: string;
  method: EncryptionMethod;
  salt: string;
  iv: string;
  createdAt: number;
}

export interface StoredUser {
  username: string;
  method: EncryptionMethod;
  createdAt: number;
}

export interface AuthSession {
  username: string;
  decryptedKey: string;
  loginTime: number;
}

// --- Notification Types ---

export interface HiveNotification {
  id: number;
  type: string;
  score: number;
  date: string;
  msg: string;
  url: string;
  isRead?: boolean;
}

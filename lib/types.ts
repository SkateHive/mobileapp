import type { Discussion } from '@hiveio/dhive';

export interface Post extends Omit<Discussion, 'post_json_metadata' | 'user_json_metadata' | 'beneficiaries'> {
  // Custom fields for Soft Posts (identifying @skateuser true authors)
  is_soft_post?: boolean;
  soft_post_author?: string;
  soft_post_display_name?: string;
  soft_post_avatar?: string;

  // Overridden fields to match our API response or specific usage
  post_json_metadata: any; 
  user_json_metadata: any;
  beneficiaries: any;
  
  // Ensure votes is available (Discussion uses active_votes, but we use both for safety)
  votes?: Array<{
    id: number;
    timestamp: string;
    voter: string;
    weight: number;
    rshares: number;
    total_vote_weight: number;
    pending_payout?: number;
    pending_payout_symbol?: string;
  }>;
}

export interface Media {
  type: 'image' | 'video' | 'embed';
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

// --- Discussion Types (Extended from @hiveio/dhive) ---

export interface NestedDiscussion extends Omit<Discussion, 'replies' | 'depth'> {
  replies: NestedDiscussion[];
  depth?: number;
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

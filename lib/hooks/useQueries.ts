import { useQuery, QueryClient } from '@tanstack/react-query';
import {
  getFeed,
  getBalance,
  getRewards } from '../api';
import { API_BASE_URL, LEADERBOARD_API_URL } from '../constants';
import { extractMediaFromBody } from '../utils';
import type { Post } from '../types';

// ============================================================================
// VIDEO FEED — shared query for prefetch on login + use on videos tab
// ============================================================================

export interface VideoPost {
  videoUrl: string;
  username: string;
  permlink: string;
  author: string;
  title: string;
  body: string;
  created: string;
  votes: number;
  payout: string;
  replies: number;
  thumbnailUrl?: string;
  tags: string[];
  json_metadata: any;
  active_votes: any[];
}

const VIDEO_FEED_QUERY_KEY = ['videoFeed'] as const;
const VIDEO_FEED_STALE_TIME = 1000 * 60 * 2; // 2 minutes

async function fetchVideoFeed(): Promise<VideoPost[]> {
  const posts = await getFeed(1, 50);
  const videoList: VideoPost[] = [];

  posts.forEach((post: Post) => {
    const media = extractMediaFromBody(post.body);
    const videoMedia = media.filter((m) => m.type === 'video');
    const rawPost = post as any;

    if (videoMedia.length > 0) {
      let metadata: any = {};
      try {
        metadata = typeof rawPost.json_metadata === 'string'
          ? JSON.parse(rawPost.json_metadata)
          : rawPost.json_metadata;
      } catch (e) {
        metadata = {};
      }

      const imageMedia = media.filter((m) => m.type === 'image');

      videoMedia.forEach((video) => {
        const thumbnail = metadata?.image?.[0] || imageMedia[0]?.url;
        videoList.push({
          videoUrl: video.url,
          username: post.author,
          permlink: post.permlink,
          author: post.author,
          title: post.title || '',
          body: post.body || '',
          created: post.created || '',
          votes: rawPost.net_votes || 0,
          payout: rawPost.pending_payout_value || rawPost.total_payout_value || '0.000 HBD',
          replies: rawPost.children || 0,
          thumbnailUrl: thumbnail,
          tags: metadata?.tags || [],
          json_metadata: metadata,
          active_votes: rawPost.active_votes || [],
        });
      });
    }
  });

  return videoList;
}

export function useVideoFeed() {
  return useQuery({
    queryKey: VIDEO_FEED_QUERY_KEY,
    queryFn: fetchVideoFeed,
    staleTime: VIDEO_FEED_STALE_TIME,
  });
}

export function prefetchVideoFeed(queryClient: QueryClient) {
  queryClient.prefetchQuery({
    queryKey: VIDEO_FEED_QUERY_KEY,
    queryFn: fetchVideoFeed,
    staleTime: VIDEO_FEED_STALE_TIME,
  });
}

/**
 * Prefetch thumbnails and avatars while user is on login screen.
 * Warms image cache so the videos tab renders instantly.
 */
export async function warmUpVideoAssets(queryClient: QueryClient) {
  const { Image } = require('react-native');

  const data = await queryClient.ensureQueryData({
    queryKey: VIDEO_FEED_QUERY_KEY,
    queryFn: fetchVideoFeed,
    staleTime: VIDEO_FEED_STALE_TIME,
  });

  if (!data || data.length === 0) return;

  // Prefetch thumbnails for the first 5 videos
  const thumbnailUrls = data
    .slice(0, 5)
    .map((v: VideoPost) => v.thumbnailUrl)
    .filter(Boolean) as string[];

  thumbnailUrls.forEach((url: string) => {
    Image.prefetch(url).catch(() => {});
  });

  // Prefetch avatar images
  const avatarUrls = [...new Set(data.slice(0, 5).map((v: VideoPost) => `https://images.hive.blog/u/${v.username}/avatar`))];
  avatarUrls.forEach((url: string) => {
    Image.prefetch(url).catch(() => {});
  });
}

interface ProfileData {
  name: string;
  reputation: string;
  followers: string;
  followings: string;
  community_followers: string;
  community_followings: string;
  community_totalposts: string;
  vp_percent: string;
  rc_percent: string;
  hp_equivalent: string;
  total_posts: string;
  posting_metadata?: {
    profile: {
      name: string;
      about: string;
      profile_image?: string;
      cover_image?: string;
      location?: string;
    }
  }
}

const SPECTATOR_PROFILE: ProfileData = {
  name: 'SPECTATOR',
  reputation: '0',
  followers: '0',
  followings: '0',
  community_followers: '0',
  community_followings: '0',
  vp_percent: '0',
  rc_percent: '0',
  hp_equivalent: '0',
  total_posts: '0',
  community_totalposts: '0',
  posting_metadata: {
    profile: {
      name: 'Spectator',
      about: '',
      profile_image: '',
      cover_image: '',
      location: '',
    }
  }
};

export function useBalance(username: string | null) {
  return useQuery({
    queryKey: ['balance', username],
    queryFn: () => username ? getBalance(username) : null,
    enabled: !!username && username !== 'SPECTATOR',
  });
}

export function useRewards(username: string | null) {
  return useQuery({
    queryKey: ['rewards', username],
    queryFn: () => username ? getRewards(username) : null,
    enabled: !!username && username !== 'SPECTATOR',
  });
}

export function useProfile(username: string | null) {
  return useQuery<ProfileData, Error>({
    queryKey: ['profile', username],
    queryFn: async (): Promise<ProfileData> => {
      if (!username || username === 'SPECTATOR') {
        return SPECTATOR_PROFILE;
      }
      const profileResponse = await fetch(`${API_BASE_URL}/profile/${username}`);
      const profileJson = await profileResponse.json();
      if (profileJson.success) {
        return profileJson.data as ProfileData;
      }
      throw new Error('Failed to fetch profile data');
    },
    enabled: !!username,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

interface LeaderboardData {
  id: number;
  hive_author: string;
  hive_balance: number;
  hp_balance: number;
  hbd_balance: number;
  hbd_savings_balance: number;
  has_voted_in_witness: boolean;
  eth_address: string;
  gnars_balance: number;
  gnars_votes: number;
  skatehive_nft_balance: number;
  max_voting_power_usd: number;
  last_updated: string;
  last_post: string;
  post_count: number;
  points: number;
  giveth_donations_usd: number;
  giveth_donations_amount: number;
}

export function useLeaderboard() {
  return useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const response = await fetch(LEADERBOARD_API_URL);
      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard data');
      }
      const data: LeaderboardData[] = await response.json();
      return data.sort((a, b) => b.points - a.points);
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}

export function useUserFeed(username: string | null) {
  return useQuery({
    queryKey: ['userFeed', username],
    queryFn: async () => {
      if (!username || username === 'SPECTATOR') {
        return [];
      }
      const response = await fetch(`${API_BASE_URL}/feed/${username}`);
      if (!response.ok) {
        throw new Error('Failed to fetch user feed');
      }
      const data = await response.json();
      return data.success ? data.data : [];
    },
    enabled: !!username && username !== 'SPECTATOR',
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}

interface MarketData {
  timestamp: string;
  open: string;
  high: string;
  low: string;
  close: string;
  base_vol: string;
  quote_vol: string;
}

export function useMarket() {
  return useQuery<MarketData>({
    queryKey: ['market'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/market`);
      if (!response.ok) {
        throw new Error('Failed to fetch market data');
      }
      const json = await response.json();
      return json.data as MarketData;
    },
    staleTime: 1000 * 60, // Cache for 1 minute
  });
}

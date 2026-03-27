import { useQuery, QueryClient } from '@tanstack/react-query';
import {
  getFeed,
  getBalance,
  getRewards,
  getVideoFeed } from '../api';
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
  created: string;
  votes: number;
  payout: string;
  replies: number;
  thumbnailUrl?: string;
  tags: string[];
  active_votes: { voter: string; weight: number }[];
}

const VIDEO_FEED_QUERY_KEY = ['videoFeed'] as const;
const VIDEO_FEED_STALE_TIME = 1000 * 60 * 1; // 1 minute (API caches for 60s)

/**
 * Fallback: extract videos client-side from the general feed endpoint.
 * Used when /api/v2/videos is not deployed yet.
 */
function extractVideosFromFeed(posts: Post[]): VideoPost[] {
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
      } catch { metadata = {}; }

      const imageMedia = media.filter((m) => m.type === 'image');
      videoMedia.forEach((video) => {
        const thumbnail = metadata?.image?.[0] || imageMedia[0]?.url;
        videoList.push({
          videoUrl: video.url,
          username: post.author,
          permlink: post.permlink,
          author: post.author,
          title: post.title || '',
          created: post.created || '',
          votes: rawPost.net_votes || 0,
          payout: rawPost.pending_payout_value || rawPost.total_payout_value || '0',
          replies: rawPost.children || 0,
          thumbnailUrl: thumbnail,
          tags: metadata?.tags || [],
          active_votes: rawPost.active_votes || [],
        });
      });
    }
  });
  return videoList;
}

async function fetchVideoFeed(): Promise<VideoPost[]> {
  // Try the dedicated /videos endpoint first
  const result = await getVideoFeed(1, 30);
  if (result) {
    return result.data.map((entry: any) => ({
      ...entry,
      username: entry.author,
    }));
  }

  // Fallback: use general feed + client-side extraction
  const posts = await getFeed(1, 50);
  return extractVideosFromFeed(posts);
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

  const thumbnailUrls = data
    .slice(0, 2)
    .map((v: VideoPost) => v.thumbnailUrl)
    .filter(Boolean) as string[];

  const avatarUrls = [...new Set(data.slice(0, 2).map((v: VideoPost) => `https://images.hive.blog/u/${v.username}/avatar`))];

  const allUrls = [...thumbnailUrls, ...avatarUrls];
  for (let i = 0; i < allUrls.length; i += 3) {
    const batch = allUrls.slice(i, i + 3);
    await Promise.allSettled(batch.map(url => Image.prefetch(url)));
  }
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


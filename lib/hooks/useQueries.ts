import { useQuery } from '@tanstack/react-query';
import { 
  getFeed, 
  getTrending, 
  getFollowing, 
  getBalance, getRewards } from '../api';
import { API_BASE_URL } from '../constants';
import type { Post } from '../types';

interface ProfileData {
  name: string;
  reputation: string;
  followers: string;
  followings: string;
  community_followers: string;
  community_followings: string;
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
  total_posts: '0',
  posting_metadata: {
    profile: {
      name: 'Spectator Mode',
      about: 'Browse and explore content without logging in.',
      profile_image: '',
      cover_image: '',
      location: '',
    }
  }
};

export function useFeed() {
  return useQuery({
    queryKey: ['feed'],
    queryFn: getFeed,
    refetchInterval: 60000,
  });
}

export function useTrending() {
  return useQuery({
    queryKey: ['trending'],
    queryFn: getTrending,
    refetchInterval: 60000,
  });
}

export function useFollowing(username: string) {
  return useQuery({
    queryKey: ['following'],
    queryFn: () => getFollowing(username),
    refetchInterval: 60000,
  });
}

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
      const response = await fetch(`${API_BASE_URL}/leaderboard`);
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
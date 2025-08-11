import React from 'react';
import { View, RefreshControl, FlatList, TouchableOpacity } from 'react-native';
import { Text } from '../ui/text';
import { PostCard } from './PostCard';
import type { Post } from '~/lib/types';
import { LoadingScreen } from '../ui/LoadingScreen';
import { ActivityIndicator } from 'react-native';
import { useColorScheme } from '~/lib/useColorScheme';
import { useAuth } from '~/lib/auth-provider';
import { useSnapsFromChain } from '~/lib/hooks/useSnapsFromChain';
import { useFeedPaginated } from '~/lib/hooks/useQueries';
import { Clock } from '~/lib/icons/Clock';
import { TrendingUp } from '~/lib/icons/TrendingUp';
import { Sun } from '~/lib/icons/Sun';
import Animated, {
  useAnimatedStyle,
  withTiming,
  withSequence,
  useSharedValue
} from 'react-native-reanimated';
import { ExtendedComment } from '~/lib/hive-utils';


type FeedMode = 'latest' | 'trending' | 'following';

interface FeedProps {
  refreshTrigger?: number;
}

export function Feed({ refreshTrigger = 0 }: FeedProps) {
  // Toggle this to switch between API and blockchain feed
  const USE_API_FEED = true; // Set to false to use blockchain

  // API feed pagination state
  const [apiPage, setApiPage] = React.useState(1);
  const API_PAGE_SIZE = 10;
  const { posts: apiPosts, isLoading: apiLoading, hasMore: apiHasMore } = useFeedPaginated(apiPage, API_PAGE_SIZE);

  // Blockchain feed
  const { comments, isLoading, loadNextPage, hasMore } = useSnapsFromChain();

  // Map ExtendedComment to Post shape for UI compatibility
  function mapCommentToPost(comment: ExtendedComment): Post {
    const metadata = typeof comment.json_metadata === 'string'
      ? JSON.parse(comment.json_metadata || '{}')
      : (comment.json_metadata || {});
    return {
      title: comment.title || '',
      body: comment.body || '',
      author: comment.author || '',
      permlink: comment.permlink || '',
      parent_author: comment.parent_author || '',
      parent_permlink: comment.parent_permlink || '',
      created: comment.created || '',
      last_edited: comment.last_update || null,
      cashout_time: comment.cashout_time || '',
      remaining_till_cashout: { days: 0, hours: 0, minutes: 0, seconds: 0, milliseconds: 0 },
      last_payout: comment.last_payout || '',
      tags: metadata.tags || [],
      category: comment.category || '',
      post_json_metadata: { app: metadata.app || '', tags: metadata.tags || [] },
      root_author: comment.author || '',
      root_permlink: comment.permlink || '',
      pending_payout_value: '',
      author_rewards: comment.author_rewards ? String(comment.author_rewards) : '',
      author_rewards_in_hive: '',
      total_payout_value: (comment.total_payout_value && typeof comment.total_payout_value === 'object' && 'toString' in comment.total_payout_value)
        ? comment.total_payout_value.toString() : (comment.total_payout_value || ''),
      curator_payout_value: (comment.curator_payout_value && typeof comment.curator_payout_value === 'object' && 'toString' in comment.curator_payout_value)
        ? comment.curator_payout_value.toString() : (comment.curator_payout_value || ''),
      beneficiary_payout_value: '',
      total_rshares: comment.vote_rshares ? String(comment.vote_rshares) : '',
      net_rshares: comment.net_rshares ? String(comment.net_rshares) : '',
      total_vote_weight: comment.total_vote_weight || 0,
      beneficiaries: '',
      max_accepted_payout: comment.max_accepted_payout ? String(comment.max_accepted_payout) : '',
      percent_hbd: comment.percent_hbd || 0,
      allow_votes: comment.allow_votes !== undefined ? comment.allow_votes : true,
      allow_curation_rewards: comment.allow_curation_rewards !== undefined ? comment.allow_curation_rewards : true,
      deleted: false,
      user_json_metadata: {
        extensions: {
          level: 0,
          staticXp: 0,
          eth_address: '',
          video_parts: [],
          cumulativeXp: 0,
        },
      },
      reputation: comment.author && comment.author.length > 0 ? '' : '',
      followers: '',
      followings: '',
      votes: Array.isArray(comment.active_votes)
        ? comment.active_votes.map((v: any, i: number) => ({
            id: i,
            timestamp: v.time || '',
            voter: v.voter || '',
            weight: v.weight || 0,
            rshares: v.rshares || 0,
            total_vote_weight: v.weight || 0,
            pending_payout: 0,
            pending_payout_symbol: '',
          }))
        : [],
    };
  }

  const feedData = USE_API_FEED
    ? apiPosts
    : Array.isArray(comments) ? comments.map(mapCommentToPost) : [];
  const [feedMode, setFeedMode] = React.useState<FeedMode>('latest');
  const { isDarkColorScheme } = useColorScheme();
  const { username } = useAuth();
  // Animation progress values
  const scale = useSharedValue(1);
  const textOpacity = useSharedValue(1);
  const textTranslateY = useSharedValue(0);

  // Handle text animation and feed mode switching
  const handleToggle = React.useCallback(() => {
    // Animate button scale
    scale.value = withSequence(
      withTiming(0.9, { duration: 100 }),
      withTiming(1, { duration: 100 })
    );

    // Animate text fade out
    textOpacity.value = withTiming(0, { duration: 150 });
    textTranslateY.value = withTiming(-10, { duration: 150 });

    // Update feed mode after a short delay to allow animation to complete
    setTimeout(() => {
      // Update feed mode state
      setFeedMode(current => {
        if (current === 'latest') return 'trending';
        if (current === 'trending') return 'following';
        return 'latest';
      });

      // Animate text coming back
      textTranslateY.value = 10;
      setTimeout(() => {
        textOpacity.value = withTiming(1, { duration: 250 });
        textTranslateY.value = withTiming(0, { duration: 250 });
      }, 50);
    }, 160);
  }, []);

  const renderItem = React.useCallback(({ item }: { item: Post }) => (
    <PostCard key={item.permlink} post={item} currentUsername={username} />
  ), [username]);

  const keyExtractor = React.useCallback((item: Post) => item.permlink, []);

  const title =
    feedMode === 'latest' ? 'Latest' :
      feedMode === 'trending' ? 'Trending' :
        'Following';

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }]
  }));

  const ListHeaderComponent = React.useCallback(() => (
    <View className="flex-row items-center justify-between mb-4 px-3">
      <Animated.View style={textAnimatedStyle}>
        <Text className="text-3xl font-bold">{title}</Text>
      </Animated.View>
      <Animated.View
        className={`rounded-full bg-card border border-muted/70`}
        style={buttonAnimatedStyle}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleToggle}
          className="h-10 w-10 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel={`Switch to ${feedMode === 'latest' ? 'trending' :
              feedMode === 'trending' ? 'following' :
                'latest'
            } posts`}
        >
          {feedMode === 'latest' ? (
            <Clock size={24} className="text-primary" />
          ) : feedMode === 'trending' ? (
            <TrendingUp size={24} className="text-primary" />
          ) : (
            <Sun size={24} className="text-primary" />
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  ), [title, feedMode, isDarkColorScheme, handleToggle, buttonAnimatedStyle, textAnimatedStyle]);

  const ItemSeparatorComponent = React.useCallback(() => (
    <View className="h-0 my-4 border border-muted" />
  ), []);

  // Get theme colors
  const foregroundColor = isDarkColorScheme ? '#ffffff' : '#000000';
  const backgroundColor = isDarkColorScheme ? '#1a1a1a' : '#ffffff';

  const ListFooterComponent = (USE_API_FEED ? apiLoading : isLoading) ? (
    <View style={{ padding: 16 }}>
      <ActivityIndicator size="large" color={foregroundColor} />
    </View>
  ) : null;

  return (
    <View className="flex-1">
      <FlatList
        data={feedData}
        showsVerticalScrollIndicator={false}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeaderComponent}
        ItemSeparatorComponent={ItemSeparatorComponent}
        ListFooterComponent={ListFooterComponent}
        contentContainerStyle={{ paddingTop: 16 }}
        onEndReached={USE_API_FEED
          ? (apiHasMore && !apiLoading ? () => setApiPage(p => p + 1) : undefined)
          : (hasMore ? loadNextPage : undefined)}
        onEndReachedThreshold={0.5}
        removeClippedSubviews={true}
        initialNumToRender={5}
        maxToRenderPerBatch={3}
        windowSize={7}
        updateCellsBatchingPeriod={50}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      />
    </View>
  );
}

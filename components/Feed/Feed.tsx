import React from "react";
import {
  View,
  FlatList,
  FlatListProps,
  StyleSheet,
  RefreshControl,
  ViewToken,
  Pressable,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Text } from "../ui/text";
import { PostCard } from "./PostCard";
import { ActivityIndicator } from "react-native";
import { useAuth } from "~/lib/auth-provider";
import { Post } from '~/lib/types';
import { useFeedFilter } from '~/lib/FeedFilterContext';
import { useScrollDirection } from '~/lib/ScrollDirectionContext';
import { useSnaps } from '~/lib/hooks/useSnaps';
import { theme } from "~/lib/theme";
import {
  ViewportTrackerProvider,
  useViewportTracker,
} from "~/lib/ViewportTracker";
import { BadgedIcon } from "../ui/BadgedIcon";
import { useNotificationContext } from "~/lib/notifications-context";
import { useScrollLock } from "~/lib/ScrollLockContext";
import { ConversationDrawer } from "./ConversationDrawer";
import { useScrollToTop } from "@react-navigation/native";
import type { Discussion } from "@hiveio/dhive";

interface FeedProps {
  refreshTrigger?: number;
  onRefresh?: () => void;
}

const AnimatedFlatList = Animated.FlatList;

function FeedContent({ refreshTrigger, onRefresh }: FeedProps) {
  const { filter } = useFeedFilter();
  const { isScrollLocked } = useScrollLock();
  const router = useRouter();
  const { username, blockedList } = useAuth();
  const { comments, isLoading, loadNextPage, hasMore, refresh } = useSnaps(filter, username);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const { updateVisibleItems } = useViewportTracker();
  const { badgeCount } = useNotificationContext();
  const [showScrollTop, setShowScrollTop] = React.useState(false);
  const scrollY = React.useRef(new Animated.Value(0)).current;
  const lastScrollY = React.useRef(0);
  const upScrollDistance = React.useRef(0);

  const flatListRef = React.useRef<FlatList>(null);
  const { setScrollDirection } = useScrollDirection();
  const navigation = useNavigation();

  React.useEffect(() => {
    const unsubscribe = (navigation as any).addListener('tabPress', (e: any) => {
      // Check if we are already focused on the feed
      const isFocused = navigation.isFocused();
      if (isFocused) {
        // If already on feed, scroll to top
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }
    });

    return unsubscribe;
  }, [navigation]);

  const handleScrollToTop = React.useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: true,
      listener: (event: any) => {
        const currentY = event.nativeEvent.contentOffset.y;
        const diff = lastScrollY.current - currentY;

        if (diff > 0) {
          // Scrolling up
          upScrollDistance.current += diff;
          if (diff > 5) setScrollDirection('up'); // Sensitivity threshold
        } else if (diff < 0) {
          // Scrolling down
          upScrollDistance.current = 0;
          if (Math.abs(diff) > 5) setScrollDirection('down');
          if (showScrollTop) setShowScrollTop(false);
        }

        if (currentY > 2600 && upScrollDistance.current > 800) {
          if (!showScrollTop) setShowScrollTop(true);
        }

        if (currentY < 100) {
          if (showScrollTop) setShowScrollTop(false);
          setScrollDirection('up'); // Keep visible at top
        }

        lastScrollY.current = currentY;
      },
    }
  );

  const scrollTopOpacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(scrollTopOpacity, {
      toValue: showScrollTop ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [showScrollTop]);

  // Conversation drawer state (lifted out of PostCard)
  const [conversationPost, setConversationPost] = React.useState<Discussion | null>(null);

  const handleOpenConversation = React.useCallback((post: Discussion) => {
    setConversationPost(post);
  }, []);

  const handleCloseConversation = React.useCallback(() => {
    setConversationPost(null);
  }, []);

  // Handle pull-to-refresh
  const handleRefresh = React.useCallback(async () => {
    setIsRefreshing(true);
    await refresh();
    // Trigger notifications refresh when feed is refreshed
    if (onRefresh) {
      onRefresh();
    }
    setIsRefreshing(false);
  }, [refresh, onRefresh]);

  // Handle viewable items change for video autoplay
  const onViewableItemsChanged = React.useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const visiblePermlinks = viewableItems
        .filter((item) => item.isViewable && item.item)
        .map((item) => (item.item as Discussion).permlink);
      updateVisibleItems(visiblePermlinks);
    },
    [updateVisibleItems]
  );

  // Viewability config - item is considered viewable when 60% is visible
  const viewabilityConfig = React.useMemo(
    () => ({
      viewAreaCoveragePercentThreshold: 60,
      minimumViewTime: 100,
    }),
    []
  );

  // Map blockchain comments (Discussion) to Post for PostCard compatibility
  // Filter out posts from blocked users
  const filteredFeedData = React.useMemo(() => {
    const feedData = comments as unknown as Post[];
    if (!feedData || feedData.length === 0) return [];

    return feedData.filter((post) => {
      // Don't filter out the user's own posts
      if (post.author === username) return true;

      const authorLower = post.author.toLowerCase();
      const blockedLowerList = blockedList.map((u) => u.toLowerCase());

      // Filter out blocked users
      return !blockedLowerList.includes(authorLower);
    });
  }, [comments, blockedList, username]);

  const renderItem = React.useCallback(
    ({ item }: { item: Post }) => (
      <PostCard
        key={item.permlink}
        post={item}
        currentUsername={username || ""}
        onOpenConversation={handleOpenConversation}
      />
    ),
    [username, handleOpenConversation]
  );

  const keyExtractor = React.useCallback(
    (item: Post) => item.permlink,
    []
);

  const ItemSeparatorComponent = React.useCallback(
    () => <View style={styles.separator} />,
    []
  );

  const ListHeaderComponent = React.useCallback(
    () => <View style={{ height: 100 }} />,
    []
  );

  const ListFooterComponent = isLoading ? (
    <View style={styles.footer}>
      <ActivityIndicator size="large" color={theme.colors.text} />
    </View>
  ) : null;

  return (
    <View style={styles.container}>
      <AnimatedFlatList<Post>
        ref={flatListRef as any}
        data={filteredFeedData}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isScrollLocked}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeaderComponent}
        ItemSeparatorComponent={ItemSeparatorComponent}
        ListFooterComponent={ListFooterComponent}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: 100 } // Space for absolute tab bar
        ]}
        onEndReached={hasMore ? loadNextPage : undefined}
        onEndReachedThreshold={0.5}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
            title="Pull to refresh..."
            titleColor={theme.colors.text}
          />
        }
        removeClippedSubviews={true} // Re-enabled to help with memory/OOM crashes
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={11}
        updateCellsBatchingPeriod={50}
        onScroll={onScroll}
        scrollEventThrottle={16}
      />

      {showScrollTop && (
        <Animated.View
          style={[
            styles.scrollTopButtonContainer,
            { opacity: scrollTopOpacity }
          ]}
        >
          <Pressable
            onPress={handleScrollToTop}
            style={({ pressed }) => [
              styles.scrollTopButton,
              pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] }
            ]}
          >
            <Ionicons name="arrow-up" size={20} color={theme.colors.background} />
            <Text style={styles.scrollTopText}>POPPING UP 🛹</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Single shared conversation drawer */}
      {conversationPost && (
        <ConversationDrawer
          isVisible={!!conversationPost}
          onClose={handleCloseConversation}
          post={conversationPost}
        />
      )}
    </View>
  );
}

export function Feed({ refreshTrigger, onRefresh }: FeedProps) {
  return (
    <FeedContent refreshTrigger={refreshTrigger} onRefresh={onRefresh} />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chevron: {
    marginLeft: theme.spacing.xs,
    marginTop: 4,
  },
  separator: {
    height: 1,
    marginTop: 0,
    marginBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  footer: {
    padding: theme.spacing.lg,
  },
  contentContainer: {
    paddingTop: theme.spacing.sm, // Add some top padding to ensure proper spacing
    paddingHorizontal: 2, // Give more breathing room from screen edge (4px rhythm adjustment)
  },
  scrollTopButtonContainer: {
    position: 'absolute',
    top: theme.spacing.lg,
    alignSelf: 'center',
    zIndex: 1000,
  },
  scrollTopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    gap: theme.spacing.xs,
    elevation: 8,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  scrollTopText: {
    color: theme.colors.background,
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.bold,
    letterSpacing: 1,
  },
});

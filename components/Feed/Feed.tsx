import React from "react";
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  ViewToken,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../ui/text";
import { PostCard } from "./PostCard";
import { ActivityIndicator } from "react-native";
import { useAuth } from "~/lib/auth-provider";
import { useFeedFilter } from "~/lib/FeedFilterContext";
import { useSnaps } from "~/lib/hooks/useSnaps";
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

function FeedContent({ refreshTrigger, onRefresh }: FeedProps) {
  const { filter } = useFeedFilter();
  const { isScrollLocked } = useScrollLock();
  const router = useRouter();
  const { username, mutedList, blacklistedList } = useAuth();
  const { comments, isLoading, loadNextPage, hasMore, refresh } = useSnaps(filter, username);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const { updateVisibleItems } = useViewportTracker();
  const { badgeCount } = useNotificationContext();

  const flatListRef = React.useRef<FlatList>(null);
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
  const feedData: Discussion[] = comments as unknown as Discussion[];

  // Filter out posts from muted and blacklisted users
  const filteredFeedData = React.useMemo(() => {
    if (!feedData || feedData.length === 0) return [];

    return feedData.filter((post) => {
      // Don't filter out the user's own posts
      if (post.author === username) return true;

      // Filter out muted and blacklisted users
      return (
        !mutedList.includes(post.author) &&
        !blacklistedList.includes(post.author)
      );
    });
  }, [feedData, mutedList, blacklistedList, username]);

  const renderItem = React.useCallback(
    ({ item }: { item: Discussion }) => (
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
    (item: Discussion) => item.permlink,
    []
  );

  const ItemSeparatorComponent = React.useCallback(
    () => <View style={styles.separator} />,
    []
  );

  const ListHeaderComponent = React.useCallback(
    () => <View style={{ height: theme.spacing.md }} />,
    []
  );

  const ListFooterComponent = isLoading ? (
    <View style={styles.footer}>
      <ActivityIndicator size="large" color={theme.colors.text} />
    </View>
  ) : null;

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={filteredFeedData}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isScrollLocked}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeaderComponent}
        ItemSeparatorComponent={ItemSeparatorComponent}
        ListFooterComponent={ListFooterComponent}
        contentContainerStyle={styles.contentContainer}
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
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      />

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
    paddingHorizontal: theme.spacing.md, // Add horizontal padding for content
  },
});

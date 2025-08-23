import React from 'react';
import { View, FlatList, StyleSheet, RefreshControl, ViewToken } from 'react-native';
import { Text } from '../ui/text';
import { PostCard } from './PostCard';
import { ActivityIndicator } from 'react-native';
import { useAuth } from '~/lib/auth-provider';
import { useSnaps } from '~/lib/hooks/useSnaps';
import { theme } from '~/lib/theme';
import { ViewportTrackerProvider, useViewportTracker } from '~/lib/ViewportTracker';
import type { Discussion } from '@hiveio/dhive';

interface FeedProps {
  refreshTrigger?: number;
}

function FeedContent({ refreshTrigger }: FeedProps) {
  const { username } = useAuth();
  const { comments, isLoading, loadNextPage, hasMore, refresh } = useSnaps();
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const { updateVisibleItems } = useViewportTracker();

  // Handle pull-to-refresh
  const handleRefresh = React.useCallback(async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  }, [refresh]);

  // Handle viewable items change for video autoplay
  const onViewableItemsChanged = React.useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const visiblePermlinks = viewableItems
        .filter(item => item.isViewable && item.item)
        .map(item => (item.item as Discussion).permlink);
      updateVisibleItems(visiblePermlinks);
    },
    [updateVisibleItems]
  );

  // Viewability config - item is considered viewable when 60% is visible
  const viewabilityConfig = React.useMemo(() => ({
    viewAreaCoveragePercentThreshold: 60,
    minimumViewTime: 100,
  }), []);

  // Map blockchain comments (Discussion) to Post for PostCard compatibility
  const feedData: Discussion[] = comments as unknown as Discussion[];

  const renderItem = React.useCallback(({ item }: { item: Discussion }) => (
    <PostCard key={item.permlink} post={item} currentUsername={username || ''} />
  ), [username]);

  const keyExtractor = React.useCallback((item: Discussion) => item.permlink, []);

  const ItemSeparatorComponent = React.useCallback(() => (
    <View style={styles.separator} />
  ), []);

  const ListHeaderComponent = React.useCallback(() => (
    <View style={styles.header}>
      <Text style={styles.headerText}>Feed</Text>
    </View>
  ), []);

  const ListFooterComponent = isLoading ? (
    <View style={styles.footer}>
      <ActivityIndicator size="large" color={theme.colors.text} />
    </View>
  ) : null;

  return (
    <View style={styles.container}>
      <FlatList
        data={feedData}
        showsVerticalScrollIndicator={false}
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

export function Feed(props: FeedProps) {
  return (
    <ViewportTrackerProvider>
      <FeedContent {...props} />
    </ViewportTrackerProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    marginBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md, // Add horizontal padding back to header
    paddingTop: theme.spacing.xxs, // Add top padding to prevent text cutoff
  },
  headerText: {
    fontSize: theme.fontSizes.xxxl,
    fontWeight: 'bold',
    color: theme.colors.text,
    lineHeight: 40, // 32 + 8 for proper line height to prevent cutoff
    fontFamily: theme.fonts.bold,
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

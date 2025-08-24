import React from 'react';
import { View, FlatList, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { useNotifications } from '~/lib/hooks/useNotifications';
import { NotificationItem } from './NotificationItem';
import { Text } from '../ui/text';
import { Button } from '../ui/button';
import { theme } from '~/lib/theme';
import { useAuth } from '~/lib/auth-provider';
import { useToast } from '~/lib/toast-provider';
import type { HiveNotification } from '~/lib/types';

export const NotificationsScreen = React.memo(() => {
  const { username } = useAuth();
  const { showToast } = useToast();
  const {
    notifications,
    isLoading,
    isLoadingMore,
    error,
    unreadCount,
    hasMore,
    refresh,
    loadMore,
    markAsRead,
  } = useNotifications();

  const handleMarkAsRead = async () => {
    if (unreadCount === 0) return;
    
    try {
      await markAsRead();
      showToast('Notifications marked as read', 'success');
    } catch (error) {
      showToast('Failed to mark notifications as read', 'error');
    }
  };

  const handleLoadMore = () => {
    if (hasMore && !isLoadingMore) {
      loadMore();
    }
  };

  const renderFooter = () => {
    if (!isLoadingMore) return null;
    
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={theme.colors.green} />
        <Text style={styles.loadingText}>Loading more...</Text>
      </View>
    );
  };

  const renderEmptyState = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={theme.colors.green} />
          <Text style={styles.emptyText}>Loading notifications...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Failed to load notifications</Text>
          <Button onPress={refresh} variant="outline" size="sm">
            <Text style={styles.buttonText}>Try Again</Text>
          </Button>
        </View>
      );
    }

    if (username === 'SPECTATOR') {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            Please log in to view notifications
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          No notifications yet
        </Text>
        <Text style={styles.emptySubtext}>
          You'll see votes, comments, and mentions here
        </Text>
      </View>
    );
  };

  const renderHeader = () => {
    if (notifications.length === 0) return null;

    return (
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          Notifications
        </Text>
        {unreadCount > 0 && (
          <Button 
            onPress={handleMarkAsRead}
            variant="outline"
            size="sm"
          >
            <Text style={styles.buttonText}>Mark All Read</Text>
          </Button>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={notifications}
        keyExtractor={(item, index) => `notification-${item.id}-${index}`}
        renderItem={({ item }) => <NotificationItem notification={item} />}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderFooter}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.1}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refresh}
            tintColor={theme.colors.green}
            colors={[theme.colors.green]}
          />
        }
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  contentContainer: {
    padding: theme.spacing.md,
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: theme.fontSizes.lg,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  emptyText: {
    fontSize: theme.fontSizes.md,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
    fontFamily: theme.fonts.regular,
  },
  emptySubtext: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.muted,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  buttonText: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  loadingText: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.muted,
    fontFamily: theme.fonts.regular,
  },
});

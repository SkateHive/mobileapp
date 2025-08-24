import { useState, useEffect, useCallback } from 'react';
import { fetchAllNotifications, fetchNewNotifications, markNotificationsAsRead, HiveNotification } from '../hive-utils';
import { useAuth } from '../auth-provider';

export function useNotifications() {
  const { session, username } = useAuth();
  const [notifications, setNotifications] = useState<HiveNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<number>(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchNotifications = useCallback(async (refresh: boolean = false) => {
    if (!username || username === 'SPECTATOR') {
      setNotifications([]);
      return;
    }

    try {
      if (refresh) {
        setIsLoading(true);
        setNotifications([]);
        setHasMore(true);
      }
      
      setError(null);
      const allNotifications = await fetchAllNotifications(username, 50); // Start with 50 notifications
      setNotifications(allNotifications);
      setLastRefresh(Date.now());
      
      // If we got less than 50, there might not be more
      if (allNotifications.length < 50) {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications');
    } finally {
      setIsLoading(false);
    }
  }, [username]);

  const loadMoreNotifications = useCallback(async () => {
    if (!username || username === 'SPECTATOR' || isLoadingMore || !hasMore) {
      return;
    }

    try {
      setIsLoadingMore(true);
      setError(null);
      
      // Get the last notification ID for pagination
      const lastId = notifications.length > 0 ? notifications[notifications.length - 1].id : undefined;
      const moreNotifications = await fetchAllNotifications(username, 50, lastId);
      
      if (moreNotifications.length === 0) {
        setHasMore(false);
      } else {
        // Filter out duplicates (in case of overlap)
        const existingIds = new Set(notifications.map(n => n.id));
        const newNotifications = moreNotifications.filter(n => !existingIds.has(n.id));
        
        setNotifications(prev => [...prev, ...newNotifications]);
        
        if (newNotifications.length < 50) {
          setHasMore(false);
        }
      }
    } catch (err) {
      console.error('Error loading more notifications:', err);
      setError(err instanceof Error ? err.message : 'Failed to load more notifications');
    } finally {
      setIsLoadingMore(false);
    }
  }, [username, notifications, isLoadingMore, hasMore]);

  const markAsRead = useCallback(async () => {
    if (!session || !session.decryptedKey || username === 'SPECTATOR') {
      return;
    }

    try {
      await markNotificationsAsRead(session.decryptedKey, username!);
      
      // Update all notifications to be marked as read
      setNotifications(prev => prev.map(notification => ({
        ...notification,
        isRead: true
      })));
    } catch (err) {
      console.error('Error marking notifications as read:', err);
      throw new Error('Failed to mark notifications as read');
    }
  }, [session, username]);

  // Fetch notifications on mount and when username changes
  useEffect(() => {
    fetchNotifications(true);
  }, [fetchNotifications]);

  // Auto-refresh notifications every 2 minutes (only the first page to check for new ones)
  useEffect(() => {
    if (!username || username === 'SPECTATOR') return;

    const interval = setInterval(() => {
      // Only refresh if we're not loading more to avoid conflicts
      if (!isLoadingMore) {
        fetchNotifications(true);
      }
    }, 120000); // 2 minutes

    return () => clearInterval(interval);
  }, [fetchNotifications, username, isLoadingMore]);

  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.isRead).length;

  return {
    notifications,
    isLoading,
    isLoadingMore,
    error,
    unreadCount,
    hasMore,
    refresh: () => fetchNotifications(true),
    loadMore: loadMoreNotifications,
    markAsRead,
    lastRefresh,
  };
}

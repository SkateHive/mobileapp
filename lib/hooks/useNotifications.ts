import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAllNotifications, fetchNewNotifications, markNotificationsAsRead, HiveNotification } from '../hive-utils';
import { useAuth } from '../auth-provider';

export function useNotifications(disableAutoRefresh: boolean = false) {
  const { session, username } = useAuth();
  const [notifications, setNotifications] = useState<HiveNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Ref so the interval callback always reads the latest value without causing interval recreation
  const isLoadingMoreRef = useRef(false);
  // Switching accounts leaves the previous request in flight. Without this, its
  // response lands after the new account's state was cleared and the old
  // account's notifications appear under the new one. Same guard the badge
  // count in notifications-context already uses.
  const requestIdRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<number>(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchNotifications = useCallback(async (refresh: boolean = false) => {
    const requestId = ++requestIdRef.current;
    // Email (userbase) accounts may have no on-chain Hive account yet → skip.
    if (!username || username === 'SPECTATOR' || session?.kind === 'userbase') {
      setNotifications([]);
      // Say so, or the list stays armed for a next page that cannot exist and
      // the first scroll asks Hive about a handle it has never heard of (#61).
      setHasMore(false);
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
      if (requestId !== requestIdRef.current) return;
      setNotifications(allNotifications);
      setLastRefresh(Date.now());
      
      // If we got less than 50, there might not be more
      if (allNotifications.length < 50) {
        setHasMore(false);
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      console.error('Error fetching notifications:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications');
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [username, session?.kind]);

  const loadMoreNotifications = useCallback(async () => {
    if (
      !username ||
      username === 'SPECTATOR' ||
      session?.kind === 'userbase' ||
      isLoadingMore ||
      !hasMore
    ) {
      return;
    }

    const requestId = ++requestIdRef.current;
    try {
      isLoadingMoreRef.current = true;
      setIsLoadingMore(true);
      setError(null);
      
      // Get the last notification ID for pagination
      const lastId = notifications.length > 0 ? notifications[notifications.length - 1].id : undefined;
      const moreNotifications = await fetchAllNotifications(username, 50, lastId);
      if (requestId !== requestIdRef.current) return;

      if (moreNotifications.length === 0) {
        setHasMore(false);
      } else {
        // Filter out duplicates (in case of overlap)
        const existingIds = new Set(notifications.map(n => n.id));
        const newNotifications = moreNotifications.filter(n => !existingIds.has(n.id));
        
        setNotifications(prev => {
          const updated = [...prev, ...newNotifications];
          // Cap to 200 items to prevent unbounded memory growth on mobile
          return updated.length > 200 ? updated.slice(-200) : updated;
        });

        if (newNotifications.length < 50) {
          setHasMore(false);
        }
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      console.error('Error loading more notifications:', err);
      setError(err instanceof Error ? err.message : 'Failed to load more notifications');
    } finally {
      if (requestId === requestIdRef.current) {
        isLoadingMoreRef.current = false;
        setIsLoadingMore(false);
      }
    }
  }, [username, session?.kind, notifications, isLoadingMore, hasMore]);

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
  // Disabled when disableAutoRefresh is true (e.g., when on notifications screen).
  // Uses isLoadingMoreRef to avoid recreating the interval when loading state changes.
  useEffect(() => {
    if (!username || username === 'SPECTATOR' || disableAutoRefresh) return;

    const interval = setInterval(() => {
      if (!isLoadingMoreRef.current) {
        fetchNotifications(true);
      }
    }, 120000); // 2 minutes

    return () => clearInterval(interval);
  }, [fetchNotifications, username, disableAutoRefresh]);

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

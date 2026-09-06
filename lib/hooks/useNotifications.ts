import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { fetchAllNotifications, markNotificationsAsRead } from '../hive-utils';
import { useAuth } from '../auth-provider';
import { isUserbaseSession } from '../posting';
import {
  getUserbaseNotifications,
  markUserbaseNotificationsRead,
  type UserbaseNotification,
} from '../userbase/api';
import { isUnreadNotification, mergeNotifications } from '../notifications/merge';
import type { HiveNotification } from '../types';

export function useNotifications(disableAutoRefresh: boolean = false) {
  const { session, username } = useAuth();
  const userbase = isUserbaseSession(session);
  const [hiveNotifications, setHiveNotifications] = useState<HiveNotification[]>([]);
  // Instagram curation-queue notifications (crosspost_queued/_rejected/_published/_failed).
  // Fetched once per refresh, not paginated — see loadMoreNotifications.
  const [crosspostNotifications, setCrosspostNotifications] = useState<UserbaseNotification[]>([]);
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
  // Only the Hive side paginates by last_id today; a userbase account has far
  // fewer curation-queue rows than a busy Hive account has votes/comments, so
  // one page of 50 covers it and "load more" only extends the Hive list.
  const [hasMore, setHasMore] = useState(true);

  const fetchNotifications = useCallback(async (refresh: boolean = false) => {
    const requestId = ++requestIdRef.current;
    if (!username || username === 'SPECTATOR') {
      setHiveNotifications([]);
      setCrosspostNotifications([]);
      // Say so, or the list stays armed for a next page that cannot exist and
      // the first scroll asks Hive about a handle it has never heard of (#61).
      setHasMore(false);
      return;
    }

    try {
      if (refresh) {
        setIsLoading(true);
        setHiveNotifications([]);
        setCrosspostNotifications([]);
        setHasMore(true);
      }

      setError(null);

      // Email (userbase) accounts may have no on-chain Hive account yet, so
      // the Hive side stays skipped for them, same as before (#61) — they get
      // the curation-queue notifications instead. A key-only session has no
      // bearer token, so it skips the curation-queue side.
      const [hiveResult, crosspostResult] = await Promise.all([
        userbase ? Promise.resolve<HiveNotification[]>([]) : fetchAllNotifications(username, 50),
        userbase && session?.userbaseToken
          ? getUserbaseNotifications(session.userbaseToken, { limit: 50 })
              .then((r) => r.notifications ?? [])
              .catch(() => [] as UserbaseNotification[])
          : Promise.resolve<UserbaseNotification[]>([]),
      ]);
      if (requestId !== requestIdRef.current) return;
      setHiveNotifications(hiveResult);
      setCrosspostNotifications(crosspostResult);
      setLastRefresh(Date.now());

      // If Hive gave us less than a full page, there might not be more (the
      // curation-queue side never paginates further regardless).
      if (hiveResult.length < 50) {
        setHasMore(false);
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      console.error('Error fetching notifications:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications');
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [username, userbase, session?.userbaseToken]);

  const loadMoreNotifications = useCallback(async () => {
    if (!username || username === 'SPECTATOR' || userbase || isLoadingMore || !hasMore) {
      return;
    }

    const requestId = ++requestIdRef.current;
    try {
      isLoadingMoreRef.current = true;
      setIsLoadingMore(true);
      setError(null);

      // Get the last notification ID for pagination
      const lastId = hiveNotifications.length > 0 ? hiveNotifications[hiveNotifications.length - 1].id : undefined;
      const moreNotifications = await fetchAllNotifications(username, 50, lastId);
      if (requestId !== requestIdRef.current) return;

      if (moreNotifications.length === 0) {
        setHasMore(false);
      } else {
        // Filter out duplicates (in case of overlap)
        const existingIds = new Set(hiveNotifications.map(n => n.id));
        const newNotifications = moreNotifications.filter(n => !existingIds.has(n.id));

        setHiveNotifications(prev => {
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
  }, [username, userbase, hiveNotifications, isLoadingMore, hasMore]);

  const markAsRead = useCallback(async () => {
    if (username === 'SPECTATOR') return;

    try {
      if (session?.decryptedKey) {
        await markNotificationsAsRead(session.decryptedKey, username!);
        setHiveNotifications(prev => prev.map(notification => ({ ...notification, isRead: true })));
      }

      if (userbase && session?.userbaseToken) {
        const unreadIds = crosspostNotifications.filter(n => n.read_at === null).map(n => n.id);
        if (unreadIds.length > 0) {
          // Own try/catch: a 404 (route not deployed yet) or network error here
          // must not stop the Hive mark-read above from having completed, and
          // must not surface as a failure toast for something the user didn't
          // even see fail.
          try {
            await markUserbaseNotificationsRead(session.userbaseToken, unreadIds);
            const now = new Date().toISOString();
            setCrosspostNotifications(prev =>
              prev.map(n => (n.read_at === null ? { ...n, read_at: now } : n))
            );
          } catch (err) {
            console.warn('Error marking curation-queue notifications as read:', err);
          }
        }
      }
    } catch (err) {
      console.error('Error marking notifications as read:', err);
      throw new Error('Failed to mark notifications as read');
    }
  }, [session, username, userbase, crosspostNotifications]);

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

  const notifications = useMemo(
    () => mergeNotifications(hiveNotifications, crosspostNotifications),
    [hiveNotifications, crosspostNotifications]
  );

  // Calculate unread count
  const unreadCount = notifications.filter(isUnreadNotification).length;

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

import { useState, useEffect, useCallback } from 'react';
import { fetchNewNotifications } from '../hive-utils';
import { useAuth } from '../auth-provider';

/**
 * Hook specifically for notification badge count that updates independently
 * of the main notifications screen to avoid refreshing when user is viewing notifications
 */
export function useNotificationBadge() {
  const { username } = useAuth();
  const [badgeCount, setBadgeCount] = useState(0);

  const updateBadgeCount = useCallback(async () => {
    if (!username || username === 'SPECTATOR') {
      setBadgeCount(0);
      return;
    }

    try {
      const newNotifications = await fetchNewNotifications(username);
      setBadgeCount(newNotifications.length);
    } catch (error) {
      console.error('Error fetching notification badge count:', error);
      // Don't reset count on error to avoid flickering
    }
  }, [username]);

  // Update badge count on mount and when username changes
  useEffect(() => {
    updateBadgeCount();
  }, [updateBadgeCount]);

  // Auto-refresh badge count every 2 minutes
  useEffect(() => {
    if (!username || username === 'SPECTATOR') return;

    const interval = setInterval(() => {
      updateBadgeCount();
    }, 120000); // 2 minutes

    return () => clearInterval(interval);
  }, [updateBadgeCount, username]);

  return {
    badgeCount,
    refreshBadge: updateBadgeCount,
    clearBadge: () => setBadgeCount(0),
  };
}

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { fetchNewNotifications } from './hive-utils';
import { useAuth } from './auth-provider';

interface NotificationContextType {
  badgeCount: number;
  refreshBadge: () => Promise<void>;
  clearBadge: () => void;
  onNotificationsMarkedAsRead: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: React.ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const { username } = useAuth();
  const [badgeCount, setBadgeCount] = useState(0);
  const [lastMarkedReadTimestamp, setLastMarkedReadTimestamp] = useState(0);

  const updateBadgeCount = useCallback(async () => {
    if (!username || username === 'SPECTATOR') {
      setBadgeCount(0);
      return;
    }

    // Ignore API fetches for 20 seconds after marking as read to allow Hive indexers to catch up
    // This prevents the badge from popping back up with old unread notifications before the blockchain clears them.
    if (Date.now() - lastMarkedReadTimestamp < 20000) {
      return;
    }

    try {
      const newNotifications = await fetchNewNotifications(username);
      setBadgeCount(newNotifications.length);
    } catch (error) {
      console.error('Error fetching notification badge count:', error);
      // Don't reset count on error to avoid flickering
    }
  }, [username, lastMarkedReadTimestamp]);

  const clearBadge = useCallback(() => {
    setBadgeCount(0);
  }, []);

  const onNotificationsMarkedAsRead = useCallback(() => {
    // Immediately clear the badge and block API updates for a few seconds
    setBadgeCount(0);
    setLastMarkedReadTimestamp(Date.now());
  }, []);

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

  const value = {
    badgeCount,
    refreshBadge: updateBadgeCount,
    clearBadge,
    onNotificationsMarkedAsRead,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  return context;
}

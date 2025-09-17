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

  const clearBadge = useCallback(() => {
    setBadgeCount(0);
  }, []);

  const onNotificationsMarkedAsRead = useCallback(() => {
    // Immediately clear the badge
    setBadgeCount(0);
    // Then refresh to make sure it's accurate
    setTimeout(() => {
      updateBadgeCount();
    }, 1000); // Wait 1 second for the mark as read operation to complete on blockchain
  }, [updateBadgeCount]);

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

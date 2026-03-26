import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
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
  const markedAsReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    // Clear any pending timer before setting a new one
    if (markedAsReadTimerRef.current) {
      clearTimeout(markedAsReadTimerRef.current);
    }
    // Then refresh to make sure it's accurate
    markedAsReadTimerRef.current = setTimeout(() => {
      markedAsReadTimerRef.current = null;
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

  // Cleanup pending timers on unmount
  useEffect(() => {
    return () => {
      if (markedAsReadTimerRef.current) {
        clearTimeout(markedAsReadTimerRef.current);
      }
    };
  }, []);

  const value = useMemo(() => ({
    badgeCount,
    refreshBadge: updateBadgeCount,
    clearBadge,
    onNotificationsMarkedAsRead,
  }), [badgeCount, updateBadgeCount, clearBadge, onNotificationsMarkedAsRead]);

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

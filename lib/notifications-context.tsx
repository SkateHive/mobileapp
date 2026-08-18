import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
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
  const { username, session } = useAuth();
  const [badgeCount, setBadgeCount] = useState(0);
  // Bumped whenever the count is set locally, so a fetch that was already in
  // flight can't land afterwards with the pre-clear result.
  const requestIdRef = useRef(0);
  // Changing this restarts the periodic refresh below.
  const [refreshCycle, setRefreshCycle] = useState(0);

  const updateBadgeCount = useCallback(async () => {
    const currentRequestId = ++requestIdRef.current;

    // Email (userbase) accounts may have no on-chain Hive account yet → skip.
    if (!username || username === 'SPECTATOR' || session?.kind === 'userbase') {
      setBadgeCount(0);
      return;
    }

    try {
      const newNotifications = await fetchNewNotifications(username);
      if (currentRequestId !== requestIdRef.current) return;
      setBadgeCount(newNotifications.length);
    } catch (error) {
      console.error('Error fetching notification badge count:', error);
      // Don't reset count on error to avoid flickering
    }
  }, [username, session?.kind]);

  const clearBadge = useCallback(() => {
    requestIdRef.current += 1;
    setBadgeCount(0);
  }, []);

  // Marking as read broadcasts a transaction, and Hive only produces a block every
  // ~3s — so re-querying right after would read the pre-mark state and put the
  // count straight back. Clear locally and let the periodic refresh below
  // reconcile once the chain has caught up.
  const onNotificationsMarkedAsRead = useCallback(() => {
    requestIdRef.current += 1;
    setBadgeCount(0);
    // Restart the refresh cycle too. The generation guard only discards requests
    // that were already in flight; a periodic refresh firing in the seconds right
    // after would be a new request, and would read the chain before the block
    // carrying the read is produced. Restarting puts the next one two minutes out.
    setRefreshCycle((c) => c + 1);
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
  }, [updateBadgeCount, username, refreshCycle]);

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

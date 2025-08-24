import React, { createContext, useContext, useCallback } from 'react';
import { useNotifications } from './hooks/useNotifications';

interface NotificationsContextType {
  triggerRefresh: () => void;
  unreadCount: number;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { refresh, unreadCount } = useNotifications();

  const triggerRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  return (
    <NotificationsContext.Provider value={{ triggerRefresh, unreadCount }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotificationsContext() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotificationsContext must be used within a NotificationsProvider');
  }
  return context;
}

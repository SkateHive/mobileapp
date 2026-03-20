import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface ViewportTrackerContextType {
  visibleItems: Set<string>;
  prefetchItems: Set<string>;
  registerItem: (id: string) => void;
  unregisterItem: (id: string) => void;
  updateVisibleItems: (items: string[]) => void;
  updatePrefetchItems: (items: string[]) => void;
  isItemVisible: (id: string) => boolean;
  isItemPrefetch: (id: string) => boolean;
}

const ViewportTrackerContext = createContext<ViewportTrackerContextType | undefined>(undefined);

interface ViewportTrackerProviderProps {
  children: ReactNode;
}

export function ViewportTrackerProvider({ children }: ViewportTrackerProviderProps) {
  const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set());
  const [prefetchItems, setPrefetchItems] = useState<Set<string>>(new Set());

  const registerItem = useCallback((id: string) => {
    // Items are registered but visibility is controlled by updateVisibleItems
  }, []);

  const unregisterItem = useCallback((id: string) => {
    setVisibleItems(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
    setPrefetchItems(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  }, []);

  const updateVisibleItems = useCallback((items: string[]) => {
    setVisibleItems(new Set(items));
  }, []);

  const updatePrefetchItems = useCallback((items: string[]) => {
    setPrefetchItems(new Set(items));
  }, []);

  const isItemVisible = useCallback((id: string) => {
    return visibleItems.has(id);
  }, [visibleItems]);

  const isItemPrefetch = useCallback((id: string) => {
    return prefetchItems.has(id);
  }, [prefetchItems]);

  const value = {
    visibleItems,
    prefetchItems,
    registerItem,
    unregisterItem,
    updateVisibleItems,
    updatePrefetchItems,
    isItemVisible,
    isItemPrefetch,
  };

  return (
    <ViewportTrackerContext.Provider value={value}>
      {children}
    </ViewportTrackerContext.Provider>
  );
}

export function useViewportTracker() {
  const context = useContext(ViewportTrackerContext);
  if (context === undefined) {
    throw new Error('useViewportTracker must be used within a ViewportTrackerProvider');
  }
  return context;
}

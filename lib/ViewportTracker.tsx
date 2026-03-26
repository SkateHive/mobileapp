import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface ViewportTrackerContextType {
  visibleItems: Set<string>;
  registerItem: (id: string) => void;
  unregisterItem: (id: string) => void;
  updateVisibleItems: (items: string[]) => void;
  isItemVisible: (id: string) => boolean;
}

const ViewportTrackerContext = createContext<ViewportTrackerContextType | undefined>(undefined);

interface ViewportTrackerProviderProps {
  children: ReactNode;
}

export function ViewportTrackerProvider({ children }: ViewportTrackerProviderProps) {
  const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set());

  const registerItem = useCallback((id: string) => {
    // Items are registered but visibility is controlled by updateVisibleItems
  }, []);

  const unregisterItem = useCallback((id: string) => {
    setVisibleItems(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  }, []);

  const updateVisibleItems = useCallback((items: string[]) => {
    setVisibleItems(new Set(items));
  }, []);

  const isItemVisible = useCallback((id: string) => {
    return visibleItems.has(id);
  }, [visibleItems]);

  const value = {
    visibleItems,
    registerItem,
    unregisterItem,
    updateVisibleItems,
    isItemVisible,
  };

  return (
    <ViewportTrackerContext.Provider value={value}>
      {children}
    </ViewportTrackerContext.Provider>
  );
}

// Safe fallback when used outside a provider — treats all items as visible
const fallbackContext: ViewportTrackerContextType = {
  visibleItems: new Set(),
  registerItem: () => {},
  unregisterItem: () => {},
  updateVisibleItems: () => {},
  isItemVisible: () => true, // Default to visible when no provider
};

export function useViewportTracker() {
  const context = useContext(ViewportTrackerContext);
  return context ?? fallbackContext;
}

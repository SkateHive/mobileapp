import React, { createContext, useContext, useState } from 'react';

export type FeedFilterType = 'Recent' | 'Following' | 'Curated' | 'Trending';

interface FeedFilterContextType {
  filter: FeedFilterType;
  setFilter: (filter: FeedFilterType) => void;
}

const FeedFilterContext = createContext<FeedFilterContextType | undefined>(undefined);

export function FeedFilterProvider({ children }: { children: React.ReactNode }) {
  const [filter, setFilter] = useState<FeedFilterType>('Recent');

  return (
    <FeedFilterContext.Provider value={{ filter, setFilter }}>
      {children}
    </FeedFilterContext.Provider>
  );
}

export function useFeedFilter() {
  const context = useContext(FeedFilterContext);
  if (context === undefined) {
    throw new Error('useFeedFilter must be used within a FeedFilterProvider');
  }
  return context;
}

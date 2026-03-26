import React, { createContext, useContext, useState, useCallback } from 'react';

type ScrollDirection = 'up' | 'down' | 'idle';

interface ScrollDirectionContextType {
  scrollDirection: ScrollDirection;
  setScrollDirection: (direction: ScrollDirection) => void;
}

const ScrollDirectionContext = createContext<ScrollDirectionContextType | undefined>(undefined);

export function ScrollDirectionProvider({ children }: { children: React.ReactNode }) {
  const [scrollDirection, setDirection] = useState<ScrollDirection>('idle');

  const setScrollDirection = useCallback((direction: ScrollDirection) => {
    setDirection(direction);
  }, []);

  return (
    <ScrollDirectionContext.Provider value={{ scrollDirection, setScrollDirection }}>
      {children}
    </ScrollDirectionContext.Provider>
  );
}

export function useScrollDirection() {
  const context = useContext(ScrollDirectionContext);
  if (context === undefined) {
    throw new Error('useScrollDirection must be used within a ScrollDirectionProvider');
  }
  return context;
}

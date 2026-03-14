import React, { createContext, useState, useContext, ReactNode } from 'react';

interface ScrollLockContextType {
  isScrollLocked: boolean;
  setScrollLocked: (locked: boolean) => void;
}

const ScrollLockContext = createContext<ScrollLockContextType | undefined>(undefined);

export const ScrollLockProvider = ({ children }: { children: ReactNode }) => {
  const [isScrollLocked, setScrollLocked] = useState(false);

  return (
    <ScrollLockContext.Provider value={{ isScrollLocked, setScrollLocked }}>
      {children}
    </ScrollLockContext.Provider>
  );
};

export const useScrollLock = () => {
  const context = useContext(ScrollLockContext);
  if (context === undefined) {
    throw new Error('useScrollLock must be used within a ScrollLockProvider');
  }
  return context;
};

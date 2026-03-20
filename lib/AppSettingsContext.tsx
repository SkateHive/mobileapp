import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';

const SETTINGS_KEY = 'app_settings';

export interface AppSettings {
  useVoteSlider: boolean; // true = slider, false = preset buttons
  stance: 'regular' | 'goofy';
  isWalletUnlocked: boolean;
  isAdvancedWallet: boolean;
  sessionDuration: number; // minutes: 0 (Auto), 5, 60, 480, 1440
  initialScreen: 'videos' | 'feed';
  isColorsUnlocked: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  useVoteSlider: true,
  stance: 'regular',
  isWalletUnlocked: false,
  isAdvancedWallet: true,
  isColorsUnlocked: false,
  sessionDuration: 1440,
  initialScreen: 'videos',
};

interface AppSettingsContextType {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
}

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

export const AppSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // Load settings on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(SETTINGS_KEY);
        if (stored) {
          setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    })();
  }, []);

  const updateSettings = (updates: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...updates };
      SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(next)).catch(console.error);
      return next;
    });
  };

  return (
    <AppSettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </AppSettingsContext.Provider>
  );
};

export const useAppSettings = () => {
  const context = useContext(AppSettingsContext);
  if (context === undefined) {
    throw new Error('useAppSettings must be used within an AppSettingsProvider');
  }
  return context;
};

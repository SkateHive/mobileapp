import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { VideoConfig } from './config/VideoConfig';

const SETTINGS_KEY = 'app_settings';

export interface AppSettings {
  useVoteSlider: boolean; // true = slider, false = preset buttons
  stance: 'regular' | 'goofy';
  isWalletUnlocked: boolean;
  isAdvancedWallet: boolean;
  sessionDuration: number; // minutes: 0 (Auto), 5, 60, 480, 1440
  initialScreen: 'videos' | 'feed';
  isColorsUnlocked: boolean;
  theme: 'skatehive' | 'matrix';
  videoMuted: boolean;
  videoAutoPlay: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  useVoteSlider: true,
  stance: 'regular',
  isWalletUnlocked: false,
  isAdvancedWallet: true,
  isColorsUnlocked: false,
  sessionDuration: 1440,
  initialScreen: 'videos',
  theme: 'skatehive',
  videoMuted: VideoConfig.autoPlayMuted,
  videoAutoPlay: VideoConfig.enableAutoPlay,
};

interface AppSettingsContextType {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  setUserForSettings: (username: string | null) => void;
}

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

export const AppSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [activeUser, setActiveUser] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const getSettingsKey = (username: string | null) => {
    return username && username !== 'SPECTATOR' 
      ? `app_settings_${username}` 
      : 'app_settings';
  };

  const loadSettings = async (username: string | null) => {
    try {
      const stored = await SecureStore.getItemAsync(getSettingsKey(username));
      if (stored) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
      } else {
        // If specific user settings not found, check if we should fallback, 
        // but for now creating fresh default settings is safer to avoid polluting from spectator
        setSettings(DEFAULT_SETTINGS);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      setSettings(DEFAULT_SETTINGS);
    }
  };

  // Load generic settings on initial mount
  useEffect(() => {
    loadSettings(null);
  }, []);

  const setUserForSettings = (username: string | null) => {
    setActiveUser(username);
    loadSettings(username);
  };

  const updateSettings = (updates: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...updates };
      SecureStore.setItemAsync(getSettingsKey(activeUser), JSON.stringify(next)).catch(console.error);
      return next;
    });
  };

  return (
    <AppSettingsContext.Provider value={{ settings, updateSettings, setUserForSettings }}>
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

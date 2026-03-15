import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { STORED_USERS_KEY } from './constants';
import {
  AccountNotFoundError,
  InvalidKeyError,
  InvalidKeyFormatError,
  validate_posting_key
} from './hive-utils';
import {
  EncryptedKey,
  EncryptionMethod,
  AuthSession,
  StoredUser
} from './types';
import {
  storeEncryptedKey,
  getEncryptedKey,
  deleteEncryptedKey,
  encryptKey,
  decryptKey,
  generateSalt,
  deriveKeyFromPin,
  authenticateBiometric
} from './secure-key';
import {
  getUserRelationshipList,
  setUserRelationship
} from './hive-utils';
import { useAppSettings } from './AppSettingsContext';
import { getFollowingList, getFollowersList, getMutedList, getBlacklistedList } from './api';

const SESSION_KEY = 'current_auth_session';

// ============================================================================
// APPLE REVIEW TEST ACCOUNT CONFIGURATION
// ============================================================================
// This is a temporary solution for Apple App Store review process.
// Apple reviewers need a simple password, but HIVE posting keys are too long.
// 
// INSTRUCTIONS:
// 1. Fill in the TEST_USERNAME with the account username
// 2. Fill in the TEST_POSTING_KEY with the actual HIVE posting key
// 3. Fill in the TEST_SIMPLE_PASSWORD with a simple password for Apple reviewers
// 
// HOW IT WORKS:
// - When someone logs in with TEST_USERNAME and TEST_SIMPLE_PASSWORD,
//   the app will internally use TEST_POSTING_KEY for all blockchain operations
// - The reviewer only needs to remember the simple password
// ============================================================================

const TEST_USERNAME: string = 'skatethread';
const TEST_POSTING_KEY: string = '5KPCy8wGKukimMDSu64dA3gUB5Utj5Qm3Vm3yueCzm1MG4Lk3XB'; // posting key is exposed intentionally and will be changed later
const TEST_SIMPLE_PASSWORD: string = '8wGKukim';

// ============================================================================

// Custom error types for authentication
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}


interface AuthContextType {
  isAuthenticated: boolean;
  username: string | null;
  isLoading: boolean;
  storedUsers: StoredUser[];
  session: AuthSession | null;
  followingList: string[];
  mutedList: string[];
  blacklistedList: string[];
  login: (username: string, postingKey: string, method: EncryptionMethod, pin?: string) => Promise<void>;
  loginStoredUser: (username: string, pin?: string) => Promise<void>;
  logout: () => Promise<void>;
  enterSpectatorMode: () => Promise<void>;
  deleteAllStoredUsers: () => Promise<void>;
  deleteStoredUser: (username: string) => Promise<void>;
  resetInactivityTimer: () => void;
  updateUserRelationship: (targetUsername: string, relationship: 'blog' | 'ignore' | 'blacklist' | '') => Promise<boolean>;
  refreshUserRelationships: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);


export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [storedUsers, setStoredUsers] = useState<StoredUser[]>([]);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [followingList, setFollowingList] = useState<string[]>([]);
  const [mutedList, setMutedList] = useState<string[]>([]);
  const [blacklistedList, setBlacklistedList] = useState<string[]>([]);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { settings } = useAppSettings();

  // Delete a single stored user and update state
  const removeStoredUser = async (usernameToRemove: string) => {
    try {
      await deleteEncryptedKey(usernameToRemove);
      const updatedUsers = storedUsers.filter(user => user.username !== usernameToRemove);
      await SecureStore.setItemAsync(STORED_USERS_KEY, JSON.stringify(updatedUsers));
      setStoredUsers(updatedUsers);
      
      if (username === usernameToRemove) {
        setSession(null);
        setUsername(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Error removing stored user:', error);
      throw error;
    }
  };

  // Inactivity timeout based on settings
  const INACTIVITY_TIMEOUT = settings.sessionDuration * 60 * 1000;

  useEffect(() => {
    loadStoredUsers();
    checkCurrentUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset inactivity timer on session change
  useEffect(() => {
    if (session) {
      resetInactivityTimer();
    } else {
      clearInactivityTimer();
    }
  }, [session]);

  // Handle Session persistence settings change
  useEffect(() => {
    if (settings.sessionDuration === 0) {
      // If Auto-lock is enabled, clear any persistent session from storage
      // The current session will stay in memory until the app is closed
      SecureStore.deleteItemAsync(SESSION_KEY).catch(console.error);
    }
  }, [settings.sessionDuration]);

  const resetInactivityTimer = () => {
    // Only reset timer if user is authenticated and has a session
    if (!session || !isAuthenticated || settings.sessionDuration === 0) return;
    
    clearInactivityTimer();
    inactivityTimer.current = setTimeout(() => {
      handleInactivityLogout();
    }, INACTIVITY_TIMEOUT);
  };

  const clearInactivityTimer = () => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
      inactivityTimer.current = null;
    }
  };

  const handleInactivityLogout = async () => {
    await logout();
  };

  // Load user relationship lists (following, muted, blacklisted)
  const refreshUserRelationships = useCallback(async (explicitUsername?: string) => {
    const targetUser = explicitUsername || username;
    
    if (!targetUser || targetUser === 'SPECTATOR') {
      setFollowingList([]);
      setMutedList([]);
      setBlacklistedList([]);
      return;
    }

    // 1. Instantly load from local disk cache to prevent UI flashing
    try {
      const cacheKey = `skatehive_relationships_${targetUser}`;
      const cachedDataStr = await AsyncStorage.getItem(cacheKey);
      
      if (cachedDataStr) {
        const cachedData = JSON.parse(cachedDataStr);
        if (cachedData.following) setFollowingList(cachedData.following);
        if (cachedData.muted) setMutedList(cachedData.muted);
        if (cachedData.blacklisted) setBlacklistedList(cachedData.blacklisted);
        console.log(`[Auth] Loaded cached relationships for @${targetUser}`);
      }
    } catch (cacheError) {
      console.warn(`[Auth] Failed to load relationship cache for @${targetUser}:`, cacheError);
    }

    // 2. Fetch fresh data silently in the background
    try {
      const [following, muted, blacklisted, followers] = await Promise.all([
        getFollowingList(targetUser),
        getMutedList(targetUser),
        getBlacklistedList(targetUser),
        getFollowersList(targetUser),
      ]);
      
      // Update React state
      setFollowingList(following);
      setMutedList(muted);
      setBlacklistedList(blacklisted);
      
      // 3. Save the fresh data back to the disk cache
      try {
        const cacheKey = `skatehive_relationships_${targetUser}`;
        const cacheDataToSave = JSON.stringify({ following, muted, blacklisted });
        await AsyncStorage.setItem(cacheKey, cacheDataToSave);
      } catch (saveError) {
        console.warn(`[Auth] Failed to save relationship cache for @${targetUser}:`, saveError);
      }
      
      console.log(`[Auth] User relationships refreshed & cached for @${targetUser}:`);
      console.log(` - Following: ${following.length} users (${following.slice(0, 5).join(', ')}...)`);
      console.log(` - Muted: ${muted.length} users`);
      console.log(` - Blacklisted: ${blacklisted.length} users`);
    } catch (error) {
      console.error(`[Auth] Error refreshing relationships for @${targetUser}:`, error);
      // Don't throw error, just log it to avoid breaking the app
    }
  }, [username]);

  // Update user relationship and refresh the lists
  const updateUserRelationship = async (
    targetUsername: string,
    relationship: 'blog' | 'ignore' | 'blacklist' | ''
  ): Promise<boolean> => {
    if (!session || !session.username || !session.decryptedKey || session.username === 'SPECTATOR') {
      return false;
    }

    try {
      const success = await setUserRelationship(
        session.decryptedKey,
        session.username,
        targetUsername,
        relationship
      );

      if (success) {
        // Update local state immediately for better UX
        if (relationship === 'blog') {
          setFollowingList(prev => [...prev.filter(u => u !== targetUsername), targetUsername]);
        } else if (relationship === 'ignore') {
          setMutedList(prev => [...prev.filter(u => u !== targetUsername), targetUsername]);
          setFollowingList(prev => prev.filter(u => u !== targetUsername));
        } else if (relationship === 'blacklist') {
          setBlacklistedList(prev => [...prev.filter(u => u !== targetUsername), targetUsername]);
          setFollowingList(prev => prev.filter(u => u !== targetUsername));
        } else if (relationship === '') {
          // Unfollow
          setFollowingList(prev => prev.filter(u => u !== targetUsername));
        }
      }

      return success;
    } catch (error) {
      console.error('Error updating user relationship:', error);
      return false;
    }
  };

  // Load stored users (usernames and methods)
  const loadStoredUsers = async () => {
    try {
      const keys = await SecureStore.getItemAsync(STORED_USERS_KEY);
      let users: StoredUser[] = [];
      if (keys) {
        users = JSON.parse(keys);
        // Clean up invalid entries on load
        const cleanedUsers = users.filter(u => u.username && u.username.trim() !== "");
        if (cleanedUsers.length !== users.length) {
          users = cleanedUsers;
          await SecureStore.setItemAsync(STORED_USERS_KEY, JSON.stringify(users));
        }
      }
      setStoredUsers(users);
    } catch (error) {
      console.error('Error loading stored users:', error);
    }
  };

  // Check if a user is already logged in (restore session)
  const checkCurrentUser = async () => {
    try {
      // Robust check: Verify session duration from storage to avoid race conditions
      // with AppSettingsContext loading.
      const storedSettingsStr = await SecureStore.getItemAsync('app_settings');
      let isAutoLock = false;
      if (storedSettingsStr) {
        const storedSettings = JSON.parse(storedSettingsStr);
        if (storedSettings.sessionDuration === 0) {
          isAutoLock = true;
        }
      }

      if (isAutoLock) {
        // If Auto-lock is enabled, we never restore from SecureStore
        await SecureStore.deleteItemAsync(SESSION_KEY);
        setUsername(null);
        setIsAuthenticated(false);
        setSession(null);
        return;
      }

      const storedSession = await SecureStore.getItemAsync(SESSION_KEY);
      if (storedSession) {
        const parsed: AuthSession & { expiryAt: number } = JSON.parse(storedSession);
        
        // Check if session has expired
        if (parsed.expiryAt > Date.now()) {
          setUsername(parsed.username);
          setSession(parsed);
          setIsAuthenticated(true);
          
          // Refresh relationships in background
          refreshUserRelationships(parsed.username);
          return;
        } else {
          // Session expired, clear it
          await SecureStore.deleteItemAsync(SESSION_KEY);
        }
      }
      
      // No valid session found
      setUsername(null);
      setIsAuthenticated(false);
      setSession(null);
    } catch (error) {
      console.error('Error checking current user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Update stored users list in SecureStore
  const updateStoredUsers = async (user: StoredUser) => {
    if (!user.username || user.username === 'SPECTATOR') return;
    try {
      let users = [...storedUsers];
      users = users.filter(u => u.username !== user.username);
      users.unshift(user);
      setStoredUsers(users);
      await SecureStore.setItemAsync(STORED_USERS_KEY, JSON.stringify(users));
      await SecureStore.setItemAsync('lastLoggedInUser', user.username);
    } catch (error) {
      console.error('Error updating stored users:', error);
    }
  };

  // First login: encrypt and store key
  const login = async (
    username: string,
    postingKey: string,
    method: EncryptionMethod,
    pin?: string
  ) => {
    try {
      const normalizedUsername = username.toLowerCase().trim();
      if (!normalizedUsername || !postingKey) {
        throw new AuthError('Username and posting key are required');
      }

      // ============================================================================
      // APPLE REVIEW TEST ACCOUNT LOGIC
      // ============================================================================
      // Check if this is the Apple test account
      if (TEST_USERNAME && normalizedUsername === TEST_USERNAME.toLowerCase()) {
        // If they're using the simple password, replace it with the real posting key
        if (TEST_SIMPLE_PASSWORD && postingKey === TEST_SIMPLE_PASSWORD) {
          postingKey = TEST_POSTING_KEY;
        }
        // If they're using the posting key directly, that's fine too
        // Continue with normal validation using the posting key
      }
      // ============================================================================

      await validate_posting_key(normalizedUsername, postingKey);

      // Encrypt the key
      let encrypted = '';
      let salt = '';
      let iv = '';
      if (method === 'pin') {
        if (!pin || pin.length !== 6) throw new AuthError('PIN must be 6 digits');
        salt = await generateSalt();
        iv = await generateSalt();
        
        // Small delay to allow UI to update with loading state before expensive operation
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const secret = deriveKeyFromPin(pin, salt);
        encrypted = encryptKey(postingKey, secret, iv);
      } else if (method === 'biometric') {
        const ok = await authenticateBiometric();
        if (!ok) throw new AuthError('Biometric authentication was cancelled or failed');
        
        salt = await generateSalt();
        iv = await generateSalt();
        // Use a device secret for biometric (simulate with salt for now)
        const secret = salt;
        encrypted = encryptKey(postingKey, secret, iv);
      } else {
        throw new AuthError('Invalid encryption method');
      }

      const encryptedKey: EncryptedKey = {
        username: normalizedUsername,
        encrypted,
        method,
        salt,
        iv,
        createdAt: Date.now(),
      };
      
      await storeEncryptedKey(normalizedUsername, encryptedKey);
      
      const user: StoredUser = {
        username: normalizedUsername,
        method,
        createdAt: Date.now(),
      };
      await updateStoredUsers(user);
      const authSession: AuthSession = { 
        username: normalizedUsername, 
        decryptedKey: postingKey, 
        loginTime: Date.now() 
      };
      
      // Store session for persistence (skip if duration is 0 / "Auto")
      if (settings.sessionDuration > 0) {
        const expiryAt = Date.now() + (settings.sessionDuration * 60 * 1000);
        await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify({ ...authSession, expiryAt }));
      }

      setUsername(normalizedUsername);
      setIsAuthenticated(true);
      setSession(authSession);
      
      // Load user relationships after successful login
      refreshUserRelationships(normalizedUsername);
    } catch (error) {
      if (
        error instanceof InvalidKeyFormatError ||
        error instanceof AccountNotFoundError ||
        error instanceof InvalidKeyError ||
        error instanceof AuthError
      ) {
        throw error;
      } else {
        console.error('Error during login:', error);
        throw new AuthError('Failed to authenticate: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    }
  };

  // Login for returning user: decrypt key
  const loginStoredUser = async (selectedUsername: string, pin?: string) => {
    try {
      const encryptedKey = await getEncryptedKey(selectedUsername);
      if (!encryptedKey) throw new AuthError('No stored credentials found');
      
      let decryptedKey = '';
      if (encryptedKey.method === 'pin') {
        if (!pin || pin.length !== 6) throw new AuthError('PIN must be 6 digits');
        
        // Small delay to allow UI to update with loading state before expensive operation
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const secret = deriveKeyFromPin(pin, encryptedKey.salt);
        decryptedKey = decryptKey(encryptedKey.encrypted, secret, encryptedKey.iv);
      } else if (encryptedKey.method === 'biometric') {
        try {
          const ok = await authenticateBiometric();
          if (!ok) throw new AuthError('Biometric authentication was cancelled or failed');
        } catch (bioError) {
          throw new AuthError('Biometric authentication failed: ' + (bioError instanceof Error ? bioError.message : 'Unknown error'));
        }
        
        try {
          const secret = encryptedKey.salt;
          decryptedKey = decryptKey(encryptedKey.encrypted, secret, encryptedKey.iv);
        } catch (decryptError) {
          throw new AuthError('Failed to decrypt stored key: ' + (decryptError instanceof Error ? decryptError.message : 'Unknown error'));
        }
      } else {
        throw new AuthError('Invalid encryption method');
      }
      if (!decryptedKey) {
        // If decryption fails, it might be due to dev/prod encryption mismatch
        // Clear the stored user to force re-login
        await deleteEncryptedKey(selectedUsername);
        throw new AuthError('Stored credentials are incompatible. Please log in again.');
      }
      const authSession: AuthSession = { 
        username: selectedUsername, 
        decryptedKey, 
        loginTime: Date.now() 
      };

      // Store session for persistence (skip if duration is 0 / "Auto")
      if (settings.sessionDuration > 0) {
        const expiryAt = Date.now() + (settings.sessionDuration * 60 * 1000);
        await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify({ ...authSession, expiryAt }));
      }

      setUsername(selectedUsername);
      setIsAuthenticated(true);
      setSession(authSession);
      await updateStoredUsers({ username: selectedUsername, method: encryptedKey.method, createdAt: encryptedKey.createdAt });
      
      // Load user relationships after successful login
      refreshUserRelationships(selectedUsername);
    } catch (error) {
      if (
        error instanceof InvalidKeyFormatError ||
        error instanceof AccountNotFoundError ||
        error instanceof InvalidKeyError ||
        error instanceof AuthError
      ) {
        throw error;
      } else {
        console.error('Error with stored user login:', error);
        throw new AuthError('Failed to authenticate with stored credentials: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    }
  };

  // Logout: clear session and decrypted key
  const logout = async () => {
    try {
      clearInactivityTimer();
      setSession(null);
      setIsAuthenticated(false);
      setUsername(null);
      setFollowingList([]);
      setMutedList([]);
      setBlacklistedList([]);
      await SecureStore.deleteItemAsync(SESSION_KEY);
      await SecureStore.deleteItemAsync('lastLoggedInUser');
    } catch (error) {
      console.error('Error during logout:', error);
      throw error;
    }
  };

  // Spectator mode
  const enterSpectatorMode = async () => {
    try {
      setSession(null);
      setUsername('SPECTATOR');
      setIsAuthenticated(true);
      await SecureStore.setItemAsync('lastLoggedInUser', 'SPECTATOR');
    } catch (error) {
      console.error('Error entering spectator mode:', error);
      throw error;
    }
  };

  // Delete all stored users and keys
  const deleteAllStoredUsers = async () => {
    try {
      for (const user of storedUsers) {
        await deleteEncryptedKey(user.username);
      }
      await SecureStore.deleteItemAsync(STORED_USERS_KEY);
      await SecureStore.deleteItemAsync(SESSION_KEY);
      await SecureStore.deleteItemAsync('lastLoggedInUser');
      setStoredUsers([]);
      setSession(null);
      setUsername(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Error deleting all users:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        username,
        isLoading,
        storedUsers,
        session,
        followingList,
        mutedList,
        blacklistedList,
        login,
        loginStoredUser,
        logout,
        enterSpectatorMode,
        deleteAllStoredUsers,
        deleteStoredUser: removeStoredUser,
        resetInactivityTimer,
        updateUserRelationship,
        refreshUserRelationships,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
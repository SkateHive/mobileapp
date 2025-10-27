import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
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

  // Inactivity timeout (5 minutes)
  const INACTIVITY_TIMEOUT = 60 * 60 * 1000;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const resetInactivityTimer = () => {
    // Only reset timer if user is authenticated and has a session
    if (!session || !isAuthenticated) return;
    
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
  const refreshUserRelationships = async () => {
    if (!username || username === 'SPECTATOR') {
      setFollowingList([]);
      setMutedList([]);
      setBlacklistedList([]);
      return;
    }

    try {
      const [following, muted, blacklisted] = await Promise.all([
        getUserRelationshipList(username, 'blog'),
        getUserRelationshipList(username, 'ignore'),
        getUserRelationshipList(username, 'blacklist'),
      ]);
      
      setFollowingList(following);
      setMutedList(muted);
      setBlacklistedList(blacklisted);
    } catch (error) {
      console.error('Error loading user relationships:', error);
      // Don't throw error, just log it to avoid breaking the app
    }
  };

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
      }
      setStoredUsers(users);
    } catch (error) {
      console.error('Error loading stored users:', error);
    }
  };

  // Check if a user is already logged in (restore session)
  const checkCurrentUser = async () => {
    try {
      // Do not auto-login: always require full login for decrypted key
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
      setUsername(normalizedUsername);
      setIsAuthenticated(true);
      setSession({ username: normalizedUsername, decryptedKey: postingKey, loginTime: Date.now() });
      
      // Load user relationships after successful login
      setTimeout(() => refreshUserRelationships(), 100);
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
      setUsername(selectedUsername);
      setIsAuthenticated(true);
      setSession({ username: selectedUsername, decryptedKey, loginTime: Date.now() });
      await updateStoredUsers({ username: selectedUsername, method: encryptedKey.method, createdAt: encryptedKey.createdAt });
      
      // Load user relationships after successful login
      setTimeout(() => refreshUserRelationships(), 100);
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
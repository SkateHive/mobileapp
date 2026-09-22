import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback } from 'react';
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
} from './hive-utils';
import { canPost, setRelationship } from './posting';
import type { UserbaseUser } from './userbase/api';
import { logout as userbaseLogout } from './userbase/api';
import {
  loadUserbaseSession,
  saveUserbaseSession,
  saveLastEmailAccount,
  saveLastAccountKind,
  clearUserbaseSession,
} from './userbase/session-store';
import {
  saveActiveSession,
  loadActiveSession,
  clearActiveSession,
} from './active-session';

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
  loginWithUserbase: (token: string, user: UserbaseUser, email?: string) => Promise<void>;
  logout: () => Promise<void>;
  enterSpectatorMode: () => Promise<void>;
  deleteAllStoredUsers: () => Promise<void>;
  deleteStoredUser: (username: string) => Promise<void>;
  resetInactivityTimer: () => void;
  updateUserRelationship: (targetUsername: string, relationship: 'blog' | 'ignore' | 'blacklist' | '') => Promise<void>;
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
        await clearActiveSession();
        setSession(null);
        setUsername(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Error removing stored user:', error);
      throw error;
    }
  };

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
    return () => {
      clearInactivityTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Load user relationships whenever a real user logs in (replaces the setTimeout hacks in login/loginStoredUser)
  useEffect(() => {
    if (username && username !== 'SPECTATOR') {
      refreshUserRelationships();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  const resetInactivityTimer = () => {
    // Inactivity auto-logout is disabled: sessions now persist for 30 days
    // (see active-session.ts / checkCurrentUser). Kept as a no-op so existing
    // callers (useActivityDetector) don't need to change. The previous 60-min
    // idle timeout was logging users out — and also wiping the persisted
    // userbase token — which is exactly what we no longer want.
    clearInactivityTimer();
  };

  const clearInactivityTimer = () => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
      inactivityTimer.current = null;
    }
  };

  // Load user relationship lists (following, muted, blacklisted)
  const refreshUserRelationships = async () => {
    // Userbase (email) accounts may not have an on-chain Hive account yet, so
    // skip the relationship RPC (it would error on a non-existent account).
    if (!username || username === 'SPECTATOR' || session?.kind === 'userbase') {
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
  ): Promise<void> => {
    if (!session || !canPost(session)) {
      throw new Error('Please log in first');
    }

    // Routes to the server for email (userbase) accounts, signs locally for
    // classic key accounts. Throws on failure (callers surface the message).
    await setRelationship(session, targetUsername, relationship);

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
      // Userbase (email) sessions are token-based / server-custody, so it's
      // safe to auto-restore them on launch (no local key to decrypt).
      const ub = await loadUserbaseSession();
      if (ub?.token && ub.user) {
        setUsername(ub.user.handle);
        setIsAuthenticated(true);
        setSession({
          username: ub.user.handle,
          decryptedKey: '',
          loginTime: Date.now(),
          kind: 'userbase',
          userbaseToken: ub.token,
        });
        return;
      }
      // Hive-key accounts: restore the cached active session ("stay logged in"
      // for 30 days) so the user isn't forced to re-enter their PIN on every
      // launch — including cold starts from the Home Screen widget. Expired or
      // missing sessions fall through to the logged-out state and re-login.
      const active = await loadActiveSession();
      if (active) {
        setUsername(active.username);
        setIsAuthenticated(true);
        setSession({
          username: active.username,
          decryptedKey: active.decryptedKey,
          loginTime: active.loginTime,
          kind: 'hive',
        });
        return;
      }
      setUsername(null);
      setIsAuthenticated(false);
      setSession(null);
    } catch (error) {
      console.error('Error checking current user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Log in a server-custody email (userbase) account: persist the bearer token
  // and mark the app authenticated. No local posting key (the server signs).
  const loginWithUserbase = async (token: string, user: UserbaseUser, email?: string) => {
    await saveUserbaseSession(token, user);
    // Remembered past logout so the login screen can greet this account by
    // name — no credential involved, just the handle and the address to send
    // the next code to.
    if (email) await saveLastEmailAccount({ handle: user.handle, email });
    await saveLastAccountKind('email');
    setUsername(user.handle);
    setIsAuthenticated(true);
    setSession({
      username: user.handle,
      decryptedKey: '',
      loginTime: Date.now(),
      kind: 'userbase',
      userbaseToken: token,
    });
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
      await saveLastAccountKind('hive');
      const loginTime = Date.now();
      setUsername(normalizedUsername);
      setIsAuthenticated(true);
      setSession({ username: normalizedUsername, decryptedKey: postingKey, loginTime, kind: 'hive' });
      // Cache the active session so the user stays logged in for 30 days.
      await saveActiveSession({ username: normalizedUsername, decryptedKey: postingKey, loginTime });

      // User relationships are loaded by the useEffect that watches username
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
      const loginTime = Date.now();
      setUsername(selectedUsername);
      setIsAuthenticated(true);
      setSession({ username: selectedUsername, decryptedKey, loginTime, kind: 'hive' });
      await updateStoredUsers({ username: selectedUsername, method: encryptedKey.method, createdAt: encryptedKey.createdAt });
      await saveLastAccountKind('hive');
      // Cache the active session so the user stays logged in for 30 days.
      await saveActiveSession({ username: selectedUsername, decryptedKey, loginTime });

      // User relationships are loaded by the useEffect that watches username
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
      // Revoke + clear any userbase (email) session.
      if (session?.kind === 'userbase' && session.userbaseToken) {
        userbaseLogout(session.userbaseToken).catch(() => {});
      }
      await clearUserbaseSession();
      await clearActiveSession();
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
      await clearActiveSession();
      setStoredUsers([]);
      setSession(null);
      setUsername(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Error deleting all users:', error);
      throw error;
    }
  };

  const contextValue = useMemo(() => ({
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
    loginWithUserbase,
    logout,
    enterSpectatorMode,
    deleteAllStoredUsers,
    deleteStoredUser: removeStoredUser,
    resetInactivityTimer,
    updateUserRelationship,
    refreshUserRelationships,
  }), [
    isAuthenticated, username, isLoading, storedUsers, session,
    followingList, mutedList, blacklistedList,
  ]);

  return (
    <AuthContext.Provider value={contextValue}>
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
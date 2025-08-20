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
  login: (username: string, postingKey: string, method: EncryptionMethod, pin?: string) => Promise<void>;
  loginStoredUser: (username: string, pin?: string) => Promise<void>;
  logout: () => Promise<void>;
  enterSpectatorMode: () => Promise<void>;
  deleteAllStoredUsers: () => Promise<void>;
  deleteStoredUser: (username: string) => Promise<void>;
  resetInactivityTimer: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);


export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [storedUsers, setStoredUsers] = useState<StoredUser[]>([]);
  const [session, setSession] = useState<AuthSession | null>(null);
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
      // await validate_posting_key(normalizedUsername, postingKey);

      // Encrypt the key
      let encrypted = '';
      let salt = '';
      let iv = '';
      if (method === 'pin') {
        if (!pin || pin.length !== 6) throw new AuthError('PIN must be 6 digits');
        salt = await generateSalt();
        iv = await generateSalt();
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
        login,
        loginStoredUser,
        logout,
        enterSpectatorMode,
        deleteAllStoredUsers,
        deleteStoredUser: removeStoredUser,
        resetInactivityTimer,
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
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Crypto from 'expo-crypto';

import AES from 'crypto-js/aes';
import PBKDF2 from 'crypto-js/pbkdf2';
import * as CryptoJS from 'crypto-js';
import { Buffer } from 'buffer';

export type EncryptionMethod = 'biometric' | 'pin';

export interface EncryptedKey {
  username: string;
  encrypted: string;
  method: EncryptionMethod;
  salt: string;
  iv: string;
  createdAt: number;
}
// ...existing code...

// Generate a random salt
export async function generateSalt(length = 16): Promise<string> {
  try {
    const bytes = await Crypto.getRandomBytesAsync(length);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch (err) {
    // Fallback for Expo Go/dev: NOT SECURE, do not use in production!
    let salt = '';
    for (let i = 0; i < length; i++) {
      salt += Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
    }
    return salt;
  }
}
// Derive a key from PIN using PBKDF2
// keySize is in 32-bit words, so 256 bits = 8 words
export function deriveKeyFromPin(pin: string, salt: string): string {
  const iterations = __DEV__ ? 1000 : 100000;
  return PBKDF2(pin, salt, { keySize: 8, iterations }).toString();
}

// Encrypt the private key with AES (mock in Expo Go/dev)
export function encryptKey(
  key: string,
  secret: string,
  iv: string
): string {
  if (__DEV__) {
    // DEV ONLY: mock encryption for Expo Go (NOT SECURE)
    return Buffer.from(`${key}::${secret}::${iv}`, 'utf8').toString('base64');
  }
  return AES.encrypt(key, secret, { iv: CryptoJS.enc.Hex.parse(iv) }).toString();
}

// Decrypt the private key with AES (mock in Expo Go/dev)
export function decryptKey(
  encrypted: string,
  secret: string,
  iv: string
): string {
  if (__DEV__) {
    // DEV ONLY: mock decryption for Expo Go (NOT SECURE)
    try {
      const decoded = Buffer.from(encrypted, 'base64').toString('utf8');
      const [k, s, v] = decoded.split('::');
      if (s === secret && v === iv) return k;
      return '';
    } catch (e) {
      return '';
    }
  }
  const bytes = AES.decrypt(encrypted, secret, { iv: CryptoJS.enc.Hex.parse(iv) });
  return bytes.toString(CryptoJS.enc.Utf8);
}


// Validate and sanitize username for SecureStore key
function sanitizeUsername(username: string): string {
  // Trim whitespace
  const trimmed = username.trim();
  // Only allow alphanumeric, ".", "-", and "_"
  const valid = /^[a-zA-Z0-9._-]+$/.test(trimmed);
  if (!trimmed || !valid) {
    throw new Error('Invalid username for SecureStore. Must be non-empty and contain only alphanumeric characters, ".", "-", and "_".');
  }
  return trimmed;
}

// Store encrypted key in SecureStore
export async function storeEncryptedKey(
  username: string,
  encryptedKey: EncryptedKey
) {
  const safeUsername = sanitizeUsername(username);
  const key = `userkey_${safeUsername}`;
  const value = JSON.stringify(encryptedKey);
  // ...existing code...
  await SecureStore.setItemAsync(key, value);
}

// Retrieve encrypted key from SecureStore
export async function getEncryptedKey(username: string): Promise<EncryptedKey | null> {
  const safeUsername = sanitizeUsername(username);
  const data = await SecureStore.getItemAsync(`userkey_${safeUsername}`);
  return data ? JSON.parse(data) : null;
}

// Delete encrypted key from SecureStore
export async function deleteEncryptedKey(username: string) {
  const safeUsername = sanitizeUsername(username);
  await SecureStore.deleteItemAsync(`userkey_${safeUsername}`);
}

// Biometric authentication
export async function authenticateBiometric(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Authenticate to unlock your key',
    fallbackLabel: 'Use PIN',
  });
  return result.success;
}

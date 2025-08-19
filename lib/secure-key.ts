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
    console.warn('⚠️ Native crypto not available, using fallback (NOT SECURE for production!)');
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
  const iterations = 100000; // Always use production-level iterations
  return PBKDF2(pin, salt, { keySize: 8, iterations }).toString();
}

// Encrypt the private key with AES 
export function encryptKey(
  key: string,
  secret: string,
  iv: string
): string {
  try {
    return AES.encrypt(key, secret, { iv: CryptoJS.enc.Hex.parse(iv) }).toString();
  } catch (error) {
    console.warn('⚠️ AES encryption failed, using fallback (NOT SECURE for production!)', error);
    // Fallback for when AES fails (like in Expo Go)
    return Buffer.from(`${key}::${secret}::${iv}`, 'utf8').toString('base64');
  }
}

// Decrypt the private key with AES
export function decryptKey(
  encrypted: string,
  secret: string,
  iv: string
): string {
  // First try AES decryption (production method)
  try {
    const bytes = AES.decrypt(encrypted, secret, { iv: CryptoJS.enc.Hex.parse(iv) });
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (decrypted) return decrypted;
  } catch (e) {
    console.warn('⚠️ AES decryption failed, trying fallback method');
  }
  
  // Fallback to base64 decryption (for data encrypted in Expo Go)
  try {
    const decoded = Buffer.from(encrypted, 'base64').toString('utf8');
    const [k, s, v] = decoded.split('::');
    if (s === secret && v === iv) return k;
    return '';
  } catch (e) {
    console.error('Both AES and fallback decryption failed:', e);
    return '';
  }
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
  try {
    // Check if biometric authentication is available
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    
    if (!hasHardware) {
      return false;
    }
    
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    
    if (!isEnrolled) {
      return false;
    }
    
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to unlock your key',
      fallbackLabel: 'Use PIN',
      disableDeviceFallback: false,
    });
    
    return result.success;
  } catch (error) {
    console.error('Biometric authentication error:', error);
    return false;
  }
}

// Check if device has biometric or device PIN/passcode available
export async function hasDeviceAuthentication(): Promise<{
  hasBiometric: boolean;
  hasDevicePin: boolean;
  biometricTypes: LocalAuthentication.AuthenticationType[];
}> {
  try {
    // Check if hardware is available
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    
    // Check if biometric is enrolled
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    
    // Get available authentication types
    const authTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
    
    // Check if device has a device lock (passcode/PIN)
    const securityLevel = await LocalAuthentication.getEnrolledLevelAsync();
    
    // In simulator or development, if biometric setup seems problematic, fallback to PIN
    if (__DEV__ && (!hasHardware || !isEnrolled || authTypes.length === 0)) {
      return {
        hasBiometric: false,
        hasDevicePin: false,
        biometricTypes: [],
      };
    }
    
    return {
      hasBiometric: hasHardware && isEnrolled && authTypes.length > 0,
      hasDevicePin: securityLevel >= LocalAuthentication.SecurityLevel.SECRET,
      biometricTypes: authTypes,
    };
  } catch (error) {
    console.error('Error checking device authentication:', error);
    // On any error in development, fallback to PIN
    if (__DEV__) {
      return {
        hasBiometric: false,
        hasDevicePin: false,
        biometricTypes: [],
      };
    }
    
    // In production, still try biometric as fallback
    return {
      hasBiometric: true,
      hasDevicePin: false,
      biometricTypes: [],
    };
  }
}

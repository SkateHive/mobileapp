# Secure Key Storage: Production Checklist

This document explains the temporary development workarounds in place for Expo Go and what you must do before releasing your app to production.

## Current Development Workarounds

- **Salt/IV Generation:**
  - In development (`__DEV__`), if `expo-crypto` fails, a fallback using `Math.random` is used for salt/IV generation. This is insecure and only for local testing in Expo Go.
- **Encryption/Decryption:**
  - In development (`__DEV__`), `encryptKey` and `decryptKey` use a mock implementation (base64 encoding/decoding) instead of real AES encryption. This is insecure and only for local testing in Expo Go.
- **Key Storage:**
  - SecureStore keys use an underscore (`userkey_username`) to avoid invalid character errors on iOS/Android.


## What To Do For Production

### 1. Remove All Development-Only Code and Fallbacks
- Remove all `__DEV__` or development-only code, including:
  - The fallback for salt/IV generation using `Math.random`. Only use `expo-crypto` for salt/IV in production.
  - The mock (base64) logic in `encryptKey` and `decryptKey`. Only use real AES encryption/decryption (`crypto-js`).
  - Any test or debug code, including the `testSecureStore` function and all debug logs.
- **PBKDF2 Iterations:**
  - In development, PBKDF2 may use a low iteration count (e.g., 1,000) for speed. In production, always use a high iteration count (e.g., 100,000 or more). Remove any `__DEV__` or development-only logic that lowers the iteration count.

### 2. Test on a Real Device with a Production Build
- Expo Go does not support all native modules. Build your app with EAS (`eas build`) or use a custom dev client (`eas dev-client`) to test the real production code on a real device.

### 3. Confirm Only Secure, Native Crypto is Used
- Double-check that no mock/fallback code or insecure logic is present in the production build. Only use `expo-crypto` and `crypto-js` AES for all cryptographic operations.

### 4. Confirm All Sensitive Data is Encrypted and Stored Securely
- Ensure all private keys, PINs, and other sensitive data are encrypted with strong, random salt/IV and stored only in SecureStore.
- Never log or expose private keys, PINs, or secrets in production.

### 5. Key Storage Format
- Continue using the `userkey_username` format for SecureStore keys (underscore, not colon).

### 6. Remove All Debug/Test Logs and Functions
- Delete or comment out any test/debug code and all debug logs before release.

### 7. Security Review
- Contact your security lead for a final review before publishing to the app store.

## Summary Table
| Area                | Development (Expo Go)         | Production (EAS/Standalone)         |
|---------------------|-------------------------------|-------------------------------------|
| Salt/IV Generation  | `Math.random` fallback        | Only `expo-crypto`                  |
| Encryption          | Mock (base64)                 | Real AES (crypto-js)                |
| PBKDF2 Iterations   | 1,000 (fast, insecure)        | 100,000+ (secure)                   |
| SecureStore Key     | `userkey_username`            | `userkey_username`                  |
| Debug/Test Code     | Present                       | Remove before release               |

## Final Checklist Before Release

- [ ] Remove all development-only code and fallbacks (including salt/IV fallback, mock encryption, PBKDF2 dev override)
- [ ] Set PBKDF2 iterations to 100,000+ (remove any dev override)
- [ ] Test on a real device with a production build (EAS or custom dev client)
- [ ] Confirm only secure, native crypto is used (expo-crypto, crypto-js AES)
- [ ] Confirm all sensitive data is encrypted and stored securely in SecureStore
- [ ] Remove all debug/test logs and functions
- [ ] Contact your security lead for a final review before publishing

---

**Contact your security lead for a final review before publishing to the app store.**

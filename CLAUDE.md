# SkateHive Mobile App – Developer Guide

## Technical Stack
- **Framework**: React Native + Expo SDK 54 (Bare Workflow)
- **Navigation**: Expo Router (Typed, file-based)
- **Language**: TypeScript (Strict)
- **State Management**: React Query (Server), Context API (Auth, Notifications, Toast)
- **Blockchain**: `@hiveio/dhive` (HIVE)
- **Storage**: `expo-secure-store` (Encrypted keys)
- **Styling**: `StyleSheet` (Dark theme only, Primary: `#32CD32`)

## Core Commands
- **Install**: `pnpm install`
- **Development**: `pnpm dev` (Starts Metro with cache clear)
- **iOS/Android**: `pnpm ios` / `pnpm android`
- **Build**: `eas build --platform [ios|android] --profile production`

## Project Structure
- `app/`: Expo Router screens
- `app/(tabs)/`: Primary navigation tabs (Feed, Videos, Create, Leaderboard, Profile)
- `lib/`: Business logic, hooks, and utils
  - `auth-provider.tsx`: Session and multi-account management
  - `hive-utils.ts`: All blockchain operations
  - `secure-key.ts`: AES encryption (PBKDF2)
  - `theme.ts`: Central design tokens
  - `hooks/`: React Query wrappers (`useQueries.ts`, `useSnaps.ts`)
- `components/`: UI components (Feed, auth, ui, Profile)

## Development Patterns

### Code Style
- **TypeScript**: Define all interfaces in `lib/types.ts`.
- **Components**: Functional components with hooks.
- **Styling**: Use `lib/theme.ts` tokens with `StyleSheet.create`. No inline styles.

### Authentication & Security
- Private keys must NEVER be stored in plaintext.
- Use `AuthSession.decryptedKey` from `useAuth()` for blockchain operations.
- Biometric and PIN authentication required for sensitive actions.

### Data Fetching
- Use `@stack/react-query` for all server state.
- Define cache keys in `lib/hooks/useQueries.ts`.
- Default stale time: 1 minute.

## Build & Versioning
Update version in 4 places before `eas build`:
1. `app.json`: `expo.version`, `ios.buildNumber`, `android.versionCode`
2. `ios/skatehive/Info.plist`: `CFBundleShortVersionString`, `CFBundleVersion`
3. `ios/skatehive.xcodeproj/project.pbxproj`: `MARKETING_VERSION`, `CURRENT_PROJECT_VERSION`
4. `package.json`: `version`

## Error Handling
- Use custom error classes defined in `lib/hive-utils.ts` and `lib/auth-provider.tsx` (`AuthError`, `InvalidKeyError`, etc.).
- Always provide user-friendly error messages via `ToastProvider`.
- Log detailed errors to console for debugging but avoid logging private data.

## Accessibility
- Use `accessibilityLabel` for all interactive elements.
- Ensure high contrast ratios (Black/Green theme provides this by default).
- Support dynamic font sizes where possible.

## Known Gotchas
- **Bare Workflow**: Changes in `ios/` or `android/` folders require `pnpm prebuild` if not using EAS.
- **New Architecture**: `newArchEnabled` is currently `false` in `app.json`.
- **RPC Failover**: `hive-utils.ts` handles multiple fallback nodes automatically.
- **Apple Review**: Test account with simple password logic exists in `lib/auth-provider.tsx`.

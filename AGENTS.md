# SkateHive Mobile App – Agent Guide

This file provides critical context for AI agents working on the SkateHive mobile codebase.

## Repository Overview
**SkateHive** is a React Native/Expo mobile app for the skateboarding community built on the HIVE blockchain. Users post content, vote, comment, and earn crypto rewards (HIVE/HBD).

## Architecture Summary
```
┌─────────────────────────────────────────────────┐
│                  Expo Router                     │
│  app/_layout.tsx (providers) -> app/(tabs)/*     │
├─────────────────────────────────────────────────┤
│              React Components                    │
│  components/Feed/  components/auth/  components/ui/ │
├─────────────────────────────────────────────────┤
│              Business Logic (lib/)               │
│  auth-provider  hive-utils  secure-key  theme     │
├─────────────────────────────────────────────────┤
│              Data Layer                          │
│  React Query  |  HIVE RPC Nodes  |  REST API     │
├─────────────────────────────────────────────────┤
│              Native Layer                        │
│  expo-secure-store  expo-camera  expo-video       │
└─────────────────────────────────────────────────┘
```

## Critical Files
- `lib/auth-provider.tsx`: Auth context, session, multi-account, biometric/PIN logic.
- `lib/hive-utils.ts`: ALL blockchain operations (vote, comment, follow, etc.).
- `lib/secure-key.ts`: AES encryption of private keys (PBKDF2).
- `lib/theme.ts`: Central design system (colors, spacing, fonts).
- `app/_layout.tsx`: Root layout wrapping all providers.

## Agent Task Patterns

### Adding a New Screen
1. Create file in `app/` (or `app/(tabs)/` for tabbed screens).
2. Expo Router auto-registers routes from filenames.
3. Import `theme` from `lib/theme.ts` for all styling.

### Blockchain Operations
1. Use functions in `lib/hive-utils.ts`.
2. Wrap in try/catch — RPC nodes can fail; the client handles failover.
3. Require `decryptedKey` from `useAuth()` session.

### Data Hooks
1. Create in `lib/hooks/`.
2. Use `useQuery`/`useMutation` from `@tanstack/react-query`.
3. Follow patterns in `useQueries.ts` for cache keys.

## Key Conventions
- **Dark Theme Only**: Background `#000000`, Primary `#32CD32`.
- **Styling**: Use `StyleSheet.create()` — no inline styles, no Tailwind/NativeWind.
- **Security**: NEVER store or log private keys in plaintext.
- **Imports**: Use `~/` path alias (e.g., `import { theme } from '~/lib/theme'`).

## Common Gotchas
1. **Version Drift**: `app.json`, `Info.plist`, `project.pbxproj`, and `package.json` must be synced manually.
2. **Native Modules**: This is a **Bare Workflow** project; native changes require `pnpm prebuild` or EAS.
3. **RPC Nodes**: Multiple fallback nodes are configured in `hive-utils.ts`.
4. **Video Autoplay**: Uses `lib/ViewportTracker.tsx` (60%+ visibility triggers play).

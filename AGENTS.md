# SkateHive Mobile App — Agent Guide

This file provides context for AI agents working on this codebase.

## Repository Overview

**SkateHive** is a React Native/Expo mobile app for a skateboarding community built on the HIVE blockchain. Users post skateboarding content (photos, videos, text), vote on posts, comment, follow each other, and earn crypto rewards (HIVE/HBD).

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
│  auth-provider  hive-utils  secure-key  upload/  │
├─────────────────────────────────────────────────┤
│              Data Layer                          │
│  React Query  |  HIVE RPC Nodes  |  REST API     │
├─────────────────────────────────────────────────┤
│              Native Layer                        │
│  expo-secure-store  expo-camera  expo-video       │
└─────────────────────────────────────────────────┘
```

## Critical Files to Understand First

| File | Purpose | Lines |
|------|---------|-------|
| `lib/auth-provider.tsx` | Authentication context, session mgmt, multi-account, biometric/PIN | ~490 |
| `lib/hive-utils.ts` | ALL blockchain operations (vote, comment, follow, power-up, etc.) | ~1200 |
| `lib/secure-key.ts` | AES encryption of private keys with PBKDF2 key derivation | ~150 |
| `lib/types.ts` | TypeScript interfaces for Post, AuthSession, etc. | ~130 |
| `lib/theme.ts` | Complete design system (colors, spacing, fonts, radii) | ~65 |
| `lib/constants.ts` | API URLs, community tag, app name | ~25 |
| `app/_layout.tsx` | Root layout wrapping all context providers | — |
| `app/(tabs)/_layout.tsx` | Tab bar configuration (5 visible + 1 hidden tab) | — |

## Agent Task Patterns

### Adding a New Screen
1. Create file in `app/` (or `app/(tabs)/` for tabbed screens)
2. Expo Router auto-registers routes from file names
3. Protected routes check `useAuth()` session in `app/_layout.tsx`
4. Import theme from `lib/theme.ts` for consistent styling

### Adding a New Blockchain Operation
1. Add function in `lib/hive-utils.ts`
2. Use `hiveClient` (pre-configured with failover nodes)
3. Require `decryptedKey` from `useAuth()` session
4. Wrap in try/catch — blockchain ops can fail on any node

### Adding a New Hook
1. Create in `lib/hooks/`
2. Use `useQuery`/`useMutation` from `@tanstack/react-query`
3. Follow existing patterns in `useQueries.ts` for cache keys and stale times
4. Export and use in components

### Modifying the Feed
- Feed data flows: `useSnaps()` -> `getSnapsContainers()` -> `getContentReplies()`
- Each post is rendered by `components/Feed/PostCard.tsx`
- Media parsing happens inside PostCard (extracts images/videos from markdown body)
- Voting UI uses `components/ui/VotingSlider.tsx`

### Media Upload Changes
- Images: `lib/upload/image-upload.ts` (HEIC conversion + HIVE image hosting)
- Videos: `lib/upload/video-upload.ts` (dynamic transcoder discovery + IPFS)
- Post assembly: `lib/upload/post-utils.ts` (permlink, tags, metadata, broadcast)

## Key Conventions

### Styling
- **Dark theme only** — never add light mode
- All colors come from `lib/theme.ts` (primary=#32CD32, bg=#000000)
- Use `StyleSheet.create()` — no inline styles, no NativeWind in practice
- Font: FiraCode (monospace) for all text

### State Management
- **Server state:** React Query (`@tanstack/react-query`)
- **Auth state:** React Context (`lib/auth-provider.tsx`)
- **Notifications:** React Context (`lib/notifications-context.tsx`)
- **Toasts:** React Context (`lib/toast-provider.tsx`)
- **Local state:** `useState`/`useReducer`

### Imports
- Use `~/` path alias (maps to project root via tsconfig)
- Example: `import { theme } from '~/lib/theme'`

### Security Rules
- NEVER store private keys in plaintext
- NEVER log private keys or decrypted values
- Always use `expo-secure-store` for sensitive data
- Blockchain writes require `AuthSession.decryptedKey`

## Provider Hierarchy (app/_layout.tsx)

```
QueryClientProvider
  └── AuthProvider
        └── NotificationProvider
              └── ToastProvider
                    └── ViewportTrackerProvider
                          └── <Slot /> (screens)
```

## Common Gotchas

1. **Version drift:** app.json, Info.plist, project.pbxproj, and package.json all have independent version numbers that must be synced manually before builds.

2. **Android versionCode:** Historically stuck at 1 — must be incremented for Play Store releases.

3. **newArchEnabled mismatch:** `app.json` says `false`, `ios/Podfile.properties.json` says `true`. Pick one and sync.

4. **Test account in auth-provider:** Hardcoded credentials for Apple App Store review — should be removed after approval.

5. **HIVE RPC nodes:** Multiple fallback nodes configured in `hive-utils.ts`. If one fails, the client retries on the next. Don't hardcode a single node.

6. **Video autoplay:** Uses viewport tracking (`lib/ViewportTracker.tsx`). Videos auto-play when 60%+ visible, pause when scrolled away.

7. **No test suite:** There are no automated tests in the project currently. The `scripts/` directory is empty.

## Environment Setup

```bash
# Prerequisites
node >= 18
pnpm

# Install & run
pnpm install
cp .env.example .env   # Configure API_BASE_URL
pnpm dev               # Start Expo dev server

# Build for production
eas build --platform ios --profile production
eas build --platform android --profile production
```

## API Dependencies
- `https://api.skatehive.app/api/v1` — SkateHive backend
- `https://api.skatehive.app/api/v2/leaderboard` — Leaderboard data
- `https://api.skatehive.app/api/transcode/status` — Video transcoding service
- `https://images.hive.blog` — HIVE image CDN
- HIVE RPC nodes (multiple, with failover)

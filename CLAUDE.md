# SkateHive Mobile App

## What Is This?
A skateboarding community mobile app built on the HIVE blockchain. Users create posts with photos/videos, vote, comment, and earn crypto rewards. Dark theme only, green accent (#32CD32).

## Tech Stack
- **Framework:** React Native + Expo SDK 54 (bare workflow — has `ios/` and `android/` dirs)
- **Router:** expo-router (file-based, typed routes)
- **Language:** TypeScript (strict)
- **State:** React Query (server), React Context (auth, notifications, toast)
- **Blockchain:** @hiveio/dhive (HIVE)
- **Storage:** expo-secure-store (encrypted keys)
- **Package Manager:** pnpm
- **Font:** FiraCode (monospace)

## Quick Start
```bash
pnpm install
pnpm dev          # Expo dev server (clears cache)
pnpm ios          # Run on iOS
pnpm android      # Run on Android
```

## Project Structure
```
app/                     # Expo Router screens
  _layout.tsx            # Root layout — wraps all providers
  index.tsx              # Welcome/splash screen
  login.tsx              # Auth screen
  (tabs)/                # Tab navigation (protected)
    feed.tsx             # Home feed (trending/following)
    videos.tsx           # Video gallery
    create.tsx           # Post creation
    leaderboard.tsx      # Community rankings
    profile.tsx          # User profile (?username= param)
    notifications.tsx    # Hidden tab (accessed via profile)
  conversation.tsx       # Thread/reply detail view

lib/                     # Core business logic
  auth-provider.tsx      # AuthContext — login, logout, session, multi-account
  hive-utils.ts          # All blockchain operations (vote, comment, follow, etc.)
  secure-key.ts          # AES encryption/decryption for private keys
  constants.ts           # API URLs, community tag, app name
  theme.ts               # Color palette, spacing, fonts, radii
  types.ts               # TypeScript interfaces (Post, AuthSession, etc.)
  api.ts                 # REST API calls
  utils.ts               # Helpers
  hooks/                 # Custom hooks
    useQueries.ts        # React Query wrappers (feed, balance, rewards)
    useSnaps.ts          # Paginated post loading with deduplication
    useHiveAccount.ts    # Account data from blockchain
    useVoteValue.ts      # Vote power estimation
    useNotifications.ts  # Notification fetching
    useBlockchainWallet.ts  # Wallet balance
    useReplies.ts        # Comment thread loading
  upload/                # Media upload pipeline
    image-upload.ts      # HEIC->JPEG, sign with posting key, upload to images.hive.blog
    video-upload.ts      # Upload to transcoding worker -> IPFS CID
    post-utils.ts        # Permlink generation, metadata, broadcast

components/              # UI components
  Feed/                  # PostCard, Feed, VideoWithAutoplay, Conversation, etc.
  auth/                  # AuthScreen, LoginForm, StoredUsersView
  ui/                    # Button, Text, Input, Card, Toast, VotingSlider, etc.
  Leaderboard/           # Leaderboard display
  Profile/               # FollowersModal
  SpectatorMode/         # Read-only mode banners
  notifications/         # NotificationsScreen, NotificationItem
  markdown/              # EnhancedMarkdownRenderer
```

## Key Architecture Decisions

### Authentication
- Two methods: **PIN** (PBKDF2 -> AES) and **Biometric** (Face ID/Touch ID)
- Private keys are NEVER stored in plaintext — encrypted in SecureStore
- Decrypted key lives in memory only (`AuthSession.decryptedKey`)
- Auto-logout after 1 hour of inactivity
- Multi-account support with quick-switch
- "Spectator Mode" for read-only browsing without login

### HIVE Blockchain
- Community: `hive-173115` (SkateHive)
- Snaps container author: `peak.snaps`
- Multiple RPC nodes with failover (deathwing, techcoderx, hive.blog, anyx, arcange, 3speak)
- All blockchain writes require the user's decrypted posting key

### Media Upload Pipeline
1. **Images:** Convert HEIC->JPEG -> SHA256 hash -> sign with posting key -> upload to `images.hive.blog`
2. **Videos:** Upload to dynamic transcoding worker (from `api.skatehive.app/api/transcode/status`) -> returns IPFS CID
3. **Posts:** Compose markdown body + media URLs -> broadcast `comment` op to HIVE

### Data Flow
- Feed loads via `useSnaps()` -> `getSnapsContainers()` -> `getContentReplies()` -> filter by community tag
- React Query caches with 1min stale time, 24h GC, 2 retries
- Video autoplay triggered by viewport tracking (60%+ visible)

## API Endpoints
- `https://api.skatehive.app/api/v1` — main REST API
- `https://api.skatehive.app/api/v2/leaderboard` — leaderboard
- `https://api.skatehive.app/api/transcode/status` — video transcoding service discovery
- `https://images.hive.blog` — image hosting (HIVE ecosystem)

## Theme
- Background: `#000000` (black)
- Primary: `#32CD32` (lime green)
- Border: `#333333`
- Muted: `#999999`
- Danger: `#FF3B30`
- All defined in `lib/theme.ts`

## Versioning Checklist (before `eas build`)
Version must be updated in ALL 4 places:
1. `app.json` → `expo.version` + `expo.ios.buildNumber` + `expo.android.versionCode`
2. `ios/skatehive/Info.plist` → `CFBundleShortVersionString` + `CFBundleVersion`
3. `ios/skatehive.xcodeproj/project.pbxproj` → `MARKETING_VERSION` + `CURRENT_PROJECT_VERSION`
4. `package.json` → `version`

> `eas.json` has `appVersionSource: "local"` so native files do NOT auto-sync.

## Build & Deploy
```bash
eas build --platform ios --profile production
eas build --platform android --profile production
eas submit --platform ios
eas submit --platform android
```
- iOS App Store ID: `6751173076`
- iOS bundle: `com.bgrana.skatehive`
- Android package: `com.skatehive.app`

## Coding Conventions
- TypeScript everywhere; interfaces in `lib/types.ts`
- Functional components with hooks
- `async/await` with try/catch
- Import paths use `~/` alias (maps to project root)
- StyleSheet.create for all styles (no NativeWind despite INSTRUCTIONS.md mentioning it)
- Haptic feedback on interactive elements via `expo-haptics`
- Use `theme` object from `lib/theme.ts` for all colors/spacing

## Known Issues
- Android `versionCode` stuck at 1 while iOS `buildNumber` is at 16+
- `newArchEnabled` contradicts: `app.json` says false, `Podfile.properties.json` says true
- Test account credentials hardcoded in `lib/auth-provider.tsx` (for Apple review)
- Security fallbacks in `lib/secure-key.ts`: Math.random fallback, 5000 PBKDF2 iterations

## Environment Variables
See `.env.example`:
- `API_BASE_URL` — backend API
- `LOADING_EFFECT` — skeleton/matrix loading style
- `SNAPS_CONTAINER_AUTHOR`, `COMMUNITY_TAG`, `MODERATOR_PUBLIC_KEY`

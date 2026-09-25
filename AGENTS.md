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
- For bold text with FiraCode, set `fontFamily: theme.fonts.bold` explicitly —
  `fontWeight: 'bold'` does not render the bold variant for custom fonts

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

2. **Android versionCode:** Must be incremented in `app.json` before each Play Store
   release (`eas.json` uses `appVersionSource: "local"`, so it is never auto-bumped).

3. **newArchEnabled:** `app.json` and `ios/Podfile.properties.json` are both `true`
   (New Arch is required by Expo 54 / RN 0.81 / reanimated 4). `app.json` is the
   source of truth — `ios/` is regenerated from it by prebuild, so do not edit the
   Podfile value directly.

4. **Test account in auth-provider:** Hardcoded credentials in `lib/auth-provider.tsx`
   let Apple reviewers log in with a simple password instead of a HIVE posting key.
   Remove immediately after Apple approves the app:
   - Delete the "APPLE REVIEW TEST ACCOUNT CONFIGURATION" block (`TEST_USERNAME`,
     `TEST_POSTING_KEY`, `TEST_SIMPLE_PASSWORD` constants).
   - Delete the "APPLE REVIEW TEST ACCOUNT LOGIC" block inside the login function.

5. **HIVE RPC nodes:** Multiple fallback nodes configured in `hive-utils.ts`. If one fails, the client retries on the next. Don't hardcode a single node.

6. **Video autoplay:** Uses viewport tracking (`lib/ViewportTracker.tsx`). Videos auto-play when 60%+ visible, pause when scrolled away.

7. **Double padding on PostCard:** `components/Feed/PostCard.tsx` has its own
   `paddingHorizontal: theme.spacing.md`, and the screens rendering it add
   theirs: feed, profile and conversation each apply 16, while the conversation
   drawer applies none. The card is therefore not inset the same everywhere.
   When changing card padding, check all four call sites instead of assuming
   the value is global.

8. **No test suite:** There are no automated tests in the project currently. The `scripts/` directory is empty.

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

## Android Quickstart (local emulator)

For running the app on an Android emulator during development. Production Android
builds are a separate flow (`eas.json`); this section is only about dev.

> Verified end to end on 2026-09-19 (Apple Silicon Mac, Pixel 9 / API 36 arm64
> AVD): clean `pnpm android` built on the first try (~10 min), the app opened and
> the feed loaded in Spectator mode. No source changes were needed.

**Facts about this project**
- Expo SDK 54 / RN 0.81: `compileSdk`/`targetSdk` 36, `minSdk` 24, build-tools
  36.0.0, NDK 27.1.12297006, Android Gradle Plugin 8.11.
- Needs **JDK 17**. macOS ships only an old Java 8 plugin, which will not work.
- **Expo Go cannot run this app** (native modules + `expo-dev-client`); you always
  build a dev client with `expo run:android`.
- `android/` is gitignored and generated by prebuild, like `ios/`. `app.json` is
  the source of truth (`android.package` `com.skatehive.app`, `versionCode`).
- The SkateSpots widget (`@bacons/apple-targets`, `modules/widget-bridge/ios`) is
  iOS-only and does **not** affect Android: `expo-module.config.json` declares
  `"platforms": ["apple"]` so autolinking skips it, `index.ts` only calls
  `requireNativeModule` when `Platform.OS === "ios"`, and the apple-targets plugin
  is a no-op for `prebuild -p android`. Keep it that way; no Android stub needed.

**One-time setup**
Android Studio is optional; the command-line path below is what was verified
(about 8.5 GB under `~/Library/Android/sdk`, no sudo).
1. JDK 17: `brew install openjdk@17`. It is keg-only and `/usr/libexec/java_home`
   does not see it, so point `JAVA_HOME` at it directly (step 3). With the
   `temurin@17` cask instead (needs sudo), use `$(/usr/libexec/java_home -v 17)`.
2. SDK: `brew install --cask android-commandlinetools`, then install everything
   into the standard SDK root:
   ```bash
   export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
   export ANDROID_HOME="$HOME/Library/Android/sdk"
   yes | sdkmanager --sdk_root="$ANDROID_HOME" --licenses
   sdkmanager --sdk_root="$ANDROID_HOME" "cmdline-tools;latest" platform-tools emulator \
     "platforms;android-36" "build-tools;36.0.0" "ndk;27.1.12297006" \
     "system-images;android-36;google_apis;arm64-v8a"
   ```
   (With Android Studio: same packages from SDK Manager, NDK under SDK Tools →
   "Show Package Details".)
3. Add to your shell profile:
   ```bash
   export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
   export ANDROID_HOME="$HOME/Library/Android/sdk"
   export PATH="$JAVA_HOME/bin:$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools"
   ```
4. Create the AVD (arm64 on Apple Silicon). Use the SDK's own `avdmanager`: the
   Homebrew one on PATH looks at a different SDK root and fails with "Package path
   is not valid":
   ```bash
   echo no | "$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager" create avd \
     -n Pixel_9_API_36 -d pixel_9 -k "system-images;android-36;google_apis;arm64-v8a"
   ```
   (Or Android Studio → Device Manager → Create Device.)
5. Verify: `adb version`, `emulator -list-avds`.

**Every time**
```bash
pnpm install                       # pnpm 9, never corepack pnpm
cp .env.example .env               # first time only
emulator -avd <avd_name> &         # or start it from Android Studio
pnpm android                       # expo run:android: prebuild + Gradle + install
```
The first build takes several minutes and creates `android/`. After that, JS edits
hot reload through Metro (8081); only native changes need `pnpm android` again.
For JS only against an already installed dev client: `pnpm dev:android`.

**Gotchas**
- If a Metro is already listening on 8081 (e.g. `pnpm start` from an iOS session),
  `pnpm android` reuses it and exits after installing; that is fine. The dev client
  connects over the Mac's LAN IP, so `adb reverse` was not needed.
- First launch shows the expo-dev-client menu onboarding over the app: tap
  Continue, then press back (`adb shell input keyevent KEYCODE_BACK`).
- Never export `CI` as an empty string (`CI= pnpm android`): Expo CLI dies in
  prebuild with `GetEnv.NoBoolean:  is not a boolean`. Unset it or use `CI=1`.
- From the emulator, the host machine is `10.0.2.2`, not `localhost`. To reach a
  local API use `http://10.0.2.2:3001`, or `adb reverse tcp:3001 tcp:3001`. If Metro
  cannot be reached, run `adb reverse tcp:8081 tcp:8081`.
- Wipe a bad build: `rm -rf android && pnpm android` (or `pnpm exec expo prebuild
  --clean -p android`).
- Logs: `adb logcat *:E ReactNativeJS:V`.
- Camera and recording features are limited on emulators; use the AVD's virtual
  scene camera, or test those on a real device (`adb devices`).
- Keep `android.versionCode` in `app.json` bumped before a Play Store release.

**With Maestri**
`maestri portal devices` lists AVDs under "Android emulators" and running ones by
serial. Adopt one with `maestri portal create --simulator <id> "Pixel"`, then
`pnpm exec expo run:android --device <avd_name>` (the AVD name from `emulator -list-avds`, e.g. `Pixel_9_API_36`; the adb serial `emulator-5554` is rejected with "Could not find device"). On Android the portal needs
no `launch` for a tree; `snapshot`, `click`, `type` and `key back` work directly.

## API Dependencies
- `https://api.skatehive.app/api/v2` — SkateHive backend (feed, profile, balance, leaderboard, etc.). The app uses v2; v1 is deprecated.
- `https://api.skatehive.app/api/userbase/*` — server-custody auth + Hive actions for email/lite accounts
- `https://api.skatehive.app/api/instagram/post` + `/api/userbase/profile/instagram` — Instagram cross-post + handle (signature-auth)
- `https://api.skatehive.app/api/transcode/status` — Video transcoding service
- `https://images.hive.blog` — HIVE image CDN
- HIVE RPC nodes (multiple, with failover)

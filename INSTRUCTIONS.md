# MyCommunity App – Project Instructions

## Overview
MyCommunity App is a React Native application built with Expo, designed for community engagement and social interaction on the HIVE blockchain. It features secure authentication, decentralized content, and a modern UI/UX using NativeWind (TailwindCSS).

## Technology Stack
- React Native (Expo)
- TypeScript (strict mode)
- NativeWind/TailwindCSS for styling
- Expo Router for navigation
- React Query for data fetching
- React Context for global state
- Expo SecureStore for sensitive data
- @hiveio/dhive for HIVE blockchain integration

## Project Structure
- `app/` – Expo Router screens (tabs, onboarding, settings)
- `assets/` – Images and videos
- `components/` – UI and feature components (ui, auth, feed, leaderboard, etc.)
- `lib/` – Core logic (api, auth-provider, hive-utils, hooks, icons, types, utils)

## Coding Conventions
- Use TypeScript everywhere; define interfaces in `lib/types.ts`
- Use async/await for async code, with try/catch and loading states
- Functional components with hooks; keep components small and focused
- Use NativeWind classes via `className` for styling; combine with `clsx` or `tailwind-merge` for dynamic styles
- Use React Query for server state, React Context for global state, and useState/useReducer for local state
- Use Expo Router for navigation; follow file-based routing in `app/`
- Use AuthContext from `lib/auth-provider.tsx` for authentication; store sensitive keys in SecureStore
- Use API functions from `lib/api.ts` and React Query for data fetching

## Best Practices
- DRY: Avoid code duplication
- Write meaningful comments for complex logic
- Break down large components
- Handle loading and error states gracefully (see `components/ui/LoadingScreen.tsx`)
- Optimize performance (React.memo, useCallback, useMemo)
- Follow HIVE blockchain best practices for key management and transactions

## Testing
- Test critical components and utilities
- Test authentication and mobile-specific flows
- Implement UI tests for key user flows

## Accessibility
- Use accessibility labels and aria attributes
- Test with different font sizes and contrast
- Follow React Native accessibility guidelines

## Environment & Setup
- Node.js v18+
- pnpm as package manager
- Expo SDK 52+
- Android 5.0+ and iOS 13+ supported

### Install & Run
1. Install dependencies: `pnpm install`
2. Set up `.env` with `API_BASE_URL` and `HIVE_NODE`
3. Start development: `pnpm start` (or `pnpm ios`, `pnpm android`, `pnpm web`)

### Build
- Use EAS Build for production: `eas build --platform ios|android --profile production`

## HIVE Blockchain
- Use `@hiveio/dhive` for blockchain actions (see `lib/hive-utils.ts`)
- Store keys securely; never expose private keys
- Handle blockchain errors and retries

## Error Handling
- Use custom error classes (see `lib/auth-provider.tsx`)
- Show user-friendly error messages
- Log errors for debugging

---
For more details, see `.github/copilot-instructions.md` and `README.md`.

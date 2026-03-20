# SkateHive Mobile App 🛹🚀

The official mobile application for **SkateHive**, the premier skateboarding community on the HIVE blockchain. This app allows skaters to share content (photos/videos), vote on posts, interact with the community, and earn crypto rewards (HIVE/HBD) in a truly decentralized environment.

## 📱 Overview

SkateHive Mobile is a high-performance React Native application built with **Expo SDK 54**. It features a modern, high-contrast dark theme, secure biometric authentication, and deep integration with the HIVE blockchain.

## 🌟 Key Features

- **Content Creation & Sharing**:
  - 📝 Markdown-supported posts and comments.
  - 🖼️ Rich media support with HEIC to JPEG conversion.
  - 🎬 Video uploads with IPFS integration.
- **Secure Wallet & Auth**:
  - 🔒 AES-encrypted key storage via Expo SecureStore.
  - 🔑 PIN and Biometric (FaceID/TouchID) authentication.
  - 💰 Real-time balance and reward tracking.
- **Community Interaction**:
  - ⭐ Hive reputation system.
  - 📊 Global and community leaderboards.
  - 💬 Threaded conversations and notifications.
- **UI/UX**:
  - 🌒 Pure Dark Theme (Black #000000, Lime Green #32CD32).
  - ⚡ Fast, responsive UI with FiraCode (monospace) typography.
  - 🎯 Viewport-aware video autoplay.

## 🛠️ Technology Stack

- **Core**: React Native (Expo SDK 54, Bare Workflow)
- **Navigation**: Expo Router (File-based, Typed)
- **Language**: TypeScript (Strict)
- **State Management**: React Query (Server), React Context (Auth/Toast/Notifications)
- **Blockchain**: `@hiveio/dhive` (HIVE RPC integration)
- **Styling**: `StyleSheet` (Standard themed styles)
- **Storage**: `expo-secure-store`, `expo-file-system`

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/)
- [EAS CLI](https://docs.expo.dev/build/introduction/) (for builds)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/SkateHive/mobileapp.git
   cd mobileapp
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Set up environment:
   ```bash
   cp .env.example .env
   # Configure API_BASE_URL and other vars
   ```

### Running Locally

```bash
pnpm dev      # Start Expo Metro bundler
pnpm ios      # Run on iOS simulator
pnpm android  # Run on Android emulator
```

## 📦 Building for Production

This project uses [EAS Build](https://docs.expo.dev/build/introduction/):

```bash
eas build --platform ios --profile production
eas build --platform android --profile production
```

> [!IMPORTANT]
> **Versioning Checklist**: Update version in `app.json`, `ios/skatehive/Info.plist`, `ios/skatehive.xcodeproj/project.pbxproj`, and `package.json` before building.

## 🔒 Security & Key Storage

Private keys are never stored in plaintext. They are encrypted using AES (PBKDF2 key derivation) and stored in the device's SecureStore.

### Production Security Checklist

- [ ] Ensure PBKDF2 iterations are set to 100,000+ (no dev overrides).
- [ ] Verify `expo-crypto` is used for all Salt/IV generation (remove `Math.random` fallbacks).
- [ ] Disable all debug logs and test credentials in `lib/auth-provider.tsx`.
- [ ] Test on a real device using a production build (EAS).

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repo and create your feature branch.
2. Ensure TypeScript types are correctly defined in `lib/types.ts`.
3. Use `async/await` with proper try/catch blocks for blockchain operations.
4. Submit a Pull Request with a clear description of changes.

---

<p align="center">
  <b>Built on the HIVE Blockchain</b> | <i>Empowering Skaters Globally</i>
</p>

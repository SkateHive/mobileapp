# MyCommunity App 🚀

A powerful React Native mobile application that empowers communities through the HIVE blockchain. MyCommunity App combines social networking features with decentralized rewards, secure authentication, and a modern user interface to create a seamless community experience.

## 📱 Overview

MyCommunity App is built using the latest React Native and Expo technologies, offering a cross-platform solution with native performance. The application connects to the HIVE blockchain, allowing users to interact with decentralized content, manage their HIVE wallets, and participate in community governance.

## 🌟 Key Features

### Content Creation & Sharing
- 📝 Long-form articles with Markdown support
- 📱 Short posts for quick updates
- 🖼️ Rich media support (images & videos)
- 🎬 IPFS video integration
- 📊 Post analytics and earnings tracking

### Secure Wallet Integration
- 🔒 Encrypted credential storage
- 💰 HIVE wallet integration
- 🎁 Easy community rewards distribution
- 📈 Real-time payout tracking
- 🔐 Secure voting mechanism

### Community Features
- 👥 Community building tools
- 🏷️ Custom tags and categories
- 💬 Interactive discussions
- ⭐ Reputation system
- 📊 Community analytics

### UI/UX
- 🌓 Dark/Light theme toggle
- 📱 Native mobile experience
- ⚡ Fast and responsive interface
- 🎨 Modern design language

## 🛠️ Project Structure

The project follows a clean, modular architecture:

```
mycommunity-app/
├── app/                 # Expo Router screens and navigation
│   ├── (tabs)/          # Main tab screens
│   ├── (onboarding)/    # Onboarding flows
│   └── _layout.tsx      # Root navigation layout
├── assets/              # Static assets (images, videos)
├── components/          # Reusable UI components
│   ├── auth/            # Authentication components
│   ├── Feed/            # Feed-related components
│   ├── ui/              # Base UI components
│   └── Leaderboard/     # Leaderboard components
├── lib/                 # Core utilities and business logic
│   ├── hooks/           # Custom React hooks
│   ├── icons/           # Icon components
│   ├── api.ts           # API integration
│   ├── auth-provider.tsx # Authentication context
│   ├── hive-utils.ts    # HIVE blockchain utilities
│   └── types.ts         # TypeScript type definitions
└── ...configuration files
```

### Key Files

- `app/_layout.tsx`: Root navigation and providers setup
- `lib/auth-provider.tsx`: Authentication logic and secure storage
- `lib/api.ts`: API integration functions
- `components/ui/`: Reusable UI components built with NativeWind

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) (v18 or newer)
- [pnpm](https://pnpm.io/) package manager
- [Expo CLI](https://docs.expo.dev/workflow/expo-cli/) (optional, but recommended)
- For iOS development: macOS with Xcode
- For Android development: Android Studio and SDK

## 🚀 Getting Started

### Installation

1. Clone the repository:

```bash
git clone https://github.com/r4topunk/mycommunity-app.git
cd mycommunity-app
```

2. Install dependencies with pnpm:

```bash
pnpm install
```

3. Set up environment variables (if needed):

Create a `.env` file in the project root with your configuration:

```
API_BASE_URL=your_api_url
HIVE_NODE=your_preferred_node
```

### Running the App

#### Development Mode

Run the app in development mode with hot reloading:

```bash
# Start the development server with Metro bundler
pnpm dev

# Run on iOS simulator
pnpm ios

# Run on Android emulator
pnpm android

# Run on web browser
pnpm web
```

#### Using a Physical Device

To run on a physical device:

1. Install the Expo Go app on your device
2. Make sure your device is on the same network as your development machine
3. Scan the QR code displayed in the terminal with your camera app (iOS) or Expo Go app (Android)

## 📦 Building for Production

This project uses [EAS Build](https://docs.expo.dev/build/introduction/) for creating production-ready builds:

```bash
# Install EAS CLI if not already installed
npm install -g eas-cli

# Log in to your Expo account
eas login

# Configure your build profiles (if needed)
eas build:configure

# Build for internal testing (preview)
eas build --platform ios --profile preview
eas build --platform android --profile preview

# Build for production
eas build --platform ios --profile production
eas build --platform android --profile production
```

## 📱 HIVE Blockchain Integration

MyCommunity App integrates with the HIVE blockchain for:

- User authentication using HIVE account credentials
- Content storage and retrieval
- Rewards distribution and tracking
- Voting and social interactions

The integration is handled through the `@hiveio/dhive` library with secure storage of user credentials using Expo SecureStore.

## 🔧 Troubleshooting

### Common Issues

#### Metro Bundler Issues

If you encounter issues with the Metro bundler:

```bash
# Clear Metro cache
pnpm clean
pnpm dev -c
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 🔐 Security

- Encrypted local storage
- Secure key management
- Private key never leaves the device
- Regular security audits

## 💎 Powered by HIVE

Built on the HIVE blockchain, enabling:
- Decentralized content storage
- Community rewards
- Transparent monetization
- Censorship resistance

## 🔗 Links

- [HIVE Blockchain](https://hive.io/)
- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/docs/getting-started)

---

<p align="center">
  Made with ❤️ for the HIVE community
</p>

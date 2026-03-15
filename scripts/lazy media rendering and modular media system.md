# Media Provider Architecture & Lazy Rendering Walkthrough

I've implemented a modular media rendering system and a lazy mounting strategy to solve the persistent autoscroll and playback issues in the Snaps feed.

## Changes Made

### 1. Modular Media Providers
- Created a [Registry](file:///home/adam/Projects/skatehive/monorepo/mobileapp-skatehive/lib/markdown/providers/Registry.ts#3-18) system where each media type (YouTube, Odysee, IPFS, etc.) is handled by a dedicated [MediaProvider](file:///home/adam/Projects/skatehive/monorepo/mobileapp-skatehive/lib/markdown/providers/BaseProvider.ts#3-26).
- Isolated regex patterns and rendering logic, making it easier to add new providers without breaking existing ones.

### 2. Base Video Embed & Focus Management
- Centralized all `WebView` rendering in [BaseVideoEmbed.tsx](file:///home/adam/Projects/skatehive/monorepo/mobileapp-skatehive/components/markdown/embeds/BaseVideoEmbed.tsx).
- Enforced strict autoplay prevention (`mediaPlaybackRequiresUserAction={true}`) and silenced all videos by default.
- Disabled `scrollEnabled` on WebViews to prevent them from stealing focus and triggering autoscrolls.

### 3. Lazy Media Rendering
- Propagated `isVisible` state from the [Feed](file:///home/adam/Projects/skatehive/monorepo/mobileapp-skatehive/components/Feed/Feed.tsx#188-193) down to individual video components.
- **WebViews now only mount when they are visible on screen.**
- When a video is off-screen, a light placeholder with a loading indicator is rendered instead. This physically prevents off-screen videos from playing audio or stealing focus.

### 4. Consolidated Rendering Logic
- Refactored [MarkdownProcessor](file:///home/adam/Projects/skatehive/monorepo/mobileapp-skatehive/lib/markdown/MarkdownProcessor.ts#8-73) and [UniversalRenderer](file:///home/adam/Projects/skatehive/monorepo/mobileapp-skatehive/components/markdown/UniversalRenderer.tsx#13-142) to use token-based rendering (`[[TYPE:ID]]`).
- Groups consecutive markdown parts to prevent layout fragmentation.

## Verification

### 🎥 Demonstration of Lazy Mounting
I've implemented the logic to only render the WebView when the component is `isVisible`. This eliminates the "Focus-Steal" which caused the autoscroll jump.

### 🛠️ Debugging Tools
I've documented the following scripts in [agents.md](file:///home/adam/Projects/skatehive/monorepo/mobileapp-skatehive/agents.md):
- [scripts/debug-snaps-specific.ts](file:///home/adam/Projects/skatehive/monorepo/mobileapp-skatehive/scripts/debug-snaps-specific.ts): Analyzes raw content of problematic snaps.
- [scripts/debug-feed.ts](file:///home/adam/Projects/skatehive/monorepo/mobileapp-skatehive/scripts/debug-feed.ts): General feed analysis.

## Next Steps
- Implement providers for `Instagram`, `Zora`, and `Snapshot`.
- Finalize the "Videos" tab transition.

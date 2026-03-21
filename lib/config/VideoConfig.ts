import { Platform } from 'react-native';

export type VideoRendererType = 'native' | 'webview';

export interface VideoSettings {
  /**
   * Preferred renderer for raw video files (MP4, etc.)
   */
  preferredRenderer: VideoRendererType;
  /**
   * Default aspect ratio for normalized video containers
   */
  aspectRatio: number;
  /**
   * Whether to enable active prefetching for near-viewport videos
   */
  enablePrefetch: boolean;
  /**
   * Number of videos to prefetch ahead of the current viewport
   */
  prefetchDistance: number;
  /**
   * Whether videos should always start muted during autoplay
   */
  autoPlayMuted: boolean;
  /**
   * Maximum number of concurrent native players to keep in memory
   */
  maxConcurrentPlayers: number;
  /**
   * Whether to prioritize loading videos currently in the viewport
   */
  lowLatencyLoad: boolean;
}

const commonSettings = {
  aspectRatio: 0.75, // 3:4 ratio for consistent normalization
  prefetchDistance: 2,
  autoPlayMuted: true,
  maxConcurrentPlayers: 3,
  lowLatencyLoad: true,
};

/**
 * Platform-specific video configuration.
 * This allows us to handle iOS and Android differently based on their native capabilities
 * and known issues with WebViews vs Native players.
 */
export const VideoConfig: VideoSettings = Platform.select({
  ios: {
    ...commonSettings,
    preferredRenderer: 'native', // iOS AVPlayer handles most stream formats very well
    enablePrefetch: true,
  },
  android: {
    ...commonSettings,
    preferredRenderer: 'webview', // Fallback to WebView for Android to avoid reported crashes
    enablePrefetch: true, // User wants to try prefetching on Android too
    maxConcurrentPlayers: 2, // Be more conservative with memory on Android
  },
  default: {
    ...commonSettings,
    preferredRenderer: 'webview',
    enablePrefetch: false,
  },
})!;

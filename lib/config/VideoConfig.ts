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
}

const commonSettings = {
  aspectRatio: 0.75, // 3:4 ratio for consistent normalization
  prefetchDistance: 2,
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
    preferredRenderer: 'native', // Android ExoPlayer is robust but can vary by device
    enablePrefetch: true,
  },
  default: {
    ...commonSettings,
    preferredRenderer: 'webview',
    enablePrefetch: false,
  },
})!;

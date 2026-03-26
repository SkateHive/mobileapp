import * as VideoThumbnails from 'expo-video-thumbnails';
import * as FileSystem from 'expo-file-system';

export interface ThumbnailResult {
  uri: string;
  base64?: string;
  width: number;
  height: number;
}

/**
 * Generate a thumbnail from a video file
 * @param videoUri - Local URI of the video
 * @param timeMs - Time in milliseconds to capture thumbnail (default: 1000ms)
 * @returns Promise with thumbnail URI and base64
 */
export async function generateVideoThumbnail(
  videoUri: string,
  timeMs: number = 1000
): Promise<ThumbnailResult> {
  try {
    const { uri, width, height } = await VideoThumbnails.getThumbnailAsync(
      videoUri,
      {
        time: timeMs,
        quality: 0.8,
      }
    );

    // Read as base64 for upload
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return {
      uri,
      base64: `data:image/jpeg;base64,${base64}`,
      width,
      height,
    };
  } catch (error) {
    console.error('Failed to generate video thumbnail:', error);
    throw error;
  }
}

/**
 * Cleanup thumbnail file from cache
 * @param thumbnailUri - Local URI of the thumbnail
 */
export async function cleanupThumbnail(thumbnailUri: string): Promise<void> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(thumbnailUri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(thumbnailUri, { idempotent: true });
    }
  } catch (error) {
    console.warn('Failed to cleanup thumbnail:', error);
  }
}

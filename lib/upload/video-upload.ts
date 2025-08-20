import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

interface VideoUploadResult {
  cid: string;
  gatewayUrl: string;
}

export interface VideoUploadOptions {
  creator: string;
  thumbnailUrl?: string;
}

/**
 * Upload video to the new video transcoding API
 * @param fileUri - Local file URI from Expo ImagePicker
 * @param fileName - Original file name
 * @param mimeType - MIME type of the video
 * @param options - Upload options including creator
 * @returns Promise with CID and gateway URL
 */
export async function uploadVideoToWorker(
  fileUri: string,
  fileName: string,
  mimeType: string,
  options: VideoUploadOptions
): Promise<VideoUploadResult> {
  const WORKER_API_URL = 'https://video-worker-e7s1.onrender.com/transcode';

  try {
    // Prevent device from sleeping during upload
    await activateKeepAwakeAsync('video-upload');
    
    // Create FormData for the upload
    const formData = new FormData();

    // Add the video file
    const fileData = {
      uri: fileUri,
      type: mimeType,
      name: fileName,
    } as any;

    formData.append('video', fileData);

    const uploadResponse = await fetch(WORKER_API_URL, {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('Video worker upload failed:', uploadResponse.status, errorText);
      throw new Error(`Video upload failed: ${uploadResponse.status} - ${errorText}`);
    }

    const result = await uploadResponse.json();

    if (!result.cid || !result.gatewayUrl) {
      throw new Error('Invalid response from video upload service');
    }

    return {
      cid: result.cid,
      gatewayUrl: result.gatewayUrl,
    };
  } catch (error) {
    console.error('Failed to upload video to worker:', error);
    throw new Error(`Video upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    // Always deactivate keep awake, even if upload fails
    deactivateKeepAwake('video-upload');
  }
}

/**
 * Create video iframe markup for Hive post
 * @param gatewayUrl - Gateway URL returned from upload
 * @param title - Optional title for the video
 * @returns HTML iframe string
 */
export function createVideoIframe(gatewayUrl: string, title?: string): string {
  return `<iframe src="${gatewayUrl}" width="100%" height="400" frameborder="0" allowfullscreen title="${title || 'Video'}"></iframe>`;
}

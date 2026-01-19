import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

interface VideoUploadResult {
  cid: string;
  gatewayUrl: string;
  requestId?: string;
  sourceApp?: string;
}

export interface VideoUploadOptions {
  creator: string;
  thumbnailUrl?: string;
  // NEW: Optional fields for enhanced tracking (won't break older server versions)
  userHP?: number;
  appVersion?: string;
  // Progress callback for UI updates (optional)
  onProgress?: (progress: number, stage: string) => void;
}

interface TranscodeService {
  priority: number;
  name: string;
  healthUrl: string;
  transcodeUrl: string;
  isHealthy: boolean;
  responseTime: number;
  lastChecked: string;
}

interface TranscodeStatusResponse {
  status: string;
  timestamp: string;
  totalResponseTime: string;
  summary: {
    healthyServices: number;
    totalServices: number;
    systemStatus: string;
    activeService: {
      name: string;
      priority: number;
      transcodeUrl: string;
      responseTime: string;
    };
  };
  services: TranscodeService[];
}

/**
 * Get the transcoding URL from the status API
 * @returns Promise with the transcoding URL from the highest priority healthy service
 */
async function getTranscodeUrl(): Promise<string> {
  const STATUS_API_URL = 'https://api.skatehive.app/api/transcode/status';

  try {
    const response = await fetch(STATUS_API_URL);

    if (!response.ok) {
      throw new Error(`Status API request failed: ${response.status}`);
    }

    const data: TranscodeStatusResponse = await response.json();

    // Filter healthy services and sort by priority
    const healthyServices = data.services
      .filter(service => service.isHealthy)
      .sort((a, b) => a.priority - b.priority);

    if (healthyServices.length === 0) {
      throw new Error('No healthy transcoding services available');
    }

    // Return the transcoding URL of the highest priority healthy service
    return healthyServices[0].transcodeUrl;
  } catch (error) {
    // Fallback to the hardcoded URL if the status API fails
    return 'https://146-235-239-243.sslip.io/transcode';
  }
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
  try {
    // Prevent device from sleeping during upload
    await activateKeepAwakeAsync('video-upload');

    // Get the dynamic transcoding URL from the status API
    const WORKER_API_URL = await getTranscodeUrl();

    // Generate correlation ID for progress tracking
    const correlationId = `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}`;

    // Create FormData for the upload
    const formData = new FormData();
    const fileData = {
      uri: fileUri,
      type: mimeType,
      name: fileName,
    } as any;

    formData.append('video', fileData);

    // REQUIRED: Creator username
    formData.append('creator', options.creator);

    // SOURCE APP IDENTIFIER - Always send 'mobile' from mobile app
    formData.append('source_app', 'mobile');

    // OPTIONAL: App version (for analytics)
    if (options.appVersion) {
      formData.append('app_version', options.appVersion);
    }

    // OPTIONAL: User's Hive Power (for priority handling)
    if (options.userHP !== undefined) {
      formData.append('userHP', options.userHP.toString());
    }

    // OPTIONAL: Thumbnail URL
    if (options.thumbnailUrl) {
      formData.append('thumbnail', options.thumbnailUrl);
    }

    // OPTIONAL: Correlation ID for SSE progress tracking
    formData.append('correlationId', correlationId);

    // OPTIONAL: Platform info
    formData.append('platform', 'expo-react-native');

    const uploadResponse = await fetch(WORKER_API_URL, {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
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

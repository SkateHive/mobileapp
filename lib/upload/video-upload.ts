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
  userHP?: number;
  appVersion?: string;
  /** Progress callback: (percent 0-100, stage: 'receiving'|'transcoding'|'uploading'|'optimized'|'complete'|'error') */
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
    // Fallback to Mac Mini if the status API fails
    return 'https://minivlad.tail83ea3e.ts.net/video/transcode';
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
    // Derive base URL for progress polling (strip /transcode from end)
    const BASE_URL = WORKER_API_URL.replace(/\/transcode$/, '');

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
    formData.append('creator', options.creator);
    formData.append('source_app', 'mobile');
    formData.append('correlationId', correlationId);
    formData.append('platform', 'expo-react-native');

    if (options.appVersion) {
      formData.append('app_version', options.appVersion);
    }
    if (options.userHP !== undefined) {
      formData.append('userHP', options.userHP.toString());
    }
    if (options.thumbnailUrl) {
      formData.append('thumbnail', options.thumbnailUrl);
    }

    // Start polling for progress in the background
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    if (options.onProgress) {
      options.onProgress(5, 'receiving');
      pollInterval = setInterval(async () => {
        try {
          const resp = await fetch(`${BASE_URL}/progress/${correlationId}`, {
            headers: { 'Accept': 'text/event-stream' },
          });
          if (!resp.ok) return;
          const text = await resp.text();
          // Parse last SSE data line
          const lines = text.split('\n').filter(l => l.startsWith('data:'));
          if (lines.length > 0) {
            const lastLine = lines[lines.length - 1];
            const data = JSON.parse(lastLine.replace('data: ', ''));
            if (data.progress !== undefined) {
              options.onProgress?.(data.progress, data.stage || 'processing');
            }
          }
        } catch {
          // Polling errors are non-fatal
        }
      }, 1500);
    }

    try {
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

      options.onProgress?.(100, 'complete');

      return {
        cid: result.cid,
        gatewayUrl: result.gatewayUrl,
      };
    } finally {
      if (pollInterval) clearInterval(pollInterval);
    }
  } catch (error) {
    throw new Error(`Video upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    // Always deactivate keep awake, even if upload fails
    deactivateKeepAwake('video-upload');
  }
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Create video iframe markup for Hive post
 * @param gatewayUrl - Gateway URL returned from upload
 * @param title - Optional title for the video
 * @returns HTML iframe string
 */
export function createVideoIframe(gatewayUrl: string, title?: string): string {
  const safeUrl = escapeHtmlAttr(gatewayUrl);
  const safeTitle = escapeHtmlAttr(title || 'Video');
  return `<iframe src="${safeUrl}" width="100%" height="400" frameborder="0" allowfullscreen title="${safeTitle}"></iframe>`;
}

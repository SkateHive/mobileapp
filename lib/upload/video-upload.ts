import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

interface VideoUploadResult {
  cid: string;
  gatewayUrl: string;
  requestId?: string;
  sourceApp?: string;
  /**
   * Poster frame the transcoder extracted (or the one we supplied). Optional
   * because it only exists from SkateHive/video-transcoder#2 onwards — both
   * workers run that code now, so either can return it.
   */
  thumbnailUrl?: string;
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
    } | null;
  };
  services: TranscodeService[];
}

const FALLBACK_TRANSCODE_SERVICES: TranscodeService[] = [
  {
    priority: 1,
    name: 'Mac Mini M4 (Primary)',
    healthUrl: 'https://minivlad.tail83ea3e.ts.net/video/healthz',
    transcodeUrl: 'https://minivlad.tail83ea3e.ts.net/video/transcode',
    isHealthy: true,
    responseTime: 0,
    lastChecked: '',
  },
  {
    priority: 2,
    name: 'Oracle (Secondary)',
    healthUrl: 'https://transcode.skatehive.app/healthz',
    transcodeUrl: 'https://transcode.skatehive.app/transcode',
    isHealthy: true,
    responseTime: 0,
    lastChecked: '',
  },
];

/**
 * Get direct transcoding endpoints in priority order.
 * Video blobs must never be posted through Vercel/API proxy routes because normal
 * mobile clips can hit FUNCTION_PAYLOAD_TOO_LARGE before the transcoder sees them.
 */
async function getTranscodeServices(): Promise<TranscodeService[]> {
  const STATUS_API_URL = 'https://api.skatehive.app/api/transcode/status';

  try {
    const response = await fetch(STATUS_API_URL);

    if (!response.ok) {
      throw new Error(`Status API request failed: ${response.status}`);
    }

    const data: TranscodeStatusResponse = await response.json();
    const healthyServices = data.services
      .filter(service => service.isHealthy)
      .sort((a, b) => a.priority - b.priority)
      .filter(service => !service.transcodeUrl.includes('/api/'));

    if (healthyServices.length === 0) {
      throw new Error('No healthy direct transcoding services available');
    }

    return healthyServices;
  } catch {
    return FALLBACK_TRANSCODE_SERVICES;
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

    const services = await getTranscodeServices();
    const errors: string[] = [];

    for (const service of services) {
      const workerApiUrl = service.transcodeUrl;
      const baseUrl = workerApiUrl.replace(/\/transcode$/, '');
      const correlationId = `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}`;

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

      let pollInterval: ReturnType<typeof setInterval> | null = null;
      // clearInterval stops future ticks but can't cancel a poll already in
      // flight. Without this guard a late response lands after the caller has
      // reset its UI and re-writes a stale stage — leaving "Done!" on screen.
      let settled = false;
      if (options.onProgress) {
        options.onProgress(5, 'receiving');
        pollInterval = setInterval(async () => {
          try {
            const resp = await fetch(`${baseUrl}/progress/${correlationId}`, {
              headers: { 'Accept': 'text/event-stream' },
            });
            if (!resp.ok || settled) return;
            const text = await resp.text();
            const lines = text.split('\n').filter(l => l.startsWith('data:'));
            if (lines.length > 0) {
              const lastLine = lines[lines.length - 1];
              const data = JSON.parse(lastLine.replace('data: ', ''));
              // Re-checked here and not only above: reading the body is a second
              // await, and the upload can settle while it's pending.
              if (!settled && data.progress !== undefined) {
                options.onProgress?.(data.progress, data.stage || 'processing');
              }
            }
          } catch {
            // Polling errors are non-fatal
          }
        }, 1500);
      }

      try {
        const uploadResponse = await fetch(workerApiUrl, {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          throw new Error(`${service.name} failed: ${uploadResponse.status} - ${errorText}`);
        }

        const result = await uploadResponse.json();

        if (!result.cid || !result.gatewayUrl) {
          throw new Error(`${service.name} returned an invalid upload response`);
        }

        options.onProgress?.(100, 'complete');

        return {
          cid: result.cid,
          gatewayUrl: result.gatewayUrl,
          requestId: result.requestId,
          sourceApp: result.sourceApp,
          // Narrow at the boundary: the response is untyped, and this value ends
          // up in json_metadata on the blockchain.
          thumbnailUrl:
            typeof result.thumbnailUrl === 'string' && result.thumbnailUrl
              ? result.thumbnailUrl
              : undefined,
        };
      } catch (error) {
        errors.push(error instanceof Error ? error.message : `${service.name} failed`);
      } finally {
        settled = true;
        if (pollInterval) clearInterval(pollInterval);
      }
    }

    throw new Error(`All video upload services failed: ${errors.join(' | ')}`);
  } catch (error) {
    throw new Error(`Video upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    // Always deactivate keep awake, even if upload fails
    deactivateKeepAwake('video-upload');
  }
}

export { createVideoIframe } from './post-assembly';

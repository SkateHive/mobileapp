import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { t } from '~/lib/i18n';
import { describeError, failWith } from './upload-runner';
import {
  canFailOver,
  createStallWatchdog,
  fetchWithTimeout,
  isForwardProgress,
  type UploadProgress,
} from './net';
import { followEventStream } from './sse';

// The status lookup only picks a server; past this, use the built-in list.
const STATUS_TIMEOUT_MS = 5_000;
// Transcoding a clip can take minutes. Once the progress stream has shown real
// movement, an upload whose progress then stops for this long is cut; before
// that, only the hard cap applies (see createStallWatchdog).
const UPLOAD_STALL_MS = 120_000;
const UPLOAD_MAX_MS = 20 * 60_000;

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
    const response = await fetchWithTimeout(STATUS_API_URL, {}, STATUS_TIMEOUT_MS);

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

      const watchdog = createStallWatchdog(UPLOAD_STALL_MS, UPLOAD_MAX_MS);
      let lastProgress: UploadProgress | null = null;
      let failedStatus: number | undefined;
      // A progress event can still arrive after the upload settled (the stream
      // is closed asynchronously); without this guard it would re-write a stale
      // stage over the caller's reset UI.
      let settled = false;
      let closeProgress: (() => void) | null = null;
      if (options.onProgress) {
        options.onProgress(5, 'receiving');
        closeProgress = followEventStream(`${baseUrl}/progress/${correlationId}`, (raw) => {
          if (settled) return;
          let data: { progress?: unknown; stage?: unknown };
          try {
            data = JSON.parse(raw);
          } catch {
            return;
          }
          if (data.progress === undefined) return;
          const next = { progress: Number(data.progress), stage: String(data.stage || 'processing') };
          if (isForwardProgress(lastProgress, next)) {
            lastProgress = next;
            watchdog.kick();
          }
          options.onProgress?.(next.progress, next.stage);
        });
      }

      try {
        const uploadResponse = await fetch(workerApiUrl, {
          method: 'POST',
          body: formData,
          signal: watchdog.signal,
        });

        if (!uploadResponse.ok) {
          failedStatus = uploadResponse.status;
          const errorText = await uploadResponse.text();
          throw failWith('service_failed', { service: service.name, status: uploadResponse.status, detail: errorText });
        }

        const result = await uploadResponse.json();

        if (!result.cid || !result.gatewayUrl) {
          throw failWith('service_invalid', { service: service.name });
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
        // Unless this server refused the video outright, it may still be
        // transcoding it (see canFailOver): stop rather than send it to the
        // next server and transcode it twice.
        if (!canFailOver({ status: failedStatus, watchdogFired: watchdog.reason !== null })) {
          throw failWith('video_unconfirmed', { service: service.name });
        }
        errors.push(error instanceof Error ? describeError(error, t) : t('upload.error.service_fallback', { service: service.name }));
      } finally {
        settled = true;
        watchdog.dispose();
        closeProgress?.();
      }
    }

    throw failWith('video_all_failed', { errors: errors.join(' | ') });
  } catch (error) {
    throw failWith('video_failed', { message: describeError(error, t) }, error);
  } finally {
    // Always deactivate keep awake, even if upload fails
    deactivateKeepAwake('video-upload');
  }
}

export { createVideoIframe } from './post-assembly';

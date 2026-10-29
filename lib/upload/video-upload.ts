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

// The status lookup only picks a server; past this, use the built-in list.
const STATUS_TIMEOUT_MS = 5_000;
const PROGRESS_POLL_TIMEOUT_MS = 4_000;
// Transcoding a clip can take minutes, so an upload is cut when its progress
// stops moving for this long while we poll it. The hard cap always applies.
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

      // Without progress polling there is no proof of life, so no stall limit:
      // the hard cap alone bounds it.
      const watchdog = createStallWatchdog(
        options.onProgress ? UPLOAD_STALL_MS : Infinity,
        UPLOAD_MAX_MS,
      );
      let pollInterval: ReturnType<typeof setInterval> | null = null;
      let polling = false;
      // The server confirmed it has this job (it answered a progress poll).
      let acknowledged = false;
      let lastProgress: UploadProgress | null = null;
      let failedStatus: number | undefined;
      let startedAt = Date.now();
      // clearInterval stops future ticks but can't cancel a poll already in
      // flight. Without this guard a late response lands after the caller has
      // reset its UI and re-writes a stale stage — leaving "Done!" on screen.
      let settled = false;
      if (options.onProgress) {
        options.onProgress(5, 'receiving');
        pollInterval = setInterval(async () => {
          // A slow poll must not pile up behind the next tick.
          if (polling) return;
          polling = true;
          try {
            const resp = await fetchWithTimeout(
              `${baseUrl}/progress/${correlationId}`,
              { headers: { 'Accept': 'text/event-stream' } },
              PROGRESS_POLL_TIMEOUT_MS,
            );
            if (!resp.ok || settled) return;
            const text = await resp.text();
            const lines = text.split('\n').filter(l => l.startsWith('data:'));
            if (lines.length > 0) {
              const lastLine = lines[lines.length - 1];
              const data = JSON.parse(lastLine.replace('data: ', ''));
              // Re-checked here and not only above: reading the body is a second
              // await, and the upload can settle while it's pending.
              if (!settled && data.progress !== undefined) {
                acknowledged = true;
                const next = { progress: Number(data.progress), stage: String(data.stage || 'processing') };
                if (isForwardProgress(lastProgress, next)) {
                  lastProgress = next;
                  watchdog.kick();
                }
                options.onProgress?.(next.progress, next.stage);
              }
            }
          } catch {
            // Polling errors are non-fatal
          } finally {
            polling = false;
          }
        }, 1500);
      }

      try {
        startedAt = Date.now();
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
        // This server may still be transcoding it (see canFailOver): sending
        // the video to the next one would transcode it twice, so stop here.
        if (!canFailOver(
            {
              status: failedStatus,
              watchdogFired: watchdog.reason !== null,
              elapsedMs: Date.now() - startedAt,
            },
            acknowledged,
          )) {
          throw failWith('video_unconfirmed', { service: service.name });
        }
        errors.push(error instanceof Error ? describeError(error, t) : t('upload.error.service_fallback', { service: service.name }));
      } finally {
        settled = true;
        watchdog.dispose();
        if (pollInterval) clearInterval(pollInterval);
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

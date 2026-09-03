// Pure module: no React Native or Expo imports, so the tests run under plain
// Node (`pnpm test`). The store and provider own all I/O.

export type UploadStatus =
  | "uploading"    // media bytes leaving the device (server stage "receiving")
  | "transcoding"  // server stages "transcoding" | "optimized" | "uploading" (to IPFS)
  | "publishing"   // parent lookup, double-post guard, broadcast
  | "published"
  | "failed";

export type MediaKind = "image" | "video" | null;

export type UploadErrorKind = "network" | "server" | "auth" | "broadcast" | "unknown";

export type ResumeKind = "launch" | "foreground";

export interface UploadError {
  kind: UploadErrorKind;
  message: string;
}

export interface UploadDraft {
  caption: string;
  mediaKind: MediaKind;
  mediaUri: string | null;  // file:// inside Paths.document/uploads/<id>/
  mime: string | null;
  fileName: string | null;
  coverUri: string | null;  // file:// copy of the picked frame
  igCaption: string;
  crossPostToInstagram: boolean;
  tags: string[];           // [communityTag] at enqueue; buildTags adds body hashtags at publish
}

export interface UploadResult {
  coverUrl?: string;        // images.hive.blog url of the cover
  imageUrl?: string;        // image posts
  cid?: string;             // video posts
  gatewayUrl?: string;
  thumbnailUrl?: string;    // worker-extracted frame
  parentAuthor?: string;
  parentPermlink?: string;
}

export interface UploadTimestamps {
  createdAt: number;
  updatedAt: number;
  attemptStartedAt: number | null;
  backgroundedAt: number | null;
  publishedAt: number | null;
}

export interface UploadJob {
  id: string;
  author: string;             // session.username at enqueue; never the key or token
  permlink: string;           // fixed at enqueue so the double-post guard can find it
  status: UploadStatus;
  progress: number;           // 0-100, monotonic within an attempt
  stage: string;              // "receiving" | "transcoding" | "optimized" | "uploading" | "complete" | "cover" | "parent" | "guard" | "broadcast"
  pendingResume: ResumeKind | null;   // pill shows "Resuming…" while set
  draft: UploadDraft;
  result: UploadResult;
  error: UploadError | null;
  attempts: number;           // runner starts, manual retries included
  autoRetries: number;        // automatic foreground retries since the last manual retry / enqueue
  timestamps: UploadTimestamps;
}

export type UploadEvent =
  | { type: "enqueued"; job: UploadJob }
  | { type: "started"; at: number }
  | { type: "progress"; progress: number; stage: string }
  | { type: "cover_done"; coverUrl: string }
  | { type: "cover_skipped" }
  | { type: "media_done"; imageUrl?: string; cid?: string; gatewayUrl?: string; thumbnailUrl?: string }
  | { type: "parent_done"; parentAuthor: string; parentPermlink: string }
  | { type: "published"; at: number }
  | { type: "failed"; error: UploadError; appActive: boolean; at: number }
  | { type: "retry"; at: number }
  | { type: "resume"; kind: ResumeKind; at: number }
  | { type: "backgrounded"; at: number }
  | { type: "cleared" };

export const UPLOAD_STATUSES: readonly UploadStatus[] = [
  "uploading",
  "transcoding",
  "publishing",
  "published",
  "failed",
];

const ACTIVE_STATUSES: readonly UploadStatus[] = ["uploading", "transcoding", "publishing"];

export function isJobActive(job: UploadJob | null | undefined): job is UploadJob {
  return !!job && ACTIVE_STATUSES.includes(job.status);
}

export interface CreateJobInput {
  id: string;
  author: string;
  permlink: string;
  caption: string;
  mediaKind: MediaKind;
  mediaUri: string | null;
  mime: string | null;
  fileName: string | null;
  coverUri: string | null;
  igCaption: string;
  crossPostToInstagram: boolean;
  communityTag: string;
  now: number;
}

export function createJob(input: CreateJobInput): UploadJob {
  const hasMedia = input.mediaKind !== null && input.mediaUri !== null;
  return {
    id: input.id,
    author: input.author,
    permlink: input.permlink,
    status: hasMedia ? "uploading" : "publishing",
    progress: hasMedia ? 0 : 100,
    stage: hasMedia ? "receiving" : "parent",
    pendingResume: null,
    draft: {
      caption: input.caption,
      mediaKind: hasMedia ? input.mediaKind : null,
      mediaUri: hasMedia ? input.mediaUri : null,
      mime: hasMedia ? input.mime : null,
      fileName: hasMedia ? input.fileName : null,
      coverUri: input.mediaKind === "video" ? input.coverUri : null,
      igCaption: input.igCaption,
      crossPostToInstagram: input.crossPostToInstagram,
      tags: [input.communityTag],
    },
    result: {},
    error: null,
    attempts: 0,
    autoRetries: 0,
    timestamps: {
      createdAt: input.now,
      updatedAt: input.now,
      attemptStartedAt: null,
      backgroundedAt: null,
      publishedAt: null,
    },
  };
}

function needsMediaLeg(job: UploadJob): boolean {
  if (job.draft.mediaKind === "video") return !job.result.cid;
  if (job.draft.mediaKind === "image") return !job.result.imageUrl;
  return false;
}

function statusForStage(stage: string, current: UploadStatus): UploadStatus {
  switch (stage) {
    case "receiving":
      return "uploading";
    case "transcoding":
    case "optimized":
    case "uploading":
      return "transcoding";
    case "complete":
      return "publishing";
    default:
      return current;
  }
}

/** Where a retry or resume lands: re-run the media leg from zero, or go straight to publish. */
function restartTarget(job: UploadJob): Pick<UploadJob, "status" | "progress" | "stage"> {
  if (needsMediaLeg(job)) return { status: "uploading", progress: 0, stage: "receiving" };
  return { status: "publishing", progress: job.progress, stage: "parent" };
}

function clampProgress(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function ignored(job: UploadJob | null, event: UploadEvent): UploadJob | null {
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.warn(`[upload-job] ignored "${event.type}" while ${job ? job.status : "empty"}`);
  }
  return job;
}

/**
 * Pure and total. An event that does not apply to the current status returns
 * the job unchanged (same reference) so callers can detect no-ops.
 */
export function reduce(job: UploadJob | null, event: UploadEvent): UploadJob | null {
  if (event.type === "enqueued") {
    return job === null ? event.job : ignored(job, event);
  }
  if (job === null) return ignored(job, event);
  if (event.type === "cleared") return null;
  if (event.type === "backgrounded") {
    return { ...job, timestamps: { ...job.timestamps, backgroundedAt: event.at, updatedAt: event.at } };
  }

  const active = isJobActive(job);

  switch (event.type) {
    case "started": {
      if (!active) return ignored(job, event);
      return {
        ...job,
        attempts: job.attempts + 1,
        error: null,
        timestamps: { ...job.timestamps, attemptStartedAt: event.at, updatedAt: event.at },
      };
    }
    case "progress": {
      if (!active) return ignored(job, event);
      return {
        ...job,
        status: statusForStage(event.stage, job.status),
        progress: Math.max(job.progress, clampProgress(event.progress)),
        stage: event.stage,
        pendingResume: null,
      };
    }
    case "cover_done": {
      if (!active) return ignored(job, event);
      return { ...job, result: { ...job.result, coverUrl: event.coverUrl }, pendingResume: null };
    }
    case "cover_skipped": {
      if (!active) return ignored(job, event);
      return { ...job, pendingResume: null };
    }
    case "media_done": {
      if (job.status !== "uploading" && job.status !== "transcoding") return ignored(job, event);
      const merged: UploadResult = { ...job.result };
      if (event.imageUrl !== undefined) merged.imageUrl = event.imageUrl;
      if (event.cid !== undefined) merged.cid = event.cid;
      if (event.gatewayUrl !== undefined) merged.gatewayUrl = event.gatewayUrl;
      if (event.thumbnailUrl !== undefined) merged.thumbnailUrl = event.thumbnailUrl;
      return { ...job, status: "publishing", progress: 100, stage: "parent", pendingResume: null, result: merged };
    }
    case "parent_done": {
      if (job.status !== "publishing") return ignored(job, event);
      return {
        ...job,
        result: { ...job.result, parentAuthor: event.parentAuthor, parentPermlink: event.parentPermlink },
        stage: "guard",
        pendingResume: null,
      };
    }
    case "published": {
      if (job.status !== "publishing") return ignored(job, event);
      return {
        ...job,
        status: "published",
        progress: 100,
        stage: "complete",
        error: null,
        pendingResume: null,
        timestamps: { ...job.timestamps, publishedAt: event.at, updatedAt: event.at },
      };
    }
    case "failed": {
      if (!active) return ignored(job, event);
      const { attemptStartedAt, backgroundedAt } = job.timestamps;
      const autoRetry =
        event.error.kind === "network" &&
        event.appActive &&
        job.autoRetries === 0 &&
        attemptStartedAt !== null &&
        backgroundedAt !== null &&
        backgroundedAt > attemptStartedAt;
      if (autoRetry) {
        return {
          ...job,
          ...restartTarget(job),
          pendingResume: "foreground",
          autoRetries: job.autoRetries + 1,
          error: event.error,
          timestamps: { ...job.timestamps, updatedAt: event.at },
        };
      }
      return {
        ...job,
        status: "failed",
        pendingResume: null,
        error: event.error,
        timestamps: { ...job.timestamps, updatedAt: event.at },
      };
    }
    case "retry": {
      if (job.status !== "failed") return ignored(job, event);
      return {
        ...job,
        ...restartTarget(job),
        error: null,
        autoRetries: 0,
        pendingResume: null,
        timestamps: { ...job.timestamps, updatedAt: event.at },
      };
    }
    case "resume": {
      if (event.kind === "foreground") {
        if (job.status !== "failed") return ignored(job, event);
        return {
          ...job,
          ...restartTarget(job),
          error: null,
          autoRetries: job.autoRetries + 1,
          pendingResume: "foreground",
          timestamps: { ...job.timestamps, updatedAt: event.at },
        };
      }
      if (!active) return ignored(job, event);
      return { ...job, pendingResume: "launch", timestamps: { ...job.timestamps, updatedAt: event.at } };
    }
    default:
      return ignored(job, event);
  }
}

export function pillLabel(job: UploadJob): string {
  if (job.pendingResume !== null) return "Resuming…";
  const pct = Math.round(job.progress);
  switch (job.status) {
    case "uploading":
      return `Uploading… ${pct}%`;
    case "transcoding":
      return job.stage === "uploading" ? `Pinning… ${pct}%` : `Transcoding… ${pct}%`;
    case "publishing":
      return "Publishing…";
    case "published":
      return "Published";
    case "failed":
      return "Upload failed";
  }
}

export function pillDetail(job: UploadJob): string {
  if (job.pendingResume !== null) return "Picking up where it left off";
  switch (job.status) {
    case "uploading":
      return "Sending to server";
    case "transcoding":
      if (job.stage === "uploading") return "Uploading to IPFS";
      if (job.stage === "optimized") return "Video already optimized";
      return "Transcoding video";
    case "publishing":
      return "Posting to Hive";
    case "published":
      return "Tap to open";
    case "failed":
      return job.error?.message ?? "Something went wrong";
  }
}

/**
 * Validates the persisted JSON. Unknown status or a missing id/permlink/author
 * means the file is unusable; the store deletes it and starts empty.
 * `pendingResume` is always reset: the provider decides whether to resume.
 */
export function parsePersistedJob(text: string): UploadJob | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const j = raw as Record<string, unknown>;
  if (typeof j.id !== "string" || j.id.length === 0) return null;
  if (typeof j.permlink !== "string" || j.permlink.length === 0) return null;
  if (typeof j.author !== "string" || j.author.length === 0) return null;
  if (typeof j.status !== "string" || !UPLOAD_STATUSES.includes(j.status as UploadStatus)) return null;
  if (typeof j.draft !== "object" || j.draft === null) return null;
  if (typeof j.timestamps !== "object" || j.timestamps === null) return null;
  const result: UploadResult =
    typeof j.result === "object" && j.result !== null ? (j.result as UploadResult) : {};
  return { ...(raw as UploadJob), result, pendingResume: null };
}

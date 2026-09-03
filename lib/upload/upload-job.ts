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

// Pure runner: the leg sequence over the job it was given, all I/O through
// `deps`. Never throws — every failure becomes a `failed` event. Imports
// nothing from React Native, Expo or hive-utils so `pnpm test` runs under Node.
import type { UploadError, UploadErrorKind, UploadEvent, UploadJob, UploadResult } from "./upload-job";
import { buildBody, buildImages, buildJsonMetadata, buildTags } from "./post-assembly";

/** Same shape as `PostCommentArgs` in lib/posting.ts, redeclared to keep this module pure. */
export interface BroadcastArgs {
  parentAuthor: string;
  parentPermlink: string;
  body: string;
  permlink: string;
  jsonMetadata: Record<string, unknown>;
}

export interface RunnerCrossPostArgs {
  permlink: string;
  body: string;
  tags: string[];
  imageUrl?: string;
  videoUrl?: string;
  caption?: string;
}

export interface RunnerDeps {
  uploadImage(uri: string, name: string, mime: string): Promise<{ url: string }>;
  uploadVideo(
    uri: string,
    name: string,
    mime: string,
    opts: { thumbnailUrl?: string; onProgress(progress: number, stage: string): void },
  ): Promise<{ cid: string; gatewayUrl: string; thumbnailUrl?: string }>;
  /** getLastSnapsContainer; the runner applies the community fallback on throw. */
  getParent(): Promise<{ author: string; permlink: string }>;
  /** Must THROW on RPC error (fail closed) and return null only when the post does not exist. */
  getContent(author: string, permlink: string): Promise<{ author: string } | null>;
  broadcast(args: BroadcastArgs): Promise<void>;
  crossPost?(args: RunnerCrossPostArgs): Promise<void>;
  communityTag: string;
  /** SNAPS_CONTAINER_AUTHOR: cross-post only when the parent is the main snaps feed. */
  snapsContainerAuthor: string;
  now(): number;
}

export type Emit = (event: UploadEvent) => UploadJob | null;

/** An error whose kind is already known to the leg that raised it. */
export class UploadRunError extends Error {
  kind: UploadErrorKind;
  constructor(kind: UploadErrorKind, message: string) {
    super(message);
    this.name = "UploadRunError";
    this.kind = kind;
  }
}

const MAX_MESSAGE = 200;

export function classifyError(error: unknown): UploadError {
  if (error instanceof UploadRunError) {
    return { kind: error.kind, message: error.message.slice(0, MAX_MESSAGE) };
  }
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "Something went wrong";
  const name = error instanceof Error ? error.name : "";
  if (
    name === "AbortError" ||
    // image-upload.ts wraps fetch failures in a plain Error (not a
    // TypeError); matching on the message alone, regardless of error type,
    // keeps foreground auto-retry working for image posts too.
    /network request failed/i.test(message) ||
    /All video upload services failed/i.test(message)
  ) {
    return { kind: "network", message: message.slice(0, MAX_MESSAGE) };
  }
  if (/\b[45]\d{2}\b/.test(message)) {
    return { kind: "server", message: message.slice(0, MAX_MESSAGE) };
  }
  return { kind: "unknown", message: message.slice(0, MAX_MESSAGE) };
}

export async function runUploadJob(job: UploadJob, deps: RunnerDeps, emit: Emit): Promise<void> {
  // The store may have discarded the job while a leg was in flight; `emit`
  // returns the job the store now holds, so a null or different id means stop.
  const alive = (event: UploadEvent): boolean => {
    const next = emit(event);
    return next !== null && next.id === job.id;
  };
  const fail = (error: unknown): void => {
    // `appActive` is a placeholder; the provider's emit wrapper stamps the real value.
    emit({ type: "failed", error: classifyError(error), appActive: true, at: deps.now() });
  };

  if (!alive({ type: "started", at: deps.now() })) return;

  const { draft } = job;
  const result: UploadResult = { ...job.result };

  try {
    // Leg 1: cover (video only, best-effort, skipped when already uploaded).
    if (draft.mediaKind === "video" && draft.coverUri && !result.coverUrl) {
      try {
        const cover = await deps.uploadImage(draft.coverUri, "cover.jpg", "image/jpeg");
        result.coverUrl = cover.url;
        if (!alive({ type: "cover_done", coverUrl: cover.url })) return;
      } catch (coverError) {
        console.warn("[upload-runner] cover upload failed, using the worker's frame:", coverError);
        if (!alive({ type: "cover_skipped" })) return;
      }
    }

    // Leg 2: media (skipped when the result already carries it).
    if (draft.mediaKind === "image" && !result.imageUrl) {
      if (!draft.mediaUri || !draft.mime) {
        throw new UploadRunError("unknown", "The image is no longer on this device");
      }
      const image = await deps.uploadImage(draft.mediaUri, draft.fileName ?? `${job.id}.jpg`, draft.mime);
      result.imageUrl = image.url;
      if (!alive({ type: "media_done", imageUrl: image.url })) return;
    } else if (draft.mediaKind === "video" && !result.cid) {
      if (!draft.mediaUri || !draft.mime) {
        throw new UploadRunError("unknown", "The video is no longer on this device");
      }
      const video = await deps.uploadVideo(draft.mediaUri, draft.fileName ?? `${job.id}.mp4`, draft.mime, {
        thumbnailUrl: result.coverUrl,
        onProgress: (progress, stage) => {
          // `complete` would move the reducer to publishing before media_done
          // arrives and get media_done ignored; media_done carries completion.
          if (stage === "complete") return;
          emit({ type: "progress", progress, stage });
        },
      });
      result.cid = video.cid;
      result.gatewayUrl = video.gatewayUrl;
      result.thumbnailUrl = video.thumbnailUrl;
      if (
        !alive({
          type: "media_done",
          cid: video.cid,
          gatewayUrl: video.gatewayUrl,
          thumbnailUrl: video.thumbnailUrl,
        })
      ) {
        return;
      }
    }

    // Leg 3: publish.
    let parent = { author: "", permlink: deps.communityTag };
    try {
      parent = await deps.getParent();
    } catch (parentError) {
      console.warn("[upload-runner] no snaps container, using the community fallback:", parentError);
    }
    if (!alive({ type: "parent_done", parentAuthor: parent.author, parentPermlink: parent.permlink })) return;

    // Double-post guard. Fails closed: an RPC error is a network failure, not a green light.
    let existing: { author: string } | null;
    try {
      existing = await deps.getContent(job.author, job.permlink);
    } catch (guardError) {
      throw new UploadRunError(
        "network",
        `Could not confirm whether the post exists: ${guardError instanceof Error ? guardError.message : String(guardError)}`,
      );
    }

    const body = buildBody(draft.caption, result);
    const tags = buildTags(body, deps.communityTag);
    const images = buildImages(result);

    if (!existing) {
      try {
        await deps.broadcast({
          parentAuthor: parent.author,
          parentPermlink: parent.permlink,
          body,
          permlink: job.permlink,
          jsonMetadata: buildJsonMetadata(tags, images),
        });
      } catch (broadcastError) {
        throw new UploadRunError(
          "broadcast",
          broadcastError instanceof Error ? broadcastError.message : "Broadcast failed",
        );
      }
    }

    if (!alive({ type: "published", at: deps.now() })) return;

    // Leg 4: cross-post, fire-and-forget, main feed only, never affects job state.
    const igImage = images[0];
    const igVideo = result.gatewayUrl;
    if (
      draft.crossPostToInstagram &&
      deps.crossPost &&
      parent.author === deps.snapsContainerAuthor &&
      (igImage || igVideo)
    ) {
      deps
        .crossPost({
          permlink: job.permlink,
          body,
          tags,
          imageUrl: igImage,
          videoUrl: igVideo,
          caption: draft.igCaption.trim() || undefined,
        })
        .catch((e: unknown) => {
          console.warn("[instagram] cross-post unconfirmed:", e instanceof Error ? e.message : e);
        });
    }
  } catch (error) {
    fail(error);
  }
}

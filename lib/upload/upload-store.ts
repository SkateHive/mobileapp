// Single-job store. Same shape as the grid visibility store in
// components/Profile/GridVideoTile.tsx: a module-level value, a Set of
// listeners, subscribe/getSnapshot for useSyncExternalStore. This is the only
// module that touches expo-file-system for the upload job.
import { useSyncExternalStore } from "react";
import { Directory, File, Paths } from "expo-file-system";
import type { AuthSession } from "~/lib/types";
import {
  createJob,
  isJobActive,
  parsePersistedJob,
  reduce,
  type MediaKind,
  type UploadEvent,
  type UploadJob,
} from "./upload-job";
import { makePermlink } from "./post-assembly";

export class UploadBusyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadBusyError";
  }
}

export interface EnqueueInput {
  caption: string;
  mediaKind: MediaKind;
  mediaUri: string | null;
  mime: string | null;
  coverUri: string | null;
  igCaption: string;
  crossPostToInstagram: boolean;
  communityTag: string;
}

const UPLOADS_DIR_NAME = "uploads";
const JOB_FILE_NAME = "job.json";

let job: UploadJob | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): UploadJob | null {
  return job;
}

export function getJob(): UploadJob | null {
  return job;
}

export function useUploadJob(): UploadJob | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// --- Persistence -----------------------------------------------------------

function uploadsDir(): Directory {
  return new Directory(Paths.document, UPLOADS_DIR_NAME);
}

function jobFile(): File {
  return new File(Paths.document, UPLOADS_DIR_NAME, JOB_FILE_NAME);
}

function jobDir(jobId: string): Directory {
  return new Directory(Paths.document, UPLOADS_DIR_NAME, jobId);
}

/** Written whole on every transition. Awaited by nothing; a failure keeps the in-memory job. */
function persist(current: UploadJob | null): void {
  try {
    const file = jobFile();
    if (current === null) {
      if (file.exists) file.delete();
      return;
    }
    uploadsDir().create({ intermediates: true, idempotent: true });
    file.write(JSON.stringify(current));
  } catch (error) {
    console.warn("[upload-store] could not persist job:", error);
  }
}

export function deleteJobFiles(jobId: string): void {
  try {
    const dir = jobDir(jobId);
    if (dir.exists) dir.delete();
  } catch (error) {
    console.warn("[upload-store] could not delete job directory:", error);
  }
}

function clampProgress(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

/**
 * Ruling (a): any throw while reading, parsing or validating job.json means
 * "no job" — we return null and remove the file (and, if we at least know the
 * job's id, its per-job media directory too) so a corrupt/partial file never
 * wedges the store. `parsePersistedJob` only checks id/permlink/author/status,
 * so `progress` is re-clamped into 0..100 here before the job is re-hydrated.
 */
export async function loadPersistedJob(): Promise<UploadJob | null> {
  // Never clobber an in-memory job that arrived while this read was in
  // flight (a user enqueue racing auth hydration, or a dev remount): the
  // caller only wants the persisted job when the store is still empty.
  if (job !== null) return job;
  const file = jobFile();
  let rawId: string | null = null;
  try {
    if (!file.exists) return null;
    const text = await file.text();
    try {
      const raw = JSON.parse(text) as { id?: unknown };
      if (typeof raw?.id === "string") rawId = raw.id;
    } catch {
      // ignore: parsePersistedJob below will fail the same JSON and we'll
      // clean up with whatever id (if any) we already captured.
    }
    const parsed = parsePersistedJob(text);
    if (parsed === null) throw new Error("persisted job.json failed validation");
    const hydrated: UploadJob = { ...parsed, progress: clampProgress(parsed.progress) };
    job = hydrated;
    notify();
    return hydrated;
  } catch (error) {
    console.warn("[upload-store] could not read persisted job, discarding:", error);
    try {
      if (file.exists) file.delete();
    } catch (deleteError) {
      console.warn("[upload-store] could not delete unusable job.json:", deleteError);
    }
    if (rawId) deleteJobFiles(rawId);
    return null;
  }
}

// --- Transitions -----------------------------------------------------------

export function dispatch(event: UploadEvent): UploadJob | null {
  const next = reduce(job, event);
  if (next === job) return job; // no-op transition, nothing to notify or persist
  job = next;
  // Persist before notify: a listener (the runner's onStoreChange) may
  // dispatch again synchronously, which reassigns the module-level `job`
  // and persists its own newer value. If notify() ran first, this frame's
  // persist(next) below would run after that nested persist and overwrite
  // disk with this stale `next`, even though `job` in memory had moved on.
  persist(next);
  notify();
  return next;
}

// --- Enqueue / discard -----------------------------------------------------

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/heic": "heic",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-msvideo": "avi",
  "video/x-ms-wmv": "wmv",
};

function extensionFor(uri: string, mime: string | null, mediaKind: MediaKind): string {
  const fileName = uri.split("?")[0].split("/").pop() ?? "";
  const dot = fileName.lastIndexOf(".");
  const fromUri = dot > 0 ? fileName.slice(dot + 1).toLowerCase() : "";
  if (/^[a-z0-9]{1,5}$/.test(fromUri)) return fromUri;
  if (mime && MIME_EXTENSIONS[mime]) return MIME_EXTENSIONS[mime];
  return mediaKind === "image" ? "jpg" : "mp4";
}

function makeJobId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Copies the media and cover into Paths.document/uploads/<id>/ (the pickers
 * write to the cache dir, which iOS may purge), builds the job and dispatches
 * `enqueued`. Throws UploadBusyError only while a job is active or failed.
 * A lingering `published` job is not "busy" and must not block a new post,
 * but it is only cleared once the new job's media copy has succeeded —
 * see the comment above the `dispatch({ type: "enqueued" })` call below for
 * why the clear happens there and not up front.
 *
 * Ruling (b): `createJob` only keeps `coverUri` when `mediaKind === "video"`,
 * regardless of whether media is present, so a video job with no `mediaUri`
 * would silently keep a cover but drop into the media-less ("publishing")
 * path. We close that off here: a "video" mediaKind must carry a mediaUri,
 * or the input is rejected before anything is copied or dispatched.
 */
export async function enqueue(input: EnqueueInput, session: AuthSession): Promise<UploadJob> {
  const existing = job;
  // Set only when the current job is `published`: it isn't "busy" (only
  // active/failed throw below), but it must not be cleared until the new
  // job is guaranteed to be created — see below.
  let publishedIdToClear: string | null = null;
  if (existing !== null) {
    if (isJobActive(existing)) throw new UploadBusyError("Wait for the current upload to finish");
    if (existing.status === "failed") throw new UploadBusyError("Retry or discard the failed upload first");
    if (existing.status === "published") publishedIdToClear = existing.id;
  }
  if (input.mediaKind === "video" && !input.mediaUri) {
    throw new Error("A video upload requires media");
  }

  const id = makeJobId();
  const dir = jobDir(id);
  let mediaUri: string | null = null;
  let coverUri: string | null = null;
  let fileName: string | null = null;

  try {
    dir.create({ intermediates: true, idempotent: true });
    if (input.mediaUri && input.mediaKind) {
      const ext = extensionFor(input.mediaUri, input.mime, input.mediaKind);
      const target = new File(dir, `media.${ext}`);
      new File(input.mediaUri).copy(target);
      mediaUri = target.uri;
      // Keep the original name: the transcoder reads the extension from it.
      fileName = input.mediaUri.split("/").pop() || `${Date.now()}.${ext}`;
    }
    if (input.mediaKind === "video" && input.coverUri) {
      const target = new File(dir, "cover.jpg");
      new File(input.coverUri).copy(target);
      coverUri = target.uri;
    }
  } catch (error) {
    // Only the half-made NEW job dir is removed here. The lingering
    // published job (if any) has not been touched yet, so a validation or
    // copy failure never leaves the user's completed post disappeared with
    // no replacement job created.
    deleteJobFiles(id);
    throw error instanceof Error ? error : new Error("Could not copy the media for upload");
  }

  const created = createJob({
    id,
    author: session.username,
    permlink: makePermlink(),
    caption: input.caption,
    mediaKind: mediaUri ? input.mediaKind : null,
    mediaUri,
    mime: mediaUri ? input.mime : null,
    fileName,
    coverUri,
    igCaption: input.igCaption,
    crossPostToInstagram: input.crossPostToInstagram,
    communityTag: input.communityTag,
    now: Date.now(),
  });
  // Only now — after the new job's media copy has succeeded and `created`
  // is ready to dispatch — clear a lingering published job. `reduce`'s
  // "enqueued" handler only accepts a new job when the store is empty, so
  // the clear must be atomic with (immediately before) the `enqueued`
  // dispatch: doing it any earlier risks deleting the finished post's
  // dir/json and then failing validation or the copy, leaving neither job
  // in the store.
  if (publishedIdToClear !== null) {
    dispatch({ type: "cleared" });
    deleteJobFiles(publishedIdToClear);
  }
  dispatch({ type: "enqueued", job: created });
  return created;
}

/** Drops the job and its files. In-flight results are ignored: their job.id no longer matches. */
export function discard(): void {
  const current = job;
  dispatch({ type: "cleared" });
  if (current) deleteJobFiles(current.id);
}

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createJob,
  isJobActive,
  reduce,
  pillLabel,
  pillDetail,
  parsePersistedJob,
  type CreateJobInput,
  type UploadEvent,
  type UploadJob,
} from "../upload-job";

const NOW = 1_700_000_000_000;

export function videoInput(overrides: Partial<CreateJobInput> = {}): CreateJobInput {
  return {
    id: "job-1",
    author: "skater",
    permlink: "sh-20260903t101500",
    caption: "Kickflip #skate",
    mediaKind: "video",
    mediaUri: "file:///Documents/uploads/job-1/media.mov",
    mime: "video/quicktime",
    fileName: "IMG_0001.MOV",
    coverUri: "file:///Documents/uploads/job-1/cover.jpg",
    igCaption: "",
    crossPostToInstagram: false,
    communityTag: "hive-173115",
    now: NOW,
    ...overrides,
  };
}

test("createJob: media draft starts uploading at 0% with stage receiving", () => {
  const job = createJob(videoInput());
  assert.equal(job.status, "uploading");
  assert.equal(job.progress, 0);
  assert.equal(job.stage, "receiving");
  assert.equal(job.attempts, 0);
  assert.equal(job.autoRetries, 0);
  assert.equal(job.pendingResume, null);
  assert.equal(job.error, null);
  assert.deepEqual(job.result, {});
  assert.deepEqual(job.draft.tags, ["hive-173115"]);
  assert.equal(job.timestamps.createdAt, NOW);
  assert.equal(job.timestamps.attemptStartedAt, null);
  assert.equal(isJobActive(job), true);
});

test("createJob: text-only draft starts publishing at 100% with stage parent", () => {
  const job = createJob(videoInput({ mediaKind: null, mediaUri: null, mime: null, fileName: null, coverUri: null }));
  assert.equal(job.status, "publishing");
  assert.equal(job.progress, 100);
  assert.equal(job.stage, "parent");
  assert.equal(job.draft.mediaKind, null);
  assert.equal(job.draft.coverUri, null);
});

test("createJob: an image draft never keeps a cover", () => {
  const job = createJob(videoInput({ mediaKind: "image", mime: "image/jpeg", fileName: "IMG_0002.JPG" }));
  assert.equal(job.draft.coverUri, null);
});

test("isJobActive is false for null, published and failed", () => {
  assert.equal(isJobActive(null), false);
  assert.equal(isJobActive({ ...createJob(videoInput()), status: "published" }), false);
  assert.equal(isJobActive({ ...createJob(videoInput()), status: "failed" }), false);
});

function run(job: UploadJob | null, ...events: UploadEvent[]): UploadJob | null {
  return events.reduce<UploadJob | null>((acc, e) => reduce(acc, e), job);
}

function activeVideo(): UploadJob {
  return reduce(null, { type: "enqueued", job: createJob(videoInput()) }) as UploadJob;
}

test("enqueued only applies to an empty store", () => {
  const first = createJob(videoInput());
  const enqueued = reduce(null, { type: "enqueued", job: first });
  assert.equal(enqueued, first);
  const second = createJob(videoInput({ id: "job-2" }));
  assert.equal(reduce(enqueued, { type: "enqueued", job: second }), enqueued);
});

test("started increments attempts, stamps attemptStartedAt, clears error, keeps pendingResume", () => {
  const job = { ...activeVideo(), pendingResume: "launch" as const, error: { kind: "network" as const, message: "x" } };
  const next = reduce(job, { type: "started", at: NOW + 10 }) as UploadJob;
  assert.equal(next.attempts, 1);
  assert.equal(next.timestamps.attemptStartedAt, NOW + 10);
  assert.equal(next.timestamps.updatedAt, NOW + 10);
  assert.equal(next.error, null);
  assert.equal(next.pendingResume, "launch");
});

test("progress maps server stages to statuses and never decreases", () => {
  let job = activeVideo();
  job = reduce(job, { type: "progress", progress: 5, stage: "receiving" }) as UploadJob;
  assert.equal(job.status, "uploading");
  job = reduce(job, { type: "progress", progress: 40, stage: "transcoding" }) as UploadJob;
  assert.equal(job.status, "transcoding");
  assert.equal(job.stage, "transcoding");
  job = reduce(job, { type: "progress", progress: 30, stage: "optimized" }) as UploadJob;
  assert.equal(job.progress, 40, "progress is monotonic within an attempt");
  assert.equal(job.stage, "optimized");
  job = reduce(job, { type: "progress", progress: 80, stage: "uploading" }) as UploadJob;
  assert.equal(job.status, "transcoding");
  job = reduce(job, { type: "progress", progress: 100, stage: "complete" }) as UploadJob;
  assert.equal(job.status, "publishing");
});

test("progress clears pendingResume", () => {
  const job = { ...activeVideo(), pendingResume: "launch" as const };
  const next = reduce(job, { type: "progress", progress: 5, stage: "receiving" }) as UploadJob;
  assert.equal(next.pendingResume, null);
});

test("cover_done stores coverUrl; cover_skipped leaves result alone; both clear pendingResume", () => {
  const job = { ...activeVideo(), pendingResume: "foreground" as const };
  const done = reduce(job, { type: "cover_done", coverUrl: "https://images.hive.blog/c.jpg" }) as UploadJob;
  assert.equal(done.result.coverUrl, "https://images.hive.blog/c.jpg");
  assert.equal(done.pendingResume, null);
  const skipped = reduce(job, { type: "cover_skipped" }) as UploadJob;
  assert.deepEqual(skipped.result, {});
  assert.equal(skipped.pendingResume, null);
});

test("media_done moves uploading/transcoding to publishing at 100% with stage parent", () => {
  const job = reduce(activeVideo(), { type: "progress", progress: 60, stage: "transcoding" }) as UploadJob;
  const next = reduce(job, {
    type: "media_done",
    cid: "bafy1",
    gatewayUrl: "https://ipfs.skatehive.app/ipfs/bafy1",
    thumbnailUrl: "https://ipfs.skatehive.app/ipfs/bafy1/thumb.jpg",
  }) as UploadJob;
  assert.equal(next.status, "publishing");
  assert.equal(next.progress, 100);
  assert.equal(next.stage, "parent");
  assert.equal(next.result.cid, "bafy1");
  assert.equal(next.result.gatewayUrl, "https://ipfs.skatehive.app/ipfs/bafy1");
  assert.equal(next.result.thumbnailUrl, "https://ipfs.skatehive.app/ipfs/bafy1/thumb.jpg");
});

test("media_done for an image stores imageUrl", () => {
  const job = reduce(null, {
    type: "enqueued",
    job: createJob(videoInput({ mediaKind: "image", mime: "image/jpeg", coverUri: null })),
  }) as UploadJob;
  const next = reduce(job, { type: "media_done", imageUrl: "https://images.hive.blog/i.jpg" }) as UploadJob;
  assert.equal(next.status, "publishing");
  assert.equal(next.result.imageUrl, "https://images.hive.blog/i.jpg");
});

test("media_done is ignored while publishing", () => {
  const job = run(activeVideo(), { type: "media_done", cid: "a", gatewayUrl: "g" }) as UploadJob;
  assert.equal(reduce(job, { type: "media_done", cid: "b", gatewayUrl: "h" }), job);
});

test("parent_done stores the parent and moves stage to guard", () => {
  const job = run(activeVideo(), { type: "media_done", cid: "a", gatewayUrl: "g" }) as UploadJob;
  const next = reduce(job, { type: "parent_done", parentAuthor: "peak.snaps", parentPermlink: "snaps-1" }) as UploadJob;
  assert.equal(next.result.parentAuthor, "peak.snaps");
  assert.equal(next.result.parentPermlink, "snaps-1");
  assert.equal(next.stage, "guard");
  const stillUploading = reduce(activeVideo(), { type: "parent_done", parentAuthor: "a", parentPermlink: "b" }) as UploadJob;
  assert.equal(stillUploading.status, "uploading");
});

test("published is terminal except for cleared", () => {
  const job = run(activeVideo(), { type: "media_done", cid: "a", gatewayUrl: "g" }) as UploadJob;
  const published = reduce(job, { type: "published", at: NOW + 99 }) as UploadJob;
  assert.equal(published.status, "published");
  assert.equal(published.progress, 100);
  assert.equal(published.timestamps.publishedAt, NOW + 99);
  assert.equal(published.error, null);
  assert.equal(reduce(published, { type: "started", at: 1 }), published);
  assert.equal(reduce(published, { type: "retry", at: 1 }), published);
  assert.equal(reduce(published, { type: "progress", progress: 1, stage: "receiving" }), published);
  assert.equal(reduce(published, { type: "cleared" }), null);
});

test("published is ignored outside publishing", () => {
  const job = activeVideo();
  assert.equal(reduce(job, { type: "published", at: 1 }), job);
});

test("backgrounded stamps backgroundedAt on any job; cleared empties any job", () => {
  const job = activeVideo();
  assert.equal((reduce(job, { type: "backgrounded", at: NOW + 5 }) as UploadJob).timestamps.backgroundedAt, NOW + 5);
  assert.equal(reduce(null, { type: "backgrounded", at: NOW + 5 }), null);
  assert.equal(reduce(job, { type: "cleared" }), null);
  assert.equal(reduce({ ...job, status: "failed" }, { type: "cleared" }), null);
});

test("events on the wrong status return the same object reference", () => {
  const job = activeVideo();
  assert.equal(reduce(job, { type: "retry", at: 1 }), job);
  assert.equal(reduce(job, { type: "resume", kind: "foreground", at: 1 }), job);
  assert.equal(reduce(null, { type: "started", at: 1 }), null);
});

function failedAfterBackground(): UploadJob {
  // attempt started at NOW+10, app backgrounded at NOW+20, request died at NOW+60
  return run(
    activeVideo(),
    { type: "started", at: NOW + 10 },
    { type: "progress", progress: 40, stage: "transcoding" },
    { type: "backgrounded", at: NOW + 20 },
  ) as UploadJob;
}

const NET_ERROR = { kind: "network" as const, message: "Network request failed" };

test("failed with the background rule met while active: stays active, pendingResume foreground, autoRetries 1, media leg restarts at 0", () => {
  const job = failedAfterBackground();
  const next = reduce(job, { type: "failed", error: NET_ERROR, appActive: true, at: NOW + 60 }) as UploadJob;
  assert.equal(isJobActive(next), true);
  assert.equal(next.status, "uploading");
  assert.equal(next.progress, 0);
  assert.equal(next.pendingResume, "foreground");
  assert.equal(next.autoRetries, 1);
});

test("a second network failure in the same cycle goes to failed", () => {
  const job = failedAfterBackground();
  const first = reduce(job, { type: "failed", error: NET_ERROR, appActive: true, at: NOW + 60 }) as UploadJob;
  const restarted = run(first, { type: "started", at: NOW + 61 }, { type: "backgrounded", at: NOW + 70 }) as UploadJob;
  const second = reduce(restarted, { type: "failed", error: NET_ERROR, appActive: true, at: NOW + 120 }) as UploadJob;
  assert.equal(second.status, "failed");
  assert.equal(second.pendingResume, null);
  assert.equal(second.autoRetries, 1);
  assert.deepEqual(second.error, NET_ERROR);
});

test("failed while the app is in the background goes to failed even if the rule holds", () => {
  const next = reduce(failedAfterBackground(), { type: "failed", error: NET_ERROR, appActive: false, at: NOW + 60 }) as UploadJob;
  assert.equal(next.status, "failed");
  assert.equal(next.autoRetries, 0);
});

test("failed without a backgrounding after attempt start goes to failed", () => {
  const job = run(activeVideo(), { type: "backgrounded", at: NOW + 1 }, { type: "started", at: NOW + 10 }) as UploadJob;
  const next = reduce(job, { type: "failed", error: NET_ERROR, appActive: true, at: NOW + 60 }) as UploadJob;
  assert.equal(next.status, "failed");
});

test("non-network failures never auto-retry and keep result", () => {
  const job = run(failedAfterBackground(), { type: "media_done", cid: "a", gatewayUrl: "g" }) as UploadJob;
  const next = reduce(job, { type: "failed", error: { kind: "broadcast", message: "RC" }, appActive: true, at: NOW + 60 }) as UploadJob;
  assert.equal(next.status, "failed");
  assert.equal(next.result.cid, "a");
});

test("retry after media_done goes to publishing with result intact and progress 100", () => {
  const failed = run(
    activeVideo(),
    { type: "started", at: NOW + 10 },
    { type: "media_done", cid: "a", gatewayUrl: "g" },
    { type: "failed", error: { kind: "broadcast", message: "boom" }, appActive: true, at: NOW + 60 },
  ) as UploadJob;
  const next = reduce(failed, { type: "retry", at: NOW + 70 }) as UploadJob;
  assert.equal(next.status, "publishing");
  assert.equal(next.progress, 100);
  assert.equal(next.stage, "parent");
  assert.equal(next.result.cid, "a");
  assert.equal(next.error, null);
  assert.equal(next.autoRetries, 0);
  assert.equal(next.pendingResume, null);
});

test("retry without result goes to uploading at 0 and resets autoRetries", () => {
  const failed = run(
    activeVideo(),
    { type: "started", at: NOW + 10 },
    { type: "progress", progress: 70, stage: "transcoding" },
    { type: "failed", error: NET_ERROR, appActive: true, at: NOW + 60 },
  ) as UploadJob;
  const next = reduce({ ...failed, autoRetries: 1 }, { type: "retry", at: NOW + 70 }) as UploadJob;
  assert.equal(next.status, "uploading");
  assert.equal(next.progress, 0);
  assert.equal(next.autoRetries, 0);
});

test("resume foreground from failed behaves like retry but marks pendingResume and counts an auto retry", () => {
  const failed = run(
    activeVideo(),
    { type: "started", at: NOW + 10 },
    { type: "failed", error: NET_ERROR, appActive: false, at: NOW + 60 },
  ) as UploadJob;
  const next = reduce(failed, { type: "resume", kind: "foreground", at: NOW + 90 }) as UploadJob;
  assert.equal(next.status, "uploading");
  assert.equal(next.pendingResume, "foreground");
  assert.equal(next.autoRetries, 1);
  assert.equal(next.error, null);
});

test("resume launch marks an active job and is ignored on failed", () => {
  const active = run(activeVideo(), { type: "media_done", cid: "a", gatewayUrl: "g" }) as UploadJob;
  const next = reduce(active, { type: "resume", kind: "launch", at: NOW + 5 }) as UploadJob;
  assert.equal(next.status, "publishing");
  assert.equal(next.pendingResume, "launch");
  const failed = { ...active, status: "failed" as const };
  assert.equal(reduce(failed, { type: "resume", kind: "launch", at: NOW + 5 }), failed);
});

test("resume launch from transcoding with no media result restarts the media leg at 0", () => {
  const job = reduce(activeVideo(), { type: "progress", progress: 62, stage: "transcoding" }) as UploadJob;
  const next = reduce(job, { type: "resume", kind: "launch", at: NOW + 5 }) as UploadJob;
  assert.equal(next.status, "uploading");
  assert.equal(next.progress, 0);
  assert.equal(next.stage, "receiving");
  assert.equal(next.pendingResume, "launch");
});

test("invariant: result survives failed, retry and resume", () => {
  let job = run(activeVideo(), { type: "started", at: NOW + 10 }, { type: "cover_done", coverUrl: "c" }) as UploadJob;
  job = reduce(job, { type: "failed", error: NET_ERROR, appActive: false, at: NOW + 60 }) as UploadJob;
  assert.equal(job.result.coverUrl, "c");
  job = reduce(job, { type: "retry", at: NOW + 70 }) as UploadJob;
  assert.equal(job.result.coverUrl, "c");
  job = reduce(job, { type: "failed", error: NET_ERROR, appActive: false, at: NOW + 80 }) as UploadJob;
  job = reduce(job, { type: "resume", kind: "foreground", at: NOW + 90 }) as UploadJob;
  assert.equal(job.result.coverUrl, "c");
});

test("pillLabel / pillDetail follow the UI table", () => {
  let job = activeVideo();
  assert.equal(pillLabel(job), "Uploading… 0%");
  assert.equal(pillDetail(job), "Sending to server");
  job = reduce(job, { type: "progress", progress: 62, stage: "transcoding" }) as UploadJob;
  assert.equal(pillLabel(job), "Transcoding… 62%");
  assert.equal(pillDetail(job), "Transcoding video");
  job = reduce(job, { type: "progress", progress: 62, stage: "optimized" }) as UploadJob;
  assert.equal(pillLabel(job), "Transcoding… 62%");
  assert.equal(pillDetail(job), "Video already optimized");
  job = reduce(job, { type: "progress", progress: 80, stage: "uploading" }) as UploadJob;
  assert.equal(pillLabel(job), "Pinning… 80%");
  assert.equal(pillDetail(job), "Uploading to IPFS");
  job = reduce(job, { type: "media_done", cid: "a", gatewayUrl: "g" }) as UploadJob;
  assert.equal(pillLabel(job), "Publishing…");
  assert.equal(pillDetail(job), "Posting to Hive");
  const resuming = reduce(job, { type: "resume", kind: "launch", at: 1 }) as UploadJob;
  assert.equal(pillLabel(resuming), "Resuming…");
  assert.equal(pillDetail(resuming), "Picking up where it left off");
  const published = reduce(job, { type: "published", at: 2 }) as UploadJob;
  assert.equal(pillLabel(published), "Published");
  assert.equal(pillDetail(published), "Tap to open");
  const failed = reduce(job, { type: "failed", error: { kind: "broadcast", message: "RC too low" }, appActive: true, at: 3 }) as UploadJob;
  assert.equal(pillLabel(failed), "Upload failed");
  assert.equal(pillDetail(failed), "RC too low");
});

test("parsePersistedJob accepts a serialized job and resets pendingResume", () => {
  const job = { ...activeVideo(), pendingResume: "launch" as const };
  const parsed = parsePersistedJob(JSON.stringify(job));
  assert.ok(parsed);
  assert.equal(parsed.id, job.id);
  assert.equal(parsed.permlink, job.permlink);
  assert.equal(parsed.pendingResume, null);
  assert.deepEqual(parsed.draft, job.draft);
});

test("parsePersistedJob rejects garbage, unknown status and missing id/permlink", () => {
  assert.equal(parsePersistedJob("not json"), null);
  assert.equal(parsePersistedJob("null"), null);
  assert.equal(parsePersistedJob(JSON.stringify({ ...activeVideo(), status: "weird" })), null);
  assert.equal(parsePersistedJob(JSON.stringify({ ...activeVideo(), id: "" })), null);
  const { permlink: _dropped, ...noPermlink } = activeVideo();
  assert.equal(parsePersistedJob(JSON.stringify(noPermlink)), null);
});

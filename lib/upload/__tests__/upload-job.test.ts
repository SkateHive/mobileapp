import { test } from "node:test";
import assert from "node:assert/strict";
import { createJob, isJobActive, type CreateJobInput } from "../upload-job";

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

import { test } from "node:test";
import assert from "node:assert/strict";
import { createJob, type UploadEvent, type UploadJob } from "../upload-job";
import {
  UploadRunError,
  classifyError,
  runUploadJob,
  type BroadcastArgs,
  type RunnerCrossPostArgs,
  type RunnerDeps,
} from "../upload-runner";
import { createVideoIframe } from "../post-assembly";

const NOW = 1_700_000_000_000;

function videoJob(overrides: Partial<UploadJob> = {}): UploadJob {
  return {
    ...createJob({
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
    }),
    ...overrides,
  };
}

function imageJob(): UploadJob {
  return createJob({
    id: "job-2",
    author: "skater",
    permlink: "sh-20260903t101501",
    caption: "Photo",
    mediaKind: "image",
    mediaUri: "file:///Documents/uploads/job-2/media.jpg",
    mime: "image/jpeg",
    fileName: "IMG_0002.JPG",
    coverUri: null,
    igCaption: "",
    crossPostToInstagram: false,
    communityTag: "hive-173115",
    now: NOW,
  });
}

function textJob(): UploadJob {
  return createJob({
    id: "job-3",
    author: "skater",
    permlink: "sh-20260903t101502",
    caption: "Just words",
    mediaKind: null,
    mediaUri: null,
    mime: null,
    fileName: null,
    coverUri: null,
    igCaption: "",
    crossPostToInstagram: false,
    communityTag: "hive-173115",
    now: NOW,
  });
}

type FakeDeps = RunnerDeps & { calls: string[]; broadcasts: BroadcastArgs[]; crossPosts: RunnerCrossPostArgs[] };

function makeDeps(overrides: Partial<RunnerDeps> = {}): FakeDeps {
  const calls: string[] = [];
  const broadcasts: BroadcastArgs[] = [];
  const crossPosts: RunnerCrossPostArgs[] = [];
  return {
    calls,
    broadcasts,
    crossPosts,
    uploadImage: async (_uri, name) => {
      calls.push(`uploadImage:${name}`);
      return { url: `https://images.hive.blog/${name}` };
    },
    uploadVideo: async (_uri, _name, _mime, opts) => {
      calls.push("uploadVideo");
      opts.onProgress(5, "receiving");
      opts.onProgress(50, "transcoding");
      opts.onProgress(90, "uploading");
      opts.onProgress(100, "complete");
      return {
        cid: "bafy1",
        gatewayUrl: "https://ipfs.skatehive.app/ipfs/bafy1",
        thumbnailUrl: "https://ipfs.skatehive.app/ipfs/bafy1/thumb.jpg",
      };
    },
    getParent: async () => {
      calls.push("getParent");
      return { author: "peak.snaps", permlink: "snaps-1" };
    },
    getContent: async () => {
      calls.push("getContent");
      return null;
    },
    broadcast: async (args) => {
      calls.push("broadcast");
      broadcasts.push(args);
    },
    communityTag: "hive-173115",
    snapsContainerAuthor: "peak.snaps",
    now: () => NOW + 1,
    ...overrides,
  };
}

function recorder(job: UploadJob) {
  const events: UploadEvent[] = [];
  const emit = (event: UploadEvent) => {
    events.push(event);
    return job;
  };
  const types = () => events.map((e) => e.type);
  return { events, emit, types };
}

test("video happy path: started, cover_done, progress…, media_done, parent_done, published; one broadcast", async () => {
  const job = videoJob();
  const deps = makeDeps();
  const rec = recorder(job);
  await runUploadJob(job, deps, rec.emit);
  assert.deepEqual(rec.types(), [
    "started",
    "cover_done",
    "progress",
    "progress",
    "progress",
    "media_done",
    "parent_done",
    "published",
  ]);
  assert.deepEqual(deps.calls, ["uploadImage:cover.jpg", "uploadVideo", "getParent", "getContent", "broadcast"]);
  assert.equal(deps.broadcasts.length, 1);
  const b = deps.broadcasts[0];
  assert.equal(b.permlink, "sh-20260903t101500");
  assert.equal(b.parentAuthor, "peak.snaps");
  assert.equal(b.parentPermlink, "snaps-1");
  assert.equal(b.body, `Kickflip #skate\n\n${createVideoIframe("https://ipfs.skatehive.app/ipfs/bafy1", "Video")}`);
  assert.deepEqual(b.jsonMetadata, {
    app: "mycommunity-mobile",
    tags: ["hive-173115", "skate"],
    images: ["https://images.hive.blog/cover.jpg"],
  });
});

test("the complete stage is not forwarded as progress (media_done carries completion)", async () => {
  const job = videoJob();
  const rec = recorder(job);
  await runUploadJob(job, makeDeps(), rec.emit);
  const stages = rec.events.filter((e) => e.type === "progress").map((e) => (e as { stage: string }).stage);
  assert.deepEqual(stages, ["receiving", "transcoding", "uploading"]);
});

test("image happy path uses the markdown body and imageUrl in images", async () => {
  const job = imageJob();
  const deps = makeDeps();
  const rec = recorder(job);
  await runUploadJob(job, deps, rec.emit);
  assert.deepEqual(rec.types(), ["started", "media_done", "parent_done", "published"]);
  assert.deepEqual(deps.calls, ["uploadImage:IMG_0002.JPG", "getParent", "getContent", "broadcast"]);
  assert.equal(deps.broadcasts[0].body, "Photo\n\n![Uploaded image](https://images.hive.blog/IMG_0002.JPG)");
  assert.deepEqual((deps.broadcasts[0].jsonMetadata as { images: string[] }).images, [
    "https://images.hive.blog/IMG_0002.JPG",
  ]);
});

test("text-only path calls neither upload dep", async () => {
  const job = textJob();
  const deps = makeDeps();
  const rec = recorder(job);
  await runUploadJob(job, deps, rec.emit);
  assert.deepEqual(rec.types(), ["started", "parent_done", "published"]);
  assert.deepEqual(deps.calls, ["getParent", "getContent", "broadcast"]);
  assert.equal(deps.broadcasts[0].body, "Just words");
  assert.deepEqual(deps.broadcasts[0].jsonMetadata, { app: "mycommunity-mobile", tags: ["hive-173115"] });
});

test("getContent returning a post publishes without broadcasting", async () => {
  const job = textJob();
  const deps = makeDeps({ getContent: async () => ({ author: "skater" }) });
  const rec = recorder(job);
  await runUploadJob(job, deps, rec.emit);
  assert.deepEqual(rec.types(), ["started", "parent_done", "published"]);
  assert.equal(deps.broadcasts.length, 0);
});

test("getContent throwing fails closed as network and does not broadcast", async () => {
  const job = textJob();
  const deps = makeDeps({
    getContent: async () => {
      throw new Error("RPC timeout");
    },
  });
  const rec = recorder(job);
  await runUploadJob(job, deps, rec.emit);
  assert.deepEqual(rec.types(), ["started", "parent_done", "failed"]);
  const failed = rec.events[2] as Extract<UploadEvent, { type: "failed" }>;
  assert.equal(failed.error.kind, "network");
  assert.equal(deps.broadcasts.length, 0);
});

test("a job that already has result.cid skips the cover and media legs", async () => {
  const job = videoJob({
    status: "publishing",
    progress: 100,
    stage: "parent",
    result: { coverUrl: "https://images.hive.blog/cover.jpg", cid: "bafy1", gatewayUrl: "https://ipfs.skatehive.app/ipfs/bafy1" },
  });
  const deps = makeDeps();
  const rec = recorder(job);
  await runUploadJob(job, deps, rec.emit);
  assert.deepEqual(rec.types(), ["started", "parent_done", "published"]);
  assert.deepEqual(deps.calls, ["getParent", "getContent", "broadcast"]);
});

test("a job with coverUrl but no cid skips only the cover leg and passes the cover as thumbnail", async () => {
  const job = videoJob({ result: { coverUrl: "https://images.hive.blog/cover.jpg" } });
  let thumbnailSeen: string | undefined;
  const deps = makeDeps({
    uploadVideo: async (_u, _n, _m, opts) => {
      thumbnailSeen = opts.thumbnailUrl;
      return { cid: "bafy2", gatewayUrl: "https://ipfs.skatehive.app/ipfs/bafy2" };
    },
  });
  const rec = recorder(job);
  await runUploadJob(job, deps, rec.emit);
  assert.equal(thumbnailSeen, "https://images.hive.blog/cover.jpg");
  assert.deepEqual(rec.types(), ["started", "media_done", "parent_done", "published"]);
});

test("cover failure emits cover_skipped and the run continues", async () => {
  const job = videoJob();
  const deps = makeDeps({
    uploadImage: async () => {
      throw new Error("Image upload failed: 500 - boom");
    },
  });
  const rec = recorder(job);
  await runUploadJob(job, deps, rec.emit);
  assert.equal(rec.types()[1], "cover_skipped");
  assert.equal(rec.types().at(-1), "published");
  assert.deepEqual((deps.broadcasts[0].jsonMetadata as { images: string[] }).images, [
    "https://ipfs.skatehive.app/ipfs/bafy1/thumb.jpg",
  ]);
});

test("failure classification: TypeError network, HTTP text server, broadcast throw broadcast", async () => {
  const netJob = videoJob({ draft: { ...videoJob().draft, coverUri: null } });
  const netDeps = makeDeps({
    uploadVideo: async () => {
      throw new TypeError("Network request failed");
    },
  });
  const netRec = recorder(netJob);
  await runUploadJob(netJob, netDeps, netRec.emit);
  assert.deepEqual(netRec.types(), ["started", "failed"]);
  assert.equal((netRec.events[1] as Extract<UploadEvent, { type: "failed" }>).error.kind, "network");

  const srvJob = imageJob();
  const srvDeps = makeDeps({
    uploadImage: async () => {
      throw new Error("Image upload failed: 413 - Payload too large");
    },
  });
  const srvRec = recorder(srvJob);
  await runUploadJob(srvJob, srvDeps, srvRec.emit);
  assert.equal((srvRec.events[1] as Extract<UploadEvent, { type: "failed" }>).error.kind, "server");

  const bcJob = textJob();
  const bcDeps = makeDeps({
    broadcast: async () => {
      throw new Error("RC too low");
    },
  });
  const bcRec = recorder(bcJob);
  await runUploadJob(bcJob, bcDeps, bcRec.emit);
  assert.deepEqual(bcRec.types(), ["started", "parent_done", "failed"]);
  const bcFail = bcRec.events[2] as Extract<UploadEvent, { type: "failed" }>;
  assert.equal(bcFail.error.kind, "broadcast");
  assert.equal(bcFail.error.message, "RC too low");
});

test("classifyError maps the worker aggregate error to network and tagged errors to their kind", () => {
  assert.equal(
    classifyError(new Error("Video upload failed: All video upload services failed: Mac Mini failed: 500 - x")).kind,
    "network",
  );
  assert.equal(classifyError(new UploadRunError("unknown", "The video is no longer on this device")).kind, "unknown");
  assert.equal(classifyError(new UploadRunError("unknown", "The video is no longer on this device")).message, "The video is no longer on this device");
  assert.equal(classifyError("weird").kind, "unknown");
  assert.equal(classifyError(Object.assign(new Error("Aborted"), { name: "AbortError" })).kind, "network");
  assert.equal(
    classifyError(new Error("Network request failed")).kind,
    "network",
    "image-upload.ts wraps fetch failures in a plain Error, not a TypeError",
  );
});

test("getParent throwing broadcasts to the community tag with an empty parent author", async () => {
  const job = textJob();
  const deps = makeDeps({
    getParent: async () => {
      throw new Error("No snaps container found");
    },
  });
  const rec = recorder(job);
  await runUploadJob(job, deps, rec.emit);
  assert.deepEqual(rec.events[1], { type: "parent_done", parentAuthor: "", parentPermlink: "hive-173115" });
  assert.equal(deps.broadcasts[0].parentAuthor, "");
  assert.equal(deps.broadcasts[0].parentPermlink, "hive-173115");
});

test("crossPost runs after publish for the main feed only and its rejection changes nothing", async () => {
  const job = videoJob({ draft: { ...videoJob().draft, crossPostToInstagram: true, igCaption: "yo" } });
  const deps = makeDeps({
    crossPost: async (args) => {
      deps.crossPosts.push(args);
      throw new Error("IG down");
    },
  });
  const rec = recorder(job);
  await runUploadJob(job, deps, rec.emit);
  assert.equal(rec.types().at(-1), "published");
  assert.equal(deps.crossPosts.length, 1);
  assert.equal(deps.crossPosts[0].permlink, "sh-20260903t101500");
  assert.equal(deps.crossPosts[0].caption, "yo");
  assert.equal(deps.crossPosts[0].imageUrl, "https://images.hive.blog/cover.jpg");
  assert.equal(deps.crossPosts[0].videoUrl, "https://ipfs.skatehive.app/ipfs/bafy1");

  const fallbackDeps = makeDeps({
    getParent: async () => {
      throw new Error("no container");
    },
    crossPost: async (args) => {
      fallbackDeps.crossPosts.push(args);
    },
  });
  await runUploadJob(job, fallbackDeps, recorder(job).emit);
  assert.equal(fallbackDeps.crossPosts.length, 0, "no cross-post when the parent is not the snaps container");
});

test("the runner stops when emit reports the job is gone", async () => {
  const job = videoJob();
  const deps = makeDeps();
  const events: UploadEvent[] = [];
  const emit = (event: UploadEvent) => {
    events.push(event);
    return event.type === "cover_done" ? null : job;
  };
  await runUploadJob(job, deps, emit);
  assert.deepEqual(events.map((e) => e.type), ["started", "cover_done"]);
  assert.deepEqual(deps.calls, ["uploadImage:cover.jpg"]);
});

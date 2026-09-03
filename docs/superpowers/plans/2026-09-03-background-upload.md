# Background Upload (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the post upload out of `app/(tabs)/create.tsx` into a persisted, resumable single-job pipeline (store → runner → legs) with a progress pill above the tab bar, so Share validates, enqueues, clears the form and returns the user to the feed while the post publishes itself and survives navigation, JS reloads, app kills and one iOS background suspension.

**Architecture:** A pure state machine (`lib/upload/upload-job.ts`) owns the `UploadJob` shape and the `reduce(job, event)` transition table; a pure runner (`lib/upload/upload-runner.ts`) walks the legs cover → media → publish through injected `RunnerDeps`, skipping legs whose result the job already carries, and guards against double posts with a fail-closed `get_content` check. The Expo-bound layer is a module-level store with `useSyncExternalStore` and JSON persistence in `Paths.document/uploads/` (`upload-store.ts`), the real deps (`upload-legs.ts`), a root `UploadProvider` that starts/resumes the runner and handles AppState, and an `UploadPill` mounted beside `<Tabs>`.

**Tech Stack:** Expo SDK 54, React Native 0.81, React 19, Expo Router 6, TypeScript 5.9, `expo-file-system` 19 (`File`/`Directory`/`Paths`), `expo-image`, `react-native-svg` 15, `@tanstack/react-query` 5, `node:test` + `node:assert/strict` run via `tsx` (devDependency), Node 24, pnpm 9.

**Spec:** `docs/superpowers/specs/2026-09-02-background-upload-design.md`

## Global Constraints

- **No new dependencies** except `tsx` as a devDependency (spec, *Testing*: "Add `tsx` as a devDependency and a script"). Everything else (`expo-file-system`, `react-native-svg`, `expo-image`) is already in `package.json`.
- **Theme tokens only** from `lib/theme.ts` — no hardcoded colors, radii, spacing or font names in any new or edited file (spec, *Pill*: "Theme tokens only (`lib/theme.ts`)").
- **English copy inline** — all user-facing strings ("Resuming…", "Wait for the current upload to finish", …) are written inline in English as in the spec's *UI* table; no i18n layer.
- **One upload at a time** — `enqueue` throws `UploadBusyError` while a job is active *or failed*; the Share button is disabled with a hint (spec, *Decisions*: "Only one upload at a time" and "A failed job also blocks new posts").
- **Never commit `.maestri/`** — every commit in this plan uses explicit `git add <paths>`; never `git add -A` or `git add .`.
- **Do not push** — all work stays on the local `feat/background-upload` branch.

## File Structure

| Path | Action | Single responsibility |
|------|--------|-----------------------|
| `package.json` | Modify | Add `tsx` devDependency and the `test` script that runs the three pure test files. |
| `lib/upload/upload-job.ts` | Create | Types (`UploadJob`, `UploadEvent`, …), `createJob`, the pure total reducer `reduce`, `isJobActive`, `pillLabel`, `pillDetail`, `parsePersistedJob`. No RN/Expo imports. |
| `lib/upload/__tests__/upload-job.test.ts` | Create | Walks the transition table row by row and the invariants. |
| `lib/upload/post-assembly.ts` | Create | Pure post assembly: `makePermlink`, `buildBody`, `buildTags`, `buildImages`, `buildJsonMetadata`, plus `createVideoIframe` / `createImageMarkdown` moved here. |
| `lib/upload/__tests__/post-assembly.test.ts` | Create | Format and concatenation tests for the assembly helpers. |
| `lib/upload/video-upload.ts` | Modify (lines 232-251) | Drop the local `escapeHtmlAttr`/`createVideoIframe`; re-export `createVideoIframe` from `post-assembly.ts`. |
| `lib/upload/image-upload.ts` | Modify (lines 188-196) | Drop the local `createImageMarkdown`; re-export it from `post-assembly.ts`. |
| `lib/upload/upload-runner.ts` | Create | `RunnerDeps`, `UploadRunError`, `classifyError`, `runUploadJob` — the leg sequence with skipping and the double-post guard, all I/O through deps. No RN/Expo imports. |
| `lib/upload/__tests__/upload-runner.test.ts` | Create | Drives `runUploadJob` with fake deps and a recording `emit`. |
| `lib/upload/upload-store.ts` | Create | Module-level job, `subscribe`/`getSnapshot`/`useUploadJob`, `dispatch` (reduce + notify + persist), `enqueue` (copy media to `Paths.document/uploads/<id>/`), `discard`, `loadPersistedJob`, `deleteJobFiles`, `UploadBusyError`. |
| `lib/upload/upload-legs.ts` | Create | `makeRunnerDeps(session)`: the real `RunnerDeps` bound to `image-upload`, `video-upload`, `hive-utils`, `posting`, `instagram`. |
| `lib/upload/upload-provider.tsx` | Create | `UploadProvider`: launch resume, session gate, start-on-enqueue, `emit` wrapper stamping `appActive`, AppState foreground retry, feed invalidation, 4s clear. |
| `app/_layout.tsx` | Modify (lines 10-13, 112-113, 217-218) | Mount `UploadProvider` directly inside `ToastProvider`. |
| `components/upload/UploadPill.tsx` | Create | The pill: thumbnail, SVG progress ring, stage label, expand, Retry/Discard, tap-to-open on Published. |
| `app/(tabs)/_layout.tsx` | Modify (lines 1-12, 226-227) | Mount `<UploadPill />` as a sibling of `<Tabs>` inside the PanResponder `View`. |
| `app/(tabs)/create.tsx` | Modify (lines 24-56, 60, 66-73, 122-181, 345-579, 606-617, 624, 680, 690, 713, 732, 743-750, 808-842) | `handlePost` becomes validate → IG prompt → enqueue → clear → navigate; Share disabled with hint while a job is active/failed; ref-based submit lock; progress card and cross-post helper removed. |

---

### Task 1: Test harness — `tsx`, `pnpm test`, first reducer scaffold

**Files:**
- Modify: `package.json` (scripts block lines 6-18, devDependencies block lines 83-90)
- Create: `lib/upload/upload-job.ts`
- Create: `lib/upload/__tests__/upload-job.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (from `lib/upload/upload-job.ts`):
  - `type UploadStatus = "uploading" | "transcoding" | "publishing" | "published" | "failed"`
  - `type MediaKind = "image" | "video" | null`
  - `type UploadErrorKind = "network" | "server" | "auth" | "broadcast" | "unknown"`
  - `type ResumeKind = "launch" | "foreground"`
  - `interface UploadError { kind: UploadErrorKind; message: string }`
  - `interface UploadDraft`, `interface UploadResult`, `interface UploadTimestamps`, `interface UploadJob`
  - `type UploadEvent` (13 variants, see code)
  - `const UPLOAD_STATUSES: readonly UploadStatus[]`
  - `function isJobActive(job: UploadJob | null | undefined): job is UploadJob`
  - `interface CreateJobInput` and `function createJob(input: CreateJobInput): UploadJob`

**Steps:**

- [ ] **Step 1.1 — Install `tsx` (the one permitted new devDependency).**

  Run (pnpm 9, never `corepack pnpm`):

  ```bash
  cd /Users/web3warrior/Code/skatehive/mobileapp && pnpm add -D tsx@^4.20.6
  ```

  Expected: `package.json` `devDependencies` gains `"tsx": "^4.20.6"`, `pnpm-lock.yaml` updates. `git status --short` shows `M package.json`, `M pnpm-lock.yaml`, `?? .maestri/` — never add `.maestri/`.

- [ ] **Step 1.2 — Add the `test` script.**

  In `package.json`, inside `"scripts"`, after the `"logs:ios"` line add:

  ```json
  "test": "tsx lib/upload/__tests__/upload-job.test.ts && tsx lib/upload/__tests__/upload-runner.test.ts && tsx lib/upload/__tests__/post-assembly.test.ts"
  ```

  (Add a trailing comma to the `"logs:ios"` line.)

- [ ] **Step 1.3 — Write the first failing test.**

  Create `lib/upload/__tests__/upload-job.test.ts`:

  ```ts
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
  ```

- [ ] **Step 1.4 — Run it and watch it fail.**

  ```bash
  pnpm exec tsx lib/upload/__tests__/upload-job.test.ts
  ```

  Expected: exits non-zero with `Error: Cannot find module '.../lib/upload/upload-job'` (the module does not exist yet).

- [ ] **Step 1.5 — Create `lib/upload/upload-job.ts` with the types, `createJob` and `isJobActive`.**

  ```ts
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
  ```

- [ ] **Step 1.6 — Run the test again.**

  ```bash
  pnpm exec tsx lib/upload/__tests__/upload-job.test.ts
  ```

  Expected output ends with:

  ```
  # tests 4
  # pass 4
  # fail 0
  ```

- [ ] **Step 1.7 — Commit.**

  ```bash
  git add package.json pnpm-lock.yaml lib/upload/upload-job.ts lib/upload/__tests__/upload-job.test.ts
  git commit -m "test(upload): add tsx test harness and the UploadJob types"
  ```

---

### Task 2: Reducer — the full transition table, labels and persisted-shape validation

**Files:**
- Modify: `lib/upload/upload-job.ts` (append after `createJob`)
- Modify: `lib/upload/__tests__/upload-job.test.ts` (append)

**Interfaces:**
- Consumes: `UploadJob`, `UploadEvent`, `UploadStatus`, `isJobActive`, `createJob` (Task 1).
- Produces (from `lib/upload/upload-job.ts`):
  - `function reduce(job: UploadJob | null, event: UploadEvent): UploadJob | null` — pure and total; returns the *same reference* when the event does not apply.
  - `function pillLabel(job: UploadJob): string`
  - `function pillDetail(job: UploadJob): string`
  - `function parsePersistedJob(text: string): UploadJob | null`

**Steps:**

- [ ] **Step 2.1 — Write failing tests for the happy-path rows (enqueued, started, progress, cover, media_done, parent_done, published, backgrounded, cleared).**

  Append to `lib/upload/__tests__/upload-job.test.ts` (add `reduce` and `type UploadEvent, type UploadJob` to the import from `"../upload-job"`):

  ```ts
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
  ```

- [ ] **Step 2.2 — Run and confirm the failure.**

  ```bash
  pnpm exec tsx lib/upload/__tests__/upload-job.test.ts
  ```

  Expected: `SyntaxError: The requested module '../upload-job' does not provide an export named 'reduce'`.

- [ ] **Step 2.3 — Implement `reduce` for those rows.**

  Append to `lib/upload/upload-job.ts`:

  ```ts
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
  ```

  `__DEV__` is declared globally by the React Native types, so `tsc` is happy; the `typeof` guard keeps Node from throwing a `ReferenceError` under `tsx`.

- [ ] **Step 2.4 — Run the tests.**

  ```bash
  pnpm exec tsx lib/upload/__tests__/upload-job.test.ts
  ```

  Expected: `# pass 17`, `# fail 0`.

- [ ] **Step 2.5 — Write failing tests for the failure / retry / resume rows and the invariants.**

  Append to the test file:

  ```ts
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
  ```

- [ ] **Step 2.6 — Run the tests.**

  ```bash
  pnpm exec tsx lib/upload/__tests__/upload-job.test.ts
  ```

  Expected: `# pass 27`, `# fail 0`. (The implementation in 2.3 already covers these rows; this step proves the failure/retry rules against the table. If any assertion fails, fix `reduce` — do not edit the test.)

- [ ] **Step 2.7 — Write failing tests for `pillLabel`, `pillDetail` and `parsePersistedJob`.**

  Append (extend the import with `pillLabel, pillDetail, parsePersistedJob`):

  ```ts
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
  ```

- [ ] **Step 2.8 — Run and confirm the failure.**

  ```bash
  pnpm exec tsx lib/upload/__tests__/upload-job.test.ts
  ```

  Expected: `SyntaxError: The requested module '../upload-job' does not provide an export named 'pillLabel'`.

- [ ] **Step 2.9 — Implement `pillLabel`, `pillDetail`, `parsePersistedJob`.**

  Append to `lib/upload/upload-job.ts`:

  ```ts
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
  ```

- [ ] **Step 2.10 — Run the tests.**

  ```bash
  pnpm exec tsx lib/upload/__tests__/upload-job.test.ts
  ```

  Expected: `# pass 30`, `# fail 0`.

- [ ] **Step 2.11 — Commit.**

  ```bash
  git add lib/upload/upload-job.ts lib/upload/__tests__/upload-job.test.ts
  git commit -m "feat(upload): pure UploadJob reducer, pill labels and persisted-shape validation"
  ```

---

### Task 3: Post assembly — pure helpers extracted from `handlePost`

**Files:**
- Create: `lib/upload/post-assembly.ts`
- Create: `lib/upload/__tests__/post-assembly.test.ts`
- Modify: `lib/upload/video-upload.ts` (lines 232-251: delete `escapeHtmlAttr` and `createVideoIframe`, add a re-export)
- Modify: `lib/upload/image-upload.ts` (lines 188-196: delete `createImageMarkdown` and its JSDoc, add a re-export)

**Interfaces:**
- Consumes: `UploadResult` (type only, Task 1).
- Produces (from `lib/upload/post-assembly.ts`):
  - `function escapeHtmlAttr(value: string): string`
  - `function createVideoIframe(gatewayUrl: string, title?: string): string` (moved, same output)
  - `function createImageMarkdown(imageUrl: string, altText?: string): string` (moved, same output)
  - `function makePermlink(now?: Date): string` — `"sh-" + 15 lowercase alphanumerics`
  - `function buildBody(caption: string, result: Pick<UploadResult, "imageUrl" | "gatewayUrl">): string`
  - `function buildTags(body: string, communityTag: string): string[]`
  - `function buildImages(result: Pick<UploadResult, "imageUrl" | "coverUrl" | "thumbnailUrl">): string[]`
  - `function buildJsonMetadata(tags: string[], images: string[]): Record<string, unknown>` — `{ app: "mycommunity-mobile", tags, images? }`
- `lib/upload/video-upload.ts` keeps exporting `createVideoIframe`; `lib/upload/image-upload.ts` keeps exporting `createImageMarkdown` (existing importers in `components/` keep working).

**Steps:**

- [ ] **Step 3.1 — Write the failing tests.**

  Create `lib/upload/__tests__/post-assembly.test.ts`:

  ```ts
  import { test } from "node:test";
  import assert from "node:assert/strict";
  import {
    buildBody,
    buildImages,
    buildJsonMetadata,
    buildTags,
    createImageMarkdown,
    createVideoIframe,
    makePermlink,
  } from "../post-assembly";

  test("makePermlink is sh- plus 15 lowercase alphanumerics from the ISO timestamp", () => {
    // "2026-09-03T10:15:00.123Z" → strip non-alphanumerics → "20260903T101500123Z" → lowercase, first 15
    const permlink = makePermlink(new Date("2026-09-03T10:15:00.123Z"));
    assert.equal(permlink, "sh-20260903t101500");
    assert.match(makePermlink(), /^sh-[a-z0-9]{15}$/);
  });

  test("buildTags keeps the community tag first, adds body hashtags, dedupes", () => {
    assert.deepEqual(buildTags("Kickflip #skate #Skate #skate day", "hive-173115"), [
      "hive-173115",
      "skate",
      "Skate",
    ]);
    assert.deepEqual(buildTags("tagged #skatehive twice #skatehive", "skatehive"), ["skatehive"]);
    assert.deepEqual(buildTags("no tags here", "hive-173115"), ["hive-173115"]);
  });

  test("buildBody matches the create screen concatenation", () => {
    assert.equal(buildBody("hello", {}), "hello");
    assert.equal(buildBody("", {}), "");
    assert.equal(
      buildBody("hello", { imageUrl: "https://images.hive.blog/i.jpg" }),
      "hello\n\n![Uploaded image](https://images.hive.blog/i.jpg)",
    );
    assert.equal(
      buildBody("", { imageUrl: "https://images.hive.blog/i.jpg" }),
      "![Uploaded image](https://images.hive.blog/i.jpg)",
    );
    const iframe = createVideoIframe("https://ipfs.skatehive.app/ipfs/bafy1", "Video");
    assert.equal(buildBody("clip", { gatewayUrl: "https://ipfs.skatehive.app/ipfs/bafy1" }), `clip\n\n${iframe}`);
    assert.equal(buildBody("", { gatewayUrl: "https://ipfs.skatehive.app/ipfs/bafy1" }), iframe);
  });

  test("createVideoIframe escapes attributes; createImageMarkdown formats markdown", () => {
    assert.equal(
      createVideoIframe('https://x.test/a"b', "T<i>"),
      '<iframe src="https://x.test/a&quot;b" width="100%" height="400" frameborder="0" allowfullscreen title="T&lt;i&gt;"></iframe>',
    );
    assert.equal(createImageMarkdown("https://x.test/i.jpg"), "![image](https://x.test/i.jpg)");
    assert.equal(createImageMarkdown("https://x.test/i.jpg", "alt"), "![alt](https://x.test/i.jpg)");
  });

  test("buildImages prefers imageUrl, then the author's cover, then the worker frame", () => {
    assert.deepEqual(buildImages({ imageUrl: "i" }), ["i"]);
    assert.deepEqual(buildImages({ coverUrl: "c", thumbnailUrl: "t" }), ["c"]);
    assert.deepEqual(buildImages({ thumbnailUrl: "t" }), ["t"]);
    assert.deepEqual(buildImages({}), []);
  });

  test("buildJsonMetadata only adds images when there are some", () => {
    assert.deepEqual(buildJsonMetadata(["hive-173115"], []), { app: "mycommunity-mobile", tags: ["hive-173115"] });
    assert.deepEqual(buildJsonMetadata(["hive-173115", "skate"], ["c"]), {
      app: "mycommunity-mobile",
      tags: ["hive-173115", "skate"],
      images: ["c"],
    });
  });
  ```

- [ ] **Step 3.2 — Run and confirm the failure.**

  ```bash
  pnpm exec tsx lib/upload/__tests__/post-assembly.test.ts
  ```

  Expected: `Error: Cannot find module '.../lib/upload/post-assembly'`.

- [ ] **Step 3.3 — Create `lib/upload/post-assembly.ts`.**

  ```ts
  // Pure post assembly extracted from app/(tabs)/create.tsx handlePost. No React
  // Native, Expo or hive-utils imports: the community tag is passed in so the
  // module runs under plain Node in the tests.
  import type { UploadResult } from "./upload-job";

  export function escapeHtmlAttr(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /** Video iframe markup for a Hive post body. */
  export function createVideoIframe(gatewayUrl: string, title?: string): string {
    const safeUrl = escapeHtmlAttr(gatewayUrl);
    const safeTitle = escapeHtmlAttr(title || "Video");
    return `<iframe src="${safeUrl}" width="100%" height="400" frameborder="0" allowfullscreen title="${safeTitle}"></iframe>`;
  }

  /** Markdown image markup for a Hive post body. */
  export function createImageMarkdown(imageUrl: string, altText: string = "image"): string {
    return `![${altText}](${imageUrl})`;
  }

  /** `sh-` + the first 15 lowercase alphanumerics of the ISO timestamp, as handlePost did. */
  export function makePermlink(now: Date = new Date()): string {
    return `sh-${now.toISOString().replace(/[^a-zA-Z0-9]/g, "").toLowerCase().substring(0, 15)}`;
  }

  /** Caption plus the media markup, separated by a blank line only when the caption is non-empty. */
  export function buildBody(caption: string, result: Pick<UploadResult, "imageUrl" | "gatewayUrl">): string {
    let body = caption;
    let markup: string | null = null;
    if (result.imageUrl) {
      markup = createImageMarkdown(result.imageUrl, "Uploaded image");
    } else if (result.gatewayUrl) {
      markup = createVideoIframe(result.gatewayUrl, "Video");
    }
    if (markup) body += body ? `\n\n${markup}` : markup;
    return body;
  }

  /** Community tag first, then the body's hashtags, deduplicated in order. */
  export function buildTags(body: string, communityTag: string): string[] {
    const bodyHashtags = (body.match(/#(\w+)/g) || []).map((h) => h.slice(1));
    return [communityTag, ...bodyHashtags].filter((tag, index, array) => array.indexOf(tag) === index);
  }

  /** json_metadata.images: the photo, or the poster (author's cover wins over the worker's frame). */
  export function buildImages(result: Pick<UploadResult, "imageUrl" | "coverUrl" | "thumbnailUrl">): string[] {
    if (result.imageUrl) return [result.imageUrl];
    const poster = result.coverUrl ?? result.thumbnailUrl;
    return poster ? [poster] : [];
  }

  export function buildJsonMetadata(tags: string[], images: string[]): Record<string, unknown> {
    return {
      app: "mycommunity-mobile",
      tags,
      ...(images.length > 0 && { images }),
    };
  }
  ```

- [ ] **Step 3.4 — Run the tests.**

  ```bash
  pnpm exec tsx lib/upload/__tests__/post-assembly.test.ts
  ```

  Expected: `# pass 6`, `# fail 0`.

- [ ] **Step 3.5 — Make `video-upload.ts` re-export instead of defining.**

  In `lib/upload/video-upload.ts` delete lines 232-251 (the `escapeHtmlAttr` function and the `createVideoIframe` function with its JSDoc) and put this line in their place:

  ```ts
  export { createVideoIframe } from './post-assembly';
  ```

- [ ] **Step 3.6 — Make `image-upload.ts` re-export instead of defining.**

  In `lib/upload/image-upload.ts` delete lines 188-196 (the JSDoc block starting `/** Create markdown image markup for Hive post` through the closing `}` of `createImageMarkdown`) and put this line in their place:

  ```ts
  export { createImageMarkdown } from './post-assembly';
  ```

- [ ] **Step 3.7 — Type-check and confirm existing importers still resolve.**

  ```bash
  pnpm exec tsc --noEmit && grep -rn "createVideoIframe\|createImageMarkdown" app components lib --include='*.ts' --include='*.tsx' | grep -v node_modules
  ```

  Expected: `tsc` prints nothing (exit 0); grep shows `app/(tabs)/create.tsx` importing both from `~/lib/upload/video-upload` / `~/lib/upload/image-upload` (still valid via the re-exports) plus the definitions in `post-assembly.ts`.

- [ ] **Step 3.8 — Commit.**

  ```bash
  git add lib/upload/post-assembly.ts lib/upload/__tests__/post-assembly.test.ts lib/upload/video-upload.ts lib/upload/image-upload.ts
  git commit -m "refactor(upload): extract pure post assembly helpers from the create screen"
  ```

---

### Task 4: Runner — leg sequence, skipping, fail-closed guard, error classification

**Files:**
- Create: `lib/upload/upload-runner.ts`
- Create: `lib/upload/__tests__/upload-runner.test.ts`

**Interfaces:**
- Consumes: `UploadJob`, `UploadEvent`, `UploadError`, `UploadErrorKind` (Task 1); `buildBody`, `buildTags`, `buildImages`, `buildJsonMetadata` (Task 3).
- Produces (from `lib/upload/upload-runner.ts`):
  - `interface BroadcastArgs { parentAuthor: string; parentPermlink: string; body: string; permlink: string; jsonMetadata: Record<string, unknown> }` (structurally identical to `PostCommentArgs` in `lib/posting.ts`, redeclared so the pure module does not import `lib/posting`)
  - `interface RunnerCrossPostArgs { permlink: string; body: string; tags: string[]; imageUrl?: string; videoUrl?: string; caption?: string }`
  - `interface RunnerDeps { uploadImage(uri: string, name: string, mime: string): Promise<{ url: string }>; uploadVideo(uri: string, name: string, mime: string, opts: { thumbnailUrl?: string; onProgress(progress: number, stage: string): void }): Promise<{ cid: string; gatewayUrl: string; thumbnailUrl?: string }>; getParent(): Promise<{ author: string; permlink: string }>; getContent(author: string, permlink: string): Promise<{ author: string } | null>; broadcast(args: BroadcastArgs): Promise<void>; crossPost?(args: RunnerCrossPostArgs): Promise<void>; communityTag: string; snapsContainerAuthor: string; now(): number }`
  - `type Emit = (event: UploadEvent) => UploadJob | null`
  - `class UploadRunError extends Error { kind: UploadErrorKind }` — for legs that already know the kind (missing file → `unknown`, guard → `network`, broadcast → `broadcast`)
  - `function classifyError(error: unknown): UploadError`
  - `function runUploadJob(job: UploadJob, deps: RunnerDeps, emit: Emit): Promise<void>` — never throws

**Steps:**

- [ ] **Step 4.1 — Write the failing tests.**

  Create `lib/upload/__tests__/upload-runner.test.ts`:

  ```ts
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
  ```

- [ ] **Step 4.2 — Run and confirm the failure.**

  ```bash
  pnpm exec tsx lib/upload/__tests__/upload-runner.test.ts
  ```

  Expected: `Error: Cannot find module '.../lib/upload/upload-runner'`.

- [ ] **Step 4.3 — Create `lib/upload/upload-runner.ts`.**

  ```ts
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
      (error instanceof TypeError && /network request failed/i.test(message)) ||
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
  ```

- [ ] **Step 4.4 — Run the tests.**

  ```bash
  pnpm exec tsx lib/upload/__tests__/upload-runner.test.ts
  ```

  Expected: `# pass 14`, `# fail 0`.

- [ ] **Step 4.5 — Run the whole suite and the type-check.**

  ```bash
  pnpm test && pnpm exec tsc --noEmit
  ```

  Expected: three `# fail 0` blocks (30, 14, 6 passes) and no `tsc` output.

- [ ] **Step 4.6 — Commit.**

  ```bash
  git add lib/upload/upload-runner.ts lib/upload/__tests__/upload-runner.test.ts
  git commit -m "feat(upload): pure runner with leg skipping and a fail-closed double-post guard"
  ```

---

### Task 5: Store and persistence — `upload-store.ts`

**Files:**
- Create: `lib/upload/upload-store.ts`

**Interfaces:**
- Consumes: `UploadJob`, `UploadEvent`, `MediaKind`, `createJob`, `reduce`, `isJobActive`, `parsePersistedJob` (Tasks 1-2); `makePermlink` (Task 3); `AuthSession` from `~/lib/types`; `Directory`, `File`, `Paths` from `expo-file-system`; `useSyncExternalStore` from `react`.
- Produces (from `lib/upload/upload-store.ts`):
  - `class UploadBusyError extends Error` — message is the Share hint text
  - `interface EnqueueInput { caption: string; mediaKind: MediaKind; mediaUri: string | null; mime: string | null; coverUri: string | null; igCaption: string; crossPostToInstagram: boolean; communityTag: string }`
  - `function subscribe(listener: () => void): () => void`
  - `function getSnapshot(): UploadJob | null` and `function getJob(): UploadJob | null` (same value)
  - `function useUploadJob(): UploadJob | null`
  - `function dispatch(event: UploadEvent): UploadJob | null`
  - `function enqueue(input: EnqueueInput, session: AuthSession): Promise<UploadJob>`
  - `function discard(): void`
  - `function deleteJobFiles(jobId: string): void`
  - `function loadPersistedJob(): Promise<UploadJob | null>`

**Steps:**

- [ ] **Step 5.1 — Create `lib/upload/upload-store.ts`.**

  ```tsx
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

  export async function loadPersistedJob(): Promise<UploadJob | null> {
    try {
      const file = jobFile();
      if (!file.exists) return null;
      const text = await file.text();
      const parsed = parsePersistedJob(text);
      if (parsed === null) {
        file.delete();
        return null;
      }
      job = parsed;
      notify();
      return parsed;
    } catch (error) {
      console.warn("[upload-store] could not read persisted job:", error);
      return null;
    }
  }

  // --- Transitions -----------------------------------------------------------

  export function dispatch(event: UploadEvent): UploadJob | null {
    const next = reduce(job, event);
    if (next === job) return job; // no-op transition, nothing to notify or persist
    job = next;
    notify();
    persist(next);
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
   * `enqueued`. Throws UploadBusyError while a job is active or failed, and
   * rethrows copy failures after removing the half-made directory.
   */
  export async function enqueue(input: EnqueueInput, session: AuthSession): Promise<UploadJob> {
    if (isJobActive(job)) throw new UploadBusyError("Wait for the current upload to finish");
    if (job?.status === "failed") throw new UploadBusyError("Retry or discard the failed upload first");

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
    dispatch({ type: "enqueued", job: created });
    return created;
  }

  /** Drops the job and its files. In-flight results are ignored: their job.id no longer matches. */
  export function discard(): void {
    const current = job;
    dispatch({ type: "cleared" });
    if (current) deleteJobFiles(current.id);
  }
  ```

- [ ] **Step 5.2 — Type-check.**

  ```bash
  pnpm exec tsc --noEmit
  ```

  Expected: no output (exit 0). If `tsc` complains about `Directory.create` options, the `DirectoryCreateOptions` type in `node_modules/expo-file-system/build/ExpoFileSystem.types.d.ts` lines 30-50 lists `intermediates`, `overwrite` and `idempotent` — keep exactly `{ intermediates: true, idempotent: true }`.

- [ ] **Step 5.3 — Run the pure suite to prove nothing regressed.**

  ```bash
  pnpm test
  ```

  Expected: three `# fail 0` blocks.

- [ ] **Step 5.4 — Commit.**

  ```bash
  git add lib/upload/upload-store.ts
  git commit -m "feat(upload): single-job store with JSON persistence and per-job media copies"
  ```

---

### Task 6: Real legs — `upload-legs.ts`

**Files:**
- Create: `lib/upload/upload-legs.ts`

**Interfaces:**
- Consumes: `RunnerDeps`, `UploadRunError` (Task 4); `uploadImageToHive(fileUri, fileName, mimeType, { username, privateKey })`, `uploadImageViaUserbase(fileUri, fileName, mimeType, token)` from `./image-upload`; `uploadVideoToWorker(fileUri, fileName, mimeType, { creator, thumbnailUrl, onProgress })` from `./video-upload`; `isUserbaseSession`, `postComment(session, args)` from `~/lib/posting`; `COMMUNITY_TAG`, `SNAPS_CONTAINER_AUTHOR`, `HiveClient`, `getLastSnapsContainer` from `~/lib/hive-utils`; `crossPostToInstagram(session, args)` from `~/lib/instagram`; `WEB_BASE_URL` from `~/lib/constants`; `File` from `expo-file-system`; `AuthSession` from `~/lib/types`.
- Produces: `function makeRunnerDeps(session: AuthSession): RunnerDeps`

**Steps:**

- [ ] **Step 6.1 — Create `lib/upload/upload-legs.ts`.**

  ```ts
  // The real RunnerDeps. Everything Expo- or network-bound the runner needs
  // lives here so upload-runner.ts stays testable under Node.
  import { File } from "expo-file-system";
  import type { AuthSession } from "~/lib/types";
  import { isUserbaseSession, postComment } from "~/lib/posting";
  import { COMMUNITY_TAG, HiveClient, SNAPS_CONTAINER_AUTHOR, getLastSnapsContainer } from "~/lib/hive-utils";
  import { crossPostToInstagram } from "~/lib/instagram";
  import { WEB_BASE_URL } from "~/lib/constants";
  import { uploadImageToHive, uploadImageViaUserbase } from "./image-upload";
  import { uploadVideoToWorker } from "./video-upload";
  import { UploadRunError, type RunnerDeps } from "./upload-runner";

  function assertOnDevice(uri: string, what: "video" | "image"): void {
    if (!new File(uri).exists) {
      throw new UploadRunError("unknown", `The ${what} is no longer on this device`);
    }
  }

  export function makeRunnerDeps(session: AuthSession): RunnerDeps {
    return {
      async uploadImage(uri, name, mime) {
        assertOnDevice(uri, "image");
        // Email (userbase) accounts have no local key to sign the Hive image
        // challenge, so the server signs + uploads on their behalf.
        return isUserbaseSession(session)
          ? uploadImageViaUserbase(uri, name, mime, session.userbaseToken!)
          : uploadImageToHive(uri, name, mime, { username: session.username, privateKey: session.decryptedKey });
      },

      async uploadVideo(uri, name, mime, opts) {
        assertOnDevice(uri, "video");
        const result = await uploadVideoToWorker(uri, name, mime, {
          creator: session.username,
          thumbnailUrl: opts.thumbnailUrl,
          onProgress: opts.onProgress,
        });
        return { cid: result.cid, gatewayUrl: result.gatewayUrl, thumbnailUrl: result.thumbnailUrl };
      },

      getParent() {
        return getLastSnapsContainer();
      },

      // Deliberately not hive-utils.getContent: that helper swallows RPC errors
      // and returns null, which would read as "post does not exist" and let a
      // retry double-post. Here an RPC error throws and the runner fails closed.
      async getContent(author, permlink) {
        const content = (await HiveClient.database.call("get_content", [author, permlink])) as {
          author?: unknown;
        } | null;
        return content && typeof content.author === "string" && content.author.length > 0
          ? { author: content.author }
          : null;
      },

      async broadcast(args) {
        await postComment(session, args);
      },

      async crossPost(args) {
        await crossPostToInstagram(session, {
          permlink: args.permlink,
          body: args.body,
          tags: args.tags,
          imageUrl: args.imageUrl,
          videoUrl: args.videoUrl,
          caption: args.caption,
          permalinkUrl: `${WEB_BASE_URL}/post/${session.username}/${args.permlink}`,
        });
      },

      communityTag: COMMUNITY_TAG,
      snapsContainerAuthor: SNAPS_CONTAINER_AUTHOR,
      now: () => Date.now(),
    };
  }
  ```

- [ ] **Step 6.2 — Type-check.**

  ```bash
  pnpm exec tsc --noEmit
  ```

  Expected: no output. (`BroadcastArgs` is structurally assignable to `PostCommentArgs` — `permlink`, `title`, `jsonMetadata` are optional there.)

- [ ] **Step 6.3 — Commit.**

  ```bash
  git add lib/upload/upload-legs.ts
  git commit -m "feat(upload): bind the runner deps to the image, video, Hive and Instagram clients"
  ```

---

### Task 7: `UploadProvider` — launch resume, session gate, AppState retry, feed invalidation, 4s clear

**Files:**
- Create: `lib/upload/upload-provider.tsx`
- Modify: `app/_layout.tsx` (imports lines 10-13; JSX lines 112-113 and 217-218)

**Interfaces:**
- Consumes: `useAuth()` → `{ session: AuthSession | null; isLoading: boolean }` from `~/lib/auth-provider`; `useQueryClient` from `@tanstack/react-query`; `canPost(session)` from `~/lib/posting`; `AppState`, `AppStateStatus` from `react-native`; `isJobActive`, `UploadJob`, `UploadEvent` (Tasks 1-2); `dispatch`, `getJob`, `subscribe`, `loadPersistedJob`, `discard` (Task 5); `runUploadJob` (Task 4); `makeRunnerDeps` (Task 6).
- Produces: `function UploadProvider({ children }: { children: React.ReactNode }): JSX.Element`

**Steps:**

- [ ] **Step 7.1 — Create `lib/upload/upload-provider.tsx`.**

  ```tsx
  // Root provider: the only place that calls runUploadJob. Lives for the whole
  // session (mounted in app/_layout.tsx), so the job keeps running while the user
  // navigates anywhere.
  import React, { useCallback, useEffect, useRef } from "react";
  import { AppState, type AppStateStatus } from "react-native";
  import { useQueryClient } from "@tanstack/react-query";
  import { useAuth } from "~/lib/auth-provider";
  import { canPost } from "~/lib/posting";
  import { isJobActive, type UploadEvent, type UploadJob } from "./upload-job";
  import { discard, dispatch, getJob, loadPersistedJob, subscribe } from "./upload-store";
  import { runUploadJob } from "./upload-runner";
  import { makeRunnerDeps } from "./upload-legs";

  const PUBLISHED_CLEAR_MS = 4000;

  function shouldAutoRetry(job: UploadJob): boolean {
    const { attemptStartedAt, backgroundedAt } = job.timestamps;
    return (
      job.status === "failed" &&
      job.error?.kind === "network" &&
      job.autoRetries === 0 &&
      attemptStartedAt !== null &&
      backgroundedAt !== null &&
      backgroundedAt > attemptStartedAt
    );
  }

  export function UploadProvider({ children }: { children: React.ReactNode }) {
    const { session, isLoading } = useAuth();
    const queryClient = useQueryClient();

    const sessionRef = useRef(session);
    sessionRef.current = session;

    const runningJobId = useRef<string | null>(null);
    const prevJobRef = useRef<UploadJob | null>(null);
    const invalidatedForId = useRef<string | null>(null);
    const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const launched = useRef(false);

    const cancelClearTimer = () => {
      if (clearTimer.current) {
        clearTimeout(clearTimer.current);
        clearTimer.current = null;
      }
    };

    const scheduleClear = useCallback((jobId: string, delayMs: number) => {
      cancelClearTimer();
      clearTimer.current = setTimeout(() => {
        clearTimer.current = null;
        const current = getJob();
        if (current && current.id === jobId && current.status === "published") discard();
      }, delayMs);
    }, []);

    const startRunner = useCallback((job: UploadJob) => {
      if (runningJobId.current === job.id) return;

      // Session gate: the job is not discarded; Retry re-runs this gate.
      const s = sessionRef.current;
      if (!s || !canPost(s) || s.username !== job.author) {
        dispatch({
          type: "failed",
          error: { kind: "auth", message: `Log in as @${job.author} to finish this post` },
          appActive: AppState.currentState === "active",
          at: Date.now(),
        });
        return;
      }

      runningJobId.current = job.id;
      const emit = (event: UploadEvent): UploadJob | null => {
        if (getJob()?.id !== job.id) return null; // discarded while a leg was in flight
        if (event.type === "failed") {
          return dispatch({ ...event, appActive: AppState.currentState === "active" });
        }
        return dispatch(event);
      };

      runUploadJob(job, makeRunnerDeps(s), emit).finally(() => {
        if (runningJobId.current === job.id) runningJobId.current = null;
        // A run ends in published or failed. If the job is still active, the
        // reducer armed the one-shot foreground retry; run it now.
        const current = getJob();
        if (current && current.id === job.id && isJobActive(current) && current.pendingResume === "foreground") {
          startRunner(current);
        }
      });
    }, []);

    // Reacts to every store change: start the runner when a job becomes active
    // (enqueue, retry, resume), invalidate + schedule the clear on published.
    const onStoreChange = useCallback(() => {
      const job = getJob();
      const prev = prevJobRef.current;
      prevJobRef.current = job;

      if (!job) {
        cancelClearTimer();
        return;
      }

      if (isJobActive(job) && runningJobId.current !== job.id) {
        const becameActive = !prev || prev.id !== job.id || !isJobActive(prev);
        if (becameActive) startRunner(job);
      }

      if (job.status === "published" && invalidatedForId.current !== job.id) {
        invalidatedForId.current = job.id;
        queryClient.invalidateQueries({ queryKey: ["feed"] });
        queryClient.invalidateQueries({ queryKey: ["userFeed", job.author] });
        scheduleClear(job.id, PUBLISHED_CLEAR_MS);
      }
    }, [queryClient, scheduleClear, startRunner]);

    // Launch resume, once auth has hydrated. Subscribes to the store only after
    // the launch decision so the persisted job is not started before `resume`.
    useEffect(() => {
      if (isLoading || launched.current) return;
      launched.current = true;
      let unsubscribe: (() => void) | null = null;
      let cancelled = false;

      (async () => {
        const persisted = await loadPersistedJob();
        if (cancelled) return;
        if (persisted) {
          if (isJobActive(persisted)) {
            dispatch({ type: "resume", kind: "launch", at: Date.now() });
          } else if (persisted.status === "published") {
            const age = Date.now() - (persisted.timestamps.publishedAt ?? 0);
            if (age > PUBLISHED_CLEAR_MS) discard();
            else scheduleClear(persisted.id, PUBLISHED_CLEAR_MS - age);
            invalidatedForId.current = persisted.id; // already invalidated in the previous session
          }
          // `failed` is simply shown in the pill with Retry / Discard.
        }
        prevJobRef.current = null;
        onStoreChange();
        unsubscribe = subscribe(onStoreChange);
      })();

      return () => {
        cancelled = true;
        unsubscribe?.();
        cancelClearTimer();
      };
    }, [isLoading, onStoreChange, scheduleClear]);

    // Foreground retry: one automatic restart per attempt cycle after the
    // request died while the app was in the background.
    useEffect(() => {
      const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
        const job = getJob();
        if (!job) return;
        if (state === "background" || state === "inactive") {
          dispatch({ type: "backgrounded", at: Date.now() });
          return;
        }
        if (state === "active" && shouldAutoRetry(job)) {
          // Moves failed → active with pendingResume "foreground"; onStoreChange starts the runner.
          dispatch({ type: "resume", kind: "foreground", at: Date.now() });
        }
      });
      return () => sub.remove();
    }, []);

    return <>{children}</>;
  }
  ```

- [ ] **Step 7.2 — Mount it in `app/_layout.tsx`.**

  After line 13 (`import { SoftPostProvider } from '~/lib/userbase/soft-post-context';`) add:

  ```tsx
  import { UploadProvider } from '~/lib/upload/upload-provider';
  ```

  Replace lines 112-113:

  ```tsx
            <ToastProvider>
              <SoftPostProvider>
  ```

  with:

  ```tsx
            <ToastProvider>
              <UploadProvider>
              <SoftPostProvider>
  ```

  and replace lines 217-218:

  ```tsx
              </SoftPostProvider>
            </ToastProvider>
  ```

  with:

  ```tsx
              </SoftPostProvider>
              </UploadProvider>
            </ToastProvider>
  ```

- [ ] **Step 7.3 — Type-check.**

  ```bash
  pnpm exec tsc --noEmit
  ```

  Expected: no output.

- [ ] **Step 7.4 — Simulator verification (dev client on the booted iPhone 17 Pro simulator).**

  Start the dev server with `pnpm start` and open the app. Nothing is visible yet (no pill, create screen unchanged), so verify the provider is inert and harmless:

  - [ ] App launches to the feed with no red box and no new warnings in the Metro console.
  - [ ] Log out and back in: no crash, no `useAuth must be used within` error.
  - [ ] Press Home and return: Metro console shows no error from the AppState listener.
  - [ ] `xcrun simctl get_app_container booted com.bgrana.skatehive data` → the returned path has no `Documents/uploads/` yet (nothing was enqueued).

- [ ] **Step 7.5 — Commit.**

  ```bash
  git add lib/upload/upload-provider.tsx app/_layout.tsx
  git commit -m "feat(upload): root UploadProvider with launch resume, session gate and foreground retry"
  ```

---

### Task 8: `UploadPill` — the persistent pill above the tab bar

**Files:**
- Create: `components/upload/UploadPill.tsx`
- Modify: `app/(tabs)/_layout.tsx` (imports lines 1-12; JSX between lines 226 `</Tabs>` and 227 `</View>`)

**Interfaces:**
- Consumes: `useUploadJob`, `dispatch`, `discard` (Task 5); `pillLabel`, `pillDetail`, `isJobActive`, `UploadJob` (Tasks 1-2); `theme` from `~/lib/theme`; `Text` from `~/components/ui/text`; `Image` from `expo-image`; `Svg`, `Circle` from `react-native-svg`; `Ionicons` from `@expo/vector-icons`; `useRouter` from `expo-router`; `Animated`, `Easing`, `Pressable`, `StyleSheet`, `View` from `react-native`.
- Produces: `function UploadPill(): JSX.Element | null` (default and named export)

**Steps:**

- [ ] **Step 8.1 — Create `components/upload/UploadPill.tsx`.**

  ```tsx
  import React, { useEffect, useRef, useState } from "react";
  import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
  import { Image } from "expo-image";
  import { Ionicons } from "@expo/vector-icons";
  import Svg, { Circle } from "react-native-svg";
  import { useRouter } from "expo-router";
  import { Text } from "~/components/ui/text";
  import { theme } from "~/lib/theme";
  import { isJobActive, pillDetail, pillLabel, type UploadJob } from "~/lib/upload/upload-job";
  import { discard, dispatch, useUploadJob } from "~/lib/upload/upload-store";

  const TAB_BAR_HEIGHT = 60; // tabBarStyle.height in app/(tabs)/_layout.tsx
  const RING_SIZE = 44;
  const RING_STROKE = 3;
  const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
  const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
  const THUMB_SIZE = RING_SIZE - RING_STROKE * 2 - 4;

  function thumbnailUri(job: UploadJob): string | null {
    if (job.draft.coverUri) return job.draft.coverUri;
    if (job.draft.mediaKind === "image" && job.draft.mediaUri) return job.draft.mediaUri;
    return null;
  }

  function ProgressRing({ job }: { job: UploadJob }) {
    const indeterminate = job.pendingResume !== null || job.status === "publishing";
    const failed = job.status === "failed";
    const fraction = job.status === "published" ? 1 : indeterminate ? 0.25 : Math.min(1, Math.max(0, job.progress / 100));
    const spin = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      if (!indeterminate) {
        spin.stopAnimation();
        spin.setValue(0);
        return;
      }
      const loop = Animated.loop(
        Animated.timing(spin, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true }),
      );
      loop.start();
      return () => loop.stop();
    }, [indeterminate, spin]);

    const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

    return (
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke={theme.colors.border}
            strokeWidth={RING_STROKE}
            fill="none"
          />
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke={failed ? theme.colors.danger : theme.colors.primary}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${RING_CIRCUMFERENCE}`}
            strokeDashoffset={RING_CIRCUMFERENCE * (1 - fraction)}
            rotation={-90}
            origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
          />
        </Svg>
      </Animated.View>
    );
  }

  export function UploadPill() {
    const job = useUploadJob();
    const router = useRouter();
    const [expanded, setExpanded] = useState(false);

    // Collapse again when the post goes out.
    useEffect(() => {
      if (job?.status === "published") setExpanded(false);
    }, [job?.status]);

    if (!job) return null;

    const uri = thumbnailUri(job);
    const failed = job.status === "failed";
    const published = job.status === "published";

    const onPress = () => {
      if (published) {
        const { author, permlink } = job;
        discard();
        router.push({ pathname: "/conversation", params: { author, permlink } });
        return;
      }
      setExpanded((v) => !v);
    };

    const onRetry = () => {
      dispatch({ type: "retry", at: Date.now() });
    };

    const onDiscard = () => {
      discard();
    };

    return (
      <View style={styles.host}>
        <Pressable
          onPress={onPress}
          style={styles.pill}
          accessibilityRole="button"
          accessibilityLabel={pillLabel(job)}
          accessibilityHint={published ? "Opens the post" : "Shows upload details"}
        >
          <View style={styles.row}>
            <View style={styles.ringSlot}>
              <ProgressRing job={job} />
              <View style={styles.thumbSlot}>
                {uri ? (
                  <Image source={{ uri }} style={styles.thumb} contentFit="cover" />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]}>
                    <Ionicons name="play-outline" size={16} color={theme.colors.muted} />
                  </View>
                )}
              </View>
            </View>

            <View style={styles.labelBlock}>
              <View style={styles.labelRow}>
                {published ? <Ionicons name="checkmark-circle" size={16} color={theme.colors.primary} /> : null}
                {failed ? <Ionicons name="alert-circle" size={16} color={theme.colors.danger} /> : null}
                <Text style={[styles.label, failed && styles.labelFailed]} numberOfLines={1}>
                  {pillLabel(job)}
                </Text>
              </View>
              {!expanded && isJobActive(job) ? (
                <Text style={styles.caption} numberOfLines={1}>
                  {job.draft.caption || " "}
                </Text>
              ) : null}
            </View>

            <Ionicons
              name={expanded ? "chevron-down" : "chevron-up"}
              size={16}
              color={theme.colors.muted}
            />
          </View>

          {expanded ? (
            <View style={styles.expanded}>
              {job.draft.caption ? (
                <Text style={styles.caption} numberOfLines={1}>
                  {job.draft.caption}
                </Text>
              ) : null}
              <Text style={[styles.detail, failed && styles.detailFailed]} numberOfLines={3}>
                {pillDetail(job)}
              </Text>
              {failed ? (
                <View style={styles.actions}>
                  <Pressable onPress={onRetry} style={styles.retryButton} accessibilityRole="button">
                    <Text style={styles.retryText}>Retry</Text>
                  </Pressable>
                  <Pressable onPress={onDiscard} style={styles.discardButton} accessibilityRole="button">
                    <Text style={styles.discardText}>Discard</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : null}
        </Pressable>
      </View>
    );
  }

  export default UploadPill;

  const styles = StyleSheet.create({
    host: {
      position: "absolute",
      left: theme.spacing.md,
      right: theme.spacing.md,
      bottom: TAB_BAR_HEIGHT + theme.spacing.sm,
      pointerEvents: "box-none",
    },
    pill: {
      backgroundColor: theme.colors.secondaryCard,
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: theme.borderRadius.xxl,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 48,
      gap: theme.spacing.sm,
    },
    ringSlot: {
      width: RING_SIZE,
      height: RING_SIZE,
      alignItems: "center",
      justifyContent: "center",
    },
    thumbSlot: {
      position: "absolute",
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: theme.borderRadius.full,
      overflow: "hidden",
    },
    thumb: {
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: theme.borderRadius.full,
    },
    thumbPlaceholder: {
      backgroundColor: theme.colors.card,
      alignItems: "center",
      justifyContent: "center",
    },
    labelBlock: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
    labelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    label: {
      color: theme.colors.text,
      fontFamily: theme.fonts.bold,
      fontSize: theme.fontSizes.sm,
    },
    labelFailed: {
      color: theme.colors.danger,
    },
    caption: {
      color: theme.colors.muted,
      fontFamily: theme.fonts.regular,
      fontSize: theme.fontSizes.xs,
    },
    expanded: {
      borderTopColor: theme.colors.border,
      borderTopWidth: 1,
      marginTop: theme.spacing.xs,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.xs,
      paddingHorizontal: theme.spacing.xs,
      gap: theme.spacing.xs,
    },
    detail: {
      color: theme.colors.muted,
      fontFamily: theme.fonts.regular,
      fontSize: theme.fontSizes.sm,
    },
    detailFailed: {
      color: theme.colors.danger,
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: theme.spacing.md,
      marginTop: theme.spacing.xs,
    },
    retryButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.full,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
    },
    retryText: {
      color: theme.colors.black,
      fontFamily: theme.fonts.bold,
      fontSize: theme.fontSizes.sm,
    },
    discardButton: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    discardText: {
      color: theme.colors.danger,
      fontFamily: theme.fonts.bold,
      fontSize: theme.fontSizes.sm,
    },
  });
  ```

  The only inline style is the animated `transform` on `Animated.View`, as the spec allows.

- [ ] **Step 8.2 — Mount it in `app/(tabs)/_layout.tsx`.**

  After line 12 (`import { ActionSheet } from "~/components/ui/ActionSheet";`) add:

  ```tsx
  import { UploadPill } from "~/components/upload/UploadPill";
  ```

  Between line 226 (`          </Tabs>`) and line 227 (`        </View>`) insert:

  ```tsx
          {/* Background upload progress. A sibling of <Tabs> so it survives
              tab switches and sits above the bar; absent on stack screens. */}
          <UploadPill />
  ```

- [ ] **Step 8.3 — Type-check.**

  ```bash
  pnpm exec tsc --noEmit
  ```

  Expected: no output.

- [ ] **Step 8.4 — Add a temporary debug hook (never committed) to drive the pill.**

  The create screen is not wired until Task 9, so step the store by hand. In `app/(tabs)/create.tsx` add these imports after line 56:

  ```tsx
  import { createJob as debugCreateJob } from "~/lib/upload/upload-job";
  import { dispatch as debugDispatch, getJob as debugGetJob } from "~/lib/upload/upload-store";
  ```

  and replace line 591 (`<Text style={styles.headerText}>Create</Text>`) with a long-press stepper that walks a fixed script one event per long-press:

  ```tsx
              <Text
                style={styles.headerText}
                onLongPress={() => {
                  if (!__DEV__) return;
                  const now = Date.now();
                  if (!debugGetJob()) {
                    debugDispatch({
                      type: "enqueued",
                      job: debugCreateJob({
                        id: "dbg",
                        author: username ?? "me",
                        permlink: "sh-dbg",
                        caption: "Debug clip #test",
                        mediaKind: "video",
                        mediaUri: "file:///nope.mov",
                        mime: "video/mp4",
                        fileName: "nope.mov",
                        coverUri: null,
                        igCaption: "",
                        crossPostToInstagram: false,
                        communityTag: "hive-173115",
                        now,
                      }),
                    });
                    return;
                  }
                  const j = debugGetJob()!;
                  if (j.status === "uploading") debugDispatch({ type: "progress", progress: 62, stage: "transcoding" });
                  else if (j.status === "transcoding" && j.stage === "transcoding") debugDispatch({ type: "progress", progress: 80, stage: "uploading" });
                  else if (j.status === "transcoding") debugDispatch({ type: "media_done", cid: "x", gatewayUrl: "https://x" });
                  else if (j.status === "publishing") debugDispatch({ type: "failed", error: { kind: "broadcast", message: "RC too low" }, appActive: true, at: now });
                }}
              >
                Create
              </Text>
  ```

  Note: the provider will start the real runner on `enqueued` (the job is fake, so that run fails fast with `The video is no longer on this device` and shows `Upload failed`; tap Discard, then long-press again, and continue with the checks below between the runner's failure and your next long-press — or, simpler, verify with the dev client offline in Airplane mode, where the runner fails with a network error before any progress event).

- [ ] **Step 8.5 — Simulator verification with the debug hook.**

  - [ ] Long-press the header once: the pill appears above the tab bar on Videos, Map, Notifications, Profile; open `/conversation` from any post — no pill there.
  - [ ] Label reads `Uploading… 0%`, the ring is empty, the placeholder `play-outline` icon shows (no cover).
  - [ ] Long-press → `Transcoding… 62%`, ring about 62% full.
  - [ ] Long-press → `Pinning… 80%`.
  - [ ] Tap the pill → expands; detail reads `Uploading to IPFS`; tap again → collapses.
  - [ ] Long-press → `Publishing…`, ring rotates (indeterminate).
  - [ ] Long-press → `Upload failed` in danger red; expand → `RC too low`, Retry and Discard visible.
  - [ ] Tap Retry → status returns to `Publishing…` then fails again (fake job); tap Discard → the pill disappears.
  - [ ] Temporarily change the last `else if` to dispatch `{ type: "published", at: now }` instead of `failed`, reload, walk the script again → `Published` with a check, ring full; the pill disappears by itself after 4s. Repeat and tap it before 4s → `/conversation` opens with `author=<you>`, `permlink=sh-dbg` (it shows "not found" — fine) and the pill is gone.

- [ ] **Step 8.6 — Remove the debug hook.**

  Revert `app/(tabs)/create.tsx` completely:

  ```bash
  git checkout -- 'app/(tabs)/create.tsx' && git status --short
  ```

  Expected: only `components/upload/UploadPill.tsx` (untracked) and `app/(tabs)/_layout.tsx` (modified) plus `?? .maestri/`.

- [ ] **Step 8.7 — Commit.**

  ```bash
  git add components/upload/UploadPill.tsx 'app/(tabs)/_layout.tsx'
  git commit -m "feat(upload): progress pill above the tab bar with ring, stages, retry and discard"
  ```

---

### Task 9: Create screen — `handlePost` becomes validate → IG prompt → enqueue → clear → navigate

**Files:**
- Modify: `app/(tabs)/create.tsx`
  - imports lines 24-56
  - `useQueryClient` line 60
  - state lines 66-73
  - `maybeCrossPostToInstagram` lines 122-181
  - `handlePost` lines 345-579
  - progress card lines 606-617
  - `disabled={isUploading …}` at lines 624, 680, 690, 713, 732
  - Share button lines 743-750
  - styles lines 808-842

**Interfaces:**
- Consumes: `useUploadJob`, `enqueue`, `UploadBusyError` (Task 5); `isJobActive` (Task 1); existing `canPost` from `~/lib/posting`; `COMMUNITY_TAG` from `~/lib/hive-utils`; `isCrossPostEnabled`, `eligibleForCrosspost`, `getHivePower`, `MIN_HP_TO_CROSSPOST`, `getIgHandle`, `setIgHandle`, `hasEligibleHiveAccount` from `~/lib/instagram`; `SecureStore`.
- Produces: no new exports; the screen's default export keeps its name `CreatePost`.

**Steps:**

- [ ] **Step 9.1 — Replace the imports (lines 24-56).**

  Delete these imports: `useQueryClient` (line 24), the `~/lib/upload/video-upload` block (27-30), the `~/lib/upload/image-upload` block (31-35), `isUserbaseSession, postComment` from `~/lib/posting` (keep `canPost`), `SNAPS_CONTAINER_AUTHOR, getLastSnapsContainer` from `~/lib/hive-utils` (keep `COMMUNITY_TAG`), `crossPostToInstagram` from `~/lib/instagram` (keep the rest), and `WEB_BASE_URL` (line 56). Lines 24-56 become:

  ```tsx
  import { useToast } from "~/lib/toast-provider";
  import { CreateSpectatorInfo } from "~/components/SpectatorMode/CreateSpectatorInfo";
  import { canPost } from "~/lib/posting";
  import { COMMUNITY_TAG } from "~/lib/hive-utils";
  import { theme } from "~/lib/theme";
  import * as SecureStore from "expo-secure-store";
  import {
    getIgHandle,
    setIgHandle,
    getHivePower,
    eligibleForCrosspost,
    hasEligibleHiveAccount,
    MIN_HP_TO_CROSSPOST,
    isCrossPostEnabled,
  } from "~/lib/instagram";
  import { InstagramHandleModal } from "~/components/Instagram/InstagramHandleModal";
  import { VideoCoverPicker } from "~/components/create/VideoCoverPicker";
  import { isJobActive } from "~/lib/upload/upload-job";
  import { enqueue, UploadBusyError, useUploadJob } from "~/lib/upload/upload-store";
  ```

  Also change line 3 to `import React, { useEffect, useRef, useState } from "react";`.

- [ ] **Step 9.2 — Replace the upload state (lines 60, 66, 71-73).**

  Delete line 60 (`const queryClient = useQueryClient();`), line 66 (`isUploading`), and lines 71-73 (`uploadProgress`, `videoProgress`, `videoStage`). In their place, right after `const { showToast } = useToast();`, add:

  ```tsx
    // The job lives in the upload store; the screen only needs to know whether
    // Share is allowed. A failed job blocks too: there is no second slot.
    const uploadJob = useUploadJob();
    const jobBlocksShare = isJobActive(uploadJob) || uploadJob?.status === "failed";
    const shareHint = isJobActive(uploadJob)
      ? "Wait for the current upload to finish"
      : uploadJob?.status === "failed"
        ? "Retry or discard the failed upload first"
        : null;
    // Ref-based lock: a second tap during the ~1s media copy must not enqueue
    // twice, and state updates are too slow to prevent it.
    const submitLock = useRef(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
  ```

- [ ] **Step 9.3 — Delete `maybeCrossPostToInstagram` (lines 122-181) entirely.** Its checks move into `handlePost` (eligibility, handle prompt) and the runner (parent-author check, the cross-post call).

- [ ] **Step 9.4 — Replace `handlePost` (lines 345-579).**

  ```tsx
    const handlePost = async () => {
      if (submitLock.current) return;

      if (!content.trim() && !media) {
        Alert.alert("Validation Error", "Please add some content or media to your post");
        return;
      }

      // Email (userbase) accounts are server-custody and have no local
      // decryptedKey, so gate on canPost() rather than the presence of a key.
      if (!username || username === "SPECTATOR" || !session || !canPost(session)) {
        Alert.alert("Authentication Required", "Please log in to create a post");
        return;
      }

      // The button is disabled in this state; this guards a stale press.
      if (jobBlocksShare) return;

      submitLock.current = true;
      setIsSubmitting(true);
      setErrorMessage(null);

      try {
        const hasMedia = !!(media && mediaType && mediaMimeType);

        // Instagram decision, resolved here because the prompt is UI and the
        // runner has none. The parent-author check happens in the runner.
        let crossPost = false;
        if (hasMedia && igCrossPost) {
          try {
            crossPost =
              (await isCrossPostEnabled()) &&
              eligibleForCrosspost(session) &&
              (await getHivePower(username)) >= MIN_HP_TO_CROSSPOST;
          } catch {
            crossPost = false; // never block the post on cross-post setup
          }
        }
        if (crossPost) {
          try {
            const { source } = await getIgHandle(session);
            if (source === null) {
              const alreadyPrompted = await SecureStore.getItemAsync(IG_PROMPTED_KEY);
              if (!alreadyPrompted) {
                await SecureStore.setItemAsync(IG_PROMPTED_KEY, "1");
                await promptForIgHandle();
              }
            }
          } catch {
            // The handle is optional; the server builds a caption without it.
          }
        }

        await enqueue(
          {
            caption: content,
            mediaKind: hasMedia ? mediaType : null,
            mediaUri: hasMedia ? media : null,
            mime: hasMedia ? mediaMimeType : null,
            coverUri: mediaType === "video" ? coverUri : null,
            igCaption: igCaption.trim(),
            crossPostToInstagram: crossPost,
            communityTag: COMMUNITY_TAG,
          },
          session,
        );

        // Clear form
        setContent("");
        setMedia(null);
        setCoverUri(null);
        setIgCaption("");
        setMediaType(null);
        setMediaMimeType(null);

        // The pill takes it from here.
        router.push("/(tabs)/feed");
      } catch (error) {
        const errorMsg =
          error instanceof UploadBusyError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Could not start the upload";
        setErrorMessage(errorMsg);
        console.error("Enqueue error:", error);
      } finally {
        submitLock.current = false;
        setIsSubmitting(false);
      }
    };
  ```

- [ ] **Step 9.5 — Remove the progress card (lines 606-617)** — the whole `{/* Upload Progress */}` block through its closing `) : null}`.

- [ ] **Step 9.6 — Swap the remaining `isUploading` references.**

  - line 624: `disabled={isUploading || isSelectingMedia}` → `disabled={isSubmitting || isSelectingMedia}`
  - line 680: `disabled={isUploading}` → `disabled={isSubmitting}`
  - line 690: `disabled={isUploading}` → `disabled={isSubmitting}`
  - line 713: `disabled={isUploading}` → `disabled={isSubmitting}`
  - line 732: `editable={!isUploading}` → `editable={!isSubmitting}`

  Then `grep -n isUploading 'app/(tabs)/create.tsx'` must print nothing.

- [ ] **Step 9.7 — Replace the Share button (lines 743-750) with the button plus the hint.**

  ```tsx
            {/* Publishing last, after the cover and caption the author may still
                be adjusting. Disabled while another job holds the single slot. */}
            <Button
              onPress={handlePost}
              disabled={(!content.trim() && !media) || isSubmitting || jobBlocksShare}
            >
              <Text style={styles.shareButtonText}>
                {isSubmitting ? "Sharing…" : "Share"}
              </Text>
            </Button>
            {shareHint ? <Text style={styles.shareHint}>{shareHint}</Text> : null}
  ```

- [ ] **Step 9.8 — Replace the progress styles (lines 808-842: `progressCard`, `progressText`, `progressBarContainer`, `progressBarFill`, `progressPercent`) with one hint style.**

  ```tsx
    shareHint: {
      color: theme.colors.muted,
      fontSize: theme.fontSizes.xs,
      fontFamily: theme.fonts.default,
      textAlign: "center",
      marginTop: theme.spacing.xs,
      marginHorizontal: theme.spacing.md,
    },
  ```

- [ ] **Step 9.9 — Type-check and grep for leftovers.**

  ```bash
  pnpm exec tsc --noEmit && grep -n "isUploading\|uploadProgress\|videoProgress\|videoStage\|maybeCrossPostToInstagram\|queryClient\|postComment\|getLastSnapsContainer\|uploadVideoToWorker\|WEB_BASE_URL" 'app/(tabs)/create.tsx'
  ```

  Expected: `tsc` silent; grep prints nothing (exit 1 from grep is the success signal here).

- [ ] **Step 9.10 — Simulator verification.**

  - [ ] Open Create, type text only, tap Share: the feed appears immediately, the pill shows `Publishing…` then `Published`, hides after 4s, the new post is at the top of the feed after the invalidation.
  - [ ] Pick an image, tap Share: pill shows `Uploading… N%` briefly then `Publishing…` → `Published`; the image post is in the feed.
  - [ ] Pick a 20-60s clip, pick a cover frame, tap Share: the form clears, the feed opens, the pill shows the cover thumbnail and moves Uploading → Transcoding → Pinning → Publishing → Published.
  - [ ] While the clip uploads, open Create again: Share is disabled and the hint reads `Wait for the current upload to finish`. After Published it is enabled again with no hint.
  - [ ] Force a failure (turn on Airplane mode before tapping Share on a clip): the pill shows `Upload failed`; open Create: Share disabled with `Retry or discard the failed upload first`. Discard from the pill → Share enabled.
  - [ ] Double-tap Share fast on a clip: exactly one pill / one job; `Documents/uploads/` (via `xcrun simctl get_app_container booted com.bgrana.skatehive data`) contains exactly one job directory plus `job.json`.
  - [ ] Eligible classic-key account with no stored handle and never prompted: tapping Share on a clip shows the Instagram handle modal *before* the form clears; saving or skipping continues to enqueue.
  - [ ] `errorCard` shows the message when enqueue fails (simulate by picking a video, then deleting it from Photos before Share; the copy throws and the form stays).

- [ ] **Step 9.11 — Commit.**

  ```bash
  git add 'app/(tabs)/create.tsx'
  git commit -m "feat(create): hand the post to the background upload job and return to the feed"
  ```

---

### Task 10: Final verification — full simulator pass and the type gate

**Files:**
- No new files. Fixes discovered here are committed to the file they belong to (each with its own `git add <path>`).

**Interfaces:**
- Consumes: everything above.
- Produces: a verified branch, ready for review — not pushed.

**Steps:**

- [ ] **Step 10.1 — Gates.**

  ```bash
  pnpm test && pnpm exec tsc --noEmit && git status --short
  ```

  Expected: three `# fail 0` blocks; `tsc` silent; `git status --short` shows only `?? .maestri/`.

- [ ] **Step 10.2 — Spec simulator verification, iPhone 17 Pro dev client (`pnpm start`, open the dev client). Tick each after observing it:**

  1. - [ ] **Happy path:** pick a 20-60s clip, Share. The feed appears immediately; the pill shows the thumbnail and moves through Uploading → Transcoding → Pinning → Publishing → Published, hides after 4s, the post is in the feed.
  2. - [ ] **Navigation:** during the upload open Profile, Videos and a post viewer. Upload continues; the pill is visible on tab screens and absent on the post viewer.
  3. - [ ] **Tap Published:** the conversation screen for the new post opens and the pill is gone.
  4. - [ ] **Kill mid-upload:** start an upload, at ~40% run `xcrun simctl terminate booted com.bgrana.skatehive`. Relaunch: the pill shows `Resuming…` then the normal stages; exactly one post appears on chain (check the profile grid).
  5. - [ ] **Kill during publishing:** repeat with the kill right after progress hits 100%. On relaunch the pill goes straight to `Publishing…` and the post is published once (the `get_content` guard is visible in the Metro console as no second broadcast).
  6. - [ ] **Background retry:** start an upload, press Home, wait 45s, return. The pill shows `Resuming…` and restarts; background it again for 45s and return: the pill shows `Upload failed` with Retry and Discard.
  7. - [ ] **Retry / Discard:** Retry from the failed state completes the post. Discard from a fresh failure removes the pill and the `Documents/uploads/<id>` directory (`ls "$(xcrun simctl get_app_container booted com.bgrana.skatehive data)/Documents/uploads"` shows no job directory and no `job.json`).
  8. - [ ] **Busy hint:** with an upload running, open Create: Share is disabled and the hint is shown; after Published it is enabled again.
  9. - [ ] **Text-only and image posts:** both publish through the pill.
  10. - [ ] **Session gate:** start an upload, kill, log out, relaunch: the pill shows `Upload failed` and, expanded, `Log in as @<author> to finish this post`; log back in as that account, Retry completes.
  11. - [ ] `pnpm logs:ios` shows no `NativeSharedObjectNotFound` and Metro shows no unhandled promise warnings during 1-7.

- [ ] **Step 10.3 — Fix anything that failed above in its own file, re-run Step 10.1, and commit each fix separately** with a message in the form `fix(upload): <what was wrong>` and `git add` of only the touched file(s).

- [ ] **Step 10.4 — Final state check.**

  ```bash
  git log --oneline main..HEAD && git status --short
  ```

  Expected: the spec commit plus the commits from Tasks 1-9 (and any 10.3 fixes); working tree clean except `?? .maestri/`. Do not push.

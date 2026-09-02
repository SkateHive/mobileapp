# Background Upload, Phase 1 (client-only) — Design Spec

**Date:** 2026-09-02
**Branch:** `feat/background-upload` (mobileapp)
**Status:** Approved design, ready for implementation planning
**Grounded in:** Maestri note `upload-flow-map` (2026-09-02), which maps the
current flow with file:line citations. Line numbers below refer to `main` at
`ca80ed6`.

## Goal

Posting a clip must stop trapping people on the Create screen. Today the whole
upload runs inside one `async` function on the screen (`app/(tabs)/create.tsx`
handlePost, 345-578): progress lives in component state, every control is
disabled, and a JS reload, a cold restart, or iOS suspending the request after
~30s in the background loses the post with an `Alert`.

After this phase:

- Tapping **Share** validates, hands the post to a job that lives outside any
  screen, clears the form and takes the user to the feed.
- A persistent pill above the tab bar shows progress; the post publishes by
  itself when the upload finishes.
- The job survives navigation, a JS reload and an app kill: it is persisted on
  every transition and resumed on the next launch.
- One upload at a time.

## Decisions (locked by the user)

- The post **publishes automatically** when the upload finishes. No
  "review before posting" step.
- **UI is a persistent pill** above the tab bar: thumbnail, progress ring, stage
  text; tap to expand; auto-hides 4s after *Published*; tapping *Published*
  opens the post; *Retry* / *Discard* on failure.
- **Killed mid-upload → resumes automatically on next launch**, pill shows
  *Resuming*.
- **iOS background kill of the request → one automatic retry on foreground**
  before *Retry* is shown.
- **No on-device compression** in this phase.
- **Only one upload at a time.** The Share button is disabled with a short hint
  while a job is active.
- **Client-only.** No transcoder, API or server changes.

Decisions made while writing this spec (all consistent with the above):

- **Every post goes through the job**, including image posts and text-only
  posts. One code path means one double-post guard, one persistence path and
  one place that invalidates the feed. A text-only post shows the pill for the
  second or two the broadcast takes.
- **A failed job also blocks new posts** until it is retried or discarded.
  Single-job means there is no slot for a second draft, and silently replacing
  a failed job would delete media the user may still want posted.
- **The Instagram first-time handle prompt runs before enqueue**, on the Create
  screen, because it is UI and the runner has none. The cross-post itself runs
  after publish, from the runner, fire-and-forget as today.
- **Auto-retry after a background kill is bounded to one per attempt cycle**:
  a manual *Retry* resets the counter.

## Current flow (from `upload-flow-map`)

1. **Pick.** `ImagePicker.launchImageLibraryAsync` (create.tsx 184-192) or the
   in-app gallery (243-290, `RecentMediaGallery` resolves `ph://` assets to a
   `file://` localUri, `components/ui/RecentMediaGallery.tsx` 128-135). No
   compression, no size check. Cover frame chosen locally by
   `VideoCoverPicker`, saved as a JPEG in the cache dir
   (`components/create/VideoCoverPicker.tsx` 47-48).
2. **Share → handlePost** (345-578): `setIsUploading` (362) → image upload
   (382-412, `uploadImageToHive` / `uploadImageViaUserbase`) **or** optional
   cover upload (425-441) then `uploadVideoToWorker` (445-467, progress via
   `onProgress` into `videoProgress` / `videoStage` / `uploadProgress` state
   66-73) → `getLastSnapsContainer` with community fallback (494-509) → tags
   from body hashtags + permlink `sh-<timestamp>` (511-522) → `postComment`
   (526-536) → toast → `maybeCrossPostToInstagram` (126-183; may show the
   handle prompt) → clear form → invalidate `["feed"]` and
   `["userFeed", username]` (564-565) → `router.push("/(tabs)/feed")` (568).
   Any throw → `Alert` (573).
3. **Transcoder client** (`lib/upload/video-upload.ts`): one synchronous
   multipart POST to `<service>/transcode` (185-206). Service list from
   `api.skatehive.app/api/transcode/status` with two hardcoded fallbacks,
   tried in priority order (123-224). Progress: client-generated
   `correlationId` (129), `GET /progress/<id>` polled every 1.5s (161-181). The
   server keeps only `{progress, stage}` in memory and drops the job 5s after
   completion; `cid`/`gatewayUrl`/`thumbnailUrl` exist only in the POST
   response. **There is no job id to poll later.** Stages the server emits:
   `receiving`, `transcoding`, `optimized`, `uploading`, `complete`, `error`.
4. **Global state** (`app/_layout.tsx` 108-118): `QueryClientProvider >
   AuthProvider > NavigationGuard > NotificationProvider > ToastProvider >
   SoftPostProvider > SafeAreaProvider > ActivityWrapper > Stack`. Toast
   auto-hides after 3s, no persistent variant. Tab bar: `(tabs)/_layout.tsx`
   wraps `<Tabs>` in a `SafeAreaView` + PanResponder `View` (136-138).
5. **Background capability:** none. `expo-file-system` 19 is installed but
   unused. No task manager, no background modes, only `expo-keep-awake` during
   the POST (video-upload.ts 121).
6. **Custody:** Hive-key sessions hold `session.decryptedKey` (also cached in
   the Keychain for 30 days, `lib/active-session.ts` 20-36); userbase sessions
   hold a bearer token and the server signs (`lib/posting.ts` 55-83).
   `postComment(session, args)` is the single seam for both.
7. **Retry / resume / queue:** none.

## Architecture

```
app/(tabs)/create.tsx        validate → prepareDraft → enqueue → clear → feed
        │
        ▼
lib/upload/upload-store.ts   single UploadJob, useSyncExternalStore, persisted
        │  ▲
        ▼  │ transitions
lib/upload/upload-runner.ts  legs: cover → media → publish, injected deps
        ▲
        │ start / resume / foreground retry
lib/upload/upload-provider.tsx   root provider: load job on launch, AppState
        │
        ▼
components/upload/UploadPill.tsx  reads the store, mounted in (tabs)/_layout.tsx
```

### Files

| File | Role | Imports RN / Expo? |
|------|------|--------------------|
| `lib/upload/upload-job.ts` | Types, `createJob`, the pure reducer `reduce(job, event)`, `isJobActive`, `pillLabel(job)` | No (pure, unit-tested) |
| `lib/upload/post-assembly.ts` | Pure helpers extracted from handlePost: `makePermlink`, `buildBody`, `buildTags(body, communityTag)`. `createVideoIframe` and `createImageMarkdown` move here; `video-upload.ts` and `image-upload.ts` re-export them so existing imports keep working | No (pure, unit-tested) |
| `lib/upload/upload-runner.ts` | `runUploadJob(job, deps, emit)`: the leg sequence and the double-post guard, all I/O through `deps` | No (pure, unit-tested) |
| `lib/upload/upload-store.ts` | Holds the job in a module-level variable, `subscribe`/`getSnapshot`, `dispatch(event)` = reduce + persist, `useUploadJob()` hook, media copy/delete helpers | Yes (`expo-file-system`, React) |
| `lib/upload/upload-legs.ts` | Real `RunnerDeps`: cover/image upload, `uploadVideoToWorker`, `getLastSnapsContainer`, `getContent`, `postComment`, `crossPostToInstagram` | Yes |
| `lib/upload/upload-provider.tsx` | `UploadProvider`: launch resume, AppState listener, session gate, query invalidation | Yes |
| `components/upload/UploadPill.tsx` | The pill | Yes |
| `lib/upload/__tests__/upload-job.test.ts`, `upload-runner.test.ts`, `post-assembly.test.ts` | Unit tests (`node:test`, run with `tsx`) | No |

The split between `upload-job.ts` / `upload-runner.ts` / `post-assembly.ts`
(pure) and `upload-store.ts` / `upload-legs.ts` (bound to Expo) exists so the
tests run under plain Node without a React Native mock. The pure modules import
nothing from `lib/hive-utils.ts` (it pulls in dhive and the RPC client), so the
community tag is passed in: the runner reads it from `deps.communityTag` and
`upload-legs.ts` supplies `COMMUNITY_TAG` from `hive-utils`.

### 1. Store (`lib/upload/upload-store.ts`)

Same shape as the grid visibility store (`components/Profile/GridVideoTile.tsx`
`createTileVisibility`, 22-43): a module-level value, a `Set` of listeners,
`subscribe`, `getSnapshot`. Consumers use
`useSyncExternalStore(subscribe, getSnapshot)` through `useUploadJob()`.

- `getJob(): UploadJob | null`
- `dispatch(event: UploadEvent): UploadJob | null` — applies `reduce`, notifies
  listeners, then persists. Persistence is awaited by nothing; a failed write
  logs a warning and keeps the in-memory job.
- `enqueue(input: EnqueueInput, session): Promise<UploadJob>` — copies media
  (see *Draft storage*), creates the job with `createJob`, dispatches
  `enqueued`. Throws `UploadBusyError` if `isJobActive(getJob())`.
- `discard()` — deletes the job directory and the JSON file, sets the job to
  `null`. Any in-flight fetch is abandoned (its result is ignored because the
  runner checks `job.id` before every dispatch).
- `loadPersistedJob(): Promise<UploadJob | null>` — reads the JSON on launch,
  validates the shape (unknown `status` or missing `id`/`permlink` → file
  deleted, `null` returned).

**Persistence.** One file, `Paths.document/uploads/job.json` (`expo-file-system`
19 `File`/`Directory`/`Paths` API). Written whole on every transition with
`file.write(JSON.stringify(job))`. The document directory is not purged by iOS
under storage pressure, unlike the cache directory the pickers write to.

**Draft storage.** `enqueue` creates `Paths.document/uploads/<jobId>/` and
copies the media there (`media.<ext>`, extension from the source uri or the
mime) and the cover (`cover.jpg`) with `File.copy`. The job stores the copied
`file://` uris. If the copy throws, `enqueue` rethrows and the Create screen
shows the error in its existing `errorCard`; nothing is enqueued. The directory
is deleted on *Discard* and when a *Published* job is cleared.

### 2. Runner (`lib/upload/upload-runner.ts`)

```ts
export interface RunnerDeps {
  uploadImage(uri: string, name: string, mime: string): Promise<{ url: string }>;
  uploadVideo(uri: string, name: string, mime: string, opts: {
    thumbnailUrl?: string;
    onProgress(progress: number, stage: string): void;
  }): Promise<{ cid: string; gatewayUrl: string; thumbnailUrl?: string }>;
  getParent(): Promise<{ author: string; permlink: string }>;   // getLastSnapsContainer + fallback
  getContent(author: string, permlink: string): Promise<{ author: string } | null>;
  broadcast(args: PostCommentArgs): Promise<void>;               // postComment(session, …)
  crossPost?(args: CrossPostArgs): Promise<void>;                // fire-and-forget
  communityTag: string;                                          // COMMUNITY_TAG from hive-utils
  now(): number;
}

export async function runUploadJob(
  job: UploadJob,
  deps: RunnerDeps,
  emit: (event: UploadEvent) => UploadJob | null
): Promise<void>
```

`emit` is the store's `dispatch`. The runner is a straight-line function over
the job it was given; it re-reads nothing from the store. It never throws: every
failure becomes a `failed` event.

Legs, in order, each skipped when the job already carries its result:

1. **Cover** (video with `draft.coverUri`, skipped when `result.coverUrl` is
   set): `deps.uploadImage(coverUri, "cover.jpg", "image/jpeg")`. Best-effort as
   today (create.tsx 425-441): on failure emit `cover_skipped` and continue
   with the worker's own frame.
2. **Media** (skipped when `result.cid` is set for video, or `result.imageUrl`
   for an image):
   - image → `deps.uploadImage(mediaUri, fileName, mime)` → `media_done
     { imageUrl }`.
   - video → `deps.uploadVideo(mediaUri, fileName, mime, { thumbnailUrl:
     result.coverUrl, onProgress })` → `media_done { cid, gatewayUrl,
     thumbnailUrl }`. `onProgress` emits `progress { progress, stage }`; the
     reducer maps `stage` to `status` (see state machine).
   - text-only → the job was created in `publishing` (see the `enqueued`
     row), so this leg does not run.
3. **Publish**:
   - `deps.getParent()` — on throw, use `{ author: "", permlink:
     deps.communityTag }` exactly as create.tsx 494-509 does.
   - **Double-post guard:** `deps.getContent(job.author, job.permlink)`. If it
     returns non-null the post already exists (a previous attempt broadcast
     before the app died, or the RPC timed out after inclusion): emit
     `published` and skip the broadcast. If it throws, the guard fails closed:
     `failed` kind `network`, no broadcast. `upload-legs.ts` therefore calls
     `HiveClient.database.call("get_content", …)` directly rather than
     `hive-utils.getContent`, which swallows RPC errors and returns `null`
     (`lib/hive-utils.ts` 314-325).
   - Body and metadata from `post-assembly.ts`: `buildBody(caption, result)`
     appends `createImageMarkdown` or `createVideoIframe`; `buildTags(body,
     deps.communityTag)`; `images` = `[imageUrl]` or `[coverUrl ??
     thumbnailUrl]`. Same output as create.tsx 382-491 and 511-536.
   - `deps.broadcast({ parentAuthor, parentPermlink, body, permlink:
     job.permlink, jsonMetadata })` → `published`.
4. **Cross-post** (after `published`, only when `draft.crossPostToInstagram`
   is true and `deps.crossPost` is provided): `deps.crossPost(...)` with a
   `.catch` that logs, never affecting job state. The runner returns without
   awaiting it.

**Retry skips finished legs** because the reducer keeps `result` across a
`retry` event; the leg guards above do the rest. A retry of a video job whose
`result.cid` exists goes straight to publish.

**Failure classification.** The runner attaches `error.kind` to the `failed`
event:

| kind | When |
|------|------|
| `network` | `TypeError` from fetch ("Network request failed"), `AbortError`, or the `All video upload services failed` error from `uploadVideoToWorker` |
| `server` | HTTP status error text from a transcoder or image host |
| `auth` | `canPost(session)` false or session username ≠ `job.author` (raised by the provider before the runner starts) |
| `broadcast` | `postComment` threw |
| `unknown` | anything else |

Only `network` failures are eligible for the automatic foreground retry.

### 3. Provider (`lib/upload/upload-provider.tsx`)

Mounted in `app/_layout.tsx` directly inside `ToastProvider` (so it sits below
`AuthProvider` and `QueryClientProvider`, which it needs, and above the
navigator, so it lives for the whole session).

Responsibilities:

- **Launch resume.** Once `useAuth().isLoading` is false: `loadPersistedJob()`.
  If a job exists and is active (`uploading`, `transcoding`, `publishing`),
  dispatch `resume { kind: "launch" }` and start the runner. If it is `failed`
  or `published`, just show it in the pill (a `published` job older than 4s
  is cleared immediately).
- **Session gate.** Before every runner start: `session` must satisfy
  `canPost(session)` and `session.username === job.author`. Otherwise dispatch
  `failed { kind: "auth", message: "Log in as @<author> to finish this post" }`.
  The job is not discarded; *Retry* re-runs the gate, so logging back in fixes
  it.
- **Start on enqueue.** Subscribes to the store; when a job appears with
  `attempts === 0`, start the runner. This is the only place that calls
  `runUploadJob`, so create.tsx never touches the runner.
- **`emit` wrapper.** The provider passes the runner an `emit` that forwards to
  the store's `dispatch` after stamping `failed` events with `appActive:
  AppState.currentState === "active"`. The runner itself never imports
  `AppState`.
- **Foreground retry.** `AppState.addEventListener("change", …)` as in
  `lib/hooks/useSpotWidgetSync.ts` 56-59. On `background`/`inactive`, dispatch
  `backgrounded`. On `active`, if the job is `failed` with
  `error.kind === "network"`, `backgroundedAt > attemptStartedAt` and
  `autoRetries === 0`, dispatch `resume { kind: "foreground" }` and start the
  runner. If the network failure lands while the app is already active again
  (the request died in the background but the promise rejects on return), the
  reducer's `failed` handler applies the same rule and the provider starts the
  runner immediately.
- **After publish.** Invalidate `["feed"]` and `["userFeed", author]` (as
  create.tsx 564-565). Schedule the 4s auto-hide: dispatch `cleared` and delete
  the job directory.
- **Single runner.** A `runningJobId` ref, set before `runUploadJob` and
  cleared when its promise settles, prevents two concurrent runs of the same
  job (launch resume and enqueue cannot both fire, but AppState `active` can
  fire while a run is in flight).

### 4. Pill (`components/upload/UploadPill.tsx`)

Mounted in `app/(tabs)/_layout.tsx` as a sibling of `<Tabs>` inside the
PanResponder `View` (136-138), absolutely positioned at `bottom: 60 +
theme.spacing.sm` (the tab bar height set at 144) with `theme.spacing.md`
horizontal insets. It renders `null` when there is no job. It is not visible on
stack screens outside the tabs (post viewer, conversation, spot); the job keeps
running there.

Theme tokens only (`lib/theme.ts`): `secondaryCard` background, `border`
border, `primary` ring, `text`/`muted` labels, `danger` for failure,
`borderRadius.full`, `fonts.regular`/`fonts.bold`. `StyleSheet.create`, no
inline styles except the animated width/rotation values.

Collapsed (default, 56pt tall):

```
┌────────────────────────────────────────────┐
│ [thumb◔]  Transcoding… 62%                 │
└────────────────────────────────────────────┘
```

- **Thumbnail:** `expo-image` from `draft.coverUri`, else for a video
  `useVideoFirstFrame` from `lib/video-thumbnails` keyed by `job.permlink`
  with `requestVideoFirstFrame(job.permlink, draft.mediaUri)`, else for an
  image `draft.mediaUri`, else the `play-outline` placeholder used by
  `GridVideoTile`.
- **Progress ring:** an SVG arc (`react-native-svg` is already a dependency)
  around the thumbnail, driven by `job.progress`. Indeterminate (rotating arc)
  while `status === "publishing"` or `pendingResume` is set.
- **Stage text:** `pillLabel(job)` from `upload-job.ts` (table in *UI*).
- **Tap** toggles expanded.

Expanded adds a second row: caption (one line, ellipsised), the stage detail
(e.g. "Uploading to IPFS"), and on failure the error message plus two buttons,
**Retry** (`primary`) and **Discard** (`danger` text). Expanded collapses again
on the next transition to `published`.

Published: label *Published* with a check icon, ring full. Tapping the pill
opens the post via `router.push({ pathname: "/conversation", params: { author,
permlink } })` (the same route the spot screen uses,
`app/spot/[author]/[permlink].tsx` 154-159) and clears the job. Otherwise the
provider clears it after 4s.

### 5. Create screen changes (`app/(tabs)/create.tsx`)

`handlePost` becomes:

1. Validate exactly as today (content or media; `canPost(session)`).
2. If `useUploadJob()` reports an active or failed job, the button is already
   disabled, so this is unreachable; the button's label reads *Share* and a
   hint under it reads "Wait for the current upload to finish" (active) or
   "Retry or discard the failed upload first" (failed).
3. Resolve the Instagram decision: `crossPostToInstagram = igCrossPost &&
   await isCrossPostEnabled() && eligibleForCrosspost(session) && hasMedia &&
   (await getHivePower(username)) >= MIN_HP_TO_CROSSPOST`. If true and no handle
   is stored and the user was never prompted, show the handle modal now (the
   existing `promptForIgHandle`, 96-111). The parent-author check
   (`SNAPS_CONTAINER_AUTHOR`) moves into the runner, where the parent is known.
4. `await enqueue({ caption, mediaUri, mime, mediaKind, coverUri, igCaption,
   crossPostToInstagram }, session)`. On `UploadBusyError` or a copy failure,
   show the message in `errorCard` and stop.
5. Clear the form (as 555-561), `router.push("/(tabs)/feed")`.

Removed from the screen: `isUploading`, `uploadProgress`, `videoProgress`,
`videoStage` state and the progress card (607-617); the `maybeCrossPostToInstagram`
helper (its checks move to step 3 and the runner); the `queryClient`
invalidation (moves to the provider). `errorMessage`, the media preview, the
cover picker and the caption block stay.

## Data model

```ts
export type UploadStatus =
  | "uploading"    // media bytes leaving the device (server stage "receiving")
  | "transcoding"  // server stages "transcoding" | "optimized" | "uploading" (to IPFS)
  | "publishing"   // parent lookup, double-post guard, broadcast
  | "published"
  | "failed";

export type MediaKind = "image" | "video" | null;

export interface UploadJob {
  id: string;                 // `${Date.now().toString(36)}-${random}` as video-upload.ts 129
  author: string;             // session.username at enqueue; never the key or token
  permlink: string;           // makePermlink() at enqueue: `sh-` + 15 chars of ISO timestamp
  status: UploadStatus;
  progress: number;           // 0-100, monotonic within an attempt
  stage: string;              // last server stage or runner stage: "receiving" | "transcoding" | "optimized" | "uploading" | "complete" | "cover" | "parent" | "guard" | "broadcast"
  pendingResume: "launch" | "foreground" | null;   // pill shows "Resuming…" while set
  draft: {
    caption: string;
    mediaKind: MediaKind;
    mediaUri: string | null;  // file:// inside Paths.document/uploads/<id>/
    mime: string | null;
    fileName: string | null;
    coverUri: string | null;  // file:// copy of the picked frame
    igCaption: string;
    crossPostToInstagram: boolean;
    tags: string[];           // [COMMUNITY_TAG] at enqueue; buildTags adds body hashtags at publish
  };
  result: {
    coverUrl?: string;        // images.hive.blog url of the cover
    imageUrl?: string;        // image posts
    cid?: string;             // video posts
    gatewayUrl?: string;
    thumbnailUrl?: string;    // worker-extracted frame
    parentAuthor?: string;
    parentPermlink?: string;
  };
  error: { kind: "network" | "server" | "auth" | "broadcast" | "unknown"; message: string } | null;
  attempts: number;           // runner starts, manual retries included
  autoRetries: number;        // automatic foreground retries since the last manual retry / enqueue
  timestamps: {
    createdAt: number;
    updatedAt: number;
    attemptStartedAt: number | null;
    backgroundedAt: number | null;
    publishedAt: number | null;
  };
}
```

Never persisted: the session, the posting key, the bearer token, the transcoder
`correlationId`. The runner obtains the session from the provider at start time.

Events (`UploadEvent`):

```ts
| { type: "enqueued"; job: UploadJob }
| { type: "started"; at: number }                       // runner begins an attempt
| { type: "progress"; progress: number; stage: string }
| { type: "cover_done"; coverUrl: string }
| { type: "cover_skipped" }
| { type: "media_done"; imageUrl?: string; cid?: string; gatewayUrl?: string; thumbnailUrl?: string }
| { type: "parent_done"; parentAuthor: string; parentPermlink: string }
| { type: "published"; at: number }
| { type: "failed"; error: UploadJob["error"]; appActive: boolean; at: number }   // appActive stamped by the provider's emit wrapper
| { type: "retry"; at: number }                         // user tapped Retry
| { type: "resume"; kind: "launch" | "foreground"; at: number }
| { type: "backgrounded"; at: number }
| { type: "cleared" }                                   // published job dismissed, or discard
```

## State machine

`reduce(job, event)` is pure and total: an event that does not apply to the
current status returns the job unchanged (and is logged in `__DEV__`).

| From | Event | To | Notes |
|------|-------|----|-------|
| `null` | `enqueued` | `uploading` when the draft has media (`progress 0`, `stage "receiving"`), else `publishing` (`progress 100`, `stage "parent"`) | `attempts 0`, `autoRetries 0` |
| `uploading` / `transcoding` / `publishing` | `started` | same | `attempts + 1`, `attemptStartedAt = at`, `error = null`. `pendingResume` is kept so the pill keeps reading *Resuming…* until the first leg event below |
| any active | `progress` | by stage: `receiving` → `uploading`; `transcoding`, `optimized`, `uploading` → `transcoding`; `complete` → `publishing` | `progress = max(progress, current)`; `stage` stored verbatim; `pendingResume = null` |
| any active | `cover_done` | same | `result.coverUrl`, `pendingResume = null` |
| any active | `cover_skipped` | same | no-op on result, `pendingResume = null` |
| `uploading` / `transcoding` | `media_done` | `publishing` | merges into `result`, `progress 100`, `stage "parent"`, `pendingResume = null` |
| `publishing` | `parent_done` | `publishing` | `result.parentAuthor/Permlink`, `stage "guard"`, `pendingResume = null` |
| `publishing` | `published` | `published` | `publishedAt = at`, `progress 100`, `error = null` |
| any active | `failed` | `failed`, **or** stays active with `pendingResume = "foreground"` when `error.kind === "network"` and `backgroundedAt > attemptStartedAt` and `autoRetries === 0` and `appActive` | in the second case `autoRetries + 1`; the provider starts the runner. If `appActive` is false the job goes to `failed` and the AppState `active` handler applies the same test |
| `failed` | `retry` | `uploading` if no `result.cid`/`imageUrl` and the draft has media, else `publishing` | `error = null`, `autoRetries = 0`, `pendingResume = null`; `result` kept; `progress 0` when going to `uploading`, unchanged otherwise |
| `failed` | `resume { kind: "foreground" }` | same as `retry` | `pendingResume = "foreground"`, `autoRetries + 1`; the provider only dispatches it when the rule above holds |
| any active (on launch) | `resume { kind: "launch" }` | same status | `pendingResume = "launch"`; the runner's leg guards decide what actually re-runs |
| any | `backgrounded` | same | `backgroundedAt = at` |
| `published` / `failed` | `cleared` | `null` | store deletes the job directory and JSON |
| any active | `cleared` | `null` | discard while running; in-flight results are ignored because their `job.id` no longer matches |

"Any active" = `uploading`, `transcoding`, `publishing`.

Invariants checked by the tests:

- `progress` never decreases within an attempt; `retry` and `resume` reset it
  to 0 only when the media leg will re-run.
- `result` is never cleared by `failed`, `retry` or `resume`.
- At most one `pendingResume = "foreground"` per manual attempt cycle.
- `published` is terminal except for `cleared`.

## UI

Pill label by state (`pillLabel(job)`):

| Status / flags | Collapsed label | Expanded detail |
|----------------|-----------------|-----------------|
| `pendingResume` set | Resuming… | "Picking up where it left off" |
| `uploading` | Uploading… `N%` | "Sending to server" |
| `transcoding`, stage `transcoding` | Transcoding… `N%` | "Transcoding video" |
| `transcoding`, stage `optimized` | Transcoding… `N%` | "Video already optimized" |
| `transcoding`, stage `uploading` | Pinning… `N%` | "Uploading to IPFS" |
| `publishing` | Publishing… | "Posting to Hive" |
| `published` | Published | "Tap to open" |
| `failed` | Upload failed | `error.message`, Retry, Discard |

`N%` is `job.progress`. Text-only posts show only *Publishing…* then
*Published*.

Create screen: Share button `disabled` while `isJobActive(job) || job?.status
=== "failed"`, with the hint text below it in `theme.colors.muted`.

Feed: no change in this phase. The post appears after the provider invalidates
the feed queries.

## Error handling

- **Network loss mid-upload** (no backgrounding): `uploadVideoToWorker` tries
  the next service, then throws "All video upload services failed" → `failed`
  kind `network`. `backgroundedAt` is older than `attemptStartedAt`, so no
  auto-retry; the pill shows *Retry*. Retry re-uploads from zero.
- **iOS suspends the request in the background** (~30s after backgrounding):
  the POST rejects with a network error. If the app is still in the background
  the job goes to `failed`; on `active` the provider sees `network` +
  `backgroundedAt > attemptStartedAt` + `autoRetries === 0` and restarts the
  media leg once with the pill showing *Resuming…*. A second failure shows
  *Retry*. **Known phase-1 limitation:** there is no resumable upload, so the
  clip restarts from zero on return; a clip that takes longer than the
  foreground window can only finish if the user keeps the app open.
- **App killed mid-upload:** on launch the provider finds an active job,
  dispatches `resume { kind: "launch" }` and runs it. A job killed during
  `uploading`/`transcoding` re-uploads (the transcoder keeps no job state);
  one killed during `publishing` after `media_done` skips straight to the
  double-post guard and the broadcast.
- **Broadcast timed out after inclusion:** the next attempt's
  `getContent(author, permlink)` returns the post → `published` without a
  second broadcast. This is why the permlink is fixed at enqueue.
- **Broadcast rejected** (RC, invalid parent, node error): `failed` kind
  `broadcast`, message from the node. Retry re-runs the parent lookup and the
  guard, never the upload.
- **Cover upload fails:** logged, `cover_skipped`, the worker's frame is used.
  Never fails the job.
- **Session mismatch on resume** (logged out, or another account active):
  `failed` kind `auth` with the author's name in the message; Retry after
  logging in as that account.
- **Media file missing on resume** (should not happen in the document dir;
  covered anyway): `failed` kind `unknown`, message "The video is no longer on
  this device"; only Discard makes sense, Retry fails the same way.
- **Persisted JSON unreadable:** deleted, no job, no pill.
- **Instagram cross-post fails:** logged only, as today (create.tsx 158-171).
- **Discard while running:** the fetch keeps running until it settles; its
  result is dropped. Keep-awake is released by `uploadVideoToWorker`'s
  `finally`.

## Testing

### Unit tests (`pnpm test`)

Add `tsx` as a devDependency and a script, the way skatehive3.0 does
(`skatehive3.0/package.json` `"test": "tsx …/__tests__/x.test.ts && …"`):

```json
"test": "tsx lib/upload/__tests__/upload-job.test.ts && tsx lib/upload/__tests__/upload-runner.test.ts && tsx lib/upload/__tests__/post-assembly.test.ts"
```

Tests use `node:test` and `node:assert/strict`, import only the pure modules
with relative paths, and mock nothing from React Native. Node 24 is installed
locally.

`upload-job.test.ts` walks the transition table row by row, plus:

- progress never decreases; `complete` moves to `publishing`.
- `failed` with the background rule met → status unchanged, `pendingResume
  "foreground"`, `autoRetries 1`; a second such `failed` → `failed`.
- `retry` after `media_done` → `publishing`, `result` intact, `progress 100`.
- `retry` without result → `uploading`, `progress 0`.
- events on the wrong status return the same object reference.

`upload-runner.test.ts` drives `runUploadJob` with fake deps and a recording
`emit`:

- video happy path emits `started, cover_done, progress…, media_done,
  parent_done, published` in order and calls `broadcast` once with the fixed
  permlink and `images: [coverUrl]`.
- image happy path uses `imageUrl` in `images` and the markdown body.
- text-only path calls neither upload dep.
- `getContent` returning a post → `published` and `broadcast` not called.
- `getContent` throwing → `failed` kind `network` and `broadcast` not called.
- job with `result.cid` → `uploadVideo` not called.
- cover failure → `cover_skipped`, run continues.
- `uploadVideo` throwing `TypeError("Network request failed")` → `failed` kind
  `network`; an HTTP error string → `server`; `broadcast` throwing →
  `broadcast`.
- `getParent` throwing → broadcast to `deps.communityTag` with empty parent
  author.
- `crossPost` rejecting does not change the emitted sequence.

`post-assembly.test.ts`: `makePermlink` format `sh-` + 15 lowercase
alphanumerics; `buildTags` dedupes and keeps `COMMUNITY_TAG` first; `buildBody`
matches the current concatenation for empty and non-empty captions.

`pnpm exec tsc --noEmit` must stay clean.

### Simulator verification (iPhone 17 Pro, dev client)

1. **Happy path:** pick a 20–60s clip, Share. The feed appears immediately;
   the pill shows the thumbnail and moves through Uploading → Transcoding →
   Pinning → Publishing → Published, hides after 4s, the post is in the feed.
2. **Navigation:** during the upload open Profile, Videos and a post viewer.
   Upload continues; the pill is visible on tab screens.
3. **Tap Published:** the conversation screen for the new post opens.
4. **Kill mid-upload:** start an upload, at ~40% swipe-kill the app from the
   app switcher (or `xcrun simctl terminate <udid> com.bgrana.skatehive`).
   Relaunch: the pill shows *Resuming…* then the normal stages; exactly one
   post appears on chain (`getContent` in the guard, check the profile grid).
5. **Kill during publishing:** repeat with the kill right after progress hits
   100%. On relaunch the pill goes straight to Publishing and the post is
   published once.
6. **Background retry:** start an upload, press Home, wait 45s, return. The
   pill shows *Resuming…* and restarts; then background it again for 45s and
   return: the pill shows *Upload failed* with Retry and Discard.
7. **Retry / Discard:** Retry from the failed state completes the post.
   Discard from a fresh failure removes the pill and the
   `Documents/uploads/<id>` directory (check with the simulator's app
   container: `xcrun simctl get_app_container <udid> com.bgrana.skatehive data`).
8. **Busy hint:** with an upload running, open Create: Share is disabled and
   the hint is shown; after Published it is enabled again.
9. **Text-only and image posts:** both publish through the pill.
10. **Session gate:** start an upload, kill, log out, relaunch: the pill shows
    the auth failure naming the account; log back in, Retry completes.
11. `pnpm logs:ios` shows no `NativeSharedObjectNotFound` or unhandled promise
    warnings during 1–7.

## Out of scope

- **Transcoder job id / server-side job state** (phase 2): would let the client
  poll after a kill instead of re-uploading.
- **iOS background upload session** (phase 3): `expo-file-system`
  `createUploadTask` with a background `NSURLSession`, or a native module, so
  the bytes keep flowing after ~30s in the background.
- **On-device compression** before upload.
- **Multiple concurrent or queued uploads.**
- **Push notifications** when a post publishes while the app is closed.
- Pill on non-tab stack screens.
- Any change to the feed, the transcoder, `api.skatehive.app`, or the userbase
  endpoints.

## Open questions

None. Every decision needed for the implementation plan is recorded above.

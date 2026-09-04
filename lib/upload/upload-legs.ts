// The real RunnerDeps. Everything Expo- or network-bound the runner needs
// lives here so upload-runner.ts stays testable under Node.
import { File } from "expo-file-system";
import type { AuthSession } from "~/lib/types";
import { isUserbaseSession, postComment } from "~/lib/posting";
import { COMMUNITY_TAG, HiveClient, SNAPS_CONTAINER_AUTHOR, getLastSnapsContainer } from "~/lib/hive-utils";
import { crossPostToInstagram } from "~/lib/instagram";
import { WEB_BASE_URL } from "~/lib/constants";
import { uploadImageToHive, uploadImageViaUserbase } from "./image-upload";
import { isHiveNotFoundError } from "./hive-errors";
import { uploadVideoToWorker } from "./video-upload";
import { UploadRunError, type RunnerDeps } from "./upload-runner";

// Mirrors DEFAULT_HIVE_POSTING_ACCOUNT in the skatehive-api comment route: the
// server signs and broadcasts email/lite (userbase) posts under this shared
// Hive account, so the double-post guard must also check there.
const SHARED_POSTING_ACCOUNT = "skateuser";

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
    // retry double-post. Here an RPC error throws and the runner fails closed
    // — with one narrow exception (see below).
    async getContent(author, permlink) {
      try {
        const content = (await HiveClient.database.call("get_content", [author, permlink])) as {
          author?: unknown;
        } | null;
        return content && typeof content.author === "string" && content.author.length > 0
          ? { author: content.author }
          : null;
      } catch (err) {
        // Current Hive nodes (api.hive.blog, deathwing, openhive) answer
        // get_content for a non-existent author/permlink with a JSON-RPC
        // error (assert_exception, "Post <author>/<permlink> does not
        // exist") instead of the old empty-object response. Every new post
        // is, by definition, non-existent before its first broadcast, so
        // without this the double-post guard would fail closed on every
        // single upload. isHiveNotFoundError matches only that exact assert
        // — any other rejection (network failure, a different assert,
        // malformed payload) is rethrown unchanged and still fails closed.
        if (isHiveNotFoundError(err)) {
          return null;
        }
        throw err;
      }
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
    sharedPostingAuthor: isUserbaseSession(session) && !session.decryptedKey ? SHARED_POSTING_ACCOUNT : null,
    now: () => Date.now(),
  };
}

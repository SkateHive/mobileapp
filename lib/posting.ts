import type { AuthSession } from "./types";
import { t } from "./i18n";
import {
  vote as hiveVote,
  comment as hiveComment,
  setUserRelationship as hiveSetRelationship,
  updateProfile as hiveUpdateProfile,
  submitEncryptedReport as hiveSubmitReport,
  buildEncryptedReportPayload,
} from "./hive-utils";
import {
  vote as ubVote,
  comment as ubComment,
  follow as ubFollow,
  accountUpdate as ubAccountUpdate,
  report as ubReport,
} from "./userbase/api";

// Unified posting seam. Server-custody email (userbase) accounts route to the
// api.skatehive.app endpoints (server signs); classic Hive-key accounts sign
// locally with the decrypted posting key as before.

export function isUserbaseSession(session: AuthSession | null | undefined): boolean {
  return !!session && session.kind === "userbase" && !!session.userbaseToken;
}

/** True if the session can post at all (has a local key OR is a userbase session). */
export function canPost(session: AuthSession | null | undefined): boolean {
  if (!session || session.username === "SPECTATOR") return false;
  return isUserbaseSession(session) || !!session.decryptedKey;
}

export async function castVote(
  session: AuthSession,
  author: string,
  permlink: string,
  weight: number
): Promise<void> {
  if (isUserbaseSession(session)) {
    const r = await ubVote(session.userbaseToken!, { author, permlink, weight });
    if (!r.success) throw new Error(r.error || t("posting.error.vote_failed"));
    return;
  }
  await hiveVote(session.decryptedKey, session.username, author, permlink, weight);
}

export interface PostCommentArgs {
  parentAuthor: string;
  parentPermlink: string;
  body: string;
  permlink?: string;
  title?: string;
  jsonMetadata?: Record<string, unknown>;
}

export async function postComment(
  session: AuthSession,
  args: PostCommentArgs
): Promise<{ author: string; permlink: string }> {
  if (isUserbaseSession(session)) {
    const r = await ubComment(session.userbaseToken!, {
      parent_author: args.parentAuthor,
      parent_permlink: args.parentPermlink,
      body: args.body,
      permlink: args.permlink,
      title: args.title,
      json_metadata: args.jsonMetadata,
    });
    if (!r.success) throw new Error(r.error || t("posting.error.comment_failed"));
    return { author: r.author || session.username, permlink: r.permlink || args.permlink || "" };
  }
  const permlink = args.permlink || `re-${Date.now().toString(36)}`;
  await hiveComment(
    session.decryptedKey,
    args.parentAuthor,
    args.parentPermlink,
    session.username,
    permlink,
    args.title || "",
    args.body,
    args.jsonMetadata || {}
  );
  return { author: session.username, permlink };
}

// Account-scoped actions (follow/mute, profile, report). For userbase accounts
// these route to the server, which signs with the user's own key and rejects
// shared @skateuser (lite) accounts with a clear "requires your own Hive
// account" message. Each throws on failure so callers can surface the message.

export async function setRelationship(
  session: AuthSession,
  following: string,
  type: "blog" | "ignore" | "blacklist" | ""
): Promise<void> {
  if (isUserbaseSession(session)) {
    const r = await ubFollow(session.userbaseToken!, { following, type });
    if (!r.success) throw new Error(r.error || t("posting.error.action_failed"));
    return;
  }
  const ok = await hiveSetRelationship(
    session.decryptedKey,
    session.username,
    following,
    type
  );
  if (!ok) throw new Error(t("posting.error.action_failed"));
}

export async function updateProfile(
  session: AuthSession,
  profile: Record<string, unknown>
): Promise<void> {
  if (isUserbaseSession(session)) {
    const r = await ubAccountUpdate(session.userbaseToken!, { profile });
    if (!r.success) throw new Error(r.error || t("posting.error.profile_failed"));
    return;
  }
  await hiveUpdateProfile(session.decryptedKey, session.username, profile);
}

export async function submitReport(
  session: AuthSession,
  args: {
    reportedAuthor: string;
    reportedPermlink: string;
    reason: string;
    additionalInfo?: string;
  }
): Promise<void> {
  if (isUserbaseSession(session)) {
    const payload = buildEncryptedReportPayload(
      session.username,
      args.reportedAuthor,
      args.reportedPermlink,
      args.reason,
      args.additionalInfo
    );
    const r = await ubReport(session.userbaseToken!, { payload });
    if (!r.success) throw new Error(r.error || t("posting.error.report_failed"));
    return;
  }
  await hiveSubmitReport(
    session.decryptedKey,
    session.username,
    args.reportedAuthor,
    args.reportedPermlink,
    args.reason,
    args.additionalInfo
  );
}

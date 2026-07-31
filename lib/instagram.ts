import { sha256 } from "js-sha256";
import { PrivateKey } from "@hiveio/dhive";
import { Buffer } from "buffer";
import { API_ORIGIN } from "./constants";
import { HiveClient, convertVestToHive } from "./hive-utils";
import { isUserbaseSession } from "./posting";
import type { AuthSession } from "./types";

// Client for the skatehive-api Instagram cross-post + IG-handle endpoints.
// Auth depends on the account kind:
//   - classic Hive-key account → per-request posting-key SIGNATURE
//   - email (userbase) account  → Bearer token (server resolves the linked Hive
//     identity + HP-gates). Only userbase accounts with an ELIGIBLE attached
//     Hive account (>=100 HP) can actually post — enforced by the HP check
//     below + the server. Never log keys here.

export const MIN_HP_TO_CROSSPOST = 100;

/**
 * Account TYPE can attempt a cross-post: a classic key account (can sign) OR a
 * userbase account (can present a Bearer token). This does NOT mean they're
 * eligible yet — use hasEligibleHiveAccount() for the real >=100 HP gate.
 */
export function eligibleForCrosspost(session: AuthSession | null | undefined): boolean {
  if (!session || session.username === "SPECTATOR") return false;
  return !!session.decryptedKey || isUserbaseSession(session);
}

/**
 * True only when the account has an eligible (>=100 HP) Hive account it can post
 * as — i.e. a key account with HP, or a userbase account whose attached Hive
 * account has HP. (For lite userbase accounts whose handle isn't a real on-chain
 * account, getHivePower returns 0, so they're correctly excluded.)
 */
export async function hasEligibleHiveAccount(session: AuthSession | null | undefined): Promise<boolean> {
  if (!eligibleForCrosspost(session)) return false;
  return (await getHivePower(session!.username)) >= MIN_HP_TO_CROSSPOST;
}

// Sign sha256(message) with the posting key — matches the server's
// cryptoUtils.sha256(Buffer.from(message)) + PublicKey.verify(digest, sig).
function signMessage(message: string, wif: string): { signature: string; publicKey: string } {
  const key = PrivateKey.fromString(wif);
  const digest = Buffer.from(sha256(message), "hex");
  return { signature: key.sign(digest).toString(), publicKey: key.createPublic().toString() };
}

function buildIgAuthMessage(hiveAuthor: string, hivePermlink: string, issuedAt: string): string {
  return [
    "Skatehive: cross-post snap to @skatehive on Instagram.",
    `Author: @${hiveAuthor}`,
    `Permlink: ${hivePermlink}`,
    `Issued at: ${issuedAt}`,
  ].join("\n");
}

function buildIgHandleAuthMessage(hiveAuthor: string, issuedAt: string): string {
  return [
    "Skatehive: manage Instagram handle for @skatehive cross-posting.",
    `Author: @${hiveAuthor}`,
    `Issued at: ${issuedAt}`,
  ].join("\n");
}

/**
 * Auth material for the IG-handle endpoints. Userbase → Bearer header (server
 * resolves the user); key account → signature fields over the handle message.
 */
function handleAuth(session: AuthSession): { headers: Record<string, string>; sig: Record<string, string> } {
  if (isUserbaseSession(session)) {
    return { headers: { Authorization: `Bearer ${session.userbaseToken}` }, sig: {} };
  }
  const issuedAt = new Date().toISOString();
  const { signature, publicKey } = signMessage(buildIgHandleAuthMessage(session.username, issuedAt), session.decryptedKey);
  return {
    headers: {},
    sig: { hive_author: session.username, hive_public_key: publicKey, hive_signature: signature, signed_at: issuedAt },
  };
}

export interface CrossPostArgs {
  permlink: string;
  body: string;
  /** Author-edited Instagram caption. When absent the server builds one from the body. */
  caption?: string;
  tags?: string[];
  imageUrl?: string;
  videoUrl?: string;
  permalinkUrl: string;
}

/** Cross-post an already-broadcast snap to @skatehive on Instagram. Throws on failure. */
export async function crossPostToInstagram(
  session: AuthSession,
  args: CrossPostArgs
): Promise<{ ig_permalink?: string; deduped?: boolean }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const payload: Record<string, unknown> = {
    hive_author: session.username,
    hive_permlink: args.permlink,
    body: args.body,
    ...(args.caption ? { caption: args.caption } : {}),
    tags: args.tags ?? [],
    image_url: args.imageUrl,
    video_url: args.videoUrl,
    permalink_url: args.permalinkUrl,
  };
  if (isUserbaseSession(session)) {
    headers.Authorization = `Bearer ${session.userbaseToken}`;
  } else {
    const issuedAt = new Date().toISOString();
    const { signature, publicKey } = signMessage(
      buildIgAuthMessage(session.username, args.permlink, issuedAt),
      session.decryptedKey
    );
    payload.hive_signature = signature;
    payload.hive_public_key = publicKey;
    payload.signed_at = issuedAt;
  }
  const res = await fetch(`${API_ORIGIN}/api/instagram/post`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; ig_permalink?: string; deduped?: boolean };
  if (!res.ok) throw new Error(data?.error || `Cross-post failed (${res.status})`);
  return data;
}

export interface IgHandleResult {
  handle: string | null;
  source: "db" | "hive" | null;
}

/** Read the user's stored IG handle. `source === null` means none set (prompt). */
export async function getIgHandle(session: AuthSession): Promise<IgHandleResult> {
  const { headers, sig } = handleAuth(session);
  const q = new URLSearchParams(sig).toString();
  const url = `${API_ORIGIN}/api/userbase/profile/instagram${q ? `?${q}` : ""}`;
  const res = await fetch(url, { headers });
  if (!res.ok) return { handle: null, source: null };
  return (await res.json().catch(() => ({ handle: null, source: null }))) as IgHandleResult;
}

/** Store/replace the user's IG handle. Throws on failure (e.g. handle taken). */
export async function setIgHandle(handle: string, session: AuthSession): Promise<void> {
  const { headers, sig } = handleAuth(session);
  const res = await fetch(`${API_ORIGIN}/api/userbase/profile/instagram`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ handle, ...sig }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data?.error || `Could not save Instagram handle (${res.status})`);
  }
}

export async function deleteIgHandle(session: AuthSession): Promise<void> {
  const { headers, sig } = handleAuth(session);
  await fetch(`${API_ORIGIN}/api/userbase/profile/instagram`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(sig),
  });
}

/** Hive Power for an account (own vests converted to HP). Returns 0 on failure. */
export async function getHivePower(username: string): Promise<number> {
  try {
    const [account] = await HiveClient.database.getAccounts([username]);
    if (!account) return 0;
    const vests = parseFloat(account.vesting_shares.toString().split(" ")[0]);
    return await convertVestToHive(vests);
  } catch {
    return 0;
  }
}

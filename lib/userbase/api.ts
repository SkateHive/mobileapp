// Client for the mobile email-OTP auth endpoints on api.skatehive.app.
// Server-custody: we only ever hold an opaque bearer session token; the server
// signs Hive actions. No posting key on the device.

const BASE = "https://api.skatehive.app/api/userbase";

export interface UserbaseUser {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  status?: string;
  onboarding_step?: number;
}

async function postJson<T>(path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok && !(data as any)?.error) {
    throw new Error(`Request failed (${res.status})`);
  }
  return data as T;
}

export interface RequestOtpResult { success: boolean; error?: string }
export function requestOtp(email: string): Promise<RequestOtpResult> {
  return postJson("/auth/otp/request", { email });
}

export interface VerifyOtpResult {
  success: boolean;
  token?: string;
  user?: UserbaseUser;
  signupRequired?: boolean;
  signupToken?: string;
  error?: string;
}
export function verifyOtp(email: string, code: string): Promise<VerifyOtpResult> {
  return postJson("/auth/otp/verify", { email, code });
}

export interface CompleteSignupResult {
  success: boolean;
  token?: string;
  user?: UserbaseUser;
  error?: string;
  code?: string;
}
export function completeSignup(
  signupToken: string,
  handle: string,
  displayName?: string
): Promise<CompleteSignupResult> {
  return postJson("/auth/signup/complete", {
    signupToken,
    handle,
    display_name: displayName,
  });
}

/** Claim an existing Hive account with its posting key during email signup. */
export function claimAccount(
  signupToken: string,
  handle: string,
  postingKey: string
): Promise<CompleteSignupResult> {
  return postJson("/auth/signup/claim", {
    signupToken,
    handle,
    postingKey,
  });
}

export interface CheckUsernameResult { valid: boolean; available: boolean; reason?: string }
export async function checkUsername(name: string): Promise<CheckUsernameResult> {
  const res = await fetch(`${BASE}/hive/check-username?name=${encodeURIComponent(name)}`);
  return (await res.json()) as CheckUsernameResult;
}

export interface SessionResult { success: boolean; user?: UserbaseUser; error?: string }
export async function getSession(token: string): Promise<SessionResult> {
  const res = await fetch(`${BASE}/auth/session`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return (await res.json().catch(() => ({ success: false }))) as SessionResult;
}

export function logout(token: string): Promise<{ success: boolean }> {
  return postJson("/auth/logout", {}, token);
}

export interface SoftPostOverlay {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
}
export interface SoftPostResult {
  author: string;
  permlink: string;
  user: SoftPostOverlay | null;
}
/** Batch-map on-chain @skateuser posts to their real authors (feed masking). */
export async function fetchSoftPosts(
  posts: { author: string; permlink: string }[]
): Promise<SoftPostResult[]> {
  const r = await postJson<{ success: boolean; results?: SoftPostResult[] }>(
    "/soft-posts",
    { posts }
  );
  return r.results || [];
}

export interface VoteArgs { author: string; permlink: string; weight: number }
export function vote(token: string, args: VoteArgs): Promise<{ success: boolean; error?: string }> {
  return postJson("/hive/vote", args, token);
}

export interface CommentArgs {
  parent_author: string;
  parent_permlink: string;
  body: string;
  permlink?: string;
  title?: string;
  json_metadata?: Record<string, unknown>;
}
export function comment(
  token: string,
  args: CommentArgs
): Promise<{ success: boolean; author?: string; permlink?: string; error?: string }> {
  return postJson("/hive/comment", args, token);
}

// Account-scoped actions below. The server signs with the user's OWN stored key
// and rejects lite accounts on the shared @skateuser key with HTTP 403 +
// code "REQUIRES_OWN_HIVE_ACCOUNT" — you can't follow/edit/report on an account
// you don't own.

export interface FollowArgs {
  following: string;
  type?: "blog" | "ignore" | "blacklist" | "";
}
export function follow(
  token: string,
  args: FollowArgs
): Promise<{ success: boolean; error?: string; code?: string }> {
  return postJson("/hive/follow", args, token);
}

export interface AccountUpdateArgs {
  profile: Record<string, unknown>;
}
export function accountUpdate(
  token: string,
  args: AccountUpdateArgs
): Promise<{ success: boolean; author?: string; error?: string; code?: string }> {
  return postJson("/hive/account-update", args, token);
}

export interface ReportArgs {
  payload: unknown;
}
export function report(
  token: string,
  args: ReportArgs
): Promise<{ success: boolean; error?: string; code?: string }> {
  return postJson("/hive/report", args, token);
}

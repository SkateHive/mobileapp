import * as SecureStore from "expo-secure-store";
import type { UserbaseUser } from "./api";

// Persists the userbase bearer session on-device. This is the ONLY auth secret
// the device holds for email accounts — no Hive posting key (server-custody).

const TOKEN_KEY = "userbase_session_token";
const USER_KEY = "userbase_session_user";

export interface UserbaseSession {
  token: string;
  user: UserbaseUser;
}

export async function saveUserbaseSession(token: string, user: UserbaseUser): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function loadUserbaseSession(): Promise<UserbaseSession | null> {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    const userRaw = await SecureStore.getItemAsync(USER_KEY);
    if (!token || !userRaw) return null;
    return { token, user: JSON.parse(userRaw) as UserbaseUser };
  } catch {
    return null;
  }
}

export async function clearUserbaseSession(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}

// ─── Who was here last ───────────────────────────────────────────────────────
// Survives logout on purpose, and holds no credential: just enough to greet a
// returning email user by name instead of an empty field. A Hive account gets
// this for free — its encrypted key stays in the stored-users list — and email
// accounts had nothing, so signing out erased them from the login screen (#60).

const LAST_ACCOUNT_KEY = "userbase_last_account";
const LAST_KIND_KEY = "last_account_kind";

/**
 * Which kind of account signed in last, so the login screen greets the one you
 * actually used. Hive accounts and email accounts are remembered in different
 * places, and without this the Hive one always won — logging out of a new email
 * account showed a Hive account from days ago.
 */
export type LastAccountKind = "hive" | "email";

export async function saveLastAccountKind(kind: LastAccountKind): Promise<void> {
  try {
    await SecureStore.setItemAsync(LAST_KIND_KEY, kind);
  } catch {}
}

export async function loadLastAccountKind(): Promise<LastAccountKind | null> {
  try {
    const raw = await SecureStore.getItemAsync(LAST_KIND_KEY);
    return raw === "hive" || raw === "email" ? raw : null;
  } catch {
    return null;
  }
}

export interface LastEmailAccount {
  handle: string;
  email: string;
}

export async function saveLastEmailAccount(account: LastEmailAccount): Promise<void> {
  try {
    await SecureStore.setItemAsync(LAST_ACCOUNT_KEY, JSON.stringify(account));
  } catch {
    // Not being able to remember is not worth failing a login over.
  }
}

export async function loadLastEmailAccount(): Promise<LastEmailAccount | null> {
  try {
    const raw = await SecureStore.getItemAsync(LAST_ACCOUNT_KEY);
    return raw ? (JSON.parse(raw) as LastEmailAccount) : null;
  } catch {
    return null;
  }
}

export async function clearLastEmailAccount(): Promise<void> {
  await SecureStore.deleteItemAsync(LAST_ACCOUNT_KEY);
}

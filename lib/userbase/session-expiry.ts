// A userbase (email) session can end on the server: it expires after 30 idle
// days or is revoked from another device. The app keeps its bearer token, so
// the first sign it's dead is a 401 from api.skatehive.app. Every client call
// reports that here; the AuthProvider listens, signs the account out and asks
// for a new email code, instead of each screen showing the raw "Unauthorized".

import { enT, type TFunction } from "~/lib/i18n/core";

// The device-language `t` lives behind react-native; the AuthProvider hands it
// over at startup so this module stays loadable in plain Node tests.
let translate: TFunction = enT;
export function setSessionExpiryTranslator(t: TFunction): void {
  translate = t;
}

/** Thrown in place of the server's raw 401 body. */
export class SessionExpiredError extends Error {
  constructor() {
    super(translate("auth.session_expired.error"));
    this.name = "SessionExpiredError";
  }
}

type Listener = () => void;
const listeners = new Set<Listener>();

/** Subscribe to session expiry; returns the unsubscribe function. */
export function onSessionExpired(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Tell every listener the stored session is no longer accepted. */
export function reportSessionExpired(): void {
  listeners.forEach((listener) => listener());
}

/**
 * Check a response from an authenticated call. A 401 means the session token
 * is dead: report it and throw a readable error. Anything else passes through.
 */
export function assertSessionAccepted(res: { status: number }): void {
  if (res.status === 401) {
    reportSessionExpired();
    throw new SessionExpiredError();
  }
}

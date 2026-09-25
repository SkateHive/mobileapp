import { t } from "~/lib/i18n";
import { AuthError, type AuthErrorCode } from "~/lib/auth-provider";
import {
  AccountNotFoundError,
  HiveError,
  InvalidKeyError,
  InvalidKeyFormatError,
} from "~/lib/hive-utils";

// What the skater reads for each AuthError code. The technical detail those errors
// carry (key derivation, storage, encryption) stays in the log message and is never
// shown: anything that failed underneath reads as a plain "could not sign in".
const AUTH_KEYS: Record<Exclude<AuthErrorCode, "biometric_failed">, string> = {
  login_first: "auth.provider.err_login_first",
  credentials_required: "auth.provider.err_required",
  pin_length: "auth.provider.err_pin_6",
  biometric_cancelled: "auth.provider.err_bio_cancelled",
  no_stored_credentials: "auth.provider.err_no_stored",
  incompatible: "auth.provider.err_incompatible",
  unsupported_method: "auth.common.sign_in_failed",
  decrypt_failed: "auth.common.sign_in_failed",
  auth_failed: "auth.common.sign_in_failed",
  stored_login_failed: "auth.common.sign_in_failed",
};

const VALIDATE_PREFIX = "Error validating posting key: ";

/**
 * The line shown under a sign-in or claim form for an error thrown by the login and
 * key-check code. `ctx.username` fills "Account '@x' not found" for the key checks.
 */
export function authErrorText(error: unknown, ctx: { username?: string } = {}): string {
  if (error instanceof AuthError) {
    // Cancelling the stored-account biometric prompt is wrapped once more on the way out.
    if (error.code === "biometric_failed") {
      return t("auth.provider.err_bio_failed", { reason: t("auth.provider.err_bio_cancelled") });
    }
    return t(AUTH_KEYS[error.code]);
  }
  // The specific key errors first: they extend HiveError.
  if (error instanceof InvalidKeyFormatError) return t("auth.key.invalid_format");
  if (error instanceof AccountNotFoundError) {
    const quoted = /'([^']+)'/.exec(error.message)?.[1];
    return t("auth.key.account_not_found", { username: ctx.username ?? quoted ?? "" });
  }
  if (error instanceof InvalidKeyError) return t("auth.key.invalid_for_user");
  if (error instanceof HiveError) {
    const m = error.message;
    return m.startsWith(VALIDATE_PREFIX) ? t("auth.key.validate_error", { message: m.slice(VALIDATE_PREFIX.length) }) : m;
  }
  return t("auth.common.sign_in_failed");
}

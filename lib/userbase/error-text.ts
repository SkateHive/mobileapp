import { t } from "~/lib/i18n";
import { RequestFailedError, SERVER_ERROR_KEYS, type UsernameReasonCode } from "./api";

/**
 * Text for an error from the userbase endpoints. A typed request failure and the
 * server's known English messages are shown in the app's language; an unknown
 * server message is shown as received, and no message at all falls back to `fallbackKey`.
 */
export function userbaseErrorText(error: unknown, fallbackKey: string): string {
  if (error instanceof RequestFailedError) return t("auth.userbase.err_request_failed", { status: error.status });
  if (error instanceof Error && error.message) {
    const key = SERVER_ERROR_KEYS[error.message];
    return key ? t(key) : error.message;
  }
  return t(fallbackKey);
}

const REASON_KEYS: Record<UsernameReasonCode, string> = {
  hive_taken: "auth.email.reason_hive_taken",
  userbase_taken: "auth.email.reserved",
  server_check_failed: "auth.email.reason_server_check_failed",
  format_length: "auth.email.reason_format_length",
  format_start: "auth.email.reason_format_start",
  format_end: "auth.email.reason_format_end",
  format_chars: "auth.email.reason_format_chars",
  format_adjacent: "auth.email.reason_format_adjacent",
  format_segment: "auth.email.reason_format_segment",
};

/** The red line under the username field for a taken or invalid name. */
export function usernameReasonText(code: UsernameReasonCode | undefined, rawReason: string | undefined): string {
  if (code) return t(REASON_KEYS[code]);
  return rawReason || t("auth.email.reason_not_available");
}

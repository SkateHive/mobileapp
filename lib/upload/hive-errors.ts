// Pure, dependency-free helpers for classifying Hive RPC errors. No RN/Expo/
// dhive imports here so these stay trivially unit-testable under plain node.

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

// dhive's RPCError wraps the JSON-RPC error payload for a rejected call. Its
// `.message` is often a useless string (e.g. " category=hivemind"), so the
// signal we actually want lives on `.jse_info` (sometimes nested under a
// `.data` property instead), which mirrors the JSON-RPC `error.data` object:
//   { name: "assert_exception", code: 10, extension: { assertion_expression }, message }
function extractAssertInfo(err: unknown): Record<string, unknown> | null {
  const errObj = asRecord(err);
  if (!errObj) return null;
  const jseInfo = asRecord(errObj.jse_info) ?? asRecord(errObj.data);
  return jseInfo;
}

// Detects specifically the "post does not exist" assert_exception that Hive
// nodes (api.hive.blog, deathwing, openhive) now return for get_content on a
// non-existent author/permlink, instead of the old empty-object response.
// Anything else — network failures, other assert_exceptions, malformed
// payloads — must NOT match, so the double-post guard keeps failing closed.
export function isHiveNotFoundError(err: unknown): boolean {
  const info = extractAssertInfo(err);
  if (info && info.name === "assert_exception") {
    const extension = asRecord(info.extension);
    const assertionExpression = extension?.assertion_expression;
    if (typeof assertionExpression === "string" && /does not exist/i.test(assertionExpression)) {
      return true;
    }
    if (typeof info.message === "string" && /does not exist/i.test(info.message)) {
      return true;
    }
    return false;
  }

  // Fallback: no recognizable assert_exception payload, but the error's own
  // message still says "does not exist" — accept it rather than fail closed.
  const errObj = asRecord(err);
  const message = errObj?.message;
  if (typeof message === "string" && /does not exist/i.test(message)) {
    return true;
  }

  return false;
}

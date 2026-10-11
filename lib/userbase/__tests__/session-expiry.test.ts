import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SessionExpiredError,
  assertSessionAccepted,
  onSessionExpired,
} from "../session-expiry";
import { checkSession, comment } from "../api";

function withFetch(response: { status: number; body?: unknown } | Error) {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => {
    if (response instanceof Error) throw response;
    return new Response(JSON.stringify(response.body ?? {}), {
      status: response.status,
    });
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

test("a 401 reports the expiry and throws a readable error", () => {
  let reported = 0;
  const stop = onSessionExpired(() => reported++);
  assert.throws(() => assertSessionAccepted({ status: 401 }), SessionExpiredError);
  assert.equal(reported, 1);
  assert.doesNotThrow(() => assertSessionAccepted({ status: 200 }));
  assert.doesNotThrow(() => assertSessionAccepted({ status: 403 }));
  assert.equal(reported, 1);
  stop();
});

test("an authenticated call that gets 401 never surfaces the raw 'Unauthorized'", async () => {
  let reported = 0;
  const stop = onSessionExpired(() => reported++);
  const restore = withFetch({ status: 401, body: { success: false, error: "Unauthorized" } });
  try {
    await assert.rejects(
      comment("dead-token", { parent_author: "a", parent_permlink: "p", body: "b" }),
      (error: Error) => error instanceof SessionExpiredError && !/Unauthorized/.test(error.message),
    );
    assert.equal(reported, 1);
  } finally {
    restore();
    stop();
  }
});

test("checkSession only calls a 401 expired", async () => {
  for (const [response, expected] of [
    [{ status: 200, body: { success: true } }, "valid"],
    [{ status: 401 }, "expired"],
    [{ status: 500 }, "unknown"],
    [new Error("offline"), "unknown"],
  ] as const) {
    const restore = withFetch(response as any);
    try {
      assert.equal(await checkSession("token"), expected);
    } finally {
      restore();
    }
  }
});

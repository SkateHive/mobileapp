import { test } from "node:test";
import assert from "node:assert/strict";
import { isHiveNotFoundError } from "../hive-errors";

test("isHiveNotFoundError: dhive RPCError-shaped 'post does not exist' assert -> true", () => {
  const err = {
    message: " category=hivemind",
    jse_info: {
      name: "assert_exception",
      code: 10,
      extension: { assertion_expression: "Post a/b does not exist" },
      message: "Assert Exception",
    },
  };
  assert.equal(isHiveNotFoundError(err), true);
});

test("isHiveNotFoundError: plain network error -> false", () => {
  assert.equal(isHiveNotFoundError(new Error("Network request failed")), false);
});

test("isHiveNotFoundError: assert_exception with unrelated assertion -> false", () => {
  const err = {
    message: " category=hivemind",
    jse_info: {
      name: "assert_exception",
      extension: { assertion_expression: "Invalid parameters" },
    },
  };
  assert.equal(isHiveNotFoundError(err), false);
});

test("isHiveNotFoundError: null and string inputs -> false", () => {
  assert.equal(isHiveNotFoundError(null), false);
  assert.equal(isHiveNotFoundError("Post a/b does not exist"), false);
});

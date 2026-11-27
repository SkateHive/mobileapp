import { test } from "node:test";
import assert from "node:assert/strict";
import { isReadAt, parseHiveDate } from "../notifications/last-read";

test("parseHiveDate: every Hive shape is read as UTC", () => {
  const ms = Date.UTC(2026, 10, 26, 19, 59, 51);
  assert.equal(parseHiveDate("2026-11-26 19:59:51"), ms); // bridge lastread
  assert.equal(parseHiveDate("2026-11-26T19:59:51"), ms); // notification date
  assert.equal(parseHiveDate("2026-11-26T19:59:51Z"), ms);
  assert.equal(parseHiveDate("2026-11-26T19:59:51.123Z"), ms + 123); // setLastRead payload
  assert.ok(Number.isNaN(parseHiveDate("not a date")));
});

test("isReadAt: at or before lastread is read, after is unread", () => {
  const lastread = "2026-11-26 19:59:51";
  assert.equal(isReadAt("2026-11-26T19:59:50", lastread), true);
  assert.equal(isReadAt("2026-11-26T19:59:51", lastread), true);
  assert.equal(isReadAt("2026-11-26T19:59:52", lastread), false);
  // A space-vs-"T" string compare would get this backwards.
  assert.equal(isReadAt("2026-11-26T08:00:00", lastread), true);
});

test("isReadAt: notification between the bridge lastread and the payload date", () => {
  // Hivemind's lastread can sit a few seconds off the setLastRead payload: for
  // payloads with milliseconds (what this app sends) it stores the time of the
  // block before the op (xvlad: payload 14:33:15.522, op block 14:33:21, bridge
  // 14:33:18). A notification in that block flips from unread to read.
  const between = "2026-06-19T14:33:18";
  assert.equal(isReadAt(between, "2026-06-19 14:33:18"), true);
  assert.equal(isReadAt(between, "2026-06-19T14:33:15.522Z"), false);
});

test("isReadAt: never-read and unparseable dates leave notifications unread", () => {
  assert.equal(isReadAt("2026-11-26T19:59:54", "1970-01-01 00:00:00"), false);
  assert.equal(isReadAt("2026-11-26T19:59:54", ""), false);
});

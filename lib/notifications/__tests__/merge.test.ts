import { test } from "node:test";
import assert from "node:assert/strict";
import { isUnreadNotification, mergeNotifications } from "../merge";
import type { HiveNotification } from "~/lib/types";
import type { UserbaseNotification } from "~/lib/userbase/api";

// Fixtures stand in for what GET /api/userbase/notifications and the Hive
// bridge account_notifications call would return — the merge/sort logic
// itself never fetches, so there is nothing to stub beyond these arrays.
function hiveNotif(overrides: Partial<HiveNotification> = {}): HiveNotification {
  return {
    id: 1,
    type: "vote",
    score: 1,
    date: "2026-09-06T12:00:00", // no timezone suffix, as the bridge sends it
    msg: "@alice voted on your post",
    url: "/@bob/my-post",
    isRead: false,
    ...overrides,
  };
}

function crosspostNotif(overrides: Partial<UserbaseNotification> = {}): UserbaseNotification {
  return {
    id: "cp-1",
    type: "crosspost_queued",
    title: "Sent to Instagram curation",
    body: "A curator will review your snap.",
    link: null,
    metadata: null,
    created_at: "2026-09-06T12:00:00.000Z",
    read_at: null,
    ...overrides,
  };
}

test("mergeNotifications sorts both sources together, newest first", () => {
  const hive = [
    hiveNotif({ id: 1, date: "2026-09-06T10:00:00" }),
    hiveNotif({ id: 2, date: "2026-09-06T14:00:00" }),
  ];
  const crosspost = [
    crosspostNotif({ id: "cp-1", created_at: "2026-09-06T12:00:00.000Z" }),
  ];
  const merged = mergeNotifications(hive, crosspost);
  assert.deepEqual(
    merged.map((m) => m.id),
    ["hive-2", "crosspost-cp-1", "hive-1"],
  );
});

test("mergeNotifications breaks a timestamp tie deterministically by id", () => {
  const hive = [hiveNotif({ id: 2, date: "2026-09-06T12:00:00" })];
  const crosspost = [crosspostNotif({ id: "z", created_at: "2026-09-06T12:00:00.000Z" })];
  const merged = mergeNotifications(hive, crosspost);
  // Same instant from both sources: "crosspost-z" sorts before "hive-2" lexicographically.
  assert.deepEqual(merged.map((m) => m.id), ["crosspost-z", "hive-2"]);
  // Order is stable across repeated calls regardless of input array order.
  const reversed = mergeNotifications(hive, crosspost);
  assert.deepEqual(reversed.map((m) => m.id), merged.map((m) => m.id));
});

test("mergeNotifications handles an empty side", () => {
  assert.deepEqual(mergeNotifications([], []), []);
  assert.equal(mergeNotifications([hiveNotif()], []).length, 1);
  assert.equal(mergeNotifications([], [crosspostNotif()]).length, 1);
});

test("mergeNotifications tags each item with its kind and keeps the original data", () => {
  const [item] = mergeNotifications([], [crosspostNotif({ type: "crosspost_rejected" })]);
  assert.equal(item.kind, "crosspost");
  assert.equal(item.data.type, "crosspost_rejected");
});

test("isUnreadNotification reads isRead for Hive and read_at for crosspost items", () => {
  const [unreadHive] = mergeNotifications([hiveNotif({ isRead: false })], []);
  const [readHive] = mergeNotifications([hiveNotif({ isRead: true })], []);
  const [unreadCrosspost] = mergeNotifications([], [crosspostNotif({ read_at: null })]);
  const [readCrosspost] = mergeNotifications([], [crosspostNotif({ read_at: "2026-09-06T13:00:00.000Z" })]);
  assert.equal(isUnreadNotification(unreadHive), true);
  assert.equal(isUnreadNotification(readHive), false);
  assert.equal(isUnreadNotification(unreadCrosspost), true);
  assert.equal(isUnreadNotification(readCrosspost), false);
});

// Pure merge/sort for the notifications tab: interleaves Hive's on-chain
// notifications with the Instagram curation-queue notifications from
// userbase, newest first. No React/Expo imports, so this runs under plain
// Node in pnpm test.
import type { HiveNotification } from "~/lib/types";
import type { UserbaseNotification } from "~/lib/userbase/api";

export type CrosspostNotificationType =
  | "crosspost_queued"
  | "crosspost_rejected"
  | "crosspost_published"
  | "crosspost_failed";

export type UnifiedNotification =
  | { kind: "hive"; id: string; timestamp: number; data: HiveNotification }
  | { kind: "crosspost"; id: string; timestamp: number; data: UserbaseNotification };

/** Hive bridge dates have no timezone suffix; the API always means UTC. */
function hiveTimestamp(n: HiveNotification): number {
  const t = new Date(`${n.date}Z`).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function crosspostTimestamp(n: UserbaseNotification): number {
  const t = new Date(n.created_at).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function isUnreadNotification(item: UnifiedNotification): boolean {
  return item.kind === "hive" ? !item.data.isRead : item.data.read_at === null;
}

/** Merge both sources by created-at, newest first. Either list may be empty. */
export function mergeNotifications(
  hive: HiveNotification[],
  crosspost: UserbaseNotification[]
): UnifiedNotification[] {
  const hiveItems: UnifiedNotification[] = hive.map((data) => ({
    kind: "hive" as const,
    id: `hive-${data.id}`,
    timestamp: hiveTimestamp(data),
    data,
  }));
  const crosspostItems: UnifiedNotification[] = crosspost.map((data) => ({
    kind: "crosspost" as const,
    id: `crosspost-${data.id}`,
    timestamp: crosspostTimestamp(data),
    data,
  }));
  return [...hiveItems, ...crosspostItems].sort((a, b) => {
    if (a.timestamp !== b.timestamp) return b.timestamp - a.timestamp;
    // Deterministic tie-break: same instant from both sources shouldn't
    // depend on array insertion order surviving the sort.
    return a.id.localeCompare(b.id);
  });
}

// Read/unread marking for Hive notifications. No React/Expo imports, so this
// runs under plain Node in pnpm test.
//
// Hive dates arrive in three shapes, all UTC:
//   "2026-11-26T19:59:54"       bridge.account_notifications (no zone)
//   "2026-11-26 19:59:51"       bridge.unread_notifications lastread (space, no zone)
//   "2026-11-26T19:59:54.123Z"  setLastRead payload read from account history

/** Milliseconds since epoch, or NaN when the string is not a date. */
export function parseHiveDate(date: string): number {
  const iso = date.trim().replace(" ", "T");
  return Date.parse(/(Z|[+-]\d\d:?\d\d)$/i.test(iso) ? iso : `${iso}Z`);
}

/** A notification is read when it is not newer than the last-read date. */
export function isReadAt(notificationDate: string, lastRead: string): boolean {
  // NaN compares false: an unparseable date leaves the notification unread.
  return parseHiveDate(notificationDate) <= parseHiveDate(lastRead);
}

// Pure helpers that put notification copy in the reader's language. No React Native
// import, so `pnpm test` runs them under Node; the caller passes the translator.
//
// Two sources write their text in English and cannot follow the reader's locale:
//   - Hive nodes ("@x voted on your post"): rebuilt from a parsed kind + actor.
//   - The skatehive API (crosspost_* rows): rebuilt from `type` + `metadata`.
// In both cases the original text stays as the fallback, so an unknown kind or type
// still shows something real.
import type { TFunction, Vars } from "../i18n/translate";

// ---------- Hive notifications ----------

export type HiveNotificationKind = "vote" | "reply" | "mention" | "follow" | "reblog" | "transfer" | "other";

export interface ParsedHiveNotification {
  kind: HiveNotificationKind;
  actor: string | null;
  /** What was voted on / replied to, when the text says so. */
  target: "post" | "comment" | null;
  /** Trailing "(50%)" of a vote, or the "1.000 HIVE" of a transfer. */
  detail: string | null;
}

function kindFromType(type: string | undefined): HiveNotificationKind | null {
  switch (type) {
    case "vote":
      return "vote";
    case "reply":
    case "reply_comment":
      return "reply";
    case "mention":
      return "mention";
    case "follow":
      return "follow";
    case "reblog":
      return "reblog";
    case "transfer":
      return "transfer";
    default:
      return null;
  }
}

function kindFromText(msg: string): HiveNotificationKind {
  const text = msg.toLowerCase();
  // Same order the notification row has always used: replies, then mentions, votes, follows.
  if (/replied to|commented on/.test(text)) return "reply";
  if (/mentioned/.test(text)) return "mention";
  if (/upvoted|voted on|\bvoted\b|\bliked\b/.test(text)) return "vote";
  if (/started following|\bfollowed\b/.test(text)) return "follow";
  if (/reblogged|resteemed/.test(text)) return "reblog";
  if (/transfer(?:r)?ed .* to you|\bsent you\b/.test(text)) return "transfer";
  return "other";
}

export function parseHiveNotification(n: { type?: string; msg: string }): ParsedHiveNotification {
  const msg = n.msg ?? "";
  const kind = kindFromType(n.type) ?? kindFromText(msg);
  const actor = msg.match(/^@([a-z0-9.-]+)/i)?.[1] ?? null;
  const lower = msg.toLowerCase();
  const target: ParsedHiveNotification["target"] =
    n.type === "reply_comment" || /\byour comment\b/.test(lower)
      ? "comment"
      : /\byour post\b/.test(lower)
        ? "post"
        : null;
  let detail: string | null = null;
  if (kind === "vote") detail = msg.match(/\(([^()]+)\)\s*$/)?.[1]?.trim() ?? null;
  if (kind === "transfer") detail = msg.match(/([\d.,]+\s*[A-Z]{2,})\s+to you/)?.[1]?.trim() ?? null;
  return { kind, actor, target, detail };
}

function lookup(t: TFunction, key: string, vars: Vars): string | null {
  const out = t(key, vars);
  return out === key ? null : out;
}

/**
 * The notification as a sentence in the reader's language, or null when the text is
 * not one we recognise (the caller then shows the node's own text).
 */
export function localizeHiveNotification(n: { type?: string; msg: string }, t: TFunction): string | null {
  const { kind, actor, target, detail } = parseHiveNotification(n);
  if (!actor) return null;
  const vars: Vars = { actor };
  switch (kind) {
    case "vote":
      if (!target) return null;
      return detail
        ? lookup(t, `notif.hive.vote_${target}_detail`, { ...vars, detail })
        : lookup(t, `notif.hive.vote_${target}`, vars);
    case "reply":
      if (!target) return null;
      return lookup(t, `notif.hive.reply_${target}`, vars);
    case "mention":
      return lookup(t, "notif.hive.mention", vars);
    case "follow":
      return lookup(t, "notif.hive.follow", vars);
    case "reblog":
      return lookup(t, "notif.hive.reblog", vars);
    case "transfer":
      return detail ? lookup(t, "notif.hive.transfer", { ...vars, detail }) : null;
    default:
      return null;
  }
}

/** "now", "5m", "2h", "3d" in the reader's language; null from a week on (show a date). */
export function formatNotificationAge(diffSeconds: number, t: TFunction): string | null {
  if (diffSeconds < 60) return t("notif.time.now");
  if (diffSeconds < 3600) return t("notif.time.minutes", { n: Math.floor(diffSeconds / 60) });
  if (diffSeconds < 86400) return t("notif.time.hours", { n: Math.floor(diffSeconds / 3600) });
  if (diffSeconds < 604800) return t("notif.time.days", { n: Math.floor(diffSeconds / 86400) });
  return null;
}

// ---------- Crosspost (Instagram curation) notifications ----------

export interface CrossPostNotificationInput {
  type: string;
  title: string;
  body: string | null;
  metadata: Record<string, unknown> | null;
}

export interface LocalizedCrossPost {
  title: string;
  body: string | null;
}

function platformOf(metadata: Record<string, unknown> | null): "Instagram" | "Farcaster" {
  return metadata?.target === "farcaster" ? "Farcaster" : "Instagram";
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

/**
 * Title and body of a crosspost_* row in the reader's language. The curator's note is
 * free text in whatever language they wrote, so only the label around it is translated;
 * a failure body is the platform's own error, more useful raw. Unknown types, and any
 * key a catalog lacks, fall back to the text the server stored.
 */
export function localizeCrossPostNotification(
  n: CrossPostNotificationInput,
  t: TFunction,
  formatWhen: (iso: string) => string | null = () => null,
): LocalizedCrossPost {
  const platform = platformOf(n.metadata);
  const key = platform.toLowerCase();
  const vars: Vars = { platform };
  const note = asString(n.metadata?.review_note) ?? asString(n.metadata?.note);

  switch (n.type) {
    case "crosspost_queued":
      return {
        title: lookup(t, "notif.crosspost.queued_title", vars) ?? n.title,
        body: lookup(t, `notif.crosspost.queued_body_${key}`, vars) ?? n.body,
      };
    case "crosspost_scheduled": {
      const iso = asString(n.metadata?.scheduled_for);
      const when = iso ? formatWhen(iso) : null;
      return {
        title: lookup(t, "notif.crosspost.scheduled_title", vars) ?? n.title,
        // Without a readable date the stored sentence beats "Going live on null".
        body: (when && lookup(t, "notif.crosspost.scheduled_body", { ...vars, when })) || n.body,
      };
    }
    case "crosspost_published":
      return {
        title: lookup(t, "notif.crosspost.published_title", vars) ?? n.title,
        body: lookup(t, "notif.crosspost.published_body", vars) ?? n.body,
      };
    case "crosspost_rejected":
      return {
        title: lookup(t, "notif.crosspost.rejected_title", vars) ?? n.title,
        body: note
          ? (lookup(t, "notif.crosspost.rejected_note", { ...vars, note }) ?? n.body)
          : (lookup(t, "notif.crosspost.rejected_body_no_note", vars) ?? n.body),
      };
    case "crosspost_failed":
      return {
        title: lookup(t, "notif.crosspost.failed_title", vars) ?? n.title,
        body: n.body,
      };
    default:
      return { title: n.title, body: n.body };
  }
}

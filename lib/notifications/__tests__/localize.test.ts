import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatNotificationAge,
  localizeCrossPostNotification,
  localizeHiveNotification,
  parseHiveNotification,
} from "../localize";
import { createTranslator } from "../../i18n/translate";

const EN = {
  "notif.time.now": "now",
  "notif.time.minutes": "{{n}}m",
  "notif.time.hours": "{{n}}h",
  "notif.time.days": "{{n}}d",
  "notif.hive.vote_post": "@{{actor}} voted on your post",
  "notif.hive.vote_comment": "@{{actor}} voted on your comment",
  "notif.hive.vote_post_detail": "@{{actor}} voted on your post ({{detail}})",
  "notif.hive.vote_comment_detail": "@{{actor}} voted on your comment ({{detail}})",
  "notif.hive.reply_post": "@{{actor}} replied to your post",
  "notif.hive.reply_comment": "@{{actor}} replied to your comment",
  "notif.hive.mention": "@{{actor}} mentioned you",
  "notif.hive.follow": "@{{actor}} started following you",
  "notif.hive.reblog": "@{{actor}} reblogged your post",
  "notif.hive.transfer": "@{{actor}} sent you {{detail}}",
  "notif.crosspost.queued_title": "Your snap is with the curation team",
  "notif.crosspost.queued_body_instagram": "They'll review it for Instagram.",
  "notif.crosspost.queued_body_farcaster": "They'll review it for Farcaster.",
  "notif.crosspost.scheduled_title": "Cross-post approved",
  "notif.crosspost.scheduled_body": "Going live on {{when}}.",
  "notif.crosspost.published_title": "Your cross-post is live on {{platform}}",
  "notif.crosspost.published_body": "Tap to see it on {{platform}}.",
  "notif.crosspost.rejected_title": "Your {{platform}} cross-post wasn't picked up",
  "notif.crosspost.rejected_body_no_note": "The curation team passed on this one.",
  "notif.crosspost.rejected_note": 'Curation team: "{{note}}"',
  "notif.crosspost.failed_title": "Your {{platform}} cross-post couldn't be published",
};
const PT = {
  "notif.hive.vote_post": "@{{actor}} votou no seu post",
  "notif.hive.follow": "@{{actor}} começou a seguir você",
  "notif.crosspost.rejected_note": 'Equipe de curadoria: "{{note}}"',
  "notif.crosspost.published_title": "Sua publicação já está no {{platform}}",
};
const tEn = createTranslator({ en: EN }, "en");
const tPt = createTranslator({ en: EN, "pt-BR": PT }, "pt-BR");

test("parseHiveNotification reads kind, actor, target and detail from the node's English text", () => {
  assert.deepEqual(parseHiveNotification({ type: "vote", msg: "@alice voted on your post (50%)" }), {
    kind: "vote", actor: "alice", target: "post", detail: "50%",
  });
  assert.deepEqual(parseHiveNotification({ type: "vote", msg: "@bob voted on your comment" }), {
    kind: "vote", actor: "bob", target: "comment", detail: null,
  });
  assert.equal(parseHiveNotification({ type: "reply_comment", msg: "@c replied to you" }).target, "comment");
  assert.equal(parseHiveNotification({ type: "reply", msg: "@c replied to your post" }).kind, "reply");
  assert.equal(parseHiveNotification({ type: "mention", msg: "@d mentioned you" }).kind, "mention");
  assert.equal(parseHiveNotification({ type: "follow", msg: "@e followed you" }).kind, "follow");
  assert.equal(parseHiveNotification({ type: "reblog", msg: "@f reblogged your post" }).kind, "reblog");
  assert.deepEqual(parseHiveNotification({ type: "transfer", msg: "@g transfered 1.500 HIVE to you" }).detail, "1.500 HIVE");
});

test("parseHiveNotification falls back to the wording when the type is unknown", () => {
  assert.equal(parseHiveNotification({ type: "x", msg: "@a upvoted your post" }).kind, "vote");
  assert.equal(parseHiveNotification({ type: "x", msg: "@a started following you" }).kind, "follow");
  assert.equal(parseHiveNotification({ type: "x", msg: "@a commented on your post" }).kind, "reply");
  assert.equal(parseHiveNotification({ type: "x", msg: "something else entirely" }).kind, "other");
  assert.equal(parseHiveNotification({ type: "vote", msg: "no actor here" }).actor, null);
});

test("localizeHiveNotification builds the sentence from the catalog, or returns null to keep the original", () => {
  assert.equal(localizeHiveNotification({ type: "vote", msg: "@alice voted on your post (50%)" }, tEn), "@alice voted on your post (50%)");
  assert.equal(localizeHiveNotification({ type: "vote", msg: "@alice voted on your post" }, tPt), "@alice votou no seu post");
  assert.equal(localizeHiveNotification({ type: "follow", msg: "@e followed you" }, tPt), "@e começou a seguir você");
  // A key the locale lacks resolves through the English fallback, never to a raw key.
  assert.equal(localizeHiveNotification({ type: "mention", msg: "@d mentioned you" }, tPt), "@d mentioned you");
  // Not recognised: null, so the row shows the node's text.
  assert.equal(localizeHiveNotification({ type: "x", msg: "unrecognised text" }, tPt), null);
  assert.equal(localizeHiveNotification({ type: "vote", msg: "@a voted somewhere odd" }, tPt), null);
  assert.equal(localizeHiveNotification({ type: "transfer", msg: "@a sent you a gift" }, tPt), null);
  // A translator that returns the key itself (missing everywhere) also means "keep the original".
  const empty = createTranslator({}, "en");
  assert.equal(localizeHiveNotification({ type: "follow", msg: "@e followed you" }, empty), null);
});

test("formatNotificationAge keeps the row's thresholds and hands weeks back to the caller", () => {
  assert.equal(formatNotificationAge(0, tEn), "now");
  assert.equal(formatNotificationAge(59, tEn), "now");
  assert.equal(formatNotificationAge(60, tEn), "1m");
  assert.equal(formatNotificationAge(3599, tEn), "59m");
  assert.equal(formatNotificationAge(3600, tEn), "1h");
  assert.equal(formatNotificationAge(86399, tEn), "23h");
  assert.equal(formatNotificationAge(86400, tEn), "1d");
  assert.equal(formatNotificationAge(604799, tEn), "6d");
  assert.equal(formatNotificationAge(604800, tEn), null);
});

const base = { title: "Server title", body: "Server body" };

test("localizeCrossPostNotification renders each type from the catalog", () => {
  assert.deepEqual(localizeCrossPostNotification({ ...base, type: "crosspost_queued", metadata: {} }, tEn), {
    title: "Your snap is with the curation team",
    body: "They'll review it for Instagram.",
  });
  assert.equal(
    localizeCrossPostNotification({ ...base, type: "crosspost_queued", metadata: { target: "farcaster" } }, tEn).body,
    "They'll review it for Farcaster.",
  );
  assert.equal(localizeCrossPostNotification({ ...base, type: "crosspost_published", metadata: {} }, tPt).title, "Sua publicação já está no Instagram");
  assert.equal(
    localizeCrossPostNotification({ ...base, type: "crosspost_published", metadata: { target: "farcaster" } }, tPt).title,
    "Sua publicação já está no Farcaster",
  );
});

test("localizeCrossPostNotification: a rejection keeps the curator's own words", () => {
  const withNote = localizeCrossPostNotification(
    { ...base, type: "crosspost_rejected", metadata: { review_note: "Too dark, resubmit" } },
    tPt,
  );
  assert.equal(withNote.body, 'Equipe de curadoria: "Too dark, resubmit"');
  const webKey = localizeCrossPostNotification({ ...base, type: "crosspost_rejected", metadata: { note: "Blurry" } }, tEn);
  assert.equal(webKey.body, 'Curation team: "Blurry"');
  const noNote = localizeCrossPostNotification({ ...base, type: "crosspost_rejected", metadata: { review_note: "  " } }, tEn);
  assert.equal(noNote.body, "The curation team passed on this one.");
});

test("localizeCrossPostNotification: failures keep the platform's error text as the body", () => {
  const out = localizeCrossPostNotification({ type: "crosspost_failed", title: "t", body: "Meta error 2207077", metadata: {} }, tEn);
  assert.equal(out.title, "Your Instagram cross-post couldn't be published");
  assert.equal(out.body, "Meta error 2207077");
});

test("localizeCrossPostNotification: scheduled needs a readable date, unknown types pass through", () => {
  const formatWhen = (iso: string) => (iso === "2026-09-20T21:00:00Z" ? "Sep 20, 6:00 PM" : null);
  const ok = localizeCrossPostNotification(
    { ...base, type: "crosspost_scheduled", metadata: { scheduled_for: "2026-09-20T21:00:00Z" } },
    tEn,
    formatWhen,
  );
  assert.equal(ok.body, "Going live on Sep 20, 6:00 PM.");
  const bad = localizeCrossPostNotification({ ...base, type: "crosspost_scheduled", metadata: { scheduled_for: "nope" } }, tEn, formatWhen);
  assert.equal(bad.body, "Server body");
  assert.deepEqual(localizeCrossPostNotification({ ...base, type: "something_new", metadata: null }, tEn), {
    title: "Server title",
    body: "Server body",
  });
});

test("localizeCrossPostNotification falls back to the server text when a key is missing from every catalog", () => {
  const empty = createTranslator({}, "en");
  assert.deepEqual(localizeCrossPostNotification({ ...base, type: "crosspost_published", metadata: {} }, empty), {
    title: "Server title",
    body: "Server body",
  });
});

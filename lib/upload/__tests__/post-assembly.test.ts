import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildBody,
  buildImages,
  buildJsonMetadata,
  buildTags,
  createImageMarkdown,
  createVideoIframe,
  makePermlink,
} from "../post-assembly";

test("makePermlink is sh- plus 15 lowercase alphanumerics from the ISO timestamp", () => {
  // "2026-09-03T10:15:00.123Z" → strip non-alphanumerics → "20260903T101500123Z" → lowercase, first 15
  const permlink = makePermlink(new Date("2026-09-03T10:15:00.123Z"));
  assert.equal(permlink, "sh-20260903t101500");
  assert.match(makePermlink(), /^sh-[a-z0-9]{15}$/);
});

test("buildTags keeps the community tag first, adds body hashtags, dedupes", () => {
  assert.deepEqual(buildTags("Kickflip #skate #Skate #skate day", "hive-173115"), [
    "hive-173115",
    "skate",
    "Skate",
  ]);
  assert.deepEqual(buildTags("tagged #skatehive twice #skatehive", "skatehive"), ["skatehive"]);
  assert.deepEqual(buildTags("no tags here", "hive-173115"), ["hive-173115"]);
});

test("buildBody matches the create screen concatenation", () => {
  assert.equal(buildBody("hello", {}), "hello");
  assert.equal(buildBody("", {}), "");
  assert.equal(
    buildBody("hello", { imageUrl: "https://images.hive.blog/i.jpg" }),
    "hello\n\n![Uploaded image](https://images.hive.blog/i.jpg)",
  );
  assert.equal(
    buildBody("", { imageUrl: "https://images.hive.blog/i.jpg" }),
    "![Uploaded image](https://images.hive.blog/i.jpg)",
  );
  const iframe = createVideoIframe("https://ipfs.skatehive.app/ipfs/bafy1", "Video");
  assert.equal(buildBody("clip", { gatewayUrl: "https://ipfs.skatehive.app/ipfs/bafy1" }), `clip\n\n${iframe}`);
  assert.equal(buildBody("", { gatewayUrl: "https://ipfs.skatehive.app/ipfs/bafy1" }), iframe);
});

test("createVideoIframe escapes attributes; createImageMarkdown formats markdown", () => {
  assert.equal(
    createVideoIframe('https://x.test/a"b', "T<i>"),
    '<iframe src="https://x.test/a&quot;b" width="100%" height="400" frameborder="0" allowfullscreen title="T&lt;i&gt;"></iframe>',
  );
  assert.equal(createImageMarkdown("https://x.test/i.jpg"), "![image](https://x.test/i.jpg)");
  assert.equal(createImageMarkdown("https://x.test/i.jpg", "alt"), "![alt](https://x.test/i.jpg)");
});

test("buildImages prefers imageUrl, then the author's cover, then the worker frame", () => {
  assert.deepEqual(buildImages({ imageUrl: "i" }), ["i"]);
  assert.deepEqual(buildImages({ coverUrl: "c", thumbnailUrl: "t" }), ["c"]);
  assert.deepEqual(buildImages({ thumbnailUrl: "t" }), ["t"]);
  assert.deepEqual(buildImages({}), []);
});

test("buildJsonMetadata only adds images when there are some", () => {
  assert.deepEqual(buildJsonMetadata(["hive-173115"], []), { app: "mycommunity-mobile", tags: ["hive-173115"] });
  assert.deepEqual(buildJsonMetadata(["hive-173115", "skate"], ["c"]), {
    app: "mycommunity-mobile",
    tags: ["hive-173115", "skate"],
    images: ["c"],
  });
});

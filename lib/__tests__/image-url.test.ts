import { test } from "node:test";
import assert from "node:assert/strict";
import { bucketWidth, sizedImageUrl } from "../image-url";

const JPG = "https://i.ecency.com/DQmRbQ7x/photo.jpg";

test("bucketWidth: picks the smallest width that covers, capped", () => {
  assert.equal(bucketWidth(100), 320);
  assert.equal(bucketWidth(320), 320);
  assert.equal(bucketWidth(321), 640);
  assert.equal(bucketWidth(1080), 1080);
  assert.equal(bucketWidth(1170), 1280);
  assert.equal(bucketWidth(4000), 1280);
});

test("sizedImageUrl: wraps a remote photo in the proxy", () => {
  assert.equal(sizedImageUrl(JPG, 1080), `https://images.hive.blog/1080x0/${JPG}`);
  const ipfs = "https://ipfs.skatehive.app/ipfs/bafy?filename=a.jpg";
  assert.equal(sizedImageUrl(ipfs, 300), `https://images.hive.blog/320x0/${ipfs}`);
});

test("sizedImageUrl: leaves what the proxy can't or shouldn't resize", () => {
  for (const url of [
    "https://images.hive.blog/640x0/https://x.com/a.jpg", // already proxied (403)
    "https://images.hive.blog/u/someone/avatar",
    "https://files.peakd.com/file/a/b.gif", // first frame only
    "https://files.peakd.com/file/a/b.GIF?x=1",
    "https://lh3.googleusercontent.com/abc", // 403
    "file:///data/user/0/x.jpg",
    "data:image/png;base64,AAAA",
  ]) {
    assert.equal(sizedImageUrl(url, 640), url, url);
  }
});

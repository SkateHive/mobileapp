import { test } from "node:test";
import assert from "node:assert/strict";
import { galleryUris, hiveResized, spotImageUri } from "../images";

const googleOriginal = "https://lh3.googleusercontent.com/abc=w4000";
const myMapsOriginal = "https://mymaps.usercontent.google.com/hostedimage/m/*/xyz";
const hiveOriginal = "https://images.hive.blog/DQmR6Ws/IMG_6200.JPG";
const hiveProxied = "https://images.hive.blog/400x400/https://images.hive.blog/DQmR6Ws/IMG_6200.JPG";
const ipfsSmall = "https://ipfs.skatehive.app/ipfs/bafkreismall";

test("prefers the bounded image, then a real small one", () => {
  assert.equal(spotImageUri({ thumbnail: myMapsOriginal, thumbnail_small: ipfsSmall, thumbnail_bounded: "m.jpg" }, false), "m.jpg");
  assert.equal(spotImageUri({ thumbnail: myMapsOriginal, thumbnail_small: ipfsSmall, thumbnail_bounded: null }, false), ipfsSmall);
});

test("works before the API ships the bounded fields", () => {
  assert.equal(spotImageUri({ thumbnail: myMapsOriginal, thumbnail_small: ipfsSmall }, false), ipfsSmall);
});

test("an original copied into thumbnail_small is not used on Android", () => {
  // Seen in production: thumbnail_small === thumbnail, Google-hosted.
  assert.equal(spotImageUri({ thumbnail: googleOriginal, thumbnail_small: googleOriginal }, false), null);
  // A Google-hosted small that differs is still not trusted.
  assert.equal(spotImageUri({ thumbnail: myMapsOriginal, thumbnail_small: googleOriginal }, false), null);
  // iOS may still show the original.
  assert.equal(spotImageUri({ thumbnail: googleOriginal, thumbnail_small: googleOriginal }, true), googleOriginal);
});

test("Hive images go through the resize proxy, never nested", () => {
  assert.equal(hiveResized(hiveOriginal, 800), `https://images.hive.blog/800x0/${hiveOriginal}`);
  assert.equal(hiveResized(hiveProxied, 800), hiveProxied);
  assert.equal(hiveResized(myMapsOriginal, 800), null);
  assert.equal(spotImageUri({ thumbnail: hiveOriginal, thumbnail_small: hiveProxied }, false), hiveProxied);
  assert.equal(spotImageUri({ thumbnail: hiveOriginal }, false), `https://images.hive.blog/400x0/${hiveOriginal}`);
});

test("gallery on Android: resized Hive images, Google originals dropped", () => {
  const spot = { thumbnail: myMapsOriginal, thumbnail_small: ipfsSmall };
  assert.deepEqual(galleryUris([hiveOriginal, myMapsOriginal], spot, false), [`https://images.hive.blog/800x0/${hiveOriginal}`]);
  assert.deepEqual(galleryUris([myMapsOriginal, googleOriginal], spot, false), [ipfsSmall]);
  assert.deepEqual(galleryUris([myMapsOriginal], { thumbnail: myMapsOriginal }, false), []);
  assert.deepEqual(galleryUris([myMapsOriginal], spot, true), [myMapsOriginal]);
});

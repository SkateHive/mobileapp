import { test } from "node:test";
import assert from "node:assert/strict";
import { spotImageUri } from "../images";

const original = "https://mymaps.usercontent.google.com/original.png";

test("prefers the bounded image, then the small one", () => {
  assert.equal(
    spotImageUri({ thumbnail: original, thumbnail_small: "s.jpg", thumbnail_bounded: "m.jpg" }, false),
    "m.jpg",
  );
  assert.equal(spotImageUri({ thumbnail: original, thumbnail_small: "s.jpg", thumbnail_bounded: null }, false), "s.jpg");
});

test("works before the API ships the bounded fields", () => {
  assert.equal(spotImageUri({ thumbnail: original, thumbnail_small: "s.jpg" }, false), "s.jpg");
});

test("never falls back to the original unless allowed", () => {
  assert.equal(spotImageUri({ thumbnail: original }, false), null);
  assert.equal(spotImageUri({ thumbnail: original, thumbnail_bounded: null, thumbnail_small: null }, false), null);
  assert.equal(spotImageUri({ thumbnail: original }, true), original);
  assert.equal(spotImageUri({}, true), null);
});

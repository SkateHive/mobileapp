import { test } from "node:test";
import assert from "node:assert/strict";
import { coverTimeAt, stripTimeAt, EDGE_MARGIN } from "../video-cover";

// A 10 second clip and a 100px travel range keep the arithmetic readable: with
// the 10% margin the scrubbable window is 1s to 9s.
const DURATION = 10;
const TRAVEL = 100;

test("the cursor at rest picks the same frame the old picker defaulted to", () => {
  assert.equal(coverTimeAt(0, TRAVEL, DURATION), DURATION * EDGE_MARGIN);
});

test("the end of the travel stops short of the clip's last moments", () => {
  assert.equal(coverTimeAt(TRAVEL, TRAVEL, DURATION), DURATION * (1 - EDGE_MARGIN));
});

test("the cursor maps linearly across the scrubbable window", () => {
  // Compared loosely: these land on binary fractions that carry float noise.
  assert.ok(Math.abs(coverTimeAt(TRAVEL / 2, TRAVEL, DURATION) - 5) < 1e-9);
  assert.ok(Math.abs(coverTimeAt(TRAVEL / 4, TRAVEL, DURATION) - 3) < 1e-9);
});

test("dragging past either edge clamps instead of leaving the clip", () => {
  assert.equal(coverTimeAt(-50, TRAVEL, DURATION), 1);
  assert.equal(coverTimeAt(TRAVEL * 3, TRAVEL, DURATION), 9);
});

test("a strip not yet measured picks the default rather than dividing by zero", () => {
  const t = coverTimeAt(20, 0, DURATION);
  assert.ok(Number.isFinite(t));
  assert.equal(t, 1);
});

test("strip frames sit at the centre of their tile, inside the margins", () => {
  const count = 10;
  const times = Array.from({ length: count }, (_, i) => stripTimeAt(i, count, DURATION));

  assert.equal(times.length, count);
  // Every frame lands inside the scrubbable window, none on the black edges.
  for (const t of times) {
    assert.ok(t > DURATION * EDGE_MARGIN, `${t} should sit after the opening margin`);
    assert.ok(t < DURATION * (1 - EDGE_MARGIN), `${t} should sit before the closing margin`);
  }
  // Evenly spaced and ascending, so the strip reads as the clip in order.
  const gap = times[1] - times[0];
  for (let i = 1; i < times.length; i++) {
    assert.ok(Math.abs(times[i] - times[i - 1] - gap) < 1e-9);
  }
});

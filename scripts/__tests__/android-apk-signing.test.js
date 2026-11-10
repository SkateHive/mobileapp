// Run with: pnpm test:signing. Tests verifyApk's reading of apksigner's verdict and signer lines, with a fake
// apksigner that prints canned output (the real one is exercised by pnpm build:android:apk).
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { verifyApk, SigningError } = require("../android-signing");

const WANT = "DD:52:09:03:71:F2:8B:56:8E:F1:CA:A4:62:FF:CF:2F:58:D5:BB:79:26:56:74:9F:FE:D7:E7:96:A1:2D:D7:9A";
const hex = (fp) => fp.replace(/:/g, "").toLowerCase();
const OTHER = "AA:".repeat(31) + "AA";
let dir;
let apk;

before(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "skh-apk-"));
  apk = path.join(dir, "app.apk");
  fs.writeFileSync(apk, "not really an apk");
});
after(() => fs.rmSync(dir, { recursive: true, force: true }));

/** A fake apksigner that prints `out` and exits with `code`. */
function fake(out, code = 0) {
  const bin = path.join(dir, `apksigner-${Math.random().toString(36).slice(2)}`);
  const body = path.join(`${bin}.out`);
  fs.writeFileSync(body, out);
  fs.writeFileSync(bin, `#!/bin/sh\ncat "${body}"\nexit ${code}\n`, { mode: 0o755 });
  return bin;
}
const verified = (...fps) =>
  ["Verifies", "Verified using v2 scheme (APK Signature Scheme v2): true",
    ...fps.map((fp, i) => `Signer #${i + 1} certificate SHA-256 digest: ${hex(fp)}`), ""].join("\n");

test("accepts an APK whose only signer is the upload certificate", { skip: process.platform === "win32" }, () => {
  assert.equal(verifyApk(apk, WANT, fake(verified(WANT))), WANT);
});

test("rejects an APK signed by another key", { skip: process.platform === "win32" }, () => {
  assert.throws(() => verifyApk(apk, WANT, fake(verified(OTHER))), (e) => e instanceof SigningError && /another key/.test(e.message));
});

test("rejects an APK with an extra signer", { skip: process.platform === "win32" }, () => {
  assert.throws(() => verifyApk(apk, WANT, fake(verified(WANT, OTHER))), /another key/);
});

test("rejects output without a signer line", { skip: process.platform === "win32" }, () => {
  assert.throws(() => verifyApk(apk, WANT, fake("Verifies\n")), /couldn't read its signer/);
});

test("rejects an APK that fails verification", { skip: process.platform === "win32" }, () => {
  assert.throws(() => verifyApk(apk, WANT, fake("DOES NOT VERIFY\nERROR: missing META-INF\n", 1)), /failed signature verification/);
  assert.throws(() => verifyApk(apk, WANT, fake(verified(WANT), 1)), /failed signature verification/);
});

test("rejects a missing file and a bad expected fingerprint", () => {
  assert.throws(() => verifyApk(path.join(dir, "nope.apk"), WANT, "/bin/false"), /does not exist/);
  assert.throws(() => verifyApk(apk, "nope", "/bin/false"), /No valid expected/);
});

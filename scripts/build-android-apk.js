#!/usr/bin/env node
// Builds the sideload APK (for skatehive.app/download while the app is not on Play) signed with the upload key.
// Usage: pnpm build:android:apk
// Needs JAVA_HOME pointing at JDK 17, the Android SDK, and the upload key set up
// (see plugins/withAndroidReleaseSigning.js).
//
// Same key as the Play bundle on purpose: when the app is set up on Play, register this key as the app signing
// key ("use my own key"), so phones that installed this APK update from Play without reinstalling. If Play
// signs with a key of its own instead, the APK and the Play app can't update each other.
//
// ARM only (arm64-v8a, armeabi-v7a): phones are ARM, and the x86 libraries would add tens of MB for emulators.
// Before building it runs the same key checks as the bundle build; after, apksigner must verify the APK and its
// only signer must be the upload certificate. Output: dist/skatehive-<version>.apk and dist/skatehive.apk.
const { execSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  SigningError, resolvePropsPath, readProps, expectedFingerprint, checkKeyPassword, verifyApk,
} = require("./android-signing");

const root = path.join(__dirname, "..");
try {
  const props = resolvePropsPath(root, process.env.SKATEHIVE_UPLOAD_PROPERTIES);
  const config = readProps(props);
  const expected = expectedFingerprint(config);
  checkKeyPassword(config);

  const { version, android } = require(path.join(root, "app.json")).expo;
  const env = { ...process.env, SKATEHIVE_UPLOAD_PROPERTIES: props };
  const run = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: "inherit", env });
  run("pnpm exec expo prebuild --clean -p android --no-install");
  run("./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a", path.join(root, "android"));

  const built = path.join(root, "android/app/build/outputs/apk/release/app-release.apk");
  verifyApk(built, expected);

  const dist = path.join(root, "dist");
  fs.mkdirSync(dist, { recursive: true });
  const named = path.join(dist, `skatehive-${version}-${android.versionCode}.apk`);
  const latest = path.join(dist, "skatehive.apk");
  fs.copyFileSync(built, named);
  fs.copyFileSync(built, latest);
  const sha = crypto.createHash("sha256").update(fs.readFileSync(latest)).digest("hex");
  fs.writeFileSync(`${latest}.sha256`, `${sha}  skatehive.apk\n`);
  const mb = (fs.statSync(latest).size / 1e6).toFixed(1);
  console.log(`\nSideload APK: ${named} (${mb} MB)\nCopy: ${latest}\nFile SHA-256: ${sha}`);
  console.log(`Signed by the upload key, certificate SHA-256 ${expected}`);
} catch (e) {
  console.error(`\n${e instanceof SigningError ? e.message : `Build failed: ${e.message}`}`);
  process.exit(1);
}

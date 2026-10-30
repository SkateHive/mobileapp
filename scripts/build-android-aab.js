#!/usr/bin/env node
// Builds the Play Store bundle (.aab) signed with the upload key.
// Usage: pnpm build:android:aab
// Needs JAVA_HOME pointing at JDK 17 and the upload key set up (see plugins/withAndroidReleaseSigning.js).
//
// Before building it checks the config (readable, complete, keystore readable, store password and alias
// valid, key password valid) and reads the upload certificate's SHA-256. After building it checks that the bundle is signed by
// exactly that certificate, so a debug-signed, unsigned or wrongly signed bundle is never reported as ready.
const { execSync } = require("node:child_process");
const path = require("node:path");
const {
  SigningError, resolvePropsPath, readProps, expectedFingerprint, checkKeyPassword, verifyBundle,
} = require("./android-signing");

const root = path.join(__dirname, "..");
try {
  // Resolved once against the repo root and handed to Gradle as an absolute path: Gradle's working
  // directory is not this process's.
  const props = resolvePropsPath(root, process.env.SKATEHIVE_UPLOAD_PROPERTIES);
  const config = readProps(props);
  const expected = expectedFingerprint(config);
  checkKeyPassword(config);

  const env = { ...process.env, SKATEHIVE_UPLOAD_PROPERTIES: props };
  const run = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: "inherit", env });
  run("pnpm exec expo prebuild --clean -p android --no-install");
  run("./gradlew bundleRelease", path.join(root, "android"));

  const aab = path.join(root, "android/app/build/outputs/bundle/release/app-release.aab");
  verifyBundle(aab, expected);
  console.log(`\nPlay bundle: ${aab}\nSigned by the upload key, SHA-256 ${expected}`);
} catch (e) {
  console.error(`\n${e instanceof SigningError ? e.message : `Build failed: ${e.message}`}`);
  process.exit(1);
}

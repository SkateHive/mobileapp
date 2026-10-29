#!/usr/bin/env node
// Builds the Play Store bundle (.aab) signed with the upload key.
// Usage: pnpm build:android:aab
// Needs JAVA_HOME pointing at JDK 17 and the upload key set up (see
// plugins/withAndroidReleaseSigning.js). Refuses to build a debug-signed
// bundle, which Play would reject.
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const props =
  process.env.SKATEHIVE_UPLOAD_PROPERTIES ||
  path.join(os.homedir(), ".skatehive", "android-upload.properties");
if (!fs.existsSync(props)) {
  console.error(`No upload key config at ${props}. See plugins/withAndroidReleaseSigning.js.`);
  process.exit(1);
}

const root = path.join(__dirname, "..");
const run = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: "inherit" });
run("pnpm exec expo prebuild --clean -p android --no-install");
run("./gradlew bundleRelease", path.join(root, "android"));

const aab = path.join(root, "android/app/build/outputs/bundle/release/app-release.aab");
console.log(`\nPlay bundle: ${aab}`);

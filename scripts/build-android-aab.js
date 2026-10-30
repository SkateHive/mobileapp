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

const root = path.join(__dirname, "..");
// Resolve once, against the repo root, and hand Gradle the absolute path: Gradle's working
// directory is not this process's, and a path it can't find silently means debug signing.
const props = path.resolve(
  root,
  process.env.SKATEHIVE_UPLOAD_PROPERTIES ||
    path.join(os.homedir(), ".skatehive", "android-upload.properties"),
);
if (!fs.existsSync(props)) {
  console.error(`No upload key config at ${props}. See plugins/withAndroidReleaseSigning.js.`);
  process.exit(1);
}

const env = { ...process.env, SKATEHIVE_UPLOAD_PROPERTIES: props };
const run = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: "inherit", env });
run("pnpm exec expo prebuild --clean -p android --no-install");
run("./gradlew bundleRelease", path.join(root, "android"));

const aab = path.join(root, "android/app/build/outputs/bundle/release/app-release.aab");
// Never hand over a debug-signed bundle as if it were the store build.
const keytool = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, "bin", "keytool") : "keytool";
const cert = execSync(`"${keytool}" -printcert -jarfile "${aab}"`, { encoding: "utf8" });
// The Expo template's debug key: CN=Android Debug, SHA1 5E:8F:16:06:…
if (/CN=Android Debug/.test(cert) || /5E:8F:16:06:2E:A3:CD:2C/.test(cert)) {
  console.error(`\n${aab} is signed with the DEBUG key, not the upload key. Check ${props}.`);
  process.exit(1);
}
const owner = /Owner: ([^\n]+)/.exec(cert)?.[1] ?? "?";
console.log(`\nPlay bundle: ${aab}\nSigned by: ${owner}`);

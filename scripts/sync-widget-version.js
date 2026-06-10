#!/usr/bin/env node
/**
 * Sync the iOS version + build number onto every app target.
 *
 * Run this AFTER `expo prebuild` (the `prebuild:ios` npm script does it for you).
 * `@bacons/apple-targets` regenerates the SkateSpots widget target with
 * CURRENT_PROJECT_VERSION reset to 1, but App Store Connect rejects an app
 * extension whose build number differs from the containing app's. This copies
 * `expo.ios.buildNumber` / `expo.version` from app.json onto the main app and
 * every extension target (anything whose bundle id is `<app-id>` or
 * `<app-id>.*`) in the generated Xcode project.
 *
 * `ios/` is gitignored and regenerated on every prebuild, so app.json is the
 * single source of version truth — only bump it there.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const { expo } = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const bundleId = expo.ios && expo.ios.bundleIdentifier;
const buildNumber = String((expo.ios && expo.ios.buildNumber) || '1');
const version = String(expo.version || '1.0.0');

if (!bundleId) {
  console.error('[sync-widget-version] expo.ios.bundleIdentifier missing in app.json — skipping.');
  process.exit(0);
}

const pbxPath = path.join(root, 'ios', 'SkateHive.xcodeproj', 'project.pbxproj');
if (!fs.existsSync(pbxPath)) {
  console.log(`[sync-widget-version] ${path.relative(root, pbxPath)} not found — run \`expo prebuild -p ios\` first. Skipping.`);
  process.exit(0);
}

let pbx = fs.readFileSync(pbxPath, 'utf8');
let patched = 0;

// Each XCBuildConfiguration has a `buildSettings = { ... };` block. Setting
// values never contain `}` (arrays use parens), so the first `\n<tabs>};`
// reliably closes the block.
pbx = pbx.replace(/buildSettings = \{([\s\S]*?)\n(\t+)\};/g, (full, body, indent) => {
  const m = body.match(/PRODUCT_BUNDLE_IDENTIFIER = "?([^";]+)"?;/);
  if (!m) return full;
  const id = m[1];
  if (id !== bundleId && !id.startsWith(bundleId + '.')) return full;

  let next = body;
  next = /CURRENT_PROJECT_VERSION = [^;]*;/.test(next)
    ? next.replace(/CURRENT_PROJECT_VERSION = [^;]*;/g, `CURRENT_PROJECT_VERSION = ${buildNumber};`)
    : next.replace(/(PRODUCT_BUNDLE_IDENTIFIER = "?[^";]+"?;)/, `$1\n${indent}\tCURRENT_PROJECT_VERSION = ${buildNumber};`);

  if (/MARKETING_VERSION = [^;]*;/.test(next)) {
    next = next.replace(/MARKETING_VERSION = [^;]*;/g, `MARKETING_VERSION = ${version};`);
  }

  if (next !== body) patched++;
  return `buildSettings = {${next}\n${indent}};`;
});

fs.writeFileSync(pbxPath, pbx);
console.log(`[sync-widget-version] CURRENT_PROJECT_VERSION=${buildNumber}, MARKETING_VERSION=${version} → ${patched} target config(s) for ${bundleId}*`);

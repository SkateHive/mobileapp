#!/usr/bin/env node
// Generates the native localisation files from the `native.*` catalog entries, so the
// permission prompts and the widget stay in step with the translations reviewed for the app.
//
//   node scripts/sync-native-strings.js                 reads lib/i18n/locales/*.json (native.* keys)
//   node scripts/sync-native-strings.js --from-additions   reads lib/i18n/additions/native.json instead
//
// Writes:
//   locales/{pt-BR,pt-PT,es}.json           Expo `locales` files (app.json), iOS InfoPlist.strings
//   targets/widget/Localizable.xcstrings    String Catalog for the SkateSpots widget
//
// Run it after the pt-BR review changes any native.* string, then rebuild the iOS project.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const LANGS = ["pt-BR", "pt-PT", "es"];

// native.perm.* id -> the Info.plist keys it fills.
const PLIST_KEYS = {
  "native.perm.face_id": ["NSFaceIDUsageDescription"],
  "native.perm.camera": ["NSCameraUsageDescription"],
  "native.perm.photos": ["NSPhotoLibraryUsageDescription"],
  "native.perm.save_photos": ["NSPhotoLibraryAddUsageDescription"],
  "native.perm.location": ["NSLocationWhenInUseUsageDescription"],
  "native.perm.location_always": ["NSLocationAlwaysAndWhenInUseUsageDescription", "NSLocationAlwaysUsageDescription"],
  "native.perm.microphone": ["NSMicrophoneUsageDescription"],
  "native.perm.motion": ["NSMotionUsageDescription"],
};

function load() {
  const out = {}; // id -> { en, "pt-BR", "pt-PT", es }
  if (process.argv.includes("--from-additions")) {
    const add = JSON.parse(fs.readFileSync(path.join(root, "lib/i18n/additions/native.json"), "utf8"));
    for (const [id, v] of Object.entries(add)) out[id] = { en: v.en, "pt-BR": v.pt, "pt-PT": v.ptPT, es: v.es };
    return out;
  }
  const cat = {};
  for (const l of ["en", ...LANGS]) cat[l] = JSON.parse(fs.readFileSync(path.join(root, `lib/i18n/locales/${l}.json`), "utf8"));
  for (const id of Object.keys(cat.en).filter((k) => k.startsWith("native."))) {
    out[id] = { en: cat.en[id] };
    for (const l of LANGS) out[id][l] = cat[l][id];
  }
  return out;
}

const strings = load();
const problems = [];

// ---- iOS InfoPlist.strings via Expo `locales` ----
// Expo writes `KEY = "value";` without escaping, so these values must be plain text.
const plist = Object.fromEntries(LANGS.map((l) => [l, {}]));
for (const [id, keys] of Object.entries(PLIST_KEYS)) {
  const s = strings[id];
  if (!s) { problems.push(`missing ${id}`); continue; }
  for (const l of LANGS) {
    const v = s[l];
    if (!v) { problems.push(`${id} has no ${l}`); continue; }
    if (/["\\\n]/.test(v)) problems.push(`${id} (${l}) contains a quote, backslash or newline`);
    for (const k of keys) plist[l][k] = v;
  }
}
fs.mkdirSync(path.join(root, "locales"), { recursive: true });
for (const l of LANGS) {
  fs.writeFileSync(path.join(root, "locales", `${l}.json`), JSON.stringify({ ios: plist[l] }, null, 2) + "\n");
}

// ---- Widget String Catalog ----
// SwiftUI looks a string literal up by its English text, so the key is the English string.
// Interpolated values become %@ (Swift's own format), e.g. "SYNC //%@".
const swiftKey = (en) => en.replace(/\{\{\w+\}\}/g, "%@");
const catalog = { sourceLanguage: "en", strings: {}, version: "1.0" };
for (const id of Object.keys(strings).filter((k) => k.startsWith("native.widget.")).sort()) {
  const s = strings[id];
  const key = swiftKey(s.en);
  const count = (t) => (t.match(/%@/g) || []).length;
  const localizations = {};
  for (const l of LANGS) {
    const v = s[l] && swiftKey(s[l]);
    if (!v) { problems.push(`${id} has no ${l}`); continue; }
    if (count(v) !== count(key)) problems.push(`${id} (${l}) has a different number of placeholders than English`);
    localizations[l] = { stringUnit: { state: "translated", value: v } };
  }
  catalog.strings[key] = { extractionState: "manual", localizations };
}
fs.writeFileSync(path.join(root, "targets/widget/Localizable.xcstrings"), JSON.stringify(catalog, null, 2) + "\n");

if (problems.length) {
  console.error("Problems:\n- " + problems.join("\n- "));
  process.exit(1);
}
console.log(`Wrote locales/{${LANGS.join(",")}}.json (${Object.keys(plist["pt-BR"]).length} plist keys each) and Localizable.xcstrings (${Object.keys(catalog.strings).length} widget strings).`);

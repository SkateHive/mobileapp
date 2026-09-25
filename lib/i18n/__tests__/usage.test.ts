import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import en from "../locales/en.json";

const ROOT = join(__dirname, "..", "..", "..");
const catalog = en as Record<string, string>;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (name === "node_modules" || name === "__tests__" || name === "i18n") continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

const files = ["app", "components", "lib"].flatMap((d) => walk(join(ROOT, d)));
const sources = files.map((f) => ({ file: f.slice(ROOT.length + 1), text: readFileSync(f, "utf8") }));

// t("literal.key") and t('literal.key'), with or without variables.
const CALL = /(?<![\w.$])t\(\s*(["'])([a-z][\w.]*)\1/g;

test("every t('literal') call points at a key that exists in en.json", () => {
  const missing: string[] = [];
  for (const { file, text } of sources) {
    for (const m of text.matchAll(CALL)) {
      const key = m[2];
      const exists = key in catalog || `${key}.other` in catalog;
      if (!exists) missing.push(`${file}: t("${key}")`);
    }
  }
  assert.deepEqual(missing, []);
});

test("no catalog key is unreferenced", () => {
  const all = sources.map((s) => s.text).join("\n");
  const unused = Object.keys(catalog).filter((key) => {
    if (key.startsWith("native.")) return false; // read by the native string generator, not by t()
    const base = key.replace(/\.(one|other)$/, "");
    if (all.includes(`"${base}"`) || all.includes(`'${base}'`) || all.includes(`"${key}"`)) return false;
    // dynamic keys built from a prefix: t(`prefix.${x}`)
    for (const m of all.matchAll(/`([a-z][\w.]*?)\$\{/g)) if (base.startsWith(m[1])) return false;
    return true;
  });
  assert.deepEqual(unused, []);
});

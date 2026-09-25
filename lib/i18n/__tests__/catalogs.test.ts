import { test } from "node:test";
import assert from "node:assert/strict";
import en from "../locales/en.json";
import ptBR from "../locales/pt-BR.json";
import ptPT from "../locales/pt-PT.json";
import es from "../locales/es.json";

const CATALOGS: Record<string, Record<string, string>> = { "pt-BR": ptBR, "pt-PT": ptPT, es };
// Every shipped locale must cover every English key.
const COMPLETE = ["pt-BR", "pt-PT", "es"];

const vars = (s: string) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();

test("every translated key exists in English and keeps the same {{variables}}", () => {
  const problems: string[] = [];
  for (const [locale, catalog] of Object.entries(CATALOGS)) {
    for (const [key, value] of Object.entries(catalog)) {
      const source = (en as Record<string, string>)[key];
      if (source === undefined) problems.push(`${locale}: "${key}" is not in en.json`);
      else if (vars(source).join() !== vars(value).join()) problems.push(`${locale}: "${key}" variables ${vars(value)} != ${vars(source)}`);
    }
  }
  assert.deepEqual(problems, []);
});

test("required locales cover every English key", () => {
  for (const locale of COMPLETE) {
    const missing = Object.keys(en).filter((k) => !(k in CATALOGS[locale]));
    assert.deepEqual(missing, [], `${locale} is missing ${missing.length} keys`);
  }
});

test("plural keys come in .one/.other pairs", () => {
  const all: Record<string, Record<string, string>> = { en, ...CATALOGS };
  for (const [locale, catalog] of Object.entries(all)) {
    for (const key of Object.keys(catalog)) {
      if (key.endsWith(".one")) assert.ok(`${key.slice(0, -4)}.other` in catalog, `${locale}: ${key} has no .other`);
      if (key.endsWith(".other")) assert.ok(`${key.slice(0, -6)}.one` in catalog, `${locale}: ${key} has no .one`);
    }
  }
});

test("no catalog value is empty", () => {
  const all: Record<string, Record<string, string>> = { en, ...CATALOGS };
  for (const [locale, catalog] of Object.entries(all)) {
    for (const [key, value] of Object.entries(catalog)) assert.ok(value.trim().length > 0, `${locale}: ${key} is empty`);
  }
});

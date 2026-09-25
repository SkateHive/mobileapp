import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveLocale } from "../resolve";
import { pluralCategory } from "../plural";
import { createTranslator, interpolate } from "../translate";
import { formatDecimal } from "../format";

test("resolveLocale: Brazilian and unmarked Portuguese are pt-BR, other regions pt-PT", () => {
  assert.equal(resolveLocale(["pt-BR"]), "pt-BR");
  assert.equal(resolveLocale(["pt"]), "pt-BR");
  assert.equal(resolveLocale(["pt_BR"]), "pt-BR");
  assert.equal(resolveLocale(["pt-Latn-BR"]), "pt-BR");
  assert.equal(resolveLocale(["pt-PT"]), "pt-PT");
  assert.equal(resolveLocale(["pt-AO"]), "pt-PT");
  assert.equal(resolveLocale(["pt-MZ"]), "pt-PT");
  assert.equal(resolveLocale(["pt-US"]), "pt-BR", "a Brazilian with a US region is still pt-BR");
  assert.equal(resolveLocale(["pt-CA"]), "pt-BR");
});

test("resolveLocale: every Spanish region is es, English and unknown fall back to en", () => {
  assert.equal(resolveLocale(["es"]), "es");
  assert.equal(resolveLocale(["es-419"]), "es");
  assert.equal(resolveLocale(["es-MX"]), "es");
  assert.equal(resolveLocale(["es_ES"]), "es");
  assert.equal(resolveLocale(["en-US"]), "en");
  assert.equal(resolveLocale(["fr-FR"]), "en");
  assert.equal(resolveLocale([]), "en");
  assert.equal(resolveLocale(["", "??"]), "en");
});

test("resolveLocale: the first supported language in the preference list wins", () => {
  assert.equal(resolveLocale(["fr-FR", "pt-BR", "en-US"]), "pt-BR");
  assert.equal(resolveLocale(["en-US", "pt-BR"]), "en");
  assert.equal(resolveLocale(["de", "es-MX"]), "es");
});

test("pluralCategory: only exactly 1 is singular, including pt-BR", () => {
  assert.equal(pluralCategory("pt-BR", 0), "other");
  assert.equal(pluralCategory("pt-BR", 1), "one");
  assert.equal(pluralCategory("pt-BR", 2), "other");
  assert.equal(pluralCategory("pt-PT", 0), "other");
  assert.equal(pluralCategory("pt-PT", 1), "one");
  assert.equal(pluralCategory("es", 1), "one");
  assert.equal(pluralCategory("es", 0), "other");
  assert.equal(pluralCategory("en", 1), "one");
  assert.equal(pluralCategory("en", 5), "other");
});

test("interpolate replaces known variables and leaves unknown ones visible", () => {
  assert.equal(interpolate("Hi {{name}}, {{n}} new", { name: "@fred", n: 3 }), "Hi @fred, 3 new");
  assert.equal(interpolate("Hi {{name}} {{missing}}", { name: "a" }), "Hi a {{missing}}");
  assert.equal(interpolate("no vars", {}), "no vars");
});

test("createTranslator falls back pt-PT -> pt-BR -> en -> the key itself", () => {
  const missing: string[] = [];
  const t = createTranslator(
    { en: { a: "A en", b: "B en", c: "C en" }, "pt-BR": { a: "A br", b: "B br" }, "pt-PT": { a: "A pt" } },
    "pt-PT",
    (key) => missing.push(key),
  );
  assert.equal(t("a"), "A pt");
  assert.equal(t("b"), "B br");
  assert.equal(t("c"), "C en");
  assert.equal(t("zzz"), "zzz");
  assert.deepEqual(missing, ["zzz"]);
});

test("createTranslator picks .one/.other by count and interpolates it", () => {
  const catalogs = {
    en: { "votes.one": "{{count}} vote", "votes.other": "{{count}} votes", plain: "{{count}} things" },
    "pt-BR": { "votes.one": "{{count}} voto", "votes.other": "{{count}} votos" },
  };
  const en = createTranslator(catalogs, "en");
  assert.equal(en("votes", { count: 1 }), "1 vote");
  assert.equal(en("votes", { count: 4 }), "4 votes");
  assert.equal(en("plain", { count: 4 }), "4 things", "no plural forms: the base key is used");
  const br = createTranslator(catalogs, "pt-BR");
  assert.equal(br("votes", { count: 0 }), "0 votos");
  assert.equal(br("votes", { count: 2 }), "2 votos");
});

test("formatDecimal writes a comma in Portuguese and Spanish", () => {
  assert.equal(formatDecimal(1.2, 1, "en"), "1.2");
  assert.equal(formatDecimal(1.2, 1, "pt-BR"), "1,2");
  assert.equal(formatDecimal(1.25, 2, "pt-PT"), "1,25");
  assert.equal(formatDecimal(3, 1, "es"), "3,0");
});

import type { Locale } from "./resolve";

export type PluralCategory = "one" | "other";

/**
 * The plural rule for whole numbers in the locales we ship (CLDR):
 * "one" is only for exactly 1 in all four locales. (CLDR also counts 0 as singular in
 * Brazilian Portuguese, but nobody writes "0 voto" in an interface: it reads as "0 votos".)
 */
export function pluralCategory(locale: Locale, n: number): PluralCategory {
  const a = Math.abs(n);
  void locale;
  return a === 1 ? "one" : "other";
}

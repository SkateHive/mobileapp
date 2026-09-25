// Pure translator: no React Native, no JSON imports, so it is testable under Node
// and the catalogs are injected by lib/i18n/index.ts.
import { pluralCategory } from "./plural";
import type { Locale } from "./resolve";

export type Catalog = Record<string, string>;
export type Catalogs = Partial<Record<Locale, Catalog>>;
export type Vars = Record<string, string | number>;
export type TFunction = (key: string, vars?: Vars) => string;

/** Which catalogs to try, in order. Portuguese from Portugal may borrow from Brazil before English. */
export const FALLBACKS: Record<Locale, readonly Locale[]> = {
  en: ["en"],
  "pt-BR": ["pt-BR", "en"],
  "pt-PT": ["pt-PT", "pt-BR", "en"],
  es: ["es", "en"],
};

export function interpolate(template: string, vars: Vars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole,
  );
}

export function createTranslator(
  catalogs: Catalogs,
  locale: Locale,
  onMissing?: (key: string, locale: Locale) => void,
): TFunction {
  const chain = FALLBACKS[locale];
  const lookup = (key: string): string | undefined => {
    for (const l of chain) {
      const value = catalogs[l]?.[key];
      if (value !== undefined) return value;
    }
    return undefined;
  };

  return (key, vars) => {
    let resolved = key;
    // `t("x", { count })` uses "x.one" / "x.other" when those exist.
    if (vars && typeof vars.count === "number") {
      const specific = `${key}.${pluralCategory(locale, vars.count)}`;
      if (lookup(specific) !== undefined) resolved = specific;
      else if (lookup(`${key}.other`) !== undefined) resolved = `${key}.other`;
    }
    const value = lookup(resolved);
    if (value === undefined) {
      onMissing?.(key, locale);
      return key;
    }
    return vars ? interpolate(value, vars) : value;
  };
}

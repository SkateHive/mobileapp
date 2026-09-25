// The app-facing entry: picks the locale once at startup and exposes `t`.
// The device language can only change while the app is closed (iOS and Android both
// restart the app on a language change), so a module-level constant is enough.
import { I18nManager, Platform, Settings } from "react-native";
import { createT } from "./core";
import { formatDecimal as formatDecimalFor } from "./format";
import { resolveLocale, type Locale } from "./resolve";
import type { TFunction, Vars } from "./translate";

export type { Locale, TFunction, Vars };

function deviceTags(): string[] {
  const tags: string[] = [];
  if (Platform.OS === "ios") {
    try {
      // The user's language list, best first ("pt-BR", "es-419"...). Settings.get is the public
      // way to read it and works with the new architecture.
      const languages = Settings.get("AppleLanguages") as unknown;
      if (Array.isArray(languages)) tags.push(...(languages as string[]));
    } catch {
      // Fall through to the locale identifier below.
    }
  }
  try {
    const id = I18nManager.getConstants().localeIdentifier;
    if (id) tags.push(id);
  } catch {
    // Older runtimes do not expose it.
  }
  try {
    const id = Intl.DateTimeFormat().resolvedOptions().locale;
    if (id) tags.push(id);
  } catch {
    // Intl is optional.
  }
  return tags;
}

export const locale: Locale = resolveLocale(deviceTags());

const warned = new Set<string>();

export const t: TFunction = createT(
  locale,
  __DEV__
    ? (key, loc) => {
        const id = `${loc}:${key}`;
        if (warned.has(id)) return;
        warned.add(id);
        console.warn(`[i18n] missing key "${key}" for ${loc}`);
      }
    : undefined,
);

/** Fixed number of decimals with the locale's separator ("1,2" in Portuguese and Spanish). */
export function formatDecimal(value: number, digits: number): string {
  return formatDecimalFor(value, digits, locale);
}

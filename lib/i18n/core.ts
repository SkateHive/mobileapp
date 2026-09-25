// The catalogs plus a factory, with no React Native import. Pure modules (the upload
// state machine, the notifications merge) and the Node tests import this, and take a
// `t` as a parameter; the app gets its device-locale `t` from lib/i18n/index.ts.
import en from "./locales/en.json";
import ptBR from "./locales/pt-BR.json";
import ptPT from "./locales/pt-PT.json";
import es from "./locales/es.json";
import type { Locale } from "./resolve";
import { createTranslator, type Catalogs, type TFunction } from "./translate";

export const catalogs: Catalogs = { en, "pt-BR": ptBR, "pt-PT": ptPT, es };

export function createT(locale: Locale, onMissing?: (key: string, locale: Locale) => void): TFunction {
  return createTranslator(catalogs, locale, onMissing);
}

/** English translator, for tests and for defaults in pure modules. */
export const enT: TFunction = createT("en");

export type { Locale, TFunction };

// Pure number helpers. Portuguese and Spanish write the decimal separator as a comma,
// so "1.2 km" has to become "1,2 km"; every place that printed a decimal goes through here.
import type { Locale } from "./resolve";

/** `digits` is the exact number of decimals. */
export function formatDecimal(value: number, digits: number, locale: Locale): string {
  const fixed = value.toFixed(digits);
  return locale === "en" ? fixed : fixed.replace(".", ",");
}

// Pure: picks one of our four locales from the device's language preferences.
// No React Native imports, so `pnpm test` runs it under Node.

export type Locale = "en" | "pt-BR" | "pt-PT" | "es";

export const LOCALES: readonly Locale[] = ["en", "pt-BR", "pt-PT", "es"];

function parse(tag: string): { lang: string; region: string | null } {
  const parts = tag.replace(/_/g, "-").split("-");
  const lang = (parts[0] ?? "").toLowerCase();
  let region: string | null = null;
  for (let i = 1; i < parts.length; i++) {
    // A region is two letters ("BR") or three digits ("419"); scripts ("Latn") are four letters.
    if (/^[A-Za-z]{2}$/.test(parts[i])) {
      region = parts[i].toUpperCase();
      break;
    }
    if (/^\d{3}$/.test(parts[i])) {
      region = parts[i];
      break;
    }
  }
  return { lang, region };
}

// Portuguese-speaking countries other than Brazil. Any other region on a Portuguese tag (a
// Brazilian living in the US reports "pt-US") is still Brazilian Portuguese.
const PT_PT_REGIONS = new Set(["PT", "AO", "MZ", "CV", "GW", "ST", "TL", "MO", "GQ"]);

/**
 * First tag in the user's preference order that we support wins, the way the OS
 * itself resolves app languages. Portuguese from Portugal, Angola, Mozambique and the other
 * Portuguese-speaking countries is pt-PT; everything else Portuguese is pt-BR.
 * Spanish is one catalog for every region. Anything else falls back to English.
 */
export function resolveLocale(tags: readonly string[]): Locale {
  for (const tag of tags) {
    const { lang, region } = parse(tag);
    if (lang === "pt") return region && PT_PT_REGIONS.has(region) ? "pt-PT" : "pt-BR";
    if (lang === "es") return "es";
    if (lang === "en") return "en";
  }
  return "en";
}

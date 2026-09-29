// Locale-aware Faker helper. We map a locale string (e.g. "en_US", "en_GB",
// "de", "fr") to a Faker instance so names, cities, phones match the country.
import { allFakers, faker } from "@faker-js/faker";

// Default to US English.
export function getFaker(locale?: string) {
  if (!locale) return faker;
  // Try exact match (e.g. "en_US"), then language-only (e.g. "en").
  const key = locale.replace("-", "_");
  if (allFakers[key as keyof typeof allFakers]) {
    return allFakers[key as keyof typeof allFakers];
  }
  const lang = key.split("_")[0];
  if (allFakers[lang as keyof typeof allFakers]) {
    return allFakers[lang as keyof typeof allFakers];
  }
  return faker; // fallback to en
}

// Countries with their dialing code + currency, used to make phone numbers and
// money depend on the chosen country/locale (a realism requirement).
export const COUNTRY_INFO: Record<
  string,
  { code: string; currency: string; dial: string }
> = {
  US: { code: "US", currency: "USD", dial: "+1" },
  GB: { code: "GB", currency: "GBP", dial: "+44" },
  DE: { code: "DE", currency: "EUR", dial: "+49" },
  FR: { code: "FR", currency: "EUR", dial: "+33" },
  PK: { code: "PK", currency: "PKR", dial: "+92" },
  IN: { code: "IN", currency: "INR", dial: "+91" },
};

export function localeCountry(locale: string): string {
  // "en_PK" -> "PK", "en_US" -> "US", "de" -> "DE"
  const key = locale.replace("-", "_").toUpperCase();
  if (COUNTRY_INFO[key]) return key;
  // Try the country part after the language (e.g. "EN_PK" -> "PK").
  const parts = key.split("_");
  if (parts.length > 1) {
    const country = parts[parts.length - 1];
    if (COUNTRY_INFO[country]) return country;
  }
  // Common language-only -> country defaults.
  const langDefaults: Record<string, string> = {
    DE: "DE", FR: "FR", ES: "ES", IT: "IT", NL: "NL",
    JA: "JP", KO: "KR", ZH: "CN", AR: "SA", TR: "TR",
    RU: "RU", PL: "PL", SV: "SE", PT: "BR",
  };
  const lang = parts[0];
  if (langDefaults[lang]) return langDefaults[lang];
  return "US";
}

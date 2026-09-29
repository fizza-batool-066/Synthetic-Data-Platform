// Expanded country/locale data for context-aware generation.
// Each country entry carries everything needed to make generated data agree:
// currency + symbol, dial code, date format, ID number format, tax label, and
// the Faker locale to use for names/cities/addresses.
//
// For countries Faker doesn't cover (e.g. Pakistan), we pair the entry with a
// custom data module (see pakistan.ts) and the generators switch to it.

export interface CountryInfo {
  code: string; // ISO 3166-1 alpha-2, e.g. "PK"
  name: string; // display name
  locale: string; // Faker locale, e.g. "en_PK"
  currency: string; // ISO 4217 code, e.g. "PKR"
  currencySymbol: string; // e.g. "Rs"
  dial: string; // dialing code, e.g. "+92"
  dateFormat: string; // e.g. "DD-MM-YYYY"
  idFormat: string; // a description of the national ID format
  idPrefix?: string; // optional prefix for IDs (e.g. "Pak" for Pakistan CNIC-ish)
  taxLabel: string; // e.g. "GST", "VAT", "Sales Tax"
  taxRate: number; // default tax rate as a fraction (0.08 = 8%)
  // Phone format hint used by the generator for non-Faker locales.
  phoneStyle: "pk" | "in" | "ae" | "gb" | "us" | "generic";
}

// All supported countries. Adding one here automatically makes it available in
// the Country dropdown and detectable from prompts.
export const COUNTRIES: Record<string, CountryInfo> = {
  US: { code: "US", name: "United States", locale: "en_US", currency: "USD", currencySymbol: "$", dial: "+1", dateFormat: "MM/DD/YYYY", idFormat: "SSN (XXX-XX-XXXX)", taxLabel: "Sales Tax", taxRate: 0.08, phoneStyle: "us" },
  GB: { code: "GB", name: "United Kingdom", locale: "en_GB", currency: "GBP", currencySymbol: "£", dial: "+44", dateFormat: "DD/MM/YYYY", idFormat: "NINO (XX-XXXXXX-X)", taxLabel: "VAT", taxRate: 0.2, phoneStyle: "gb" },
  PK: { code: "PK", name: "Pakistan", locale: "en_PK", currency: "PKR", currencySymbol: "Rs", dial: "+92", dateFormat: "DD-MM-YYYY", idFormat: "CNIC (XXXXX-XXXXXXX-X)", idPrefix: "PK", taxLabel: "GST", taxRate: 0.17, phoneStyle: "pk" },
  IN: { code: "IN", name: "India", locale: "en_IN", currency: "INR", currencySymbol: "₹", dial: "+91", dateFormat: "DD-MM-YYYY", idFormat: "Aadhaar (XXXX XXXX XXXX)", idPrefix: "IN", taxLabel: "GST", taxRate: 0.18, phoneStyle: "in" },
  AE: { code: "AE", name: "United Arab Emirates", locale: "ar_AE", currency: "AED", currencySymbol: "AED", dial: "+971", dateFormat: "DD-MM-YYYY", idFormat: "EID (784-XXXX-XXXXXXX-X)", idPrefix: "AE", taxLabel: "VAT", taxRate: 0.05, phoneStyle: "ae" },
  DE: { code: "DE", name: "Germany", locale: "de", currency: "EUR", currencySymbol: "€", dial: "+49", dateFormat: "DD.MM.YYYY", idFormat: "Steuer-ID (XX-XXX-XXXX)", taxLabel: "MwSt", taxRate: 0.19, phoneStyle: "generic" },
  FR: { code: "FR", name: "France", locale: "fr", currency: "EUR", currencySymbol: "€", dial: "+33", dateFormat: "DD/MM/YYYY", idFormat: "INSEE (X-XX-XX-XX-XXX-XXX)", taxLabel: "TVA", taxRate: 0.2, phoneStyle: "generic" },
  ES: { code: "ES", name: "Spain", locale: "es", currency: "EUR", currencySymbol: "€", dial: "+34", dateFormat: "DD/MM/YYYY", idFormat: "DNI (XXXXXXXX-X)", taxLabel: "IVA", taxRate: 0.21, phoneStyle: "generic" },
  IT: { code: "IT", name: "Italy", locale: "it", currency: "EUR", currencySymbol: "€", dial: "+39", dateFormat: "DD/MM/YYYY", idFormat: "Codice Fiscale", taxLabel: "IVA", taxRate: 0.22, phoneStyle: "generic" },
  NL: { code: "NL", name: "Netherlands", locale: "nl", currency: "EUR", currencySymbol: "€", dial: "+31", dateFormat: "DD-MM-YYYY", idFormat: "BSN (XXXXXXXXX)", taxLabel: "BTW", taxRate: 0.21, phoneStyle: "generic" },
  JP: { code: "JP", name: "Japan", locale: "ja", currency: "JPY", currencySymbol: "¥", dial: "+81", dateFormat: "YYYY-MM-DD", idFormat: "My Number (XXXX-XXXX-XXXX)", taxLabel: "Consumption Tax", taxRate: 0.1, phoneStyle: "generic" },
  KR: { code: "KR", name: "South Korea", locale: "ko", currency: "KRW", currencySymbol: "₩", dial: "+82", dateFormat: "YYYY-MM-DD", idFormat: "RRN (XXXXXX-XXXXXXX)", taxLabel: "VAT", taxRate: 0.1, phoneStyle: "generic" },
  CN: { code: "CN", name: "China", locale: "zh_CN", currency: "CNY", currencySymbol: "¥", dial: "+86", dateFormat: "YYYY-MM-DD", idFormat: "National ID (XXXXXXXXXXXXXXXXXX)", taxLabel: "VAT", taxRate: 0.13, phoneStyle: "generic" },
  SA: { code: "SA", name: "Saudi Arabia", locale: "ar", currency: "SAR", currencySymbol: "SAR", dial: "+966", dateFormat: "DD-MM-YYYY", idFormat: "Iqama (XXXXXXXXX)", taxLabel: "VAT", taxRate: 0.15, phoneStyle: "generic" },
  TR: { code: "TR", name: "Turkey", locale: "tr", currency: "TRY", currencySymbol: "₺", dial: "+90", dateFormat: "DD.MM.YYYY", idFormat: "T.C. Kimlik (XXXXXXXXXXX)", taxLabel: "KDV", taxRate: 0.2, phoneStyle: "generic" },
  RU: { code: "RU", name: "Russia", locale: "ru", currency: "RUB", currencySymbol: "₽", dial: "+7", dateFormat: "DD.MM.YYYY", idFormat: "INN (XXXXXXXXXX)", taxLabel: "VAT", taxRate: 0.2, phoneStyle: "generic" },
  BR: { code: "BR", name: "Brazil", locale: "pt_BR", currency: "BRL", currencySymbol: "R$", dial: "+55", dateFormat: "DD/MM/YYYY", idFormat: "CPF (XXX.XXX.XXX-XX)", taxLabel: "ICMS", taxRate: 0.17, phoneStyle: "generic" },
  AU: { code: "AU", name: "Australia", locale: "en_AU", currency: "AUD", currencySymbol: "A$", dial: "+61", dateFormat: "DD/MM/YYYY", idFormat: "TFN (XXX-XXX-XXX)", taxLabel: "GST", taxRate: 0.1, phoneStyle: "generic" },
  CA: { code: "CA", name: "Canada", locale: "en_CA", currency: "CAD", currencySymbol: "C$", dial: "+1", dateFormat: "YYYY-MM-DD", idFormat: "SIN (XXX-XXX-XXX)", taxLabel: "GST", taxRate: 0.05, phoneStyle: "us" },
  SE: { code: "SE", name: "Sweden", locale: "sv", currency: "SEK", currencySymbol: "kr", dial: "+46", dateFormat: "YYYY-MM-DD", idFormat: "Personnummer (YYYYMMDD-XXXX)", taxLabel: "Moms", taxRate: 0.25, phoneStyle: "generic" },
  PL: { code: "PL", name: "Poland", locale: "pl", currency: "PLN", currencySymbol: "zł", dial: "+48", dateFormat: "DD.MM.YYYY", idFormat: "PESEL (XXXXXXXXXXX)", taxLabel: "VAT", taxRate: 0.23, phoneStyle: "generic" },
};

// Lookup by country code, locale string, or name keyword.
export function getCountry(input?: string): CountryInfo {
  if (!input) return COUNTRIES.US;
  const k = input.replace("-", "_").toUpperCase();
  // Exact code match (e.g. "PK", "en_PK" -> "PK")
  if (COUNTRIES[k]) return COUNTRIES[k];
  const parts = k.split("_");
  const country = parts[parts.length - 1];
  if (COUNTRIES[country]) return COUNTRIES[country];
  // Language-only -> default country.
  const langDefaults: Record<string, string> = {
    DE: "DE", FR: "FR", ES: "ES", IT: "IT", NL: "NL",
    JA: "JP", KO: "KR", ZH: "CN", AR: "SA", TR: "TR",
    RU: "RU", PL: "PL", SV: "SE", PT: "BR", EN: "US",
  };
  const lang = parts[0];
  if (langDefaults[lang] && COUNTRIES[langDefaults[lang]]) return COUNTRIES[langDefaults[lang]];
  return COUNTRIES.US;
}

// Backwards-compatible exports for code that still uses the old shape.
export const COUNTRY_INFO: Record<string, { code: string; currency: string; dial: string }> =
  Object.fromEntries(
    Object.entries(COUNTRIES).map(([k, v]) => [k, { code: v.code, currency: v.currency, dial: v.dial }]),
  );

export function localeCountry(locale: string): string {
  return getCountry(locale).code;
}

// Format a date according to a country's date format.
export function formatDate(d: Date, fmt: string): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const yy = String(yyyy).slice(-2);
  switch (fmt) {
    case "DD-MM-YYYY": return `${dd}-${mm}-${yyyy}`;
    case "DD/MM/YYYY": return `${dd}/${mm}/${yyyy}`;
    case "DD.MM.YYYY": return `${dd}.${mm}.${yyyy}`;
    case "MM/DD/YYYY": return `${mm}/${dd}/${yyyy}`;
    case "YYYY-MM-DD": return `${yyyy}-${mm}-${dd}`;
    case "YYYY/MM/DD": return `${yyyy}/${mm}/${dd}`;
    default: return `${yyyy}-${mm}-${dd}`;
  }
}

// Generate a national ID number matching the country's format description.
export function formatNationalId(rng: () => number, country: CountryInfo): string {
  const digits = (n: number) => Array.from({ length: n }, () => Math.floor(rng() * 10)).join("");
  switch (country.code) {
    case "US": return `${digits(3)}-${digits(2)}-${digits(4)}`; // SSN
    case "GB": return `${letters(rng, 2)}${digits(6)}${letters(rng, 1)}`; // NINO
    case "PK": return `${digits(5)}-${digits(7)}-${digits(1)}`; // CNIC
    case "IN": return `${digits(4)} ${digits(4)} ${digits(4)}`; // Aadhaar
    case "AE": return `784-${digits(4)}-${digits(7)}-${digits(1)}`; // EID
    case "DE": return `${digits(2)}-${digits(3)}-${digits(4)}`; // Steuer-ID
    case "FR": return `${digits(1)} ${digits(2)} ${digits(2)} ${digits(2)} ${digits(3)} ${digits(3)}`; // INSEE
    case "ES": return `${digits(8)}-${letters(rng, 1)}`; // DNI
    case "IT": return `${letters(rng, 6)}${digits(2)}${letters(rng, 1)}${digits(3)}${letters(rng, 1)}`; // Codice Fiscale-ish
    case "NL": return `${digits(9)}`; // BSN
    case "JP": return `${digits(4)}-${digits(4)}-${digits(4)}`; // My Number
    case "KR": return `${digits(6)}-${digits(7)}`; // RRN
    case "CN": return `${digits(18)}`;
    case "SA": return `${digits(9)}`;
    case "TR": return `${digits(11)}`;
    case "RU": return `${digits(10)}`;
    case "BR": return `${digits(3)}.${digits(3)}.${digits(3)}-${digits(2)}`; // CPF
    case "AU": return `${digits(3)} ${digits(3)} ${digits(3)}`; // TFN
    case "CA": return `${digits(3)}-${digits(3)}-${digits(3)}`; // SIN
    case "SE": return `${digits(8)}-${digits(4)}`; // Personnummer
    case "PL": return `${digits(11)}`; // PESEL
    default: return digits(10);
  }
}

function letters(rng: () => number, n: number): string {
  const A = 65;
  return Array.from({ length: n }, () => String.fromCharCode(A + Math.floor(rng() * 26))).join("");
}

// List of country options for the dropdown UI.
export const COUNTRY_OPTIONS = Object.values(COUNTRIES).map((c) => ({
  code: c.code,
  name: c.name,
  currency: c.currency,
  symbol: c.currencySymbol,
  dial: c.dial,
  flag: flagEmoji(c.code),
}));

function flagEmoji(code: string): string {
  // Convert ISO code to regional indicator symbols.
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCharCode(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

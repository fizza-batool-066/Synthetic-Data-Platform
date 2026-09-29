// Context detection: read a natural-language prompt and detect country,
// industry, language/script, and special conditions. This powers the
// "context-aware and location-aware" generation feature.
//
// Detection is keyword-based (fast, deterministic, no AI needed). The AI
// prompt mode can also use these helpers to override the user's dropdowns.

export interface DetectedContext {
  countries: { code: string; share: number }[]; // shares sum to 1
  industry: string; // "hospital" | "university" | "bank" | "shop" | "iot" | "employees" | "generic"
  language?: string; // detected language hint, e.g. "urdu", "arabic"
  specialConditions: string[]; // e.g. "only 10% girls", "late payers", "20% more pending"
  rowCount?: number; // if the prompt mentions a row count
  femalePct?: number; // if the prompt mentions a female percentage
  notes: string[]; // human-readable detection notes for the summary
}

// Country keyword -> ISO code. Order matters: more specific phrases first.
const COUNTRY_KEYWORDS: { code: string; words: string[] }[] = [
  { code: "PK", words: ["pakistan", "pakistani", "karachi", "lahore", "islamabad", "peshawar", "rawalpindi", "multan", "pkr", "cnic", "+92", "rupee"] },
  { code: "IN", words: ["india", "indian", "mumbai", "delhi", "bangalore", "chennai", "kolkata", "hyderabad", "inr", "aadhaar", "+91", "rupee"] },
  { code: "AE", words: ["uae", "emirates", "dubai", "abu dhabi", "sharjah", "ajman", "aed", "eid", "+971", "dirham"] },
  { code: "GB", words: ["uk", "united kingdom", "britain", "england", "scotland", "wales", "london", "manchester", "birmingham", "gbp", "pound", "nino", "+44"] },
  { code: "US", words: ["usa", "america", "american", "united states", "new york", "california", "texas", "chicago", "florida", "usd", "dollar", "ssn", "+1"] },
  { code: "DE", words: ["germany", "german", "berlin", "munich", "hamburg", "frankfurt", "euro", "steuer", "+49"] },
  { code: "FR", words: ["france", "french", "paris", "lyon", "marseille", "toulouse", "insee", "+33"] },
  { code: "SA", words: ["saudi", "saudi arabia", "riyadh", "jeddah", "mecca", "medina", "sar", "iqama", "+966", "riyal"] },
  { code: "JP", words: ["japan", "japanese", "tokyo", "osaka", "kyoto", "jpy", "yen", "+81"] },
  { code: "CN", words: ["china", "chinese", "beijing", "shanghai", "guangzhou", "cny", "rmb", "yuan", "+86"] },
  { code: "TR", words: ["turkey", "turkish", "istanbul", "ankara", "izmir", "try", "lira", "+90"] },
  { code: "BR", words: ["brazil", "brazilian", "sao paulo", "rio", "salvador", "brl", "real", "+55"] },
  { code: "CA", words: ["canada", "canadian", "toronto", "vancouver", "montreal", "cad", "+1"] },
  { code: "AU", words: ["australia", "australian", "sydney", "melbourne", "brisbane", "aud", "+61"] },
];

// Industry keywords -> industry key.
const INDUSTRY_KEYWORDS: { key: string; words: string[] }[] = [
  { key: "hospital", words: ["hospital", "patient", "doctor", "medical", "clinic", "medicine", "nurse", "pharmacy", "diagnosis", "admission", "ward", "treatment", "bill"] },
  { key: "university", words: ["university", "student", "college", "course", "professor", "faculty", "enrollment", "gpa", "campus", "degree", "semester", "tuition", "fee"] },
  { key: "bank", words: ["bank", "account", "transaction", "deposit", "withdraw", "withdrawal", "loan", "balance", "statement", "credit", "debit", "atm", "transfer"] },
  { key: "shop", words: ["shop", "ecommerce", "e-commerce", "order", "cart", "customer", "product", "invoice", "store", "retail", "merchant", "purchase"] },
  { key: "iot", words: ["iot", "sensor", "device", "telemetry", "reading", "temperature", "humidity", "gateway", "firmware"] },
  { key: "employees", words: ["employee", "hr", "human resources", "staff", "payroll", "department", "salary", "designation", "onboarding"] },
];

// Language keywords -> language hint.
const LANGUAGE_KEYWORDS: { lang: string; words: string[] }[] = [
  { lang: "urdu", words: ["urdu", "roman urdu"] },
  { lang: "arabic", words: ["arabic", "arab"] },
  { lang: "hindi", words: ["hindi", "devanagari"] },
  { lang: "chinese", words: ["chinese", "mandarin", "simplified chinese"] },
  { lang: "spanish", words: ["spanish", "español"] },
];

// Main detection entry point.
export function detectContext(prompt: string): DetectedContext {
  const p = " " + prompt.toLowerCase() + " ";
  const notes: string[] = [];

  // 1) Countries — support mixed shares like "50% Pakistan, 50% UAE".
  const countries = detectCountries(p);
  if (countries.length === 0) {
    notes.push("No country mentioned — using a neutral default (United States).");
  } else if (countries.length > 1) {
    notes.push(`Mixed regions detected: ${countries.map((c) => `${c.code} ${Math.round(c.share * 100)}%`).join(", ")}.`);
  } else {
    notes.push(`Country detected: ${countries[0].code}.`);
  }

  // 2) Industry
  let industry = "generic";
  for (const ind of INDUSTRY_KEYWORDS) {
    if (ind.words.some((w) => p.includes(w))) {
      industry = ind.key;
      break;
    }
  }
  if (industry === "generic") {
    notes.push("No industry mentioned — using a generic customers dataset.");
  } else {
    notes.push(`Industry detected: ${industry}.`);
  }

  // 3) Language
  let language: string | undefined;
  for (const l of LANGUAGE_KEYWORDS) {
    if (l.words.some((w) => p.includes(w))) {
      language = l.lang;
      break;
    }
  }

  // 4) Special conditions
  const specialConditions: string[] = [];

  // Female percentage: "only 10% girls", "10% female", "90% male"
  let femalePct: number | undefined;
  const femaleMatch = p.match(/(\d+)\s*%\s*(girls?|female|women)/);
  const maleMatch = p.match(/(\d+)\s*%\s*(boys?|male|men)/);
  if (femaleMatch) {
    femalePct = parseInt(femaleMatch[1]);
    specialConditions.push(`Only ${femalePct}% female, as requested.`);
  } else if (maleMatch) {
    femalePct = 100 - parseInt(maleMatch[1]);
    specialConditions.push(`${parseInt(maleMatch[1])}% male (so ${femalePct}% female), as requested.`);
  }

  // Late payers / refunds / status conditions
  if (p.includes("late payer") || p.includes("late payment") || p.includes("more pending")) {
    specialConditions.push("Higher share of late/pending payments.");
  }
  if (p.includes("refund")) specialConditions.push("Refunds included in order statuses.");
  if (p.includes("high income") || p.includes("wealthy") || p.includes("rich")) {
    specialConditions.push("Higher-than-average income/salary range.");
  }
  if (p.includes("low income") || p.includes("poor")) {
    specialConditions.push("Lower-than-average income/salary range.");
  }
  if (p.includes("missing") || p.includes("empty values") || p.includes("null")) {
    specialConditions.push("Some missing values included for realism.");
  }
  if (p.includes("elderly") || p.includes("older") || p.includes("senior")) {
    specialConditions.push("Older age distribution (mean shifted up).");
  }
  if (p.includes("young")) {
    specialConditions.push("Younger age distribution.");
  }
  if (p.includes("city") && (p.includes("most from") || p.includes("urban"))) {
    specialConditions.push("Mostly city-dwelling records.");
  }

  // Row count: "1000 students", "1,000 rows", "500 records"
  let rowCount: number | undefined;
  const countMatch = prompt.match(/(\d[\d,]*)\s*(students?|rows?|records?|customers?|patients?|orders?|accounts?|entries|people)/i);
  if (countMatch) {
    rowCount = parseInt(countMatch[1].replace(/,/g, ""));
    if (rowCount > 0 && rowCount < 200000) {
      notes.push(`Row count requested: ${rowCount.toLocaleString()}.`);
    } else {
      rowCount = undefined;
    }
  }

  return { countries, industry, language, specialConditions, rowCount, femalePct, notes };
}

// Detect countries + shares. Handles "50% Pakistan, 50% UAE" and single mentions.
function detectCountries(p: string): { code: string; share: number }[] {
  const found: { code: string; pos: number; pct?: number }[] = [];
  for (const c of COUNTRY_KEYWORDS) {
    for (const w of c.words) {
      const idx = p.indexOf(w);
      if (idx >= 0) {
        // Look for a percentage right before the keyword (e.g. "50% pakistan").
        const before = p.slice(Math.max(0, idx - 12), idx);
        const pctMatch = before.match(/(\d+)\s*%/);
        found.push({ code: c.code, pos: idx, pct: pctMatch ? parseInt(pctMatch[1]) : undefined });
        break; // one hit per country
      }
    }
  }
  if (found.length === 0) return [];
  if (found.length === 1) return [{ code: found[0].code, share: 1 }];

  // Multiple countries: normalize shares so they sum to 1.
  const withPct = found.filter((f) => f.pct !== undefined);
  const withoutPct = found.filter((f) => f.pct === undefined);
  const totalPct = withPct.reduce((s, f) => s + (f.pct ?? 0), 0);
  const result: { code: string; share: number }[] = [];
  if (totalPct > 0) {
    for (const f of withPct) result.push({ code: f.code, share: (f.pct ?? 0) / 100 });
    const remaining = Math.max(0, 1 - totalPct / 100);
    const each = withoutPct.length ? remaining / withoutPct.length : 0;
    for (const f of withoutPct) result.push({ code: f.code, share: each });
    // If percentages didn't sum to 100, renormalize.
    const sum = result.reduce((s, r) => s + r.share, 0);
    if (sum > 0) for (const r of result) r.share = r.share / sum;
  } else {
    const each = 1 / found.length;
    for (const f of found) result.push({ code: f.code, share: each });
  }
  return result.sort((a, b) => b.share - a.share);
}

// Build the "what was detected" summary line for the summary box.
export function detectionSummary(ctx: DetectedContext): string {
  const parts: string[] = [];
  if (ctx.countries.length === 1) parts.push(`Country: ${ctx.countries[0].code}`);
  else if (ctx.countries.length > 1) parts.push(`Countries: ${ctx.countries.map((c) => `${c.code} ${Math.round(c.share * 100)}%`).join(", ")}`);
  if (ctx.industry !== "generic") parts.push(`Industry: ${ctx.industry}`);
  if (ctx.language) parts.push(`Language: ${ctx.language}`);
  if (ctx.femalePct !== undefined) parts.push(`Girls: ${ctx.femalePct}%`);
  return parts.join(". ") + (parts.length ? "." : "");
}

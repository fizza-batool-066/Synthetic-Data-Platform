// Column value generators. EachColumnType maps to a function that produces a
// single realistic value. Dependencies, missing values, outliers and typos are
// handled here so every column looks real, not random.
import type { Faker } from "@faker-js/faker";
import type { ColumnDef } from "./types";
import type { CountryInfo } from "./countries";
import { formatDate, formatNationalId, getCountry } from "./countries";
import {
  normal,
  uniform,
  uniformInt,
  clamp,
  round,
  weightedIndex,
  chance,
  typo,
  money,
} from "./random";
import {
  PK_MALE_FIRST_NAMES,
  PK_FEMALE_FIRST_NAMES,
  PK_LAST_NAMES,
  PK_CITIES,
  pick as pkPick,
} from "./pakistan";
import { localeNamePools, localePhone, pick as locPick } from "./locales-data";

export interface GenContext {
  rng: () => number;
  fk: Faker;
  locale: string;
  country: string; // ISO code, e.g. "PK"
  countryInfo: CountryInfo; // full country data (currency, dates, phones, IDs)
  currency: string;
  currencySymbol: string;
  dial: string;
  rowIndex: number;
  row: Record<string, unknown>; // values produced so far in the same row
  // For FK columns: the list of valid parent primary keys to reference.
  parentKeys?: unknown[];
  // For computed columns: helper data (e.g. items belonging to this order).
  computed?: Record<string, number>;
}

// A small realistic product catalog: name -> typical price range.
// Using a catalog makes price depend on the product (a realism requirement).
const PRODUCT_CATALOG: { name: string; min: number; max: number }[] = [
  { name: "Wireless Mouse", min: 8, max: 25 },
  { name: "Mechanical Keyboard", min: 60, max: 180 },
  { name: "USB-C Cable", min: 4, max: 15 },
  { name: "Laptop Stand", min: 20, max: 60 },
  { name: "Notebook", min: 2, max: 12 },
  { name: "Coffee Mug", min: 6, max: 20 },
  { name: "Headphones", min: 25, max: 220 },
  { name: "Webcam", min: 30, max: 120 },
  { name: "Desk Lamp", min: 18, max: 70 },
  { name: "Power Bank", min: 15, max: 60 },
  { name: "Phone Case", min: 5, max: 25 },
  { name: "Monitor", min: 120, max: 450 },
];

// A job -> salary band map so salary always matches the job (realism).
const JOB_SALARY: Record<string, [number, number]> = {
  "Software Engineer": [60000, 140000],
  "Teacher": [30000, 65000],
  "Nurse": [45000, 85000],
  "Accountant": [45000, 95000],
  "Designer": [40000, 95000],
  "Manager": [70000, 150000],
  "Chef": [28000, 70000],
  "Salesperson": [30000, 90000],
  "Doctor": [120000, 280000],
  "Electrician": [35000, 75000],
};
const JOBS = Object.keys(JOB_SALARY);

// Main entry point: generate one value for a column.
export function genValue(col: ColumnDef, ctx: GenContext): unknown {
  const { rng, fk, row, dial, currency } = ctx;

  // 1) Computed columns are filled later by the relational engine; skip here.
  if (col.formula) return null;

  // 2) Foreign key: pick a real parent primary key (relational integrity).
  if (col.refTable && ctx.parentKeys && ctx.parentKeys.length) {
    return ctx.parentKeys[uniformInt(rng, 0, ctx.parentKeys.length - 1)];
  }

  // 3) Missing values: a small, configurable chance the cell is empty.
  if (col.missingPct && chance(rng, col.missingPct / 100)) {
    return "";
  }

  // 4) Generate the base value by type.
  let value = baseValue(col, ctx);

  // 5) Outliers: a small chance of a rare extreme value (realistic mess).
  if (col.outlierPct && chance(rng, col.outlierPct / 100) && typeof value === "number") {
    const dir = chance(rng, 0.5) ? 1 : -1;
    value = round(Number(value) + dir * (col.std ?? (col.max ?? 100) * 0.4) * 4, col.decimals ?? 2);
    if (col.min !== undefined) value = Math.max(col.min, value);
    if (col.max !== undefined) value = Math.min(col.max, value);
  }

  // 6) Typos in text fields (realistic mess).
  if (col.typoPct && typeof value === "string" && value.length > 3 && chance(rng, col.typoPct / 100)) {
    value = typo(rng, value);
  }

  return value;
}

// Produce the base value for a column type (before mess is applied).
function baseValue(col: ColumnDef, ctx: GenContext): unknown {
  const { rng, fk, row, dial, currency } = ctx;

  switch (col.type) {
    case "id": {
      // sequential id, or uuid if format says so
      if (col.format === "uuid") return fk.string.uuid();
      return ctx.rowIndex + 1;
    }
    case "name":
      // Use locale-specific name pools (PK/IN/AE) where available; otherwise Faker.
      return localeName(ctx);
    case "firstName":
      return localeFirstName(ctx);
    case "lastName":
      return localeLastName(ctx);
    case "gender": {
      // weighted gender (defaults to ~50/50). weights let us skew, e.g. 10/90.
      const cats = col.categories ?? ["Female", "Male"];
      const w = col.weights ?? [0.5, 0.5];
      // If the weights are explicitly skewed (not ~50/50), the user requested a
      // specific ratio — use the weights to pick the gender so the ratio holds.
      // The name generator will then match the chosen gender from the row.
      const skewed = w.some((x) => x < 0.4 || x > 0.6);
      if (!skewed) {
        // Default ~50/50: infer the gender from the name if one was already set
        // (so name and gender always agree for locale-specific name pools).
        const inferred = inferGenderFromName(ctx, cats);
        if (inferred !== undefined) return inferred;
      }
      return cats[weightedIndex(rng, w)];
    }
    case "age": {
      // Realistic age: bell curve around the mean (default 21 for students).
      const mean = col.mean ?? 21;
      const std = col.std ?? 2.5;
      const min = col.min ?? 17;
      const max = col.max ?? 35;
      return Math.round(clamp(normal(rng, mean, std), min, max));
    }
    case "number": {
      return numByDist(col, ctx);
    }
    case "money": {
      // Log-normal-ish money: most amounts near the mean, a few large ones.
      const mean = col.mean ?? 100;
      const std = col.std ?? mean * 0.3;
      const v = clamp(normal(rng, mean, std), col.min ?? 1, col.max ?? mean * 5);
      return round(v, col.decimals ?? 2);
    }
    case "price": {
      // If a productName column exists in the row, match its catalog price.
      const prod = findInRow(row, "productName");
      if (prod) {
        const c = PRODUCT_CATALOG.find((p) => p.name === prod);
        if (c) return round(uniform(rng, c.min, c.max), 2);
      }
      // otherwise pick a random product's range
      const c = PRODUCT_CATALOG[uniformInt(rng, 0, PRODUCT_CATALOG.length - 1)];
      return round(uniform(rng, c.min, c.max), 2);
    }
    case "productName": {
      const c = PRODUCT_CATALOG[uniformInt(rng, 0, PRODUCT_CATALOG.length - 1)];
      return c.name;
    }
    case "quantity": {
      // most orders have 1-3 items, a few have more
      const q = Math.round(clamp(normal(rng, 2, 1.5), 1, 10));
      return q;
    }
    case "email": {
      // email derived from name if present, else random
      const name = findInRow(row, "name") || findInRow(row, "firstName");
      if (name) {
        return fk.internet
          .email({ firstName: String(name).split(" ")[0], lastName: String(name).split(" ")[1] })
          .toLowerCase();
      }
      return fk.internet.email().toLowerCase();
    }
    case "phone": {
      // Country-specific phone format (PK/IN/AE/GB/US).
      return localePhone(rng, ctx.countryInfo);
    }
    case "address":
      return fk.location.streetAddress({ useFullAddress: true });
    case "city": {
      // Locale-specific city pools (PK/IN/AE) where available; otherwise Faker.
      const cities = localeCities(ctx);
      return cities ? locPick(rng, cities) : fk.location.city();
    }
    case "country":
      return fk.location.country();
    case "postcode":
      return fk.location.zipCode();
    case "job": {
      // pick from our salary-backed job list so job<->salary stays consistent
      return JOBS[uniformInt(rng, 0, JOBS.length - 1)];
    }
    case "company":
      return fk.company.name();
    case "date": {
      const start = col.min ? new Date(col.min) : new Date("2022-01-01");
      const end = col.max ? new Date(col.max) : new Date("2024-12-31");
      const d = randomDateBiased(rng, start, end);
      // Format according to the country's date format (DD-MM-YYYY for PK/IN, MM/DD/YYYY for US, etc.)
      return formatDate(d, ctx.countryInfo.dateFormat);
    }
    case "datetime": {
      const start = col.min ? new Date(col.min) : new Date("2022-01-01");
      const end = col.max ? new Date(col.max) : new Date("2024-12-31");
      const d = randomDateBiased(rng, start, end);
      return formatDate(d, ctx.countryInfo.dateFormat) + " " + d.toISOString().slice(11, 19);
    }
    case "nationalId": {
      // Country-specific national ID (CNIC, Aadhaar, SSN, EID, etc.)
      return formatNationalId(rng, ctx.countryInfo);
    }
    case "category": {
      const cats = col.categories ?? ["A", "B", "C"];
      const w = col.weights ?? cats.map(() => 1 / cats.length);
      return cats[weightedIndex(rng, w)];
    }
    case "boolean": {
      const w = col.weights ?? [0.5, 0.5]; // [true, false]
      return weightedIndex(rng, w) === 0;
    }
    case "text":
      return fk.lorem.sentence({ min: 4, max: 10 });
    default:
      return null;
  }
}

// Draw a number using the chosen distribution (normal/bimodal/exponential/uniform).
function numByDist(col: ColumnDef, ctx: GenContext): number {
  const { rng } = ctx;
  const dist = col.distribution ?? "normal";
  const min = col.min ?? 0;
  const max = col.max ?? 100;
  const decimals = col.decimals ?? 0;
  let v: number;
  if (dist === "uniform") {
    v = uniform(rng, min, max);
  } else if (dist === "exponential") {
    // mostly small values, occasionally large
    const mean = col.mean ?? (min + max) / 2;
    v = min + (max - min) * Math.pow(rng(), 2.5);
    void mean;
  } else if (dist === "bimodal") {
    // two peaks (e.g. two student age clusters)
    const peak = chance(rng, 0.5) ? min + (max - min) * 0.3 : min + (max - min) * 0.7;
    v = normal(rng, peak, (max - min) * 0.08);
  } else {
    // normal: bell curve around the mean
    const mean = col.mean ?? (min + max) / 2;
    const std = col.std ?? (max - min) / 6;
    v = normal(rng, mean, std);
  }
  v = clamp(v, min, max);
  return round(v, decimals);
}

// Salary that depends on the job (relationship: job -> salary).
export function salaryForJob(job: string, rng: () => number): number {
  const band = JOB_SALARY[job] ?? [30000, 70000];
  return round(uniform(rng, band[0], band[1]), 0);
}

// A date biased toward weekends and month-ends (realistic business peaks).
function randomDateBiased(rng: () => number, start: Date, end: Date): Date {
  // try a few times to land on a "peakier" day
  let best = new Date(start.getTime() + rng() * (end.getTime() - start.getTime()));
  for (let i = 0; i < 3; i++) {
    const d = new Date(start.getTime() + rng() * (end.getTime() - start.getTime()));
    const day = d.getDate();
    const dow = d.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const isMonthEnd = day >= 25;
    // prefer weekends and month-ends ~30% of the time
    if ((isWeekend || isMonthEnd) && rng() < 0.3) {
      best = d;
      break;
    }
    best = d;
  }
  return best;
}

// Helper: find a value already generated in the same row by name/type.
function findInRow(row: Record<string, unknown>, type: string): unknown {
  // The generator stores values keyed by column name; we also tag rows with a
  // type hint when convenient. Simple search by key suffix.
  for (const key of Object.keys(row)) {
    if (key.toLowerCase().includes(type.toLowerCase())) return row[key];
  }
  return undefined;
}

// --- Locale-aware name/city helpers ---
// For countries Faker covers poorly (PK/IN/AE) we use curated name + city pools.
// For everything else we delegate to Faker with the right locale.

// Return the name pools for the current country (or null to use Faker).
function namePools(ctx: GenContext): { male: string[]; female: string[]; last: string[] } | null {
  switch (ctx.country) {
    case "PK":
      return { male: PK_MALE_FIRST_NAMES, female: PK_FEMALE_FIRST_NAMES, last: PK_LAST_NAMES };
    case "IN":
    case "AE": {
      const p = localeNamePools(ctx.countryInfo);
      if (p.male && p.female && p.last) return { male: p.male, female: p.female, last: p.last };
      return null;
    }
    default:
      return null;
  }
}

function localeCities(ctx: GenContext): string[] | null {
  if (ctx.country === "PK") return PK_CITIES;
  const p = localeNamePools(ctx.countryInfo);
  return p.cities;
}

// Build a full name from the locale pools (matching gender if present), or fall
// back to Faker for locales we don't curate.
function localeName(ctx: GenContext): string {
  const pools = namePools(ctx);
  if (!pools) return ctx.fk.person.fullName();
  const gender = rowGender(ctx);
  const first =
    gender === "female"
      ? locPick(ctx.rng, pools.female)
      : gender === "male"
        ? locPick(ctx.rng, pools.male)
        : locPick(ctx.rng, ctx.rng() < 0.5 ? pools.female : pools.male);
  const last = locPick(ctx.rng, pools.last);
  return `${first} ${last}`;
}

function localeFirstName(ctx: GenContext): string {
  const pools = namePools(ctx);
  if (!pools) return ctx.fk.person.firstName();
  const gender = rowGender(ctx);
  return gender === "female"
    ? locPick(ctx.rng, pools.female)
    : gender === "male"
      ? locPick(ctx.rng, pools.male)
      : locPick(ctx.rng, ctx.rng() < 0.5 ? pools.female : pools.male);
}

function localeLastName(ctx: GenContext): string {
  const pools = namePools(ctx);
  if (!pools) return ctx.fk.person.lastName();
  return locPick(ctx.rng, pools.last);
}

// Read a gender value already set in this row (if any).
function rowGender(ctx: GenContext): string {
  for (const key of Object.keys(ctx.row)) {
    if (/gender|sex/i.test(key)) {
      return String(ctx.row[key] ?? "").toLowerCase();
    }
  }
  return "";
}

// If a name was already set in this row, infer the gender from the first name
// pool so name and gender always agree. Works for PK/IN/AE. Handles compound
// first names like "Abdul Rahman" by checking prefixes of increasing length.
function inferGenderFromName(ctx: GenContext, cats: string[]): string | undefined {
  const pools = namePools(ctx);
  if (!pools) return undefined;
  const nameVal = findInRow(ctx.row, "name") ?? findInRow(ctx.row, "firstName");
  if (!nameVal) return undefined;
  const parts = String(nameVal).trim().split(/\s+/);
  for (let n = Math.min(3, parts.length); n >= 1; n--) {
    const candidate = parts.slice(0, n).join(" ");
    if (pools.female.includes(candidate)) {
      return cats.find((c) => c.toLowerCase() === "female") ?? "Female";
    }
    if (pools.male.includes(candidate)) {
      return cats.find((c) => c.toLowerCase() === "male") ?? "Male";
    }
  }
  return undefined;
}

export { PRODUCT_CATALOG, JOBS, money };

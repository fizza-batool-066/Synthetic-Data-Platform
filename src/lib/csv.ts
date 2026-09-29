// CSV "learn from a sample" feature.
// Steps:
//  1. Parse the uploaded CSV.
//  2. Detect each column's type (number / date / category / text).
//  3. Detect private columns (name, phone, email, ID) and MASK them.
//  4. Compute trends: averages, min/max, category shares, missing values.
//  5. Build a Plan that reproduces the same trends at a larger scale.
//  6. Provide a similarity score + a "no copied rows" proof after generation.
import Papa from "papaparse";
import type { Plan, ColumnDef } from "./synthetic";
import { clamp, round } from "./synthetic";

export type DetectedType = "number" | "date" | "category" | "text" | "boolean";

export interface ColumnStats {
  name: string;
  detectedType: DetectedType;
  isPrivate: boolean; // a private column (name/phone/email/id) we must mask
  // numeric stats
  min?: number;
  max?: number;
  mean?: number;
  std?: number;
  // category distribution
  distribution?: { value: string; count: number; pct: number }[];
  // date range
  minDate?: string;
  maxDate?: string;
  missing: number; // count of missing values
  missingPct: number;
}

export interface AnalysisResult {
  rowCount: number;
  columns: ColumnStats[];
  privateColumns: string[];
  maskedPreview: Record<string, unknown>[]; // first ~10 rows with private cols masked
  plan: Plan; // a plan that reproduces these trends
  facts: string[]; // plain-English trend summary
}

// Regex that flags private/PII columns by name.
const PRIVATE_RE = /(name|email|phone|mobile|tel|ssn|cnic|nic|passport|id\b|identifier|address|iban|account|card|dob|birth)/i;

// Parse CSV text into rows (with header fields). Shared so the endpoint can
// cache the raw rows separately from the analysis sent to the browser.
export function parseCsvRows(csvText: string): { fields: string[]; rows: Record<string, unknown>[] } {
  const parsed = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });
  const rows = parsed.data.filter((r) => r && Object.keys(r).length > 0);
  if (rows.length === 0) throw new Error("The uploaded CSV has no rows.");
  return { fields: parsed.meta.fields ?? Object.keys(rows[0]), rows };
}

// Analyze already-parsed rows + build a plan (no raw PII leaves this call).
export function analyzeRows(
  rows: Record<string, unknown>[],
  fields: string[],
  locale: string,
  seed: number,
): AnalysisResult {
  const columns: ColumnStats[] = fields.map((name) => analyzeColumn(name, rows));
  const privateColumns = columns.filter((c) => c.isPrivate).map((c) => c.name);
  const maskedPreview = rows.slice(0, 10).map((r) => maskRow(r, columns));
  const plan = buildPlanFromAnalysis(columns, rows.length, locale, seed);
  const facts = buildFacts(columns, rows.length, privateColumns);
  return { rowCount: rows.length, columns, privateColumns, maskedPreview, plan, facts };
}

// Convenience: parse + analyze in one call.
export function analyzeCsv(csvText: string, locale: string, seed: number): AnalysisResult {
  const { fields, rows } = parseCsvRows(csvText);
  return analyzeRows(rows, fields, locale, seed);
}

// Detect type + compute stats for one column.
function analyzeColumn(name: string, rows: Record<string, unknown>[]): ColumnStats {
  const values = rows.map((r) => r[name]);
  const nonEmpty = values.filter((v) => v !== "" && v !== null && v !== undefined).map(String);
  const missing = values.length - nonEmpty.length;
  const missingPct = (missing / values.length) * 100;
  const isPrivate = PRIVATE_RE.test(name);

  // Try number.
  const nums = nonEmpty.map(Number).filter((n) => !isNaN(n));
  const numRatio = nonEmpty.length ? nums.length / nonEmpty.length : 0;

  // Try date.
  const dates = nonEmpty.map((d) => new Date(d)).filter((d) => !isNaN(d.getTime()));
  const dateRatio = nonEmpty.length ? dates.length / nonEmpty.length : 0;

  // Category: few unique values.
  const uniq = new Set(nonEmpty);
  const catRatio = nonEmpty.length ? uniq.size / nonEmpty.length : 1;

  let detectedType: DetectedType = "text";
  if (numRatio > 0.8) detectedType = "number";
  else if (dateRatio > 0.8) detectedType = "date";
  else if (uniq.size <= 2 && numRatio > 0.5) detectedType = "boolean";
  else if (catRatio < 0.3 || uniq.size <= 12) detectedType = "category";

  const stats: ColumnStats = { name, detectedType, isPrivate, missing, missingPct };

  if (detectedType === "number" && nums.length) {
    stats.min = Math.min(...nums);
    stats.max = Math.max(...nums);
    stats.mean = nums.reduce((a, b) => a + b, 0) / nums.length;
    const variance = nums.reduce((a, b) => a + (b - stats.mean!) ** 2, 0) / nums.length;
    stats.std = Math.sqrt(variance);
  } else if (detectedType === "date" && dates.length) {
    const sorted = dates.sort((a, b) => a.getTime() - b.getTime());
    stats.minDate = sorted[0].toISOString().slice(0, 10);
    stats.maxDate = sorted[sorted.length - 1].toISOString().slice(0, 10);
  } else if (detectedType === "category" || detectedType === "boolean") {
    const counts: Record<string, number> = {};
    for (const v of nonEmpty) counts[v] = (counts[v] ?? 0) + 1;
    stats.distribution = Object.entries(counts)
      .map(([value, count]) => ({ value, count, pct: count / nonEmpty.length }))
      .sort((a, b) => b.count - a.count);
  }
  return stats;
}

// Mask a private value: keep the type/shape but replace with a generic token
// so no real PII ever leaves the analysis. We only keep the structure.
function maskRow(row: Record<string, unknown>, columns: ColumnStats[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const c of columns) {
    const v = row[c.name];
    if (c.isPrivate) {
      out[c.name] = maskValue(v, c.detectedType);
    } else {
      out[c.name] = v;
    }
  }
  return out;
}

function maskValue(v: unknown, type: DetectedType): unknown {
  if (v === "" || v === null || v === undefined) return "";
  switch (type) {
    case "number":
      return "***";
    case "date":
      return "YYYY-MM-DD";
    default:
      return "****";
  }
}

// Build a Plan that reproduces the sample's trends at a larger scale.
// Private columns are regenerated with fake-but-realistic values (Faker).
function buildPlanFromAnalysis(
  columns: ColumnStats[],
  sampleRows: number,
  locale: string,
  seed: number,
): Plan {
  const colDefs: ColumnDef[] = columns.map((c) => toColumnDef(c));
  return {
    locale,
    seed,
    description: `Learned from a sample of ${sampleRows} rows. Private columns regenerated with fake values.`,
    tables: [
      {
        name: "synthesized",
        // default scale: 10x the sample. The user can change this in the UI.
        rowCount: Math.max(sampleRows, Math.min(50000, sampleRows * 10)),
        columns: colDefs,
      },
    ],
  };
}

// Map an analyzed column to a generation ColumnDef.
function toColumnDef(c: ColumnStats): ColumnDef {
  // Private columns get a realistic fake generator instead of copying values.
  if (c.isPrivate) {
    if (/email/i.test(c.name)) return { name: c.name, type: "email", missingPct: c.missingPct };
    if (/phone|mobile|tel/i.test(c.name)) return { name: c.name, type: "phone", missingPct: c.missingPct };
    if (/name/i.test(c.name)) return { name: c.name, type: "name", missingPct: c.missingPct };
    if (/address/i.test(c.name)) return { name: c.name, type: "address", missingPct: c.missingPct };
    if (/id|identifier|cnic|ssn|passport|nic/i.test(c.name)) return { name: c.name, type: "id", format: "uuid" };
    if (/date|dob|birth/i.test(c.name)) {
      return { name: c.name, type: "date", min: c.minDate ? new Date(c.minDate).getTime() : undefined, max: c.maxDate ? new Date(c.maxDate).getTime() : undefined };
    }
    if (/account|iban|card/i.test(c.name)) return { name: c.name, type: "text" };
  }

  switch (c.detectedType) {
    case "number":
      return {
        name: c.name,
        type: "number",
        distribution: "normal",
        mean: c.mean,
        std: c.std ?? (c.max && c.min ? (c.max - c.min) / 6 : 1),
        min: c.min,
        max: c.max,
        decimals: Number.isInteger(c.mean) ? 0 : 2,
        missingPct: c.missingPct,
        outlierPct: 2,
      };
    case "date":
      return {
        name: c.name,
        type: "date",
        min: c.minDate ? new Date(c.minDate).getTime() : undefined,
        max: c.maxDate ? new Date(c.maxDate).getTime() : undefined,
        missingPct: c.missingPct,
      };
    case "category":
    case "boolean": {
      const categories = (c.distribution ?? []).map((d) => d.value);
      const weights = (c.distribution ?? []).map((d) => d.pct);
      return { name: c.name, type: "category", categories, weights, missingPct: c.missingPct };
    }
    default:
      return { name: c.name, type: "text", missingPct: c.missingPct, typoPct: 2 };
  }
}

// Plain-English trend facts for the UI ("Most students are 19-22. Girls are 30%.").
function buildFacts(columns: ColumnStats[], rowCount: number, privateColumns: string[]): string[] {
  const facts: string[] = [];
  facts.push(`Uploaded ${rowCount} rows. Detected ${columns.length} columns.`);
  if (privateColumns.length) {
    facts.push(`Private columns detected and masked: ${privateColumns.join(", ")}.`);
  }
  for (const c of columns) {
    if (c.isPrivate) continue; // don't describe PII values
    if (c.detectedType === "number" && c.mean !== undefined) {
      facts.push(`${c.name}: most values near ${round(c.mean, 1)} (range ${round(c.min!, 1)}–${round(c.max!, 1)}).`);
    } else if ((c.detectedType === "category" || c.detectedType === "boolean") && c.distribution) {
      const top = c.distribution[0];
      if (top) facts.push(`${c.name}: top value "${top.value}" is ${Math.round(top.pct * 100)}%.`);
    } else if (c.detectedType === "date") {
      facts.push(`${c.name}: spans ${c.minDate} to ${c.maxDate}.`);
    }
    if (c.missingPct > 0) facts.push(`${c.name}: ${c.missingPct.toFixed(1)}% missing.`);
  }
  return facts;
}

// --- Similarity + copied-rows check (run after generating the bigger dataset) ---

// Compute a similarity score (0-100) between the sample and the generated data,
// column by column, by comparing distributions/means.
export function similarityScore(
  sampleColumns: ColumnStats[],
  generatedRows: Record<string, unknown>[],
): number {
  let total = 0;
  let count = 0;
  for (const c of sampleColumns) {
    if (c.isPrivate) continue; // privacy: never compare real PII
    const values = generatedRows.map((r) => r[c.name]);
    if (c.detectedType === "number") {
      const nums = values.map(Number).filter((n) => !isNaN(n));
      if (!nums.length) continue;
      const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
      const diff = Math.abs(mean - (c.mean ?? mean));
      const range = (c.max ?? 1) - (c.min ?? 1) || 1;
      total += clamp(100 - (diff / range) * 100, 0, 100);
      count++;
    } else if (c.detectedType === "category" || c.detectedType === "boolean") {
      const counts: Record<string, number> = {};
      const nonEmpty = values.filter((v) => v !== "" && v !== null && v !== undefined).map(String);
      for (const v of nonEmpty) counts[v] = (counts[v] ?? 0) + 1;
      const totalN = nonEmpty.length || 1;
      let overlap = 0;
      for (const d of c.distribution ?? []) {
        const genPct = (counts[d.value] ?? 0) / totalN;
        overlap += Math.min(d.pct, genPct);
      }
      total += overlap * 100;
      count++;
    }
  }
  return count ? Math.round(total / count) : 100;
}

// Prove no generated row is a verbatim copy of a sample row.
// We compare non-private columns; private columns are regenerated anyway.
export function copiedRowsCheck(
  sampleRows: Record<string, unknown>[],
  generatedRows: Record<string, unknown>[],
  privateColumns: string[],
): { copied: number; checked: number } {
  const sampleKeys = sampleRows.map((r) =>
    JSON.stringify(
      Object.fromEntries(Object.entries(r).filter(([k]) => !privateColumns.includes(k)).map(([k, v]) => [k, String(v)])),
    ),
  );
  const sampleSet = new Set(sampleKeys);
  let copied = 0;
  for (const r of generatedRows) {
    const key = JSON.stringify(
      Object.fromEntries(Object.entries(r).filter(([k]) => !privateColumns.includes(k)).map(([k, v]) => [k, String(v)])),
    );
    if (sampleSet.has(key)) copied++;
  }
  return { copied, checked: generatedRows.length };
}

// Export helper so the "learn" flow can regenerate from a (possibly user-edited) plan.
export { toColumnDef as columnDefFromStats };

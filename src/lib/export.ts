// Export helpers: convert generated tables to CSV and JSON for download.
import type { GenerationResult } from "./synthetic";

type Table = { name: string; columns: string[]; rows: Record<string, unknown>[] };

// Convert a single table to CSV.
export function tableToCsv(table: Table): string {
  const header = table.columns.map(csvCell).join(",");
  const lines = table.rows.map((row) => table.columns.map((c) => csvCell(row[c])).join(","));
  return [header, ...lines].join("\n");
}

// Convert all tables to one CSV file (tables separated by blank lines) or to a
// JSON object keyed by table name.
export function resultToCsv(result: GenerationResult): string {
  return result.tables.map((t) => `# ${t.name}\n${tableToCsv(t)}`).join("\n\n");
}

export function resultToJson(result: GenerationResult): string {
  const obj: Record<string, unknown[]> = {};
  for (const t of result.tables) obj[t.name] = t.rows;
  return JSON.stringify(obj, null, 2);
}

// Escape a value for CSV (quotes/commas/newlines).
function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

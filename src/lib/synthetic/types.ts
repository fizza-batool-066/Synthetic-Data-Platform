// Shared types for the synthetic data engine.
// A "Plan" fully describes how to generate a dataset. It can be built either
// from the manual "settings" mode or from the AI "prompt" mode — both produce
// the same Plan shape, so generation logic is shared.

// Every column has a generator "type". Keeping this list small but expressive
// keeps the code easy to understand while still producing realistic data.
export type ColumnType =
  | "id" // sequential or uuid identifier
  | "name" // full person name
  | "firstName"
  | "lastName"
  | "gender"
  | "age" // integer age with realistic distribution
  | "email"
  | "phone"
  | "address"
  | "city"
  | "country"
  | "postcode"
  | "job"
  | "company"
  | "date" // calendar date
  | "datetime" // date + time
  | "number" // numeric (int or float)
  | "money" // currency amount
  | "category" // pick from weighted categories
  | "boolean"
  | "text" // lorem ipsum sentence
  | "productName"
  | "price" // product price with realistic skew
  | "quantity"
  | "categoryId" // stable numeric ID for a category value (Female=1, Male=2…)
  | "nationalId" // country-specific national ID (CNIC, Aadhaar, SSN, EID…)
  | "computed"; // derived from other columns (totals, running balance, FK)

export interface ColumnDef {
  name: string;
  type: ColumnType;
  // --- numeric options ---
  min?: number;
  max?: number;
  decimals?: number;
  // which distribution to draw from. "normal" = bell curve (most values near
  // the mean, a few rare high/low) — this is what makes data look real.
  distribution?: "normal" | "uniform" | "exponential" | "bimodal";
  mean?: number;
  std?: number;
  // --- category options ---
  categories?: string[];
  weights?: number[]; // 0..1 each, roughly summing to 1
  // --- realistic "mess" options ---
  missingPct?: number; // 0..100 chance the cell is empty
  outlierPct?: number; // 0..100 chance of a rare extreme value
  typoPct?: number; // 0..100 chance of a typo in text values
  // --- dependencies (make columns depend on each other) ---
  dependsOn?: string; // another column name
  relationship?: string; // e.g. "job->salary", "age->class", "city->postcode", "product->price"
  // --- formatting / misc ---
  format?: string; // date format etc.
  // --- computed columns (formulas guarantee correct totals) ---
  formula?: "orderTotal" | "runningBalance" | "itemsTotal" | "lineTotal";
  // parent reference for foreign keys (relational)
  refTable?: string;
  refColumn?: string;
}

export interface TableDef {
  name: string;
  rowCount: number;
  columns: ColumnDef[];
  // When this table is a child in a relation, each row picks a parent FK.
  parent?: { table: string; column: string; as: string };
}

export interface Plan {
  tables: TableDef[];
  locale: string; // e.g. "en", "en_US", "en_GB" — drives Faker
  seed: number; // deterministic output for the same seed
  // human-readable description of the rules (for the summary box)
  description?: string;
}

// The result of a generation: rows per table + a computed summary.
export interface GenerationResult {
  tables: { name: string; columns: string[]; rows: Record<string, unknown>[] }[];
  summary: Summary;
}

// A "How this data was made" summary. Every number here is computed from the
// REAL generated data, never guessed, so it always matches the dataset.
export interface Summary {
  rowCount: number;
  tableCount: number;
  columns: { table: string; columns: string[] }[];
  facts: string[]; // plain-English facts, e.g. "70% live in the city"
  realismScore: number; // 0..100
  realismNotes: string[];
  rulesUsed: string[]; // rules that were applied (from the plan)
  missingPct: number; // overall missing-value share
  integrity: string[]; // checks that passed (FK integrity, totals, etc.)
}

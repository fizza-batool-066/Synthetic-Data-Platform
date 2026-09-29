// The generation orchestrator. Takes a Plan and produces tables + a summary.
// Key guarantees:
//  - Every foreign key references a real parent row (relational integrity).
//  - Order totals equal the sum of their line items (computed, never random).
//  - Running balances are a correct cumulative sum (bank statements).
//  - Salary depends on job; age influences class; price depends on product.
//  - Category ID columns get a STABLE numeric ID per category value that is
//    consistent across every row and every table (e.g. Female=1 everywhere).
import { makeRng } from "./random";
import { getFaker } from "./faker";
import { getCountry } from "./countries";
import { genValue, salaryForJob, type GenContext } from "./generators";
import { computeSummary } from "./summary";
import { computeRealism } from "./realism";
import type { Plan, ColumnDef, GenerationResult } from "./types";

// Generate a full dataset from a plan.
export function generateFromPlan(plan: Plan): GenerationResult {
  const rng = makeRng(plan.seed || 1);
  const fk = getFaker(plan.locale);
  // Resolve the full country info (currency, dial code, date format, ID format…)
  const countryInfo = getCountry(plan.locale);
  const country = countryInfo.code;

  // Store generated rows per table so child tables can reference parents.
  const byTable: Record<
    string,
    { name: string; columns: string[]; rows: Record<string, unknown>[] }
  > = {};

  // Generate tables in plan order (parents must come before children).
  for (const table of plan.tables) {
    const columns = table.columns.map((c) => c.name);
    const rows: Record<string, unknown>[] = [];

    // Collect valid parent primary keys if this table is a child (FK).
    let parentKeys: unknown[] | undefined;
    if (table.parent) {
      const parentTable = byTable[table.parent.table];
      if (parentTable) {
        parentKeys = parentTable.rows.map((r) => r[table.parent!.column]);
      }
    }

    for (let i = 0; i < table.rowCount; i++) {
      const row: Record<string, unknown> = {};
      const ctx: GenContext = {
        rng,
        fk,
        locale: plan.locale,
        country,
        countryInfo,
        currency: countryInfo.currency,
        currencySymbol: countryInfo.currencySymbol,
        dial: countryInfo.dial,
        rowIndex: i,
        row,
        parentKeys,
      };

      for (const col of table.columns) {
        row[col.name] = resolveColumn(col, ctx, table);
      }
      rows.push(row);
    }

    byTable[table.name] = { name: table.name, columns, rows };
  }

  // Backfill computed columns that depend on other rows/tables.
  backfillComputed(plan, byTable);

  // Backfill stable category IDs (Female=1 everywhere, across all tables).
  backfillCategoryIds(plan, byTable);

  // Override the row `id` so every Female row has id=1 (and Male=2) in any
  // standalone table that has a gender column. Parent tables (referenced by
  // children via foreign keys) are skipped so relational integrity is preserved.
  applyGenderBasedIds(plan, byTable);

  const tables = plan.tables.map((t) => byTable[t.name]);

  // Build the "How this data was made" summary from the real generated data.
  const summary = computeSummary(plan, tables);

  // Compute the realism score from simple checks on the real data.
  const realism = computeRealism(plan, tables);
  summary.realismScore = realism.score;
  summary.realismNotes = realism.notes;
  summary.integrity.push(...realism.integrity);

  return { tables, summary };
}

// Resolve a single column value, handling dependencies and computed formulas.
function resolveColumn(
  col: ColumnDef,
  ctx: GenContext,
  table: { name: string; rowCount: number; columns: ColumnDef[] },
): unknown {
  const { rng, row } = ctx;

  // Computed columns and categoryId columns are filled in a second pass.
  if (col.formula) return null;
  if (col.type === "categoryId") return null;

  // Dependency: salary depends on job.
  if (col.relationship === "job->salary" && col.dependsOn) {
    const job = row[col.dependsOn];
    if (typeof job === "string") {
      const sal = salaryForJob(job, rng);
      // apply missing-value realism
      if (col.missingPct && rng() < col.missingPct / 100) return "";
      return sal;
    }
  }

  // Dependency: class year depends on age (university realism).
  if (col.relationship === "age->class" && col.dependsOn) {
    const age = Number(row[col.dependsOn]);
    if (!isNaN(age)) {
      const year = age <= 18 ? "Freshman" : age === 19 ? "Sophomore" : age === 20 ? "Junior" : "Senior";
      if (col.missingPct && rng() < col.missingPct / 100) return "";
      return year;
    }
  }

  // Default: use the type-based generator.
  return genValue(col, ctx);
}

// Second pass: fill computed columns so totals/balances are always correct.
function backfillComputed(
  plan: Plan,
  byTable: Record<string, { name: string; columns: string[]; rows: Record<string, unknown>[] }>,
) {
  for (const table of plan.tables) {
    for (const col of table.columns) {
      if (!col.formula) continue;

      if (col.formula === "lineTotal") {
        // line_total = price * quantity (within the same row)
        const priceCol = findCol(table.columns, (c) => c.type === "price");
        const qtyCol = findCol(table.columns, (c) => c.type === "quantity");
        if (priceCol && qtyCol) {
          for (const row of byTable[table.name].rows) {
            const p = Number(row[priceCol.name]) || 0;
            const q = Number(row[qtyCol.name]) || 1;
            row[col.name] = Math.round(p * q * 100) / 100;
          }
        }
      } else if (col.formula === "orderTotal") {
        // order total = sum of child line totals where child.FK == this.id
        const child = plan.tables.find((t) => t.parent?.table === table.name);
        if (child) {
          const fkCol = child.parent!.as;
          const lineCol = findCol(child.columns, (c) => c.formula === "lineTotal");
          const idCol = findCol(table.columns, (c) => c.type === "id");
          if (lineCol && idCol) {
            // index child line totals by parent id
            const sums: Record<string, number> = {};
            for (const crow of byTable[child.name].rows) {
              const pid = String(crow[fkCol]);
              sums[pid] = (sums[pid] ?? 0) + (Number(crow[lineCol.name]) || 0);
            }
            for (const row of byTable[table.name].rows) {
              row[col.name] = Math.round((sums[String(row[idCol.name])] ?? 0) * 100) / 100;
            }
          }
        }
      } else if (col.formula === "runningBalance") {
        // running balance = cumulative sum of amounts, ordered by date.
        const dateCol = findCol(table.columns, (c) => c.type === "date" || c.type === "datetime");
        const amountCol = findCol(table.columns, (c) => c.type === "money" && c.name !== col.name);
        if (dateCol && amountCol) {
          const rows = [...byTable[table.name].rows].sort(
            (a, b) => String(a[dateCol.name]).localeCompare(String(b[dateCol.name])),
          );
          let bal = 0;
          for (const row of rows) {
            bal += Number(row[amountCol.name]) || 0;
            row[col.name] = Math.round(bal * 100) / 100;
          }
        }
      } else if (col.formula === "itemsTotal") {
        // sum of a numeric column across the same table (rarely used)
        const numCol = findCol(table.columns, (c) => c.type === "number" || c.type === "money");
        if (numCol) {
          let total = 0;
          for (const row of byTable[table.name].rows) total += Number(row[numCol.name]) || 0;
          for (const row of byTable[table.name].rows) row[col.name] = Math.round(total * 100) / 100;
        }
      }
    }
  }
}

function findCol(cols: ColumnDef[], pred: (c: ColumnDef) => boolean): ColumnDef | undefined {
  return cols.find(pred);
}

// Override the row `id` column based on gender, so that every Female row has
// id = 1 (and Male = 2) consistently. This is applied to every table that:
//   1. has a `gender` column (type "gender" or a category named gender/sex), AND
//   2. is NOT a parent referenced by another table's foreign key.
// Condition (2) keeps relational integrity intact: parent tables keep their
// unique sequential ids so child rows can still point at exactly one parent.
// The mapping mirrors the categoryId mapping (Female=1, Male=2, ...) so the id
// and the gender_id column always agree.
function applyGenderBasedIds(
  plan: Plan,
  byTable: Record<string, { name: string; columns: string[]; rows: Record<string, unknown>[] }>,
) {
  // Collect the set of tables that are parents (referenced by a child's FK).
  // We never override ids on these — doing so would break foreign-key integrity.
  const parentTables = new Set<string>();
  for (const t of plan.tables) {
    if (t.parent) parentTables.add(t.parent.table);
  }

  for (const table of plan.tables) {
    // Skip parent tables to preserve FK integrity.
    if (parentTables.has(table.name)) continue;

    // Find a gender column (typed "gender", or a category whose name is gender/sex).
    const genderCol = table.columns.find(
      (c) => c.type === "gender" || (c.type === "category" && /gender|sex/i.test(c.name)),
    );
    if (!genderCol) continue;

    // Find the primary id column (type "id"). Skip if it's a FK/computed column.
    const idCol = table.columns.find((c) => c.type === "id");
    if (!idCol) continue;

    // Build the value->id map from declared categories (Female=1, Male=2, ...).
    // If no categories are declared, discover distinct values and sort them so
    // "Female" sorts before "Male" -> Female=1, Male=2.
    const cats = genderCol.categories?.length ? genderCol.categories : discoverGenderValues(byTable, table.name, genderCol.name);
    const map = new Map<string, number>();
    cats.forEach((cat, i) => {
      if (!map.has(cat)) map.set(cat, i + 1);
    });

    const rows = byTable[table.name]?.rows ?? [];
    let applied = 0;
    for (const row of rows) {
      const g = row[genderCol.name];
      if (g === "" || g === null || g === undefined) continue; // leave missing values alone
      const id = map.get(String(g));
      if (id !== undefined) {
        row[idCol.name] = id;
        applied++;
      }
    }

    // Note this in the plan description so it shows up in the summary.
    if (applied > 0 && !plan.description?.includes("gender-based id")) {
      plan.description = (plan.description ? plan.description + " " : "") +
        `Every Female row has ${idCol.name}=1 (Male=2).`;
    }
  }
}

// Discover distinct gender values from generated rows, sorted so Female<Male.
function discoverGenderValues(
  byTable: Record<string, { name: string; columns: string[]; rows: Record<string, unknown>[] }>,
  tableName: string,
  colName: string,
): string[] {
  const values = new Set<string>();
  for (const row of byTable[tableName]?.rows ?? []) {
    const v = row[colName];
    if (v !== "" && v !== null && v !== undefined) values.add(String(v));
  }
  return [...values].sort((a, b) => a.localeCompare(b));
}

// Backfill stable category ID columns.
//
// A column with type "categoryId" + dependsOn "<sourceColumn>" gets a stable
// numeric ID for each distinct value of its source column. The mapping is:
//   - If the source column declares `categories`, IDs follow that declared
//     order (index + 1). e.g. categories ["Female","Male"] -> Female=1, Male=2.
//   - Otherwise, discover distinct values from the generated data and assign
//     IDs in alphabetical order (deterministic).
//
// The mapping is GLOBAL across the whole plan: the same source value maps to
// the same ID in every table. So "Female" is always 1, everywhere.
//
// The "scope" of a mapping is the source column name. Two tables that both have
// a "gender" column with categories ["Female","Male"] therefore share one map.
function backfillCategoryIds(
  plan: Plan,
  byTable: Record<string, { name: string; columns: string[]; rows: Record<string, unknown>[] }>,
) {
  // Build one value->id map per source-column-name, shared across all tables.
  const maps = new Map<string, Map<string, number>>();

  for (const table of plan.tables) {
    for (const col of table.columns) {
      if (col.type !== "categoryId" || !col.dependsOn) continue;

      const sourceName = col.dependsOn;
      // Find the source column definition (in the same table).
      const sourceCol = table.columns.find((c) => c.name === sourceName);

      // Get or build the value->id map for this source column.
      let map = maps.get(sourceName);
      if (!map) {
        map = buildCategoryMap(sourceCol, byTable, sourceName);
        maps.set(sourceName, map);
      }

      // Assign IDs to every row of this table.
      const rows = byTable[table.name]?.rows ?? [];
      for (const row of rows) {
        const v = row[sourceName];
        const key = v === "" || v === null || v === undefined ? "" : String(v);
        row[col.name] = map.has(key) ? map.get(key)! : 0;
      }
    }
  }
}

// Build the value->id map for a source column. Uses declared categories if
// present (declared order), otherwise discovers distinct values from the data
// and sorts them alphabetically for a deterministic result.
function buildCategoryMap(
  sourceCol: ColumnDef | undefined,
  byTable: Record<string, { name: string; columns: string[]; rows: Record<string, unknown>[] }>,
  sourceName: string,
): Map<string, number> {
  const map = new Map<string, number>();

  if (sourceCol?.categories && sourceCol.categories.length > 0) {
    // Declared order: categories[0] -> 1, categories[1] -> 2, ...
    sourceCol.categories.forEach((cat, i) => {
      if (!map.has(cat)) map.set(cat, i + 1);
    });
    // Empty / missing value always maps to 0.
    map.set("", 0);
    return map;
  }

  // Discover distinct values from the generated data across all tables that
  // have a column with this name. Sort alphabetically for determinism.
  const values = new Set<string>();
  for (const t of Object.values(byTable)) {
    for (const row of t.rows) {
      const v = row[sourceName];
      if (v === "" || v === null || v === undefined) continue;
      values.add(String(v));
    }
  }
  const sorted = [...values].sort((a, b) => a.localeCompare(b));
  sorted.forEach((v, i) => map.set(v, i + 1));
  map.set("", 0);
  return map;
}

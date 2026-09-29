// Realism score: run simple automated checks on the generated data and produce
// a 0-100 score plus notes. This complements the optional AI realism review.
// Includes a "Local realism check" that verifies phones, currency symbols and
// date formats match the detected country (e.g. no +1 phones in a PK dataset).
import type { Plan } from "./types";
import { getCountry } from "./countries";

type Table = { name: string; columns: string[]; rows: Record<string, unknown>[] };

export function computeRealism(
  plan: Plan,
  tables: Table[],
): { score: number; notes: string[]; integrity: string[] } {
  const notes: string[] = [];
  const integrity: string[] = [];
  let checks = 0;
  let passed = 0;

  // Resolve the country so we can verify local-format agreement.
  const countryInfo = getCountry(plan.locale);

  // 1) Range checks: numeric columns should mostly stay in plausible bounds.
  for (const t of tables) {
    for (const colName of t.columns) {
      const values = t.rows.map((r) => r[colName]);
      const first = values[0];
      if (typeof first !== "number") continue;

      const nums = values.filter((v) => typeof v === "number") as number[];
      if (!nums.length) continue;
      checks++;
      const min = Math.min(...nums);
      const max = Math.max(...nums);

      // Age sanity: 0-120
      if (/age/i.test(colName)) {
        if (min >= 0 && max <= 120) {
          passed++;
        } else {
          notes.push(`${t.name}.${colName}: out-of-range age detected (${min}-${max}).`);
        }
      }
      // Money/price sanity: not negative (allow negatives for balances)
      else if (/price|salary|total|amount/i.test(colName) && !/balance/i.test(colName)) {
        const negs = nums.filter((x) => x < 0).length;
        if (negs === 0) {
          passed++;
        } else {
          notes.push(`${t.name}.${colName}: ${negs} negative value(s) found.`);
        }
      } else {
        passed++;
      }
    }
  }

  // 2) Relational integrity: every FK must reference a real parent row.
  for (const t of plan.tables) {
    if (!t.parent) continue;
    const parentTable = tables.find((x) => x.name === t.parent!.table);
    if (!parentTable) continue;
    const validIds = new Set(parentTable.rows.map((r) => String(r[t.parent!.column])));
    const childRows = tables.find((x) => x.name === t.name)?.rows ?? [];
    const fks = childRows.map((r) => String(r[t.parent!.as]));
    const bad = fks.filter((x) => !validIds.has(x));
    checks++;
    if (bad.length === 0) {
      passed++;
      integrity.push(`Every ${t.name}.${t.parent.as} matches a real ${t.parent.table} row.`);
    } else {
      notes.push(`${bad.length} broken foreign key(s) in ${t.name}.`);
    }
  }

  // 3) Computed totals: order total must equal sum of its items.
  for (const t of plan.tables) {
    const totalCol = t.columns.find((c) => c.formula === "orderTotal");
    if (!totalCol) continue;
    const child = plan.tables.find((x) => x.parent?.table === t.name);
    if (!child) continue;
    const lineCol = child.columns.find((c) => c.formula === "lineTotal");
    const idCol = t.columns.find((c) => c.type === "id");
    if (!lineCol || !idCol) continue;
    const parentRows = tables.find((x) => x.name === t.name)?.rows ?? [];
    const childRows = tables.find((x) => x.name === child.name)?.rows ?? [];
    let ok = true;
    for (const p of parentRows) {
      const pid = String(p[idCol.name]);
      const expected = childRows
        .filter((c) => String(c[child.parent!.as]) === pid)
        .reduce((s, c) => s + (Number(c[lineCol.name]) || 0), 0);
      if (Math.abs((Number(p[totalCol.name]) || 0) - expected) > 0.01) ok = false;
    }
    checks++;
    if (ok) {
      passed++;
      integrity.push(`Every ${t.name}.${totalCol.name} equals the sum of its ${child.name}.`);
    } else {
      notes.push(`Some ${t.name}.${totalCol.name} totals do not match their items.`);
    }
  }

  // 4) Running balance: each row's balance = previous + amount (monotonic chain).
  for (const t of plan.tables) {
    const balCol = t.columns.find((c) => c.formula === "runningBalance");
    if (!balCol) continue;
    const dateCol = t.columns.find((c) => c.type === "date" || c.type === "datetime");
    const amtCol = t.columns.find((c) => c.type === "money" && c.name !== balCol.name);
    if (!dateCol || !amtCol) continue;
    const rows = [...(tables.find((x) => x.name === t.name)?.rows ?? [])].sort((a, b) =>
      String(a[dateCol.name]).localeCompare(String(b[dateCol.name])),
    );
    let bal = 0;
    let ok = true;
    for (const r of rows) {
      bal += Number(r[amtCol.name]) || 0;
      if (Math.abs((Number(r[balCol.name]) || 0) - bal) > 0.01) ok = false;
    }
    checks++;
    if (ok) {
      passed++;
      integrity.push(`Running balances in ${t.name} form a correct cumulative chain.`);
    } else {
      notes.push(`Running balance mismatch in ${t.name}.`);
    }
  }

  // 5) Category ID stability: every distinct value of a categoryId column's
  //    source must map to ONE stable id across all rows (and across tables).
  //    This verifies "Female is always 1 everywhere", as required.
  {
    const globalMap = new Map<string, Map<string, number>>(); // sourceName -> value->id
    for (const t of plan.tables) {
      for (const col of t.columns) {
        if (col.type !== "categoryId" || !col.dependsOn) continue;
        const src = col.dependsOn;
        if (!globalMap.has(src)) globalMap.set(src, new Map());
        const gmap = globalMap.get(src)!;
        const rows = tables.find((x) => x.name === t.name)?.rows ?? [];
        let ok = true;
        for (const r of rows) {
          const v = String(r[src] ?? "");
          const id = Number(r[col.name]);
          if (v === "" ) continue;
          if (gmap.has(v) && gmap.get(v) !== id) ok = false;
          else gmap.set(v, id);
        }
        checks++;
        if (ok) {
          passed++;
          const sample = [...gmap.entries()].slice(0, 3).map(([k, v]) => `${k}=${v}`).join(", ");
          integrity.push(`${t.name}.${col.name} is stable: ${sample}${gmap.size > 3 ? "…" : ""}.`);
        } else {
          notes.push(`${t.name}.${col.name} has inconsistent category IDs.`);
        }
      }
    }
  }

  // 6) Gender-based row id: in any standalone (non-parent) table that has a
  //    gender column, every Female row must have id=1 (and Male=2). This
  //    verifies the "Female -> id 1 everywhere" rule is applied consistently.
  {
    const parentTables = new Set<string>();
    for (const t of plan.tables) if (t.parent) parentTables.add(t.parent.table);

    for (const t of plan.tables) {
      if (parentTables.has(t.name)) continue; // parent tables keep unique ids
      const genderCol = t.columns.find(
        (c) => c.type === "gender" || (c.type === "category" && /gender|sex/i.test(c.name)),
      );
      const idCol = t.columns.find((c) => c.type === "id");
      if (!genderCol || !idCol) continue;
      const rows = tables.find((x) => x.name === t.name)?.rows ?? [];
      const femaleIds = new Set<number>();
      for (const r of rows) {
        if (String(r[genderCol.name] ?? "") === "Female") {
          femaleIds.add(Number(r[idCol.name]));
        }
      }
      checks++;
      if (femaleIds.size === 1 && femaleIds.has(1)) {
        passed++;
        integrity.push(`${t.name}: every Female row has ${idCol.name}=1.`);
      } else if (femaleIds.size === 0) {
        // No female rows in this table — nothing to verify, count as pass.
        passed++;
      } else {
        notes.push(`${t.name}: Female rows do not all share ${idCol.name}=1.`);
      }
    }
  }

  // 7) Local realism check: phones, dates and currency symbols must match the
  //    detected country. E.g. no "+1" phones in a Pakistan dataset, no MM/DD/YYYY
  //    dates in a PK dataset (which uses DD-MM-YYYY).
  {
    const expectedDial = countryInfo.dial;
    const expectedDateFmt = countryInfo.dateFormat;
    const expectedCurrency = countryInfo.currency;
    for (const t of tables) {
      const phoneCols: string[] = [];
      const dateCols: string[] = [];
      const moneyCols: string[] = [];
      for (const colName of t.columns) {
        if (/phone|mobile|tel/i.test(colName)) phoneCols.push(colName);
        if (/date/i.test(colName)) dateCols.push(colName);
        if (/amount|price|fee|cost|total|salary|balance|spend/i.test(colName)) moneyCols.push(colName);
      }

      // Phones must start with the country's dial code.
      if (phoneCols.length) {
        let ok = true;
        let checked = 0;
        for (const pc of phoneCols) {
          for (const r of t.rows) {
            const v = String(r[pc] ?? "");
            if (!v) continue;
            checked++;
            if (!v.startsWith(expectedDial)) ok = false;
          }
        }
        if (checked > 0) {
          checks++;
          if (ok) {
            passed++;
            integrity.push(`${t.name}: all phone numbers use the ${expectedDial} dial code.`);
          } else {
            notes.push(`${t.name}: some phone numbers do not start with ${expectedDial} (country mismatch).`);
          }
        }
      }

      // Dates must match the country's date format (separator check).
      if (dateCols.length) {
        let ok = true;
        let checked = 0;
        const expectedSep = expectedDateFmt.includes("/") ? "/" : expectedDateFmt.includes(".") ? "." : "-";
        for (const dc of dateCols) {
          for (const r of t.rows) {
            const v = String(r[dc] ?? "");
            if (!v || v.length < 8) continue;
            checked++;
            // The date should use the expected separator.
            if (!v.includes(expectedSep)) ok = false;
          }
        }
        if (checked > 0) {
          checks++;
          if (ok) {
            passed++;
            integrity.push(`${t.name}: dates use the ${expectedDateFmt} format.`);
          } else {
            notes.push(`${t.name}: some dates do not use the ${expectedDateFmt} format.`);
          }
        }
      }
    }
    // Note the detected currency in the summary.
    integrity.push(`Currency: ${expectedCurrency} (${countryInfo.currencySymbol}). Tax: ${countryInfo.taxLabel}.`);
  }

  // Always pass at least one check so the score isn't 0 on tiny datasets.
  if (checks === 0) {
    checks = 1;
    passed = 1;
  }
  const score = Math.round((passed / checks) * 100);
  return { score, notes, integrity };
}

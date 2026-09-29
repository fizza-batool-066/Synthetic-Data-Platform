// Pre-built dataset templates. Each one returns a ready-to-edit Plan.
// These give users a one-click start for common scenarios.
import type { Plan } from "./types";

export const TEMPLATE_NAMES = ["university", "shop", "bank", "hospital"] as const;
export type TemplateName = (typeof TEMPLATE_NAMES)[number];

export const TEMPLATE_LABELS: Record<TemplateName, string> = {
  university: "University (students)",
  shop: "E-commerce (customers→orders→items)",
  bank: "Bank (accounts + transactions)",
  hospital: "Hospital (patients + visits)",
};

// Build a plan for a named template. rowCount applies to the main table.
export function buildTemplate(
  name: TemplateName,
  rowCount: number,
  locale: string,
  seed: number,
): Plan {
  switch (name) {
    case "university":
      return universityPlan(rowCount, locale, seed);
    case "shop":
      return shopPlan(rowCount, locale, seed);
    case "bank":
      return bankPlan(rowCount, locale, seed);
    case "hospital":
      return hospitalPlan(rowCount, locale, seed);
  }
}

// University: a single Students table with realistic age, gender split, city.
function universityPlan(n: number, locale: string, seed: number): Plan {
  return {
    locale,
    seed,
    description: "University students dataset — 10% female, most from the city.",
    tables: [
      {
        name: "students",
        rowCount: n,
        columns: [
          { name: "student_id", type: "id" },
          { name: "name", type: "name" },
          {
            name: "gender",
            type: "gender",
            categories: ["Female", "Male"],
            weights: [0.1, 0.9], // 10% female as in the example prompt
          },
          { name: "age", type: "age", mean: 21, std: 2, min: 17, max: 30 },
          { name: "city", type: "city" },
          // Stable category ID: Female=1, Male=2 everywhere (see backfillCategoryIds).
          { name: "gender_id", type: "categoryId", dependsOn: "gender" },
          { name: "email", type: "email", missingPct: 2 },
          { name: "gpa", type: "number", distribution: "normal", mean: 3.0, std: 0.4, min: 0, max: 4, decimals: 2 },
          { name: "year", type: "category", categories: ["Freshman", "Sophomore", "Junior", "Senior"], weights: [0.35, 0.25, 0.22, 0.18] },
          // Stable category ID for year: Freshman=1, Sophomore=2, Junior=3, Senior=4.
          { name: "year_id", type: "categoryId", dependsOn: "year" },
          { name: "phone", type: "phone", missingPct: 5 },
        ],
      },
    ],
  };
}

// E-commerce: Customers -> Orders -> Order Items. Order totals = sum of items.
function shopPlan(n: number, locale: string, seed: number): Plan {
  const orderCount = Math.max(5, Math.round(n * 1.5));
  const itemCount = orderCount * 3;
  return {
    locale,
    seed,
    description: "E-commerce dataset: customers, their orders, and order line items.",
    tables: [
      {
        name: "customers",
        rowCount: n,
        columns: [
          { name: "customer_id", type: "id" },
          { name: "name", type: "name" },
          { name: "email", type: "email" },
          { name: "city", type: "city" },
          { name: "phone", type: "phone", missingPct: 4 },
          { name: "joined_date", type: "date" },
        ],
      },
      {
        name: "orders",
        rowCount: orderCount,
        parent: { table: "customers", column: "customer_id", as: "customer_id" },
        columns: [
          { name: "order_id", type: "id" },
          { name: "customer_id", type: "computed", refTable: "customers", refColumn: "customer_id" },
          { name: "order_date", type: "date" },
          { name: "status", type: "category", categories: ["paid", "pending", "refunded"], weights: [0.8, 0.15, 0.05] },
          // Stable category ID: paid=1, pending=2, refunded=3 everywhere.
          { name: "status_id", type: "categoryId", dependsOn: "status" },
          { name: "total", type: "computed", formula: "orderTotal" },
        ],
      },
      {
        name: "order_items",
        rowCount: itemCount,
        parent: { table: "orders", column: "order_id", as: "order_id" },
        columns: [
          { name: "item_id", type: "id" },
          { name: "order_id", type: "computed", refTable: "orders", refColumn: "order_id" },
          { name: "product", type: "productName" },
          { name: "price", type: "price", decimals: 2 },
          { name: "quantity", type: "quantity" },
          { name: "line_total", type: "computed", formula: "lineTotal" },
        ],
      },
    ],
  };
}

// Bank: accounts plus a transactions table with a correct running balance.
function bankPlan(n: number, locale: string, seed: number): Plan {
  const txCount = Math.max(10, n * 4);
  return {
    locale,
    seed,
    description: "Bank dataset: accounts and transactions with correct running balances.",
    tables: [
      {
        name: "accounts",
        rowCount: n,
        columns: [
          { name: "account_id", type: "id" },
          { name: "holder", type: "name" },
          { name: "email", type: "email" },
          { name: "city", type: "city" },
          { name: "opened_date", type: "date" },
        ],
      },
      {
        name: "transactions",
        rowCount: txCount,
        parent: { table: "accounts", column: "account_id", as: "account_id" },
        columns: [
          { name: "txn_id", type: "id" },
          { name: "account_id", type: "computed", refTable: "accounts", refColumn: "account_id" },
          { name: "date", type: "date" },
          { name: "description", type: "category", categories: ["Salary", "Rent", "Groceries", "ATM", "Transfer", "Shopping"], weights: [0.15, 0.15, 0.25, 0.15, 0.15, 0.15] },
          // money can be negative (debits) — balances still add up.
          { name: "amount", type: "money", mean: 0, std: 300, min: -2000, max: 3000, decimals: 2 },
          { name: "balance", type: "computed", formula: "runningBalance" },
        ],
      },
    ],
  };
}

// Hospital: patients plus visit records.
function hospitalPlan(n: number, locale: string, seed: number): Plan {
  const visitCount = Math.max(5, Math.round(n * 1.8));
  return {
    locale,
    seed,
    description: "Hospital dataset: patients and their visit records.",
    tables: [
      {
        name: "patients",
        rowCount: n,
        columns: [
          { name: "patient_id", type: "id" },
          { name: "gender", type: "gender", categories: ["Female", "Male"], weights: [0.5, 0.5] },

          { name: "name", type: "name" },
          { name: "gender_id", type: "categoryId", dependsOn: "gender" },
          { name: "age", type: "age", mean: 45, std: 18, min: 0, max: 100 },
          { name: "city", type: "city" },
          { name: "phone", type: "phone", missingPct: 6 },
        ],
      },
      {
        name: "visits",
        rowCount: visitCount,
        parent: { table: "patients", column: "patient_id", as: "patient_id" },
        columns: [
          { name: "visit_id", type: "id" },
          { name: "patient_id", type: "computed", refTable: "patients", refColumn: "patient_id" },
          { name: "visit_date", type: "date" },
          { name: "department", type: "category", categories: ["Emergency", "Cardiology", "Pediatrics", "Orthopedics", "General"], weights: [0.3, 0.15, 0.15, 0.15, 0.25] },
          { name: "department_id", type: "categoryId", dependsOn: "department" },
          { name: "cost", type: "money", mean: 350, std: 200, min: 20, max: 5000, decimals: 2 },
        ],
      },
    ],
  };
}

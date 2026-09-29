// Industry schemas: each industry defines the tables, columns, and vocabulary
// that match its domain (a hospital has patients/doctors/visits/medicines/bills;
// a university has students/departments/courses/fees; etc.). This keeps topics
// from mixing and makes every dataset internally consistent.
//
// Each builder takes a CountryInfo so money columns use the right currency/tax,
// and the locale drives realistic local names/cities/phones via the generators.
import type { Plan, TableDef } from "./types";
import type { CountryInfo } from "./countries";

export type IndustryKey = "university" | "hospital" | "bank" | "shop" | "iot" | "employees" | "generic";

export interface IndustryOption {
  key: IndustryKey;
  label: string;
  desc: string;
}

export const INDUSTRY_OPTIONS: IndustryOption[] = [
  { key: "university", label: "University", desc: "Students, departments, courses, fees" },
  { key: "hospital", label: "Hospital", desc: "Patients, doctors, visits, medicines, bills" },
  { key: "bank", label: "Bank", desc: "Accounts, transactions, running balances" },
  { key: "shop", label: "E-commerce", desc: "Customers, orders, order items" },
  { key: "iot", label: "IoT telemetry", desc: "Devices, sensor readings" },
  { key: "employees", label: "HR / Employees", desc: "Employees, departments, salaries" },
  { key: "generic", label: "Generic", desc: "Simple customers table" },
];

// Detect the industry from a prompt (lowercased). Used when the user doesn't
// pick the dropdown explicitly.
export function detectIndustry(prompt: string): IndustryKey {
  const p = prompt.toLowerCase();
  const has = (...words: string[]) => words.some((w) => p.includes(w));
  if (has("hospital", "patient", "doctor", "medical", "clinic", "medicine", "nurse", "diagnosis", "treatment", "ward")) return "hospital";
  if (has("university", "student", "college", "course", "professor", "faculty", "enrollment", "gpa", "semester", "tuition", "fee")) return "university";
  if (has("bank", "account", "transaction", "deposit", "withdraw", "loan", "balance", "statement", "atm")) return "bank";
  if (has("shop", "ecommerce", "e-commerce", "order", "cart", "product", "invoice", "store", "retail", "merchant")) return "shop";
  if (has("iot", "sensor", "device", "telemetry", "reading", "temperature", "humidity")) return "iot";
  if (has("employee", "hr", "human resources", "staff", "payroll", "department", "salary")) return "employees";
  return "generic";
}

// Build a Plan for an industry + country. rowCount applies to the main table;
// related child tables scale proportionally.
export function buildIndustryPlan(
  industry: IndustryKey,
  country: CountryInfo,
  rowCount: number,
  seed: number,
  extraRules: string[] = [],
): Plan {
  const tables = industryTables(industry, country, rowCount);
  const ind = INDUSTRY_OPTIONS.find((i) => i.key === industry)?.label ?? "Generic";
  const parts = [
    `Country: ${country.name}.`,
    `Industry: ${ind}.`,
    `Currency: ${country.currency} (${country.currencySymbol}).`,
    `Tax: ${country.taxLabel} (${Math.round(country.taxRate * 100)}%).`,
    `Dates: ${country.dateFormat}.`,
    `Phones: ${country.dial}…`,
  ];
  return {
    tables,
    locale: country.locale,
    seed,
    description: [...parts, ...extraRules].join(" "),
  };
}

// Per-industry table definitions. Each uses country-aware money/tax where it
// matters, and includes gender/gender_id and category/categoryId columns so
// stable IDs and the "Female = id 1" rule both apply.
function industryTables(industry: IndustryKey, c: CountryInfo, n: number): TableDef[] {
  switch (industry) {
    case "hospital": return hospitalTables(c, n);
    case "university": return universityTables(c, n);
    case "bank": return bankTables(c, n);
    case "shop": return shopTables(c, n);
    case "iot": return iotTables(c, n);
    case "employees": return employeesTables(c, n);
    default: return genericTables(c, n);
  }
}

// --- Hospital: patients, doctors, visits, medicines, bills ---
// Patients -> Visits (child). Visits reference doctors. Bills computed from visits.
function hospitalTables(c: CountryInfo, n: number): TableDef[] {
  const visits = Math.max(5, Math.round(n * 1.5));
  return [
    {
      name: "patients",
      rowCount: n,
      columns: [
        { name: "patient_id", type: "id" },
        { name: "gender", type: "gender", categories: ["Female", "Male"], weights: [0.5, 0.5] },

        { name: "name", type: "name" },
        { name: "gender_id", type: "categoryId", dependsOn: "gender" },
        { name: "age", type: "age", mean: 45, std: 18, min: 0, max: 100 },
        { name: "blood_group", type: "category", categories: ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"], weights: [0.34, 0.06, 0.09, 0.02, 0.38, 0.07, 0.03, 0.01] },
        { name: "blood_group_id", type: "categoryId", dependsOn: "blood_group" },
        { name: "phone", type: "phone", missingPct: 6 },
        { name: "city", type: "city" },
        { name: "national_id", type: "nationalId" },
        { name: "admission_date", type: "date" },
      ],
    },
    {
      name: "doctors",
      rowCount: Math.max(3, Math.round(n * 0.15)),
      columns: [
        { name: "doctor_id", type: "id" },
        { name: "gender", type: "gender", categories: ["Female", "Male"], weights: [0.4, 0.6] },

        { name: "name", type: "name" },
        { name: "gender_id", type: "categoryId", dependsOn: "gender" },
        { name: "specialization", type: "category", categories: ["Cardiology", "Neurology", "Pediatrics", "Orthopedics", "General Medicine", "Dermatology", "ENT", "Oncology"], weights: [0.15, 0.12, 0.15, 0.13, 0.2, 0.1, 0.1, 0.05] },
        { name: "specialization_id", type: "categoryId", dependsOn: "specialization" },
        { name: "phone", type: "phone" },
        { name: "city", type: "city" },
        { name: "consultation_fee", type: "money", mean: 2500, std: 1500, min: 500, max: 15000, decimals: 2 },
      ],
    },
    {
      name: "visits",
      rowCount: visits,
      parent: { table: "patients", column: "patient_id", as: "patient_id" },
      columns: [
        { name: "visit_id", type: "id" },
        { name: "patient_id", type: "computed", refTable: "patients", refColumn: "patient_id" },
        { name: "doctor_id", type: "computed", refTable: "doctors", refColumn: "doctor_id" },
        { name: "visit_date", type: "date" },
        { name: "department", type: "category", categories: ["Emergency", "Cardiology", "Pediatrics", "Orthopedics", "General"], weights: [0.3, 0.15, 0.15, 0.15, 0.25] },
        { name: "department_id", type: "categoryId", dependsOn: "department" },
        { name: "diagnosis", type: "category", categories: ["Flu", "Hypertension", "Diabetes", "Fracture", "Infection", "Checkup", "Asthma"], weights: [0.2, 0.18, 0.15, 0.1, 0.12, 0.15, 0.1] },
        { name: "medicine", type: "category", categories: ["Paracetamol", "Amoxicillin", "Insulin", "Atenolol", "Ibuprofen", "Salbutamol"], weights: [0.25, 0.2, 0.1, 0.15, 0.2, 0.1] },
        { name: "medicine_id", type: "categoryId", dependsOn: "medicine" },
        { name: "cost", type: "money", mean: 3500, std: 2000, min: 200, max: 50000, decimals: 2 },
      ],
    },
  ];
}

// --- University: students, departments, courses, fees ---
function universityTables(c: CountryInfo, n: number): TableDef[] {
  const enrollments = Math.max(5, Math.round(n * 1.2));
  return [
    {
      name: "students",
      rowCount: n,
      columns: [
        { name: "student_id", type: "id" },
        { name: "gender", type: "gender", categories: ["Female", "Male"], weights: [0.1, 0.9] },

        { name: "name", type: "name" },
        { name: "gender_id", type: "categoryId", dependsOn: "gender" },
        { name: "age", type: "age", mean: 21, std: 2, min: 17, max: 30 },
        { name: "city", type: "city" },
        { name: "email", type: "email", missingPct: 2 },
        { name: "gpa", type: "number", distribution: "normal", mean: 3.0, std: 0.4, min: 0, max: 4, decimals: 2 },
        { name: "year", type: "category", categories: ["Freshman", "Sophomore", "Junior", "Senior"], weights: [0.35, 0.25, 0.22, 0.18] },
        { name: "year_id", type: "categoryId", dependsOn: "year" },
        { name: "national_id", type: "nationalId" },
        { name: "phone", type: "phone", missingPct: 5 },
      ],
    },
    {
      name: "departments",
      rowCount: Math.max(4, Math.min(12, Math.round(n * 0.05))),
      columns: [
        { name: "department_id", type: "id" },
        { name: "name", type: "category", categories: ["Computer Science", "Electrical Engineering", "Business Administration", "Mechanical Engineering", "Civil Engineering", "Medicine", "Law", "Economics"], weights: [0.2, 0.15, 0.18, 0.12, 0.1, 0.1, 0.08, 0.07] },
        { name: "name_id", type: "categoryId", dependsOn: "name" },
        { name: "head", type: "name" },
        { name: "established", type: "date" },
      ],
    },
    {
      name: "courses",
      rowCount: Math.max(5, Math.round(n * 0.1)),
      columns: [
        { name: "course_id", type: "id" },
        { name: "title", type: "category", categories: ["Data Structures", "Algorithms", "Database Systems", "Calculus", "Physics", "Economics 101", "Operating Systems", "Machine Learning", "Linear Algebra"], weights: [0.15, 0.12, 0.13, 0.12, 0.1, 0.1, 0.1, 0.1, 0.08] },
        { name: "title_id", type: "categoryId", dependsOn: "title" },
        { name: "credits", type: "number", distribution: "normal", mean: 3, std: 1, min: 1, max: 6, decimals: 0 },
        { name: "fee", type: "money", mean: 15000, std: 5000, min: 5000, max: 50000, decimals: 2 },
      ],
    },
    {
      name: "enrollments",
      rowCount: enrollments,
      parent: { table: "students", column: "student_id", as: "student_id" },
      columns: [
        { name: "enrollment_id", type: "id" },
        { name: "student_id", type: "computed", refTable: "students", refColumn: "student_id" },
        { name: "course_id", type: "computed", refTable: "courses", refColumn: "course_id" },
        { name: "enroll_date", type: "date" },
        { name: "grade", type: "category", categories: ["A", "B", "C", "D", "F"], weights: [0.3, 0.35, 0.2, 0.1, 0.05] },
        { name: "grade_id", type: "categoryId", dependsOn: "grade" },
        { name: "fee_paid", type: "money", mean: 15000, std: 5000, min: 0, max: 50000, decimals: 2 },
      ],
    },
  ];
}

// --- Bank: accounts, transactions (running balance) ---
function bankTables(c: CountryInfo, n: number): TableDef[] {
  const txCount = Math.max(10, n * 4);
  return [
    {
      name: "accounts",
      rowCount: n,
      columns: [
        { name: "account_id", type: "id" },
        { name: "holder", type: "name" },
        { name: "email", type: "email" },
        { name: "city", type: "city" },
        { name: "national_id", type: "nationalId" },
        { name: "phone", type: "phone", missingPct: 4 },
        { name: "opened_date", type: "date" },
        { name: "account_type", type: "category", categories: ["Savings", "Current", "Salary", "Business"], weights: [0.45, 0.2, 0.2, 0.15] },
        { name: "account_type_id", type: "categoryId", dependsOn: "account_type" },
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
        { name: "description", type: "category", categories: ["Salary", "Rent", "Groceries", "ATM Withdrawal", "Online Shopping", "Utility Bill", "Transfer", "Loan Repayment"], weights: [0.15, 0.12, 0.2, 0.12, 0.13, 0.1, 0.13, 0.05] },
        { name: "description_id", type: "categoryId", dependsOn: "description" },
        { name: "amount", type: "money", mean: 0, std: 300, min: -50000, max: 80000, decimals: 2 },
        { name: "balance", type: "computed", formula: "runningBalance" },
      ],
    },
  ];
}

// --- Shop: customers -> orders -> order_items (totals = sum of items) ---
function shopTables(c: CountryInfo, n: number): TableDef[] {
  const orderCount = Math.max(5, Math.round(n * 1.5));
  const itemCount = orderCount * 3;
  return [
    {
      name: "customers",
      rowCount: n,
      columns: [
        { name: "customer_id", type: "id" },
        { name: "gender", type: "gender", categories: ["Female", "Male"], weights: [0.5, 0.5] },

        { name: "name", type: "name" },
        { name: "gender_id", type: "categoryId", dependsOn: "gender" },
        { name: "email", type: "email" },
        { name: "phone", type: "phone", missingPct: 4 },
        { name: "city", type: "city" },
        { name: "national_id", type: "nationalId" },
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
  ];
}

// --- IoT: devices + sensor readings ---
function iotTables(c: CountryInfo, n: number): TableDef[] {
  const readings = Math.max(20, n * 5);
  return [
    {
      name: "devices",
      rowCount: n,
      columns: [
        { name: "device_id", type: "id" },
        { name: "device_name", type: "text" },
        { name: "type", type: "category", categories: ["temperature", "humidity", "pressure", "co2", "motion"], weights: [0.3, 0.25, 0.2, 0.15, 0.1] },
        { name: "type_id", type: "categoryId", dependsOn: "type" },
        { name: "location", type: "city" },
        { name: "installed_date", type: "date" },
        { name: "firmware", type: "category", categories: ["v1.0", "v1.1", "v2.0", "v2.1"], weights: [0.2, 0.3, 0.35, 0.15] },
        { name: "firmware_id", type: "categoryId", dependsOn: "firmware" },
        { name: "online", type: "boolean", weights: [0.92, 0.08] },
      ],
    },
    {
      name: "readings",
      rowCount: readings,
      parent: { table: "devices", column: "device_id", as: "device_id" },
      columns: [
        { name: "reading_id", type: "id" },
        { name: "device_id", type: "computed", refTable: "devices", refColumn: "device_id" },
        { name: "timestamp", type: "datetime" },
        { name: "value", type: "number", distribution: "normal", mean: 22, std: 4, min: -10, max: 60, decimals: 2 },
        { name: "unit", type: "category", categories: ["°C", "%", "hPa", "ppm"], weights: [0.3, 0.25, 0.2, 0.25] },
        { name: "unit_id", type: "categoryId", dependsOn: "unit" },
        { name: "battery_pct", type: "number", distribution: "normal", mean: 70, std: 20, min: 0, max: 100, decimals: 0 },
      ],
    },
  ];
}

// --- Employees: HR ---
function employeesTables(c: CountryInfo, n: number): TableDef[] {
  return [
    {
      name: "employees",
      rowCount: n,
      columns: [
        { name: "employee_id", type: "id" },
        { name: "gender", type: "gender", categories: ["Female", "Male"], weights: [0.4, 0.6] },

        { name: "name", type: "name" },
        { name: "gender_id", type: "categoryId", dependsOn: "gender" },
        { name: "age", type: "age", mean: 35, std: 9, min: 22, max: 65 },
        { name: "email", type: "email" },
        { name: "phone", type: "phone", missingPct: 6 },
        { name: "city", type: "city" },
        { name: "national_id", type: "nationalId" },
        { name: "department", type: "category", categories: ["Engineering", "Sales", "Marketing", "Finance", "HR", "Support"], weights: [0.35, 0.2, 0.12, 0.1, 0.08, 0.15] },
        { name: "department_id", type: "categoryId", dependsOn: "department" },
        { name: "level", type: "category", categories: ["Junior", "Mid", "Senior", "Lead", "Director"], weights: [0.4, 0.3, 0.18, 0.08, 0.04] },
        { name: "level_id", type: "categoryId", dependsOn: "level" },
        { name: "salary", type: "money", relationship: "job->salary", dependsOn: "level", mean: 75000, std: 25000, min: 30000, max: 250000, decimals: 0 },
        { name: "hire_date", type: "date" },
      ],
    },
  ];
}

// --- Generic: a single customers table ---
function genericTables(c: CountryInfo, n: number): TableDef[] {
  return [
    {
      name: "customers",
      rowCount: n,
      columns: [
        { name: "customer_id", type: "id" },
        { name: "gender", type: "gender", categories: ["Female", "Male"], weights: [0.5, 0.5] },

        { name: "name", type: "name" },
        { name: "gender_id", type: "categoryId", dependsOn: "gender" },
        { name: "age", type: "age", mean: 38, std: 12, min: 18, max: 85 },
        { name: "email", type: "email", missingPct: 2 },
        { name: "phone", type: "phone", missingPct: 5 },
        { name: "city", type: "city" },
        { name: "national_id", type: "nationalId" },
        { name: "job", type: "job" },
        { name: "salary", type: "money", relationship: "job->salary", dependsOn: "job", min: 20000, max: 300000, decimals: 0 },
        { name: "joined_date", type: "date" },
      ],
    },
  ];
}

// Build a Plan from the manual "settings" mode. The user picks a template
// (customers, employees, products, iot, events, students), a row count, a seed,
// a locale, and a missing-value percentage. We build the plan and apply the
// user's overrides (missing %, outlier %, country/locale via Faker).
import { buildTemplate } from "./templates";
import type { TemplateName } from "./templates";
import type { Plan, ColumnDef } from "./types";

// All available single-table templates for the "Tabular data" mode.
// Adding one here automatically adds it to the dropdown in the settings panel.
export const TABULAR_TEMPLATES = [
  "customers",
  "students",
  "employees",
  "products",
  "iot_sensors",
  "events",
  "patients",
] as const;

export type TabularTemplate = (typeof TABULAR_TEMPLATES)[number];

export const TABULAR_LABELS: Record<TabularTemplate, string> = {
  customers: "Customers",
  students: "Students (university)",
  employees: "Employees (HR)",
  products: "Products (catalog)",
  iot_sensors: "IoT sensors (telemetry)",
  events: "Events / conferences",
  patients: "Patients (hospital)",
};

export interface SettingsConfig {
  template: TabularTemplate | TemplateName;
  rowCount: number;
  seed: number;
  locale: string;
  missingPct: number; // applied to most non-id columns
  outlierPct: number;
}

// Customers: a classic CRM-style table.
function customersPlan(n: number, locale: string, seed: number): Plan {
  return {
    locale,
    seed,
    description: "Customer table with realistic names, ages, cities and spend.",
    tables: [
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
          { name: "job", type: "job" },
          { name: "salary", type: "money", relationship: "job->salary", dependsOn: "job", min: 20000, max: 300000, decimals: 0 },
          { name: "joined_date", type: "date" },
          { name: "lifetime_spend", type: "money", mean: 1200, std: 800, min: 0, max: 20000, decimals: 2 },
        ],
      },
    ],
  };
}

// Employees: HR-style with department, job level, salary bands.
function employeesPlan(n: number, locale: string, seed: number): Plan {
  return {
    locale,
    seed,
    description: "Employee table with departments, levels and salary bands.",
    tables: [
      {
        name: "employees",
        rowCount: n,
        columns: [
          { name: "employee_id", type: "id" },
          { name: "gender", type: "gender", categories: ["Female", "Male"], weights: [0.45, 0.55] },

          { name: "name", type: "name" },
          { name: "gender_id", type: "categoryId", dependsOn: "gender" },
          { name: "age", type: "age", mean: 35, std: 9, min: 22, max: 65 },
          { name: "email", type: "email" },
          { name: "phone", type: "phone", missingPct: 6 },
          { name: "department", type: "category", categories: ["Engineering", "Sales", "Marketing", "Finance", "HR", "Support"], weights: [0.35, 0.2, 0.12, 0.1, 0.08, 0.15] },
          { name: "department_id", type: "categoryId", dependsOn: "department" },
          { name: "level", type: "category", categories: ["Junior", "Mid", "Senior", "Lead", "Director"], weights: [0.4, 0.3, 0.18, 0.08, 0.04] },
          { name: "level_id", type: "categoryId", dependsOn: "level" },
          { name: "salary", type: "money", relationship: "job->salary", dependsOn: "level", mean: 75000, std: 25000, min: 30000, max: 250000, decimals: 0 },
          { name: "hire_date", type: "date" },
          { name: "city", type: "city" },
        ],
      },
    ],
  };
}

// Products: a catalog with category, price skew, stock.
function productsPlan(n: number, locale: string, seed: number): Plan {
  return {
    locale,
    seed,
    description: "Product catalog with categories, prices and stock levels.",
    tables: [
      {
        name: "products",
        rowCount: n,
        columns: [
          { name: "product_id", type: "id" },
          { name: "product", type: "productName" },
          { name: "category", type: "category", categories: ["Electronics", "Accessories", "Office", "Home", "Outdoor"], weights: [0.3, 0.2, 0.2, 0.15, 0.15] },
          { name: "category_id", type: "categoryId", dependsOn: "category" },
          { name: "price", type: "price", decimals: 2 },
          { name: "cost", type: "money", mean: 30, std: 25, min: 1, max: 400, decimals: 2 },
          { name: "stock", type: "number", distribution: "exponential", min: 0, max: 1000, decimals: 0 },
          { name: "rating", type: "number", distribution: "normal", mean: 4.2, std: 0.6, min: 1, max: 5, decimals: 1 },
          { name: "sku", type: "text", format: "sku" },
          { name: "in_stock", type: "boolean", weights: [0.85, 0.15] },
        ],
      },
    ],
  };
}

// IoT sensors: telemetry with realistic sensor readings.
function iotSensorsPlan(n: number, locale: string, seed: number): Plan {
  return {
    locale,
    seed,
    description: "IoT sensor telemetry: temperature, humidity, battery across devices.",
    tables: [
      {
        name: "sensor_readings",
        rowCount: n,
        columns: [
          { name: "reading_id", type: "id" },
          { name: "device_id", type: "text", format: "uuid" },
          { name: "sensor_type", type: "category", categories: ["temperature", "humidity", "pressure", "co2"], weights: [0.4, 0.3, 0.2, 0.1] },
          { name: "sensor_type_id", type: "categoryId", dependsOn: "sensor_type" },
          { name: "location", type: "city" },
          { name: "timestamp", type: "datetime" },
          { name: "value", type: "number", distribution: "normal", mean: 22, std: 4, min: -10, max: 60, decimals: 2 },
          { name: "battery_pct", type: "number", distribution: "normal", mean: 70, std: 20, min: 0, max: 100, decimals: 0 },
          { name: "online", type: "boolean", weights: [0.92, 0.08] },
        ],
      },
    ],
  };
}

// Events: conferences/meetups with attendance and ticket prices.
function eventsPlan(n: number, locale: string, seed: number): Plan {
  return {
    locale,
    seed,
    description: "Event schedule with attendance, venues and ticket prices.",
    tables: [
      {
        name: "events",
        rowCount: n,
        columns: [
          { name: "event_id", type: "id" },
          { name: "name", type: "text" },
          { name: "type", type: "category", categories: ["Conference", "Workshop", "Meetup", "Webinar", "Hackathon"], weights: [0.3, 0.2, 0.25, 0.15, 0.1] },
          { name: "type_id", type: "categoryId", dependsOn: "type" },
          { name: "city", type: "city" },
          { name: "event_date", type: "date" },
          { name: "attendees", type: "number", distribution: "exponential", min: 5, max: 5000, decimals: 0 },
          { name: "ticket_price", type: "money", mean: 150, std: 120, min: 0, max: 2000, decimals: 2 },
          { name: "capacity", type: "number", distribution: "normal", mean: 300, std: 150, min: 10, max: 2000, decimals: 0 },
          { name: "organizer", type: "company" },
        ],
      },
    ],
  };
}

// Patients: hospital patients (single-table variant of the hospital template).
function patientsPlan(n: number, locale: string, seed: number): Plan {
  return {
    locale,
    seed,
    description: "Patient table with demographics and contact info.",
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
          { name: "blood_group", type: "category", categories: ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"], weights: [0.34, 0.06, 0.09, 0.02, 0.38, 0.07, 0.03, 0.01] },
          { name: "blood_group_id", type: "categoryId", dependsOn: "blood_group" },
          { name: "phone", type: "phone", missingPct: 6 },
          { name: "city", type: "city" },
          { name: "admission_date", type: "date" },
        ],
      },
    ],
  };
}

export function buildSettingsPlan(cfg: SettingsConfig): Plan {
  let plan: Plan;
  switch (cfg.template) {
    case "customers":
      plan = customersPlan(cfg.rowCount, cfg.locale, cfg.seed);
      break;
    case "employees":
      plan = employeesPlan(cfg.rowCount, cfg.locale, cfg.seed);
      break;
    case "products":
      plan = productsPlan(cfg.rowCount, cfg.locale, cfg.seed);
      break;
    case "iot_sensors":
      plan = iotSensorsPlan(cfg.rowCount, cfg.locale, cfg.seed);
      break;
    case "events":
      plan = eventsPlan(cfg.rowCount, cfg.locale, cfg.seed);
      break;
    case "patients":
      plan = patientsPlan(cfg.rowCount, cfg.locale, cfg.seed);
      break;
    default:
      // Relational templates (university/shop/bank/hospital) + students.
      if (cfg.template === "students") {
        plan = buildTemplate("university", cfg.rowCount, cfg.locale, cfg.seed);
      } else {
        plan = buildTemplate(cfg.template as TemplateName, cfg.rowCount, cfg.locale, cfg.seed);
      }
  }

  // Apply the user's global missing/outlier percentage to most columns.
  // We skip id and FK columns so integrity is never broken by missing values.
  const protectedTypes = new Set(["id", "computed"]);
  for (const table of plan.tables) {
    for (const col of table.columns) {
      if (protectedTypes.has(col.type)) continue;
      if (cfg.missingPct > 0) col.missingPct = cfg.missingPct;
      if (cfg.outlierPct > 0 && (col.type === "number" || col.type === "money" || col.type === "age")) {
        col.outlierPct = cfg.outlierPct;
      }
    }
  }
  plan.seed = cfg.seed;
  return plan;
}

// Helper used by the chat-to-edit feature: tweak a plan's rules with a sentence.
// This is a lightweight heuristic so it works even without the AI model.
export function applyRuleTweak(plan: Plan, sentence: string): Plan {
  const s = sentence.toLowerCase();
  const next = structuredClone(plan);

  // "make 20% more late payments" -> bump a "late"/"refunded"/"pending" weight.
  const morePct = s.match(/(\d+)\s*%\s*more/);
  const lessPct = s.match(/(\d+)\s*%\s*less/);
  const delta = morePct ? parseInt(morePct[1]) / 100 : lessPct ? -parseInt(lessPct[1]) / 100 : 0;

  for (const table of next.tables) {
    for (const col of table.columns) {
      if (col.categories) {
        // bump categories whose name appears in the sentence
        col.categories.forEach((cat, i) => {
          if (s.includes(cat.toLowerCase()) && col.weights) {
            col.weights[i] = Math.max(0.01, col.weights[i] * (1 + delta));
          }
        });
        // renormalize weights so they still sum to 1
        if (col.weights) {
          const sum = col.weights.reduce((a, b) => a + b, 0);
          col.weights = col.weights.map((w) => w / sum);
        }
      }
      // "double the rows" / "20% more rows"
      if (/more rows|extra rows|add.*rows/.test(s)) {
        const m = s.match(/(\d+)\s*%/);
        if (m) table.rowCount = Math.max(1, Math.round(table.rowCount * (1 + parseInt(m[1]) / 100)));
      }
    }
  }
  next.description = `Adjusted by chat: "${sentence}"`;
  return next;
}

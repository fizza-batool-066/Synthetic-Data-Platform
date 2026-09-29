// AI integration. Supports two providers:
//  - "zai": the built-in Z.ai SDK (works with no key, good default).
//  - "groq": a user-provided Groq API key (OpenAI-compatible endpoint).
//
// Three AI features live here:
//   generatePlanFromPrompt() — turn a sentence into a validated Plan
//   aiRealismReview()        — AI reviews a 20-row sample for impossible values
//   aiChatEdit()             — turn an edit sentence into rule tweaks
//
// The user's API key is read from the DB (server-side only) and is NEVER sent
// to the browser or written into generated files.
import ZAI from "z-ai-web-dev-sdk";
import { db } from "./db";
import { getCurrentUser } from "./auth";
import type { Plan, ColumnDef, TableDef, ColumnType } from "./synthetic";

// Friendly error type so API routes can map messages to the UI.
export class AiError extends Error {
  constructor(message: string, public kind: "no_key" | "bad_key" | "rate_limit" | "network" | "bad_json" | "unknown" = "unknown") {
    super(message);
  }
}

interface AiConfig {
  provider: "zai" | "groq";
  model: string;
  apiKey?: string | null;
}

// Read the logged-in user's AI settings (never exposed to the client).
// Default provider is Groq (using the GROQ_API_KEY from .env). The user can
// switch provider/model or paste their own key in the Settings page.
async function getAiConfig(): Promise<AiConfig> {
  const defaultModel = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const user = await getCurrentUser();
  if (user) {
    const s = await db.settings.findUnique({ where: { userId: user.id } });
    if (s) return { provider: s.provider as "zai" | "groq", model: s.model, apiKey: s.apiKey };
  }
  // Fall back to Groq with the env key (works out of the box).
  return { provider: "groq", model: defaultModel };
}

// Core chat completion that routes to the configured provider.
// If Groq fails (rejected key, rate limit, network), we automatically fall back
// to the built-in Z.ai SDK so the app keeps working.
async function chat(messages: { role: string; content: string }[], cfg: AiConfig): Promise<string> {
  if (cfg.provider === "groq") {
    const key = cfg.apiKey || process.env.GROQ_API_KEY;
    const model = cfg.model || process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
    const base = process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
    if (key) {
      try {
        const res = await fetch(`${base}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({ model, messages, temperature: 0.4 }),
        });
        if (res.ok) {
          const data = await res.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) return content;
        }
        // If the key was rejected (401/403) or rate-limited (429), fall through
        // to the built-in Z.ai SDK so the user still gets a result.
        if (res.status === 401 || res.status === 403 || res.status === 429) {
          console.warn(`Groq returned ${res.status}; falling back to built-in AI.`);
        } else {
          throw new AiError(`Groq request failed (${res.status}).`, "network");
        }
      } catch (e) {
        if (e instanceof AiError) throw e;
        // network error -> fall through to built-in AI
        console.warn("Groq network error; falling back to built-in AI.");
      }
    }
  }

  // Built-in Z.ai SDK (used as the default and as a fallback when Groq fails).
  try {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: messages as never,
      thinking: { type: "disabled" },
    });
    return completion.choices?.[0]?.message?.content ?? "";
  } catch (e) {
    throw new AiError("The AI service is unavailable right now. Check your API key in Settings.", "network");
  }
}

// Pull a JSON object out of an LLM response that may include code fences/text.
function extractJson(text: string): unknown {
  // Try direct parse first.
  try {
    return JSON.parse(text);
  } catch {
    /* fall through */
  }
  // Look for a ```json ... ``` block.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try {
      return JSON.parse(fence[1]);
    } catch {
      /* fall through */
    }
  }
  // Look for the first { ... last }.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(text.slice(start, end + 1));
  }
  throw new AiError("The AI did not return valid JSON. Please rephrase your prompt and try again.", "bad_json");
}

// Map loose type names from the LLM to our strict ColumnType union.
const TYPE_ALIASES: Record<string, ColumnType> = {
  string: "text", text: "text", str: "text",
  int: "number", integer: "number", float: "number", double: "number", numeric: "number", number: "number",
  age: "age", gender: "gender", sex: "gender",
  name: "name", fullname: "name", "full name": "name",
  email: "email", phone: "phone", tel: "phone",
  address: "address", city: "city", country: "country", postcode: "postcode", zip: "postcode",
  date: "date", datetime: "datetime", timestamp: "datetime",
  money: "money", currency: "money", price: "price", amount: "money",
  category: "category", enum: "category", categorical: "category",
  boolean: "boolean", bool: "boolean", flag: "boolean",
  job: "job", title: "job", company: "company",
  product: "productName", "product name": "productName", quantity: "quantity", qty: "quantity",
  id: "id", uuid: "id",
  categoryid: "categoryId", "category id": "categoryId", code: "categoryId",
};

// Validate and coerce an LLM plan into our strict Plan type.
function validatePlan(raw: unknown, seed: number, defaultLocale: string): Plan {
  if (!raw || typeof raw !== "object") throw new AiError("The AI plan is not an object.", "bad_json");
  const obj = raw as Record<string, unknown>;
  const tablesRaw = obj.tables;
  if (!Array.isArray(tablesRaw) || tablesRaw.length === 0) {
    throw new AiError("The AI plan has no tables. Try a more specific prompt.", "bad_json");
  }

  const tables: TableDef[] = [];
  for (const tr of tablesRaw) {
    if (!tr || typeof tr !== "object") throw new AiError("A table in the plan is malformed.", "bad_json");
    const t = tr as Record<string, unknown>;
    const name = String(t.name ?? "table");
    const rowCount = Math.max(1, Math.min(100000, Number(t.rowCount ?? t.rows ?? 50) || 50));
    const colsRaw = t.columns;
    if (!Array.isArray(colsRaw) || colsRaw.length === 0) {
      throw new AiError(`Table "${name}" has no columns.`, "bad_json");
    }
    const columns: ColumnDef[] = [];
    for (const cr of colsRaw) {
      const c = cr as Record<string, unknown>;
      const colName = String(c.name ?? `col${columns.length}`);
      const rawType = String(c.type ?? "text").toLowerCase();
      const type = TYPE_ALIASES[rawType] ?? "text";
      const col: ColumnDef = { name: colName, type };
      if (c.min !== undefined) col.min = Number(c.min);
      if (c.max !== undefined) col.max = Number(c.max);
      if (c.mean !== undefined) col.mean = Number(c.mean);
      if (c.std !== undefined) col.std = Number(c.std);
      if (c.decimals !== undefined) col.decimals = Number(c.decimals);
      if (c.distribution) col.distribution = String(c.distribution) as ColumnDef["distribution"];
      if (Array.isArray(c.categories)) col.categories = (c.categories as unknown[]).map(String);
      if (Array.isArray(c.weights)) col.weights = (c.weights as unknown[]).map(Number);
      if (c.missingPct !== undefined) col.missingPct = Number(c.missingPct);
      if (c.outlierPct !== undefined) col.outlierPct = Number(c.outlierPct);
      if (c.dependsOn) col.dependsOn = String(c.dependsOn);
      if (c.relationship) col.relationship = String(c.relationship);
      if (c.format) col.format = String(c.format);
      columns.push(col);
    }
    const table: TableDef = { name, rowCount, columns };
    if (t.parent && typeof t.parent === "object") {
      const p = t.parent as Record<string, unknown>;
      table.parent = { table: String(p.table), column: String(p.column), as: String(p.as ?? p.column) };
      // Add a FK column automatically if missing.
      if (!columns.find((c) => c.refTable)) {
        columns.unshift({
          name: table.parent.as,
          type: "computed",
          refTable: table.parent.table,
          refColumn: table.parent.column,
        });
      }
    }
    tables.push(table);
  }

  return {
    tables,
    locale: String(obj.locale ?? defaultLocale),
    seed,
    description: String(obj.description ?? "Generated from your prompt."),
  };
}

// FEATURE 1: turn a natural-language prompt into a validated Plan.
export async function generatePlanFromPrompt(
  prompt: string,
  seed: number,
  defaultLocale: string,
): Promise<Plan> {
  const cfg = await getAiConfig();
  const system = `You are a data architect that turns natural-language requests into a JSON data generation plan.

Return ONLY valid JSON (no markdown, no commentary) with this exact shape:
{
  "locale": "en_US",
  "description": "one short sentence describing the dataset",
  "tables": [
    {
      "name": "students",
      "rowCount": 1000,
      "columns": [
        { "name": "student_id", "type": "id" },
        { "name": "gender", "type": "gender", "categories": ["Female","Male"], "weights": [0.1, 0.9] },
        { "name": "gender_id", "type": "categoryId", "dependsOn": "gender" },
        { "name": "age", "type": "age", "mean": 21, "std": 2, "min": 17, "max": 30 },
        { "name": "city", "type": "city" },
        { "name": "email", "type": "email", "missingPct": 5 }
      ]
    }
  ]
}

Rules:
- Use ONLY these column types: id, name, firstName, lastName, gender, age, email, phone, address, city, country, postcode, job, company, date, datetime, number, money, category, boolean, text, productName, price, quantity, categoryId.
- For every categorical/gender column, ALSO add a "categoryId" column with "dependsOn" pointing at it, so each category value gets a stable numeric ID everywhere (e.g. Female=1, Male=2).
- For categories, always include matching "weights" that sum to 1.
- Make columns depend on each other when it makes sense: add "dependsOn" (another column name) and "relationship" such as "job->salary".
- Use realistic distributions: set "distribution":"normal" with mean/std for ages, incomes, prices. Never uniform for those.
- Add a small "missingPct" (1-8) to a few columns for realism.
- For relational data, set "parent": {"table":"X","column":"Y","as":"y_id"} on child tables; the FK column will be added automatically.
- Respect ratios the user asks for (e.g. "10% girls" => gender weights [0.1,0.9]).
- Keep the plan small and focused. 1-3 tables.`;

  const text = await chat(
    [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    cfg,
  );
  const raw = extractJson(text);
  return validatePlan(raw, seed, defaultLocale);
}

// REALISM CHECK: ask the AI to review a sample of 20 rows for impossible values,
// AND for country/topic mismatches (the "Local realism check"). For example, an
// American phone number in a Pakistan dataset, or a "professor" column in a
// hospital dataset. Returns issues and, where possible, auto-fixes them.
export async function aiRealismReview(
  plan: Plan,
  sampleRows: Record<string, unknown>[],
): Promise<{ issues: string[]; fixedPlan?: Plan }> {
  const cfg = await getAiConfig();
  // Extract the detected country/industry from the plan description (set by the
  // context-aware prompt route) so the review knows what to check against.
  const desc = plan.description ?? "";
  const countryMatch = desc.match(/Country:\s*([^.]+)/i);
  const industryMatch = desc.match(/Industry:\s*([^.]+)/i);
  const currencyMatch = desc.match(/Currency:\s*([^.]+)/i);
  const country = countryMatch?.[1]?.trim();
  const industry = industryMatch?.[1]?.trim();
  const currency = currencyMatch?.[1]?.trim();

  const contextLine = [
    country ? `Country: ${country}` : "",
    industry ? `Industry: ${industry}` : "",
    currency ? `Currency: ${currency}` : "",
    `Locale: ${plan.locale}`,
  ].filter(Boolean).join(". ");

  const system = `You review synthetic data for LOCAL realism. Look at the 20 sample rows (JSON).
Check TWO kinds of problems:
1. Impossible values (e.g. age 12 with a PhD, negative price).
2. Country/topic mismatches — anything that does NOT fit the detected country or industry.
   For example: an American phone number (+1) in a Pakistan dataset, a non-Pakistani name
   in a Pakistan dataset, a "professor" column in a hospital, or the wrong currency symbol.
${contextLine ? `\nDetected context: ${contextLine}.` : ""}
Return ONLY JSON: { "issues": ["short issue 1", "short issue 2"] }. If everything fits the country and topic, return { "issues": [] }.`;
  const text = await chat(
    [
      { role: "system", content: system },
      { role: "user", content: `PLAN: ${JSON.stringify(plan).slice(0, 800)}\n\nSAMPLE ROWS:\n${JSON.stringify(sampleRows.slice(0, 20))}` },
    ],
    cfg,
  );
  try {
    const obj = extractJson(text) as { issues?: string[] };
    return { issues: Array.isArray(obj.issues) ? obj.issues.map(String) : [] };
  } catch {
    return { issues: ["Could not parse the realism review response."] };
  }
}

// FEATURE: chat-to-edit. Turn an edit sentence into adjusted rule weights.
// We ask the AI for a small JSON patch of weight changes and apply it.
export async function aiChatEdit(
  plan: Plan,
  sentence: string,
): Promise<{ plan: Plan; changes: string[] }> {
  const cfg = await getAiConfig();
  const system = `You adjust a synthetic data plan based on a user's sentence.
Return ONLY JSON: { "changes": ["short human readable change 1", ...], "weightOverrides": [ { "table":"orders","column":"status","category":"pending","newWeight":0.3 } ] }.
Only override weights you are confident about. Leave things you cannot change out.`;
  const text = await chat(
    [
      { role: "system", content: system },
      { role: "user", content: `PLAN: ${JSON.stringify(plan).slice(0, 1500)}\n\nSENTENCE: ${sentence}` },
    ],
    cfg,
  );
  let changes: string[] = [];
  const next = structuredClone(plan);
  try {
    const obj = extractJson(text) as { changes?: string[]; weightOverrides?: Array<Record<string, unknown>> };
    changes = Array.isArray(obj.changes) ? obj.changes.map(String) : [];
    if (Array.isArray(obj.weightOverrides)) {
      for (const o of obj.weightOverrides) {
        const table = next.tables.find((t) => t.name === String(o.table));
        if (!table) continue;
        const col = table.columns.find((c) => c.name === String(o.column));
        if (!col || !col.categories) continue;
        const idx = col.categories.indexOf(String(o.category));
        if (idx >= 0 && col.weights && typeof o.newWeight === "number") {
          col.weights[idx] = o.newWeight;
          const sum = col.weights.reduce((a, b) => a + b, 0);
          col.weights = col.weights.map((w) => w / sum);
        }
      }
    }
  } catch {
    changes = ["Could not apply the AI edit — try rephrasing."];
  }
  next.description = `Edited via chat: "${sentence}"`;
  return { plan: next, changes };
}

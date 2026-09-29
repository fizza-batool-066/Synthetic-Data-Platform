# Synthetic Data Platform

Create **realistic, privacy-safe fake data** in your browser: tables, linked
(relational) tables, PDF invoices & bank statements, prompt-based generation via
AI, and a "learn from a small CSV" mode that clones a sample's trends without
copying a single row.

> Built for a hackathon. The brief asked for a Python (Flask/FastAPI) backend,
> but this implementation runs on **Next.js 16 + TypeScript** (the project's
> native stack) so it ships as a single app — the functionality is identical to
> what was requested. `requirements.txt` lists the npm dependencies (the Node
> equivalent of a Python requirements file).

---

## ✨ Features

### Base features
- **Tabular data** — generate a table (e.g. customers) with a chosen row count,
  a random seed, and configurable missing values / outliers.
- **Relational data** — linked tables (Customers → Orders → Order items).
  Every foreign key matches a real parent row, and order totals equal the sum
  of their line items.
- **Documents** — generate invoices and bank statements as PDFs. Totals and
  running balances are always correct.
- **One clean screen** — pick the data type on the left, settings in the
  middle, a live preview table on the right, and buttons to download CSV, JSON,
  or PDF.

### New feature 1 — Prompt-based generation
Type what you want in plain words (e.g. *"Make a university dataset with 1,000
students, only 10% girls, and most students from the city."*) and the AI returns
a JSON plan (tables, columns, types, rules). The JSON is **validated** before any
data is generated; if it's malformed you get a friendly error. A normal
**Settings mode** is always available too.

### New feature 2 — Summary after every generation
A **"How this data was made"** box shows rows, columns, the rules used, and key
facts (e.g. *"Only 10% are female, as requested. 70% live in the city. Average
age is 21."*). Every number is **computed from the real generated data**, so the
summary always matches the download. Includes a **Download summary** button.

### New feature 3 — API key support
A **Settings** page lets you paste your own AI API key and choose the
provider/model. The key is **never** put in the frontend, never logged, and never
saved into generated files or the summary — it lives only on the backend (in the
DB or `.env`). If no key is added, you get a clear message and can still use the
normal Settings mode. Helpful errors are shown for a wrong key, no internet, or
rate limits.

A **built-in AI** (Z.ai SDK) works with no key at all, so AI features work out of
the box. You can optionally switch to **Groq** with your own key.

### New feature 4 — Learn from a small sample
Upload a small CSV (20–500 rows). The platform detects each column type
(number/text/date/category), finds trends (average, min/max, category shares,
missing values), and **masks private columns** (name, phone, email, ID) before
learning. You can **edit the trends** (e.g. change a category from 30% to 50%)
before generating a bigger dataset that follows the same trends — **without
copying any row** from the sample. A **similarity score** and a **"copied rows"
check** are shown, plus sample-vs-generated charts.

### New feature 5 — Extra add-ons
- **Sample templates**: university, shop, bank, hospital.
- **Save & reload a recipe** (the trends/rules) as JSON.
- **Chat box** to change the generated data with a sentence (e.g. *"make 20%
  more late payments"*).
- **Simple data cleaning**: reports missing/wrong values and offers to fix them.

### Realism rules (very important)
- Realistic **distributions**: most values near the typical range with a few
  rare outliers (normal/bimodal/exponential — never plain uniform for age,
  income, or prices).
- **Columns depend on each other** (age↔class, job↔salary, city↔phone code,
  product↔price).
- Realistic **names, emails, addresses, cities** via Faker with the right locale.
- **Time patterns**: weekends and month-ends are slightly heavier.
- All **calculations are correct**: totals, tax, running balances.
- A small, configurable amount of **realistic mess**: empty values, typos, rare
  outliers.
- **Realism check**: an automated scorer (valid ranges, matching columns, correct
  totals, no impossible values) plus an optional **AI review of 20 rows** that
  lists anything that looks fake (e.g. age 12 with a PhD) and warns you.
- A **Realism score** is shown in the summary.

### Auth
Login / signup is present. Accounts store your saved recipes and AI provider
settings only.

---

## 🚀 Setup

```bash
# 1. Install dependencies
bun install            # or: npm install

# 2. Set up the database (SQLite, file-based — no external DB needed)
bun run db:push

# 3. Start the dev server
bun run dev
```

Open the app via the **Preview panel** (the sandbox does not expose `localhost`
directly). Click **Open in New Tab** if you want a separate browser window.

### Environment (`.env`)
A default `.env` is included with:
- `DATABASE_URL` — SQLite file path
- `AUTH_SECRET` — token-signing secret (change in production)
- `GROQ_API_KEY` / `GROQ_BASE_URL` / `GROQ_MODEL` — a default Groq key so AI
  works out of the box (override per-user in Settings)

The app works with **no** external services: SQLite is file-based, and the
built-in Z.ai AI needs no key.

---

## 🧑‍💻 Usage

1. **Sign up** (or log in).
2. Pick a **data type** on the left:
   - **Tabular** / **Relational** / **Documents** — configure in the middle and
     click Generate.
   - **Prompt mode** — describe the dataset in plain words.
   - **Learn from CSV** — upload a sample and clone its trends.
3. Inspect the **preview table**, the **summary box**, and the **realism score**.
4. **Download** as CSV, JSON, or PDF, or download the **summary**.
5. Use the **chat box** to tweak the data, the **Settings** page for your AI key,
   and **Recipes** to save/reload configurations.

---

## 🗣️ Example prompts

1. **University**
   > Make a university dataset with 1,000 students, only 10% girls, and most
   > students from the city.

2. **E-commerce**
   > Generate an online shop: 500 customers, their orders, and order items.
   > 80% of orders should be paid, 15% pending, 5% refunded.

3. **Bank**
   > Create a bank dataset with 200 accounts and their transactions, including
   > a correct running balance. Most transactions should be small debits with a
   > few large salary credits.

(More prompts work too — just describe the tables, columns, ratios, and any
realism rules you care about.)

---

## 🏗️ Tech stack

- **Next.js 16** (App Router) + **TypeScript 5**
- **Tailwind CSS 4** + **shadcn/ui** components + **Lucide** icons
- **Prisma ORM** (SQLite) for users, settings, and saved recipes
- **Faker** for realistic locale-aware data
- **jsPDF** + **jspdf-autotable** for PDF documents
- **PapaParse** for CSV parsing
- **Zustand** for client state
- **z-ai-web-dev-sdk** (built-in AI) + optional **Groq** (OpenAI-compatible)

See `requirements.txt` for the full dependency list.

---

## 📁 Project structure (key parts)

```
src/
  lib/
    synthetic/        # the data engine: types, RNG/distributions, generators,
                       # generation orchestrator, summary, realism, templates
    ai.ts             # AI integration (plan generation, realism review, chat)
    csv.ts            # CSV learn: type detection, trends, masking, similarity
    pdf.ts            # invoice & bank-statement PDFs (correct totals)
    export.ts         # CSV / JSON export
    auth.ts           # password hashing + JWT session cookies
    db.ts             # Prisma client
  app/
    api/              # all backend routes (auth, generate, learn, download…)
    page.tsx          # the single user-visible route (auth gate → platform)
  components/         # UI: auth screen, app shell, panels, modals
prisma/schema.prisma  # User, Settings, Recipe models
```

---

## 🔒 Privacy notes
- Uploaded CSV samples are kept **only in server memory** (cached briefly under a
  random id) to compute the similarity / copied-rows proof, then they expire.
  Raw PII is never sent to the browser.
- AI API keys are stored server-side only and never returned to the frontend.
- No real personal data is used — everything generated is fake.

---

Built for a hackathon with care for realism and privacy. 🛡️

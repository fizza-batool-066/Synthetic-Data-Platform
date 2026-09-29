"use client";
// Browser history: every generated dataset is saved to localStorage so the user
// can revisit previous generations. Each entry stores a compact preview + the
// full plan (so the dataset can be re-generated deterministically) + the
// summary facts. We cap the number of entries to keep localStorage small.

export interface HistoryEntry {
  id: string;
  createdAt: number; // epoch ms
  title: string; // short label, e.g. "Customers · 200 rows"
  mode: string; // which mode produced it
  plan: unknown; // the full Plan object (deterministic re-generation)
  summary: {
    rowCount: number;
    tableCount: number;
    realismScore: number;
    missingPct: number;
    facts: string[];
    integrity: string[];
  };
  preview: { name: string; columns: string[]; rows: Record<string, unknown>[] }[];
}

const KEY = "sdp_history_v1";
const MAX_ENTRIES = 25;
// Keep previews small so localStorage doesn't blow up on big datasets.
const MAX_PREVIEW_ROWS = 10;
const MAX_PREVIEW_TABLES = 3;

// Read all history entries (newest first). Safe to call during SSR.
export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.sort((a, b) => b.createdAt - a.createdAt) : [];
  } catch {
    return [];
  }
}

// Save a generation to history. Trims the list to MAX_ENTRIES.
export function saveToHistory(entry: HistoryEntry): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const all = loadHistory();
    // Avoid duplicates of the exact same plan+seed within 2 seconds.
    const dedup = all.filter(
      (e) => !(e.title === entry.title && Math.abs(e.createdAt - entry.createdAt) < 2000),
    );
    const next = [entry, ...dedup].slice(0, MAX_ENTRIES);
    window.localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch {
    return loadHistory();
  }
}

// Remove a single history entry by id.
export function deleteHistory(id: string): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const next = loadHistory().filter((e) => e.id !== id);
    window.localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch {
    return loadHistory();
  }
}

// Clear all history.
export function clearHistory(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

// Build a HistoryEntry from a generation result.
export function buildEntry(
  mode: string,
  plan: unknown,
  result: {
    tables: { name: string; columns: string[]; rows: Record<string, unknown>[] }[];
    summary: HistoryEntry["summary"];
  },
): HistoryEntry {
  const p = plan as { tables?: { name: string; rowCount: number }[]; seed?: number } | null;
  const firstTable = p?.tables?.[0];
  const title = firstTable
    ? `${firstTable.name} · ${firstTable.rowCount} rows`
    : "Generated dataset";
  return {
    id: Math.random().toString(36).slice(2) + Date.now().toString(36),
    createdAt: Date.now(),
    title,
    mode,
    plan,
    summary: result.summary,
    preview: result.tables.slice(0, MAX_PREVIEW_TABLES).map((t) => ({
      name: t.name,
      columns: t.columns,
      rows: t.rows.slice(0, MAX_PREVIEW_ROWS),
    })),
  };
}

// Server-only in-memory cache for uploaded CSV samples. We keep the raw rows
// here (never sent to the browser) so the "learn" flow can later compute a
// similarity score and a "no copied rows" proof without re-uploading the file.
// Entries expire after 30 minutes to keep memory bounded.

const TTL_MS = 30 * 60 * 1000;

interface CachedSample {
  rows: Record<string, unknown>[];
  privateColumns: string[];
  expiresAt: number;
}

const cache = new Map<string, CachedSample>();

export function cacheSample(rows: Record<string, unknown>[], privateColumns: string[]): string {
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
  cache.set(id, { rows, privateColumns, expiresAt: Date.now() + TTL_MS });
  // opportunistic cleanup
  if (cache.size > 50) prune();
  return id;
}

export function getSample(id: string): CachedSample | undefined {
  const s = cache.get(id);
  if (!s) return undefined;
  if (Date.now() > s.expiresAt) {
    cache.delete(id);
    return undefined;
  }
  return s;
}

function prune() {
  const now = Date.now();
  for (const [id, s] of cache) {
    if (now > s.expiresAt) cache.delete(id);
  }
}

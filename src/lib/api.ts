"use client";
// Tiny fetch wrapper that posts JSON and returns parsed data or throws a
// friendly error message (the backend always returns { error } on failure).
export async function api<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON (e.g. a file blob handled by the caller).
    return text as unknown as T;
  }
  if (!res.ok) {
    const msg = (data && typeof data === "object" && "error" in data ? String((data as Record<string, unknown>).error) : `Request failed (${res.status})`);
    throw new Error(msg);
  }
  return data as T;
}

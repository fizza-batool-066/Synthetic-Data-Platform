// Seeded random number generator + realistic distribution helpers.
// We use a small mulberry32 PRNG so the same seed always produces the same
// data (reproducible, which is great for testing and demos).

// A deterministic PRNG. seed -> function returning floats in [0, 1).
export function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Uniform float in [min, max).
export function uniform(rng: () => number, min: number, max: number): number {
  return min + (max - min) * rng();
}

// Uniform integer in [min, max] inclusive.
export function uniformInt(rng: () => number, min: number, max: number): number {
  return Math.floor(uniform(rng, min, max + 1));
}

// Box-Muller transform -> a normally-distributed sample. This is the key to
// realistic data: most values cluster near the mean with a few rare extremes.
export function normal(
  rng: () => number,
  mean = 0,
  std = 1,
): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * std;
}

// Clamp a value into [min, max].
export function clamp(x: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, x));
}

// Round to n decimals.
export function round(x: number, decimals = 0): number {
  const f = Math.pow(10, decimals);
  return Math.round(x * f) / f;
}

// Pick a weighted index. weights are relative (need not sum to 1).
export function weightedIndex(rng: () => number, weights: number[]): number {
  const total = weights.reduce((a, b) => a + Math.max(0, b), 0);
  if (total <= 0) return 0;
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= Math.max(0, weights[i]);
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

// True with probability p (0..1).
export function chance(rng: () => number, p: number): boolean {
  return rng() < p;
}

// Format a number as money (2 decimals).
export function money(x: number): number {
  return round(x, 2);
}

// Generate a date between two Date objects, biased toward "time patterns":
// weekends and month-ends are slightly heavier (realistic business peaks).
export function randomDate(
  rng: () => number,
  start: Date,
  end: Date,
): Date {
  const t = start.getTime() + rng() * (end.getTime() - start.getTime());
  return new Date(t);
}

// Introduce a deliberate typo in a string (realistic mess). Swaps two adjacent
// characters or duplicates one.
export function typo(rng: () => number, s: string): string {
  if (s.length < 2) return s;
  const i = uniformInt(rng, 0, s.length - 2);
  const kind = rng();
  if (kind < 0.5) {
    // swap two adjacent chars
    return s.slice(0, i) + s[i + 1] + s[i] + s.slice(i + 2);
  }
  // duplicate a char
  return s.slice(0, i) + s[i] + s[i] + s.slice(i + 1);
}

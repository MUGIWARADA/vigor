/**
 * Deterministic pseudo-random number generation for the demo dataset.
 *
 * The demo dataset must be reproducible: the same seed always produces the
 * same players, metrics, matches and events. This keeps every derived
 * statistic (percentiles, similarity scores, rankings) stable across runs
 * and makes the dataset unit-testable.
 */

export type Rng = () => number

/** Mulberry32 — small, fast, good enough distribution for demo data. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function rand(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min)
}

export function randInt(rng: Rng, min: number, max: number): number {
  return Math.floor(rand(rng, min, max + 1))
}

export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]!
}

/** Approximately normal noise via the sum of uniforms (Irwin–Hall, n=3). */
export function gauss(rng: Rng, mean = 0, sd = 1): number {
  const u = rng() + rng() + rng()
  return mean + (u - 1.5) * sd * 1.1547
}

/** Knuth Poisson sampler, capped to avoid runaway values. */
export function poisson(rng: Rng, lambda: number): number {
  const l = Math.max(0, Math.min(lambda, 18))
  let k = 0
  let p = Math.exp(-l)
  let cum = p
  const u = rng()
  while (u > cum && k < 30) {
    k += 1
    p = (p * l) / k
    cum += p
  }
  return k
}

/** Weighted choice. Weights must be positive; falls back to uniform. */
export function weightedPick<T>(rng: Rng, items: readonly T[], weights: readonly number[]): T {
  const total = weights.reduce((s, w) => s + Math.max(0, w), 0)
  if (total <= 0) return pick(rng, items)
  let u = rng() * total
  for (let i = 0; i < items.length; i++) {
    u -= Math.max(0, weights[i]!)
    if (u <= 0) return items[i]!
  }
  return items[items.length - 1]!
}

/**
 * Deterministic seeded shuffle (Fisher–Yates on a copy).
 * Useful for name pools etc.
 */
export function seededShuffle<T>(rng: Rng, arr: readonly T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

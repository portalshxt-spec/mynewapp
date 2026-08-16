/**
 * Seeded PRNG. Runs are reproducible from a single seed, which is what makes
 * the ghost replay and the chunk shuffler deterministic.
 */

export class Rng {
  private state: number;

  constructor(seed: number) {
    // Avoid the degenerate zero state.
    this.state = (seed >>> 0) || 0x9e3779b9;
  }

  /** mulberry32 — small, fast, good enough for level layout. */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Integer in [min, max]. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  bool(chance = 0.5): boolean {
    return this.next() < chance;
  }

  /** +1 or -1 — used for firewall rotation direction, which flips per instance. */
  sign(): number {
    return this.next() < 0.5 ? -1 : 1;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  /** In-place Fisher-Yates. */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }
}

/** A fresh seed for a fresh run. */
export function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}

/** Stable seed per (run seed, layer) so a layer restart re-seeds identically. */
export function layerSeed(runSeed: number, level: number): number {
  return (Math.imul(runSeed ^ (level * 0x85ebca6b), 0xc2b2ae35) >>> 0) || 1;
}

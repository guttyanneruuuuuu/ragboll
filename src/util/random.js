// ============================================================
// random.js — Seedable PRNG abstraction so the game can replay
// deterministic matches (sword swings, AI choices, particles).
// ============================================================

import { mulberry32 } from './math.js';

/** Convert a string seed to a 32-bit integer. */
export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Wrap a `mulberry32` PRNG with a stack of seeds so subsystems
 * can fork from the master stream without affecting each other.
 */
export class RNG {
  constructor(seed = Date.now()) {
    this.seed = seed;
    this._fn = mulberry32(seed);
    this._calls = 0;
  }

  /** Next float in [0,1). */
  next() {
    this._calls++;
    return this._fn();
  }

  /** Integer in [min, max). */
  int(min, max) {
    return Math.floor(this.next() * (max - min)) + min;
  }

  /** Float in [min, max). */
  range(min, max) {
    return this.next() * (max - min) + min;
  }

  /** Boolean with probability `p`. */
  chance(p) {
    return this.next() < p;
  }

  /** Pick one of the supplied weighted entries `[ {weight, value} ]`. */
  weighted(entries) {
    let total = 0;
    for (const e of entries) total += Math.max(0, e.weight);
    if (total <= 0) return entries[0]?.value;
    let r = this.next() * total;
    for (const e of entries) {
      r -= Math.max(0, e.weight);
      if (r <= 0) return e.value;
    }
    return entries[entries.length - 1].value;
  }

  /** Pick one element uniformly. */
  pick(arr) {
    if (!arr || !arr.length) return undefined;
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Shuffle in place. */
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  /** Fork a deterministic child PRNG (different seed). */
  fork() {
    const next = (this.next() * 0xffffffff) >>> 0;
    return new RNG(next || 1);
  }

  /** Snapshot the internal counter (debug). */
  snapshot() {
    return { seed: this.seed, calls: this._calls };
  }
}

/** Global RNG used for non-deterministic visual effects. */
export const globalRng = new RNG();

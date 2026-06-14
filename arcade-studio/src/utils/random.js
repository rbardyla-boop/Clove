/**
 * Deterministic, seedable PRNG — no Math.random(). Same seed → identical sequence, so scene
 * decoration, particle jitter, and tests are reproducible. Pure; safe in Node and the browser.
 */

/** Hash a string seed into a 32-bit unsigned int (xfnv1a). */
export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — a small, fast, well-distributed 32-bit PRNG. Returns a function in [0, 1). */
export function mulberry32(seedInt) {
  let a = seedInt >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Convenience deterministic random source bound to a string or numeric seed. */
export class SeededRandom {
  constructor(seed = 'arcade-studio') {
    this._next = mulberry32(typeof seed === 'number' ? seed >>> 0 : hashSeed(seed));
  }
  /** Float in [0, 1). */
  next() {
    return this._next();
  }
  /** Float in [min, max). */
  range(min, max) {
    return min + (max - min) * this._next();
  }
  /** Integer in [min, max] inclusive. */
  int(min, max) {
    return Math.floor(min + (max - min + 1) * this._next());
  }
  /** Pick one element from a non-empty array. */
  pick(arr) {
    return arr[Math.floor(this._next() * arr.length)];
  }
  /** True with probability `p`. */
  chance(p) {
    return this._next() < p;
  }
}

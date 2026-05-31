/**
 * Seeded, deterministic PRNG for the HiveWorld simulator.
 *
 * The whole testbed must be reproducible: same seed -> same run. We therefore
 * forbid Math.random() anywhere in the simulator and route every random choice
 * through one of these generators.
 *
 * mulberry32 is a tiny, well-distributed 32-bit generator. It is NOT
 * cryptographically secure and is never used for anything security-relevant —
 * only for scheduling, fault injection and scenario variety.
 */

/** Hash an arbitrary string seed into a 32-bit unsigned integer (xfnv1a). */
export function seedFromString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Create a deterministic RNG. Accepts a number or string seed.
 * Returns a function plus typed helpers; calling the function yields a float in [0,1).
 */
export function makeRng(seed) {
  let state = (typeof seed === 'string' ? seedFromString(seed) : (seed >>> 0)) || 1;

  function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] inclusive. */
  next.int = (min, max) => min + Math.floor(next() * (max - min + 1));
  /** true with probability p (default 0.5). */
  next.bool = (p = 0.5) => next() < p;
  /** Pick one element from a non-empty array. */
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  /** Return a new shuffled copy (Fisher–Yates) — does not mutate input. */
  next.shuffle = (arr) => {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  };

  return next;
}

/** A seeded, deterministic source of randomness. The engine's only one. */
export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /**
   * Integer in [1, maxInclusive]. Equivalent to the original's
   * `INT(RND * n + 1)` idiom, which every random draw in the game used.
   */
  nextInt(maxInclusive: number): number;
}

/**
 * mulberry32. Chosen for being small, fast, and well distributed. The original
 * used the BASIC PDS generator; reproducing it is explicitly not a goal, and
 * every formula is written against a uniform in [0, 1) so the substitution is
 * invisible to game behavior.
 */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    nextInt: (maxInclusive: number) => Math.floor(next() * maxInclusive) + 1,
  };
}

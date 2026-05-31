/**
 * Deterministic, headless Pulse Tap round.
 *
 * This is the SIMULATION twin of the browser mini-game in arcade/pulse-tap-game.js.
 * It produces the same shape of result (hits / accuracy / streak / grade) without
 * any DOM or requestAnimationFrame, seeded so a scenario replays identically.
 *
 * A round NEVER produces money. It produces a score and a grade. Credits are only
 * granted as a SEPARATE, opt-in market event when the simulator runs in
 * economyTestMode — and even then they are internal arcade credits, nothing more.
 */
import { makeRng } from './rng.mjs';

const BEATS = 36; // ~30s of beats, matching the browser round feel

function gradeFor(accuracy, bestStreak) {
  if (accuracy >= 92 && bestStreak >= 12) return 'S';
  if (accuracy >= 80) return 'A';
  if (accuracy >= 65) return 'B';
  if (accuracy >= 45) return 'C';
  return 'D';
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Simulate one round. `skill` in [0,1] is the agent's base hit probability;
 * difficulty ramps slightly with streak, mirroring the real beat speed-up.
 */
export function simulatePulseTapRound({ seed, skill = 0.7 }) {
  const rng = makeRng(seed);
  let hits = 0;
  let misses = 0;
  let streak = 0;
  let best = 0;

  for (let i = 0; i < BEATS; i++) {
    const p = clamp(skill - streak * 0.005, 0.05, 0.98);
    if (rng() < p) {
      hits += 1;
      streak += 1;
      if (streak > best) best = streak;
    } else {
      misses += 1;
      streak = 0;
    }
  }

  const total = hits + misses;
  const accuracy = total ? Math.round((hits / total) * 100) : 0;
  return {
    beats: BEATS,
    hits,
    misses,
    bestStreak: best,
    accuracy,
    grade: gradeFor(accuracy, best),
    score: hits * 100 + best * 25,
  };
}

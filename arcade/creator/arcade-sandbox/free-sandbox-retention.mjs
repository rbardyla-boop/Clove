/**
 * Creator Freedom v1 — LOCAL-ONLY retention core (pure + cross-env).
 *
 * Host-only play history keyed by LOCAL package fingerprint: best score, plays, last score/seed, won
 * flag, a personal grade, and a recent-packages list. There is NO server, NO account, NO leaderboard,
 * NO economy — this is a single-device memory the trusted builder/sandbox HOST keeps in localStorage.
 * It is never read by the sandbox iframe (the importer bans storage in package source), and it grants
 * no authority: every stored score is a local, untrusted self-report.
 *
 * Pure functions take an explicit state object so they are fully node-testable; readStore/writeStore are
 * thin, defensive localStorage wrappers for the host (any storage failure degrades to "no retention").
 */

export const RETENTION_KEY = 'cf_free_sandbox_retention_v1';
const RECENT_MAX = 12;
const SCHEMA = 1;

export function emptyState() { return { v: SCHEMA, by_fp: {}, recent: [] }; }

/** PURE: parse untrusted stored text into a well-shaped state (never throws). */
export function parseState(raw) {
  try {
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object' || o.v !== SCHEMA || typeof o.by_fp !== 'object' || !Array.isArray(o.recent)) return emptyState();
    const by_fp = {};
    for (const [fp, s] of Object.entries(o.by_fp)) {
      if (!s || typeof s !== 'object') continue;
      by_fp[String(fp)] = {
        best: num(s.best), plays: num(s.plays), last_score: num(s.last_score),
        last_seed: num(s.last_seed), won: !!s.won, best_grade: typeof s.best_grade === 'string' ? s.best_grade.slice(0, 2) : '',
      };
    }
    const recent = o.recent
      .filter((r) => r && typeof r === 'object' && typeof r.fp === 'string')
      .map((r) => ({ fp: r.fp, name: typeof r.name === 'string' ? r.name.slice(0, 60) : '' }))
      .slice(0, RECENT_MAX);
    return { v: SCHEMA, by_fp, recent };
  } catch { return emptyState(); }
}
function num(v) { return Number.isFinite(v) ? v : 0; }

/** PURE: a personal grade for an attempt, RELATIVE to the player's own prior best (no fixed economy scale). */
export function gradeFor(score, prevBest, won, firstPlay) {
  if (firstPlay) return won ? 'A' : (score > 0 ? 'B' : 'C');
  if (score > prevBest) return 'S';
  const ratio = prevBest > 0 ? score / prevBest : 1;
  if (won && ratio >= 0.9) return 'A';
  if (ratio >= 0.7) return 'B';
  if (ratio >= 0.4) return 'C';
  return 'D';
}

const GRADE_RANK = { S: 5, A: 4, B: 3, C: 2, D: 1, '': 0 };

/**
 * PURE: record a play result. Returns { state (NEW object), grade, is_best }. Never mutates the input.
 * `result` is the untrusted local proposal: { proposed_score|score, won, elapsed }. `seed` is the
 * package's deterministic seed (for "replay the same run"). `name` is closed display copy.
 */
export function recordResult(state, { fp, name, score, seed, won }) {
  const s0 = (state && state.v === SCHEMA) ? state : emptyState();
  const key = String(fp || '');
  const prev = s0.by_fp[key] || { best: 0, plays: 0, last_score: 0, last_seed: 0, won: false, best_grade: '' };
  const firstPlay = prev.plays === 0;
  const sc = num(score);
  const grade = gradeFor(sc, prev.best, !!won, firstPlay);
  const is_best = firstPlay || sc > prev.best;
  const best_grade = GRADE_RANK[grade] > GRADE_RANK[prev.best_grade] ? grade : prev.best_grade;
  const nextStats = {
    best: Math.max(prev.best, sc), plays: prev.plays + 1, last_score: sc,
    last_seed: num(seed), won: !!won || prev.won, best_grade,
  };
  const recent = [{ fp: key, name: typeof name === 'string' ? name.slice(0, 60) : '' }]
    .concat(s0.recent.filter((r) => r.fp !== key))
    .slice(0, RECENT_MAX);
  return { state: { v: SCHEMA, by_fp: { ...s0.by_fp, [key]: nextStats }, recent }, grade, is_best };
}

/** PURE: stats for one fingerprint, or null. */
export function getStats(state, fp) {
  const s = (state && state.by_fp) ? state.by_fp[String(fp)] : null;
  return s ? { ...s } : null;
}

/** PURE: recent packages, most-recent first. */
export function recentList(state) { return (state && Array.isArray(state.recent)) ? state.recent.slice() : []; }

export function serializeState(state) { return JSON.stringify(state && state.v === SCHEMA ? state : emptyState()); }

// ── defensive host wrappers (browser) ─────────────────────────────────────────
export function readStore(storage) {
  try { const raw = storage.getItem(RETENTION_KEY); return raw ? parseState(raw) : emptyState(); } catch { return emptyState(); }
}
export function writeStore(storage, state) {
  try { storage.setItem(RETENTION_KEY, serializeState(state)); return true; } catch { return false; }
}

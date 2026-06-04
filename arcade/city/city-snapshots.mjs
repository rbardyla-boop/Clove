/**
 * Neon Circuit — City remote-player snapshot buffer + interpolation (Phase 4B), PURE.
 *
 * Remote players are rendered from CANONICAL server snapshots, never predicted. We
 * buffer snapshots by server timestamp and sample an interpolated state a small
 * render-delay in the past, so jitter/irregular snapshot intervals smooth out. If
 * data is missing we hold the last known state; a player absent from a snapshot is
 * simply gone. No private fields are ever stored (snapshots are already public-safe).
 *
 * Imported by the browser scene and the unit tests. No DOM, no network.
 */

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** A snapshot buffer. `delayMs` = render delay; `maxAgeMs` = retention window. */
export function createSnapshotBuffer({ delayMs = 100, maxAgeMs = 1000 } = {}) {
  return { delayMs, maxAgeMs, snaps: [] }; // snaps kept sorted ascending by serverTime
}

/** Drop snapshots older than `now - maxAgeMs` (keeps the buffer bounded). */
export function pruneOldSnapshots(buffer, now) {
  const cutoff = now - buffer.maxAgeMs;
  return { ...buffer, snaps: buffer.snaps.filter((s) => s.serverTime >= cutoff) };
}

/**
 * Insert a snapshot in server-time order (dedup identical serverTime, tolerate
 * out-of-order arrival), then prune stale entries. Ignores malformed input.
 */
export function pushSnapshot(buffer, snap) {
  if (!snap || !Number.isFinite(snap.serverTime) || !Array.isArray(snap.players)) return buffer;
  const players = snap.players.map((p) => ({ id: p.id, x: p.x, y: p.y, facing: Number.isFinite(p.facing) ? p.facing : 0 }));
  const snaps = buffer.snaps.filter((s) => s.serverTime !== snap.serverTime);
  let i = snaps.length;
  while (i > 0 && snaps[i - 1].serverTime > snap.serverTime) i -= 1;
  snaps.splice(i, 0, { serverTime: snap.serverTime, players });
  return pruneOldSnapshots({ ...buffer, snaps }, snap.serverTime);
}

/** Interpolate one player between two states (lerp position, shortest-arc facing). */
export function interpolatePlayerState(a, b, t) {
  const k = clamp(t, 0, 1);
  let df = (b.facing || 0) - (a.facing || 0);
  while (df > Math.PI) df -= 2 * Math.PI;
  while (df < -Math.PI) df += 2 * Math.PI;
  return { id: a.id, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, facing: (a.facing || 0) + df * k };
}

/** The latest buffered server timestamp (0 if empty). */
export function latestServerTime(buffer) {
  return buffer.snaps.length ? buffer.snaps[buffer.snaps.length - 1].serverTime : 0;
}

/**
 * Sample interpolated remote players at `renderTime` (caller passes an already
 * delay-adjusted server-time estimate). Before the first snapshot → []; before the
 * earliest or after the latest → hold that endpoint; otherwise interpolate within
 * the bracketing pair. Players present in only one endpoint are held / appear as-is.
 */
export function sampleSnapshotAt(buffer, renderTime) {
  const snaps = buffer.snaps;
  if (snaps.length === 0) return [];
  if (renderTime <= snaps[0].serverTime) return snaps[0].players.map((p) => ({ ...p }));
  const last = snaps[snaps.length - 1];
  if (renderTime >= last.serverTime) return last.players.map((p) => ({ ...p })); // hold last on gap

  let a = snaps[0];
  let b = last;
  for (let i = 0; i < snaps.length - 1; i += 1) {
    if (snaps[i].serverTime <= renderTime && snaps[i + 1].serverTime >= renderTime) { a = snaps[i]; b = snaps[i + 1]; break; }
  }
  const span = b.serverTime - a.serverTime || 1;
  const t = clamp((renderTime - a.serverTime) / span, 0, 1);
  const bById = new Map(b.players.map((p) => [p.id, p]));
  const aIds = new Set(a.players.map((p) => p.id));
  const out = [];
  for (const pa of a.players) {
    const pb = bById.get(pa.id);
    out.push(pb ? interpolatePlayerState(pa, pb, t) : { ...pa }); // held if it left in b
  }
  for (const pb of b.players) if (!aIds.has(pb.id)) out.push({ ...pb }); // newly appeared
  return out;
}

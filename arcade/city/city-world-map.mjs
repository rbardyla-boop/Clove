/**
 * Neon Circuit — WORLD MAP travel helpers (Phase W-1), PURE + cross-env.
 *
 * DISPLAY/CLIENT-ONLY fast travel over the public district manifest. Two jobs:
 *   (a) a per-block zone ACCENT token (closed table — the world-bible zone palette mapped
 *       onto the shipped blocks; --gold stays reserved for tickets and appears nowhere here);
 *   (b) WAYPOINT planning: BFS shortest path over the manifest's public adjacency so the
 *       map can chain hop-by-hop travel to a non-adjacent block.
 *
 * This module owns NO state, adds NO wire field, and changes NO authority: every hop the
 * client requests still goes through net.requestRoute → the server's validateRouteRequest
 * (adjacent-only). A waypoint is just the client asking for the next legal hop after each
 * arrival. Grants nothing economic. See arcade/virtual-arcade/HIVE_WORLD_ALIGNMENT.md §3.
 */

/** Closed per-block zone accents (display-only; hex tokens, never gold #ffd23f). */
const BLOCK_ACCENTS = Object.freeze({
  'downtown-01': '#ff2d95', // the hub — canonical pink
  'harbor-02':   '#19e3ff', // the waterfront — cyan (5B harbor identity)
  'skyline-03':  '#ff9e3f', // the heights — warm amber (deliberately NOT ticket gold)
  'foundry-04':  '#ff5a5a', // the works — industrial red (racing red, not error)
  'nexus-05':    '#b14aff', // the crossing — violet pulse
  'garden-06':   '#3df58b', // the green — calm green
  'aurora-07':   '#33e0c4', // the polar arc — bright teal
  'relay-08':    '#ffa033', // the junction — signal orange-amber
  'lumen-09':    '#bfeaff', // the beacon — halo ice-blue
});
const NEUTRAL_ACCENT = '#9d8fc4'; // muted fallback for unknown/future blocks

/** PURE: a block's zone accent (hex string; neutral for unknown ids). */
export function blockAccent(cityId) {
  return BLOCK_ACCENTS[cityId] || NEUTRAL_ACCENT;
}

/** PURE: block ids with a bespoke accent (fresh array, for tests/tools). */
export function accentBlockIds() {
  return Object.keys(BLOCK_ACCENTS);
}

/**
 * PURE: BFS shortest path over a public adjacency map. Neighbours are visited in sorted
 * order so the result is deterministic for equal-length alternatives. Returns the full
 * path INCLUDING both endpoints ([from] when from === to), or null when unreachable or
 * either endpoint is unknown to the adjacency.
 */
export function shortestPath(adjacency, fromId, toId) {
  if (!adjacency || typeof adjacency !== 'object') return null;
  if (typeof fromId !== 'string' || typeof toId !== 'string') return null;
  if (!Array.isArray(adjacency[fromId]) || !Array.isArray(adjacency[toId])) return null;
  if (fromId === toId) return [fromId];
  const cameFrom = new Map([[fromId, null]]);
  const queue = [fromId];
  while (queue.length) {
    const cur = queue.shift();
    const neighbours = Array.isArray(adjacency[cur]) ? [...adjacency[cur]].sort() : [];
    for (const next of neighbours) {
      if (cameFrom.has(next) || !Array.isArray(adjacency[next])) continue;
      cameFrom.set(next, cur);
      if (next === toId) {
        const path = [toId];
        for (let p = cur; p !== null; p = cameFrom.get(p)) path.unshift(p);
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}

/**
 * PURE: plan the next legal hop toward a waypoint target, from the manifest the client
 * already holds. Returns { ok:true, target_city_id, next_hop, path, hops_remaining } or
 * { ok:false, reason } with reason ∈ unknown_target | already_here | no_path | no_manifest.
 * The next_hop is ALWAYS adjacent to current — the server re-validates it regardless.
 */
export function planNextHop(manifest, targetId) {
  const cur = manifest && typeof manifest.current_city_id === 'string' ? manifest.current_city_id : null;
  const adj = manifest && manifest.adjacency && typeof manifest.adjacency === 'object' ? manifest.adjacency : null;
  if (!cur || !adj) return { ok: false, reason: 'no_manifest' };
  if (typeof targetId !== 'string' || !Array.isArray(adj[targetId])) return { ok: false, reason: 'unknown_target' };
  if (targetId === cur) return { ok: false, reason: 'already_here' };
  const path = shortestPath(adj, cur, targetId);
  if (!path || path.length < 2) return { ok: false, reason: 'no_path' };
  return {
    ok: true,
    target_city_id: targetId,
    next_hop: path[1],
    path,
    hops_remaining: path.length - 1,
  };
}

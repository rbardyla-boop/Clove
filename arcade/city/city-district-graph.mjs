/**
 * Neon Circuit — District GRAPH model + corridor classifier (Phase 8C-2), PURE + cross-env.
 *
 * DISPLAY-ONLY route readability. Turns the public-safe district manifest (blocks + adjacency the client
 * already holds) into (a) a small fixed-layout graph model for a six-node "DISTRICT MAP" inset, and
 * (b) a corridor grouping so the panel can show adjacency as "Ring" vs "New corridor". It owns NO state,
 * adds NO wire field, and changes NO authority: the adjacent-only routing rule still lives entirely in
 * the server's validateRouteRequest — this module only *renders the same topology more legibly*.
 *
 * The two traversal paths downtown⇄skyline are static (city-district.mjs ADJACENCY):
 *   Ring         : downtown↔harbor, harbor↔skyline, skyline↔foundry, foundry↔downtown
 *   New corridor : downtown↔garden, garden↔nexus, nexus↔skyline   (Phase 8A)
 * Harbor and foundry are NOT adjacent — there is no edge between them.
 *
 * Grants nothing economic. See docs/PHASE_8C_DISTRICT_CONTENT_DEPTH.md §4 (Polish 2/4/5).
 */

/** Undirected edge key (order-independent). */
const edgeKey = (a, b) => [a, b].sort().join('|');

/** The static corridor edge-sets (the only knowledge this module hardcodes). */
const RING_EDGES = Object.freeze([
  ['downtown-01', 'harbor-02'], ['harbor-02', 'skyline-03'],
  ['skyline-03', 'foundry-04'], ['foundry-04', 'downtown-01'],
]);
const NEW_EDGES = Object.freeze([
  ['downtown-01', 'garden-06'], ['garden-06', 'nexus-05'], ['nexus-05', 'skyline-03'],
]);
const RING_SET = new Set(RING_EDGES.map(([a, b]) => edgeKey(a, b)));
const NEW_SET = new Set(NEW_EDGES.map(([a, b]) => edgeKey(a, b)));

/** Fixed, stable 2D layout for the known six-block topology: a ring "diamond" + a lower new-corridor swoop. */
const NODE_POS = Object.freeze({
  'downtown-01': { x: 14, y: 48 }, // left hub (degree 3)
  'harbor-02':   { x: 60, y: 16 }, // ring, top
  'skyline-03':  { x: 106, y: 48 }, // right hub (degree 3)
  'foundry-04':  { x: 60, y: 80 }, // ring, bottom
  'garden-06':   { x: 44, y: 104 }, // new corridor, lower-left
  'nexus-05':    { x: 76, y: 104 }, // new corridor, lower-right
});
export const DISTRICT_GRAPH_VIEWBOX = '0 0 120 120';

/** PURE: which corridor an edge belongs to — 'ring' | 'new' | null (no direct edge / not adjacent). */
export function corridorOf(a, b) {
  const k = edgeKey(a, b);
  if (RING_SET.has(k)) return 'ring';
  if (NEW_SET.has(k)) return 'new';
  return null;
}

/** A short panel label for a block (drops the trailing " Block"). */
function shortLabel(displayName, cityId) {
  if (typeof displayName === 'string' && displayName) return displayName.replace(/\s+Block$/, '');
  return String(cityId || '').replace(/-\d+$/, '');
}

/** Deterministic fallback position for an unknown block (a point on a circle), so a future block still draws. */
function fallbackPos(index, count) {
  const t = (index / Math.max(1, count)) * Math.PI * 2;
  return { x: 60 + Math.cos(t) * 44, y: 60 + Math.sin(t) * 44 };
}

/**
 * PURE: group a block's adjacent ids by corridor for the panel. Returns { ring:[…], new:[…] }. Every id
 * is one of currentId's real neighbours; the unions of ring+new exactly equal the input (falsifier #1).
 */
export function groupAdjacentByCorridor(currentId, adjacentIds) {
  const ring = [], neu = [];
  for (const id of Array.isArray(adjacentIds) ? adjacentIds : []) {
    // every real adjacency edge classifies as ring or new (proven for all six blocks in the unit test);
    // a future edge in neither set falls back to the Ring group — a display default, never a routing change.
    (corridorOf(currentId, id) === 'new' ? neu : ring).push(id);
  }
  return { ring, new: neu };
}

/**
 * PURE: build the district-graph model from the manifest (display-only). Nodes carry a fixed layout
 * position + current/adjacent flags; edges carry their corridor + whether they touch the current block
 * (incident = a directly-routable edge from here). No player/economic data.
 */
export function districtGraphModel(manifest) {
  const cur = manifest && typeof manifest.current_city_id === 'string' ? manifest.current_city_id : null;
  const adj = (manifest && manifest.adjacency && typeof manifest.adjacency === 'object') ? manifest.adjacency : {};
  const blocks = Array.isArray(manifest && manifest.blocks) ? manifest.blocks : [];
  const ids = blocks.length ? blocks.map((b) => b.city_id) : Object.keys(adj);
  const adjOfCur = Array.isArray(adj[cur]) ? adj[cur] : [];

  const nodes = ids.map((id, i) => {
    const pos = NODE_POS[id] || fallbackPos(i, ids.length);
    const b = blocks.find((x) => x && x.city_id === id);
    return {
      city_id: id,
      label: shortLabel(b && b.display_name, id),
      x: pos.x, y: pos.y,
      current: id === cur,
      adjacent: adjOfCur.includes(id),
    };
  });

  const seen = new Set();
  const edges = [];
  for (const a of ids) {
    for (const b of (Array.isArray(adj[a]) ? adj[a] : [])) {
      const k = edgeKey(a, b);
      if (seen.has(k) || !ids.includes(b)) continue;
      seen.add(k);
      edges.push({ from: a, to: b, corridor: corridorOf(a, b), incident: a === cur || b === cur });
    }
  }
  return { viewBox: DISTRICT_GRAPH_VIEWBOX, nodes, edges };
}

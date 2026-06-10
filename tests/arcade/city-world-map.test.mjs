// Phase W-1 — World Map travel helpers (pure): zone accents + BFS waypoint planning.
// Run: node --test tests/arcade/city-world-map.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { blockAccent, accentBlockIds, shortestPath, planNextHop } from '../../arcade/city/city-world-map.mjs';
import { districtManifest } from '../../arcade/city/city-district.mjs';
import { CITY_IDS } from '../../arcade/city/city-block.mjs';

const manifest = () => districtManifest('downtown-01');
const ADJ = () => manifest().adjacency;

// ── accents ────────────────────────────────────────────────────────────────
test('every shipped block has a bespoke hex accent', () => {
  for (const id of CITY_IDS) {
    const a = blockAccent(id);
    assert.match(a, /^#[0-9a-f]{6}$/i, `${id} accent`);
  }
});

test('accents are distinct across the six blocks', () => {
  const seen = new Set(CITY_IDS.map((id) => blockAccent(id)));
  assert.equal(seen.size, CITY_IDS.length);
});

test('gold stays reserved for tickets — no block accent is #ffd23f', () => {
  for (const id of accentBlockIds()) assert.notEqual(blockAccent(id).toLowerCase(), '#ffd23f');
});

test('unknown block gets the neutral accent (no throw)', () => {
  assert.match(blockAccent('mystery-99'), /^#[0-9a-f]{6}$/i);
  assert.notEqual(blockAccent('mystery-99'), blockAccent('downtown-01'));
});

// ── shortestPath ───────────────────────────────────────────────────────────
const assertValidPath = (path, from, to, adj) => {
  assert.ok(Array.isArray(path), 'path is array');
  assert.equal(path[0], from);
  assert.equal(path[path.length - 1], to);
  for (let i = 0; i + 1 < path.length; i++) {
    assert.ok(adj[path[i]].includes(path[i + 1]), `${path[i]} -> ${path[i + 1]} must be a real edge`);
  }
};

test('downtown→skyline is two hops (both corridors are length 2; result is deterministic)', () => {
  const p1 = shortestPath(ADJ(), 'downtown-01', 'skyline-03');
  const p2 = shortestPath(ADJ(), 'downtown-01', 'skyline-03');
  assertValidPath(p1, 'downtown-01', 'skyline-03', ADJ());
  assert.equal(p1.length, 3);
  assert.deepEqual(p1, p2);
});

test('harbor→foundry needs two hops (they are never adjacent)', () => {
  const adj = ADJ();
  assert.ok(!adj['harbor-02'].includes('foundry-04'));
  const p = shortestPath(adj, 'harbor-02', 'foundry-04');
  assertValidPath(p, 'harbor-02', 'foundry-04', adj);
  assert.equal(p.length, 3);
});

test('garden→harbor routes through downtown', () => {
  const p = shortestPath(ADJ(), 'garden-06', 'harbor-02');
  assertValidPath(p, 'garden-06', 'harbor-02', ADJ());
  assert.equal(p.length, 3);
});

test('every block reaches every other block (the district is connected)', () => {
  const adj = ADJ();
  for (const a of CITY_IDS) for (const b of CITY_IDS) {
    const p = shortestPath(adj, a, b);
    assert.ok(p, `${a}→${b} reachable`);
    assertValidPath(p, a, b, adj);
  }
});

test('same block → single-entry path; unknown endpoints → null', () => {
  assert.deepEqual(shortestPath(ADJ(), 'downtown-01', 'downtown-01'), ['downtown-01']);
  assert.equal(shortestPath(ADJ(), 'downtown-01', 'mystery-99'), null);
  assert.equal(shortestPath(ADJ(), 'mystery-99', 'downtown-01'), null);
  assert.equal(shortestPath(null, 'a', 'b'), null);
});

test('unreachable block → null (isolated node)', () => {
  const adj = { a: ['b'], b: ['a'], island: [] };
  assert.equal(shortestPath(adj, 'a', 'island'), null);
});

// ── planNextHop ────────────────────────────────────────────────────────────
test('waypoint to a non-adjacent block plans a server-routable first hop', () => {
  const m = manifest();
  const plan = planNextHop(m, 'skyline-03');
  assert.equal(plan.ok, true);
  assert.equal(plan.target_city_id, 'skyline-03');
  assert.equal(plan.hops_remaining, 2);
  // the next hop must be directly adjacent to the current block — the server's rule
  assert.ok(m.adjacency['downtown-01'].includes(plan.next_hop));
  assert.equal(plan.path[0], 'downtown-01');
  assert.equal(plan.path[plan.path.length - 1], 'skyline-03');
});

test('waypoint to an adjacent block is a single hop', () => {
  const plan = planNextHop(manifest(), 'harbor-02');
  assert.equal(plan.ok, true);
  assert.equal(plan.next_hop, 'harbor-02');
  assert.equal(plan.hops_remaining, 1);
});

test('waypoint rejections: already_here / unknown_target / no_manifest', () => {
  assert.deepEqual(planNextHop(manifest(), 'downtown-01'), { ok: false, reason: 'already_here' });
  assert.deepEqual(planNextHop(manifest(), 'mystery-99'), { ok: false, reason: 'unknown_target' });
  assert.deepEqual(planNextHop(null, 'harbor-02'), { ok: false, reason: 'no_manifest' });
  assert.deepEqual(planNextHop({}, 'harbor-02'), { ok: false, reason: 'no_manifest' });
});

test('plan output is public-safe (no player/account/balance fields anywhere)', () => {
  const text = JSON.stringify(planNextHop(manifest(), 'nexus-05'));
  assert.ok(!/player_id|account|balance|ledger|inventory|email|secret/i.test(text));
});

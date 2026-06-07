/**
 * Phase 8C-2 — district graph model + corridor classifier unit tests (city-district-graph.mjs).
 * Proves: the corridor classifier matches the real ADJACENCY (ring vs new corridor; harbor/foundry NOT
 * adjacent); the panel grouping's unions exactly equal each block's adjacency (plan falsifier #1); the
 * graph model has the right nodes/edges/flags. DISPLAY-ONLY — derives from the public manifest, owns no
 * authority, grants nothing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { corridorOf, groupAdjacentByCorridor, districtGraphModel, DISTRICT_GRAPH_VIEWBOX } from '../../arcade/city/city-district-graph.mjs';
import { districtManifest, adjacentBlocks } from '../../arcade/city/city-district.mjs';
import { CITY_IDS } from '../../arcade/city/city-block.mjs';

test('corridorOf classifies ring vs new-corridor edges (symmetric); non-adjacent → null', () => {
  for (const [a, b] of [['downtown-01', 'harbor-02'], ['harbor-02', 'skyline-03'], ['skyline-03', 'foundry-04'], ['foundry-04', 'downtown-01']]) {
    assert.equal(corridorOf(a, b), 'ring'); assert.equal(corridorOf(b, a), 'ring');
  }
  for (const [a, b] of [['downtown-01', 'garden-06'], ['garden-06', 'nexus-05'], ['nexus-05', 'skyline-03']]) {
    assert.equal(corridorOf(a, b), 'new'); assert.equal(corridorOf(b, a), 'new');
  }
  // non-edges → null. Harbor & Foundry are NOT adjacent; downtown & skyline are the non-adjacent hubs.
  assert.equal(corridorOf('harbor-02', 'foundry-04'), null);
  assert.equal(corridorOf('downtown-01', 'skyline-03'), null);
  assert.equal(corridorOf('downtown-01', 'nexus-05'), null);
});

test('groupAdjacentByCorridor unions exactly equal real adjacency for every block (falsifier #1)', () => {
  for (const id of CITY_IDS) {
    const adj = adjacentBlocks(id);
    const g = groupAdjacentByCorridor(id, adj);
    assert.deepEqual([...g.ring, ...g.new].slice().sort(), adj.slice().sort(), `${id}: grouped union == adjacency`);
  }
  // specific groupings (plan §4 Polish 2)
  assert.deepEqual(groupAdjacentByCorridor('downtown-01', adjacentBlocks('downtown-01')), { ring: ['harbor-02', 'foundry-04'], new: ['garden-06'] });
  assert.deepEqual(groupAdjacentByCorridor('skyline-03', adjacentBlocks('skyline-03')), { ring: ['harbor-02', 'foundry-04'], new: ['nexus-05'] });
  assert.deepEqual(groupAdjacentByCorridor('garden-06', adjacentBlocks('garden-06')), { ring: [], new: ['downtown-01', 'nexus-05'] });
  assert.deepEqual(groupAdjacentByCorridor('nexus-05', adjacentBlocks('nexus-05')), { ring: [], new: ['skyline-03', 'garden-06'] });
  assert.deepEqual(groupAdjacentByCorridor('harbor-02', adjacentBlocks('harbor-02')), { ring: ['downtown-01', 'skyline-03'], new: [] });
  assert.deepEqual(groupAdjacentByCorridor('foundry-04', adjacentBlocks('foundry-04')), { ring: ['downtown-01', 'skyline-03'], new: [] });
});

test('districtGraphModel: six nodes, seven edges, every edge classified, current/adjacent/incident flags', () => {
  const g = districtGraphModel(districtManifest('downtown-01'));
  assert.equal(g.nodes.length, CITY_IDS.length);
  assert.equal(g.edges.length, 7);                                           // 4 ring + 3 new (undirected)
  assert.equal(g.edges.filter((e) => e.corridor === 'ring').length, 4);
  assert.equal(g.edges.filter((e) => e.corridor === 'new').length, 3);
  assert.equal(g.edges.filter((e) => e.corridor === null).length, 0);        // every edge classifies
  // from downtown's perspective: current flag, adjacency, and the non-adjacent hub
  assert.equal(g.nodes.find((n) => n.city_id === 'downtown-01').current, true);
  assert.equal(g.nodes.find((n) => n.city_id === 'garden-06').adjacent, true);
  assert.equal(g.nodes.find((n) => n.city_id === 'skyline-03').adjacent, false); // not adjacent to downtown
  // incident edges = the directly-routable edges from the current block (downtown is degree 3)
  assert.equal(g.edges.filter((e) => e.incident).length, 3);
  // nodes carry a numeric position + a short label (no trailing " Block")
  for (const n of g.nodes) {
    assert.equal(typeof n.x, 'number'); assert.equal(typeof n.y, 'number');
    assert.equal(/\sBlock$/.test(n.label), false, `${n.city_id} label is short: "${n.label}"`);
  }
  assert.equal(g.viewBox, DISTRICT_GRAPH_VIEWBOX);
});

test('districtGraphModel incident flags follow the current block (degree-2 source)', () => {
  const g = districtGraphModel(districtManifest('garden-06')); // garden has degree 2 (downtown, nexus)
  assert.equal(g.edges.filter((e) => e.incident).length, 2);
  assert.equal(g.nodes.find((n) => n.city_id === 'garden-06').current, true);
  // both of garden's edges are the NEW corridor
  assert.equal(g.edges.filter((e) => e.incident && e.corridor === 'new').length, 2);
});

test('districtGraphModel is robust to an empty/garbage manifest (display-only, never throws)', () => {
  assert.deepEqual(districtGraphModel(null), { viewBox: DISTRICT_GRAPH_VIEWBOX, nodes: [], edges: [] });
  assert.deepEqual(districtGraphModel({}), { viewBox: DISTRICT_GRAPH_VIEWBOX, nodes: [], edges: [] });
});

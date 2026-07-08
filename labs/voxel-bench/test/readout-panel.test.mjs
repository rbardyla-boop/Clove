/**
 * Voxel Lab Bench — shared readout panel tests (Node-side, no browser).
 *   node --test labs/voxel-bench/test/readout-panel.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderReadoutText, mountReadoutPanel } from '../src/readout-panel.mjs';

/** A representative fixture state covering every field, with the LOD object already
 * activated (instanceCount is a number, not null). */
function buildActivatedFixture() {
  return {
    strategy: 'greedy-quads',
    instanceCount: 0,
    quadCount: 42,
    triangleCount: 84,
    drawCalls: 1,
    delta: {
      instancedCubes: { drawCalls: 1, triangleCount: 264 },
      greedyQuads: { drawCalls: 1, triangleCount: 84 },
    },
    lod: { active: true, cameraDistance: 12.5, lodLevel: 1, instanceCount: 128 },
    light: { resolution: 32, buildTimeMs: 6.813, lightVolumeBytes: 32768, drawCalls: 1 },
  };
}

/** The "not yet activated" fixture: lod.instanceCount is null (default LOD state
 * before the first setCameraDistance() call). */
function buildNotYetActivatedFixture() {
  const fixture = buildActivatedFixture();
  return { ...fixture, lod: { active: false, cameraDistance: 0, lodLevel: 0, instanceCount: null } };
}

test('renderReadoutText includes strategy, instance/quad/triangle counts, and draw calls', () => {
  const output = renderReadoutText(buildActivatedFixture());
  assert.ok(output.includes('strategy: greedy-quads'));
  assert.ok(output.includes('instances: 0'));
  assert.ok(output.includes('quads: 42  triangles: 84'));
  assert.ok(output.includes('drawCalls: 1'));
});

test('renderReadoutText includes both strategy-delta rows', () => {
  const output = renderReadoutText(buildActivatedFixture());
  assert.ok(output.includes('instanced-cubes: 1 draw / 264 tris'));
  assert.ok(output.includes('greedy-quads:    1 draw / 84 tris'));
});

test('renderReadoutText includes LOD active/distance/level/instanceCount when activated', () => {
  const output = renderReadoutText(buildActivatedFixture());
  assert.ok(output.includes('active: true'));
  assert.ok(output.includes('cameraDistance: 12.50'));
  assert.ok(output.includes('lodLevel: 1'));
  assert.ok(output.includes('instances: 128'));
});

test('renderReadoutText shows "not yet activated" when lod.instanceCount is null', () => {
  const output = renderReadoutText(buildNotYetActivatedFixture());
  assert.ok(output.includes('instances: n/a (not yet activated)'));
  assert.ok(!output.includes('instances: null'));
});

test('renderReadoutText includes light-volume resolution/buildTimeMs/bytes/drawCalls', () => {
  const output = renderReadoutText(buildActivatedFixture());
  assert.ok(output.includes('resolution: 32^3'));
  assert.ok(output.includes('buildTimeMs: 6.813'));
  assert.ok(output.includes('lightVolumeBytes: 32768'));
  assert.ok(output.includes('drawCalls: 1'));
});

test('renderReadoutText is deterministic: same state in, same string out, called twice', () => {
  const state = buildActivatedFixture();
  const first = renderReadoutText(state);
  const second = renderReadoutText(state);
  assert.equal(first, second);
});

test('mountReadoutPanel(element).update(state) sets element.textContent to exactly renderReadoutText(state)', () => {
  const fakeElement = { textContent: '' };
  const panel = mountReadoutPanel(fakeElement);
  const state = buildActivatedFixture();
  panel.update(state);
  assert.equal(fakeElement.textContent, renderReadoutText(state));
});

test('mountReadoutPanel(null).update(state) does not throw', () => {
  const panel = mountReadoutPanel(null);
  assert.doesNotThrow(() => panel.update(buildActivatedFixture()));
});

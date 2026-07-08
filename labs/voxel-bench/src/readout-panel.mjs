/**
 * Voxel Lab Bench — shared readout panel component (Gate E corrective pass, closing
 * Operator Decision #3, docs/VOXEL_LAB_BENCH_PLAN.md: "a shared component scoped to
 * the labs/ namespace — built so future labs can reuse it, but not wired into Neon
 * Circuit city UI or general arcade UI at this time").
 *
 * renderReadoutText() is pure and dependency-free (no DOM, no THREE, no network) so it
 * is directly node:test-testable in isolation, matching the sibling deterministic
 * modules (mesh-greedy.mjs, lod.mjs, light-volume.mjs, metrics-room.mjs,
 * export-markdown.mjs) — it reads ONLY the `state` object a caller passes in, no
 * hidden globals. mountReadoutPanel() is the ONE DOM-touching wrapper, kept separate
 * from the renderer on purpose so the text-building logic itself never needs a DOM to
 * be tested.
 *
 * Extracted field-for-field from bench-boot.mjs's former step()-local
 * `readout.textContent = ...` template — same fields, same order, same wording,
 * except the header line no longer hardcodes a stale gate name (it used to say
 * "Gate B Slice 5" even after Gates C/D/E shipped); "Voxel Lab Bench" is
 * version-agnostic so this component does not need editing every time a new gate
 * lands.
 */

/**
 * renderReadoutText(state) -> string
 *
 * `state` shape:
 *   { strategy, instanceCount, quadCount, triangleCount, drawCalls,
 *     delta: { instancedCubes: {drawCalls, triangleCount},
 *              greedyQuads: {drawCalls, triangleCount} },
 *     lod: { active, cameraDistance, lodLevel, instanceCount: number|null },
 *     light: { resolution, buildTimeMs, lightVolumeBytes, drawCalls } }
 *
 * `lod.instanceCount === null` renders the "not yet activated" text, matching the
 * former inline `lodRenderable ? ... : '  instances: n/a (not yet activated)'` branch
 * (the LOD object is opt-in and lazily built — see bench-boot.mjs's setCameraDistance).
 */
export function renderReadoutText(state) {
  const { strategy, instanceCount, quadCount, triangleCount, drawCalls, delta, lod, light } = state;
  const lodInstancesText = lod.instanceCount !== null
    ? `  instances: ${lod.instanceCount}`
    : '  instances: n/a (not yet activated)';
  return (
    `Voxel Lab Bench\n` +
    `strategy: ${strategy}\n` +
    `instances: ${instanceCount}\n` +
    `quads: ${quadCount}  triangles: ${triangleCount}\n` +
    `drawCalls: ${drawCalls}\n` +
    `— delta (same room, both strategies) —\n` +
    `instanced-cubes: ${delta.instancedCubes.drawCalls} draw / ${delta.instancedCubes.triangleCount} tris\n` +
    `greedy-quads:    ${delta.greedyQuads.drawCalls} draw / ${delta.greedyQuads.triangleCount} tris\n` +
    `— LOD object (watch the seam) —\n` +
    `active: ${lod.active}  cameraDistance: ${lod.cameraDistance.toFixed(2)}  lodLevel: ${lod.lodLevel}` +
    lodInstancesText +
    `\n— light volume (lighting-resolution cost lab) —\n` +
    `resolution: ${light.resolution}^3  buildTimeMs: ${light.buildTimeMs.toFixed(3)}  lightVolumeBytes: ${light.lightVolumeBytes}  drawCalls: ${light.drawCalls}`
  );
}

/**
 * mountReadoutPanel(element) -> { update(state) }
 *
 * The ONLY part of this module allowed to touch an Element — kept separate from
 * renderReadoutText so the pure renderer stays node:test-testable without a DOM.
 * `element` may be null/undefined (matching bench-boot.mjs's existing
 * `if (readout) {...}` null-guard convention, e.g. a page with no #readout node); in
 * that case update() is a safe no-op rather than throwing.
 */
export function mountReadoutPanel(element) {
  return {
    update(state) {
      if (element) element.textContent = renderReadoutText(state);
    },
  };
}

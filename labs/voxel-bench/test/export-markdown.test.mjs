/**
 * Voxel Lab Bench — Gate E Slice 7 Markdown export tests (Node-side, no browser).
 *   node --test labs/voxel-bench/test/export-markdown.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportExperiment } from '../src/export-markdown.mjs';

const REQUIRED_HEADINGS = [
  '## Metadata',
  '## What I changed',
  '## What I measured',
  '## The lesson',
  '## Reproduction',
];

/** A rich, realistic fixture reused across the determinism/order/escaping tests. */
function buildRichFixture() {
  return {
    title: 'Voxel Lab Bench Experiment',
    metadata: {
      date: '2026-07-01T00:00:00Z',
      room: '32m x 32m x 16m, chunk resolution 32',
      renderStrategy: 'greedy-quads',
    },
    changes: ['lightGridResolution: 16 -> 64 (one variable)'],
    metricsHistory: [
      { lightGridResolution: 16, frameTimeMs: 4.1, lightVolumeBytes: 4096, drawCalls: 212 },
      { lightGridResolution: 32, frameTimeMs: 6.8, lightVolumeBytes: 32768, drawCalls: 212 },
      { lightGridResolution: 64, frameTimeMs: 14.2, lightVolumeBytes: 262144, drawCalls: 212 },
    ],
    lesson: 'Draw calls didn\'t change — only frame time and memory did.',
    reproduction: 'world.setLightGridResolution(32);',
  };
}

test('exportExperiment() with no arguments does not throw and shows every placeholder', () => {
  let output;
  assert.doesNotThrow(() => { output = exportExperiment(); });
  assert.equal(output.startsWith('# '), true);
  for (const heading of REQUIRED_HEADINGS) {
    assert.ok(output.includes(heading), `missing heading: ${heading}`);
  }
  assert.ok(output.includes('_No metadata provided._'));
  assert.ok(output.includes('_No changes recorded._'));
  assert.ok(output.includes('_No measurements recorded._'));
  assert.ok(output.includes('_No lesson recorded._'));
  assert.ok(output.includes('_No reproduction steps recorded._'));
});

test('exportExperiment(fixedRichInput) called twice with the same object is byte-for-byte identical', () => {
  const input = buildRichFixture();
  const first = exportExperiment(input);
  const second = exportExperiment(input);
  assert.equal(first, second);
});

test('section headings appear in strictly increasing order', () => {
  const output = exportExperiment(buildRichFixture());
  const indices = REQUIRED_HEADINGS.map((heading) => output.indexOf(heading));
  for (const idx of indices) assert.ok(idx >= 0, 'heading missing entirely');
  for (let i = 1; i < indices.length; i += 1) {
    assert.ok(indices[i] > indices[i - 1], `heading order violated at index ${i}`);
  }
});

test('metrics table shape: header + divider + N body rows, raw column order from first row', () => {
  const output = exportExperiment({
    metricsHistory: [
      { a: 1, b: 2, c: 3 },
      { a: 4, b: 5, c: 6 },
      { a: 7, b: 8, c: 9 },
    ],
  });
  const lines = output.split('\n');
  const headerIdx = lines.indexOf('| a | b | c |');
  assert.ok(headerIdx >= 0, 'header row not found or column order/names wrong');
  assert.equal(lines[headerIdx + 1], '|---|---|---|');
  assert.equal(lines[headerIdx + 2], '| 1 | 2 | 3 |');
  assert.equal(lines[headerIdx + 3], '| 4 | 5 | 6 |');
  assert.equal(lines[headerIdx + 4], '| 7 | 8 | 9 |');
});

test('number formatting end-to-end via table cells', () => {
  const output = exportExperiment({
    metricsHistory: [
      { big: 4096, small: 4.1, plain: 212, zero: 0, negative: -1234 },
    ],
  });
  const lines = output.split('\n');
  const rowLine = lines.find((line) => line.startsWith('| 4,096'));
  assert.ok(rowLine, 'row with formatted big number not found');
  assert.ok(rowLine.includes('4,096'));
  assert.ok(rowLine.includes('4.1'));
  assert.ok(!rowLine.includes('4.100'));
  assert.ok(rowLine.includes('212'));
  assert.ok(rowLine.includes('| 0 |') || rowLine.endsWith('| 0 |'));
  assert.ok(rowLine.includes('-1,234'));
});

test('missing/undefined optional fields render deterministic placeholders, not throw', () => {
  assert.ok(exportExperiment({ changes: ['x'] }).includes('_No metadata provided._'));
  assert.ok(exportExperiment({ metadata: { a: 1 } }).includes('_No changes recorded._'));
  assert.ok(exportExperiment({ lesson: 'y' }).includes('_No measurements recorded._'));
  assert.ok(exportExperiment({ metricsHistory: [{ a: 1 }] }).includes('_No lesson recorded._'));
  assert.ok(exportExperiment({ lesson: 'y' }).includes('_No reproduction steps recorded._'));

  let output;
  assert.doesNotThrow(() => {
    output = exportExperiment({
      metricsHistory: [
        { a: 1, b: 2 },
        { a: 3 },
      ],
    });
  });
  assert.ok(!output.includes('undefined'));
  const lines = output.split('\n');
  const secondRowIdx = lines.indexOf('| 3 |  |');
  assert.ok(secondRowIdx >= 0, 'expected the second row to render its missing "b" cell as empty, found: ' + JSON.stringify(lines));
});

test('escaping: newline in metadata value collapses to a space', () => {
  const output = exportExperiment({ metadata: { note: 'line one\nline two' } });
  const line = output.split('\n').find((l) => l.startsWith('- Note:'));
  assert.ok(line, 'metadata line not found');
  assert.equal(line, '- Note: line one line two');
});

test('escaping: pipe character in a table cell is escaped so column count is not broken', () => {
  const output = exportExperiment({ metricsHistory: [{ a: 'x|y', b: 2 }] });
  const lines = output.split('\n');
  const rowLine = lines.find((l) => l.startsWith('| x'));
  assert.ok(rowLine, 'row not found');
  assert.ok(rowLine.includes('x\\|y'));
  // The raw unescaped pipe must not appear as a bare column separator between x and y.
  assert.ok(!rowLine.includes('x|y'));
});

test('escaping: newline in title collapses the heading line to a single line', () => {
  const output = exportExperiment({ title: 'Line one\nLine two' });
  const titleLine = output.split('\n')[0];
  assert.equal(titleLine, '# Line one Line two');
  assert.ok(!titleLine.includes('\n'));
});

test('reproduction accepts a multi-line string OR an equivalent array with identical rendered output', () => {
  const asString = exportExperiment({ reproduction: 'line1\nline2' });
  const asArray = exportExperiment({ reproduction: ['line1', 'line2'] });
  assert.equal(asString, asArray);
  assert.ok(asString.includes('    line1\n    line2'));
});

test('no raw "<script" substring appears anywhere in the output for a realistic fixture', () => {
  const output = exportExperiment(buildRichFixture());
  assert.ok(!output.includes('<script'));
});

test('WORKED-EXAMPLE FIDELITY: matches docs/VOXEL_LAB_BENCH_PLAN.md Section 4.3 line-by-line', () => {
  const output = exportExperiment({
    title: 'Voxel Lab 0 Experiment — Lighting Resolution Cost',
    metadata: {
      date: '2026-07-01T00:00:00Z',
      room: '32m x 32m x 16m, chunk resolution 32',
      renderStrategy: 'greedy-quads',
    },
    changes: ['lightGridResolution: 16 -> 64 (one variable)'],
    metricsHistory: [
      { lightGridResolution: 16, frameTimeMs: 4.1, lightVolumeBytes: 4096, drawCalls: 212 },
      { lightGridResolution: 32, frameTimeMs: 6.8, lightVolumeBytes: 32768, drawCalls: 212 },
      { lightGridResolution: 64, frameTimeMs: 14.2, lightVolumeBytes: 262144, drawCalls: 212 },
    ],
    lesson: "Draw calls didn't change — only frame time and memory did. Lighting cost scales with grid RESOLUTION, not with how many voxels are visible. This is why the coarse-grid trick works: you buy most of the visual quality at 32^3 for a fraction of the cost of 64^3.",
    reproduction: 'world.setLightGridResolution(32);',
  });

  const lines = output.split('\n');

  assert.equal(lines[0], '# Voxel Lab 0 Experiment — Lighting Resolution Cost');
  assert.ok(lines.includes('- Date: 2026-07-01T00:00:00Z'));
  assert.ok(lines.includes('- Room: 32m x 32m x 16m, chunk resolution 32'));
  assert.ok(lines.includes('- Render strategy: greedy-quads'));

  const dateIdx = lines.indexOf('- Date: 2026-07-01T00:00:00Z');
  const roomIdx = lines.indexOf('- Room: 32m x 32m x 16m, chunk resolution 32');
  const strategyIdx = lines.indexOf('- Render strategy: greedy-quads');
  assert.ok(dateIdx < roomIdx && roomIdx < strategyIdx, 'metadata lines must appear in Date/Room/Render-strategy order');

  assert.ok(lines.includes('- lightGridResolution: 16 -> 64 (one variable)'));

  const headerIdx = lines.indexOf('| lightGridResolution | frameTimeMs | lightVolumeBytes | drawCalls |');
  assert.ok(headerIdx >= 0, 'exact table header line not found');
  assert.equal(lines[headerIdx + 1], '|---|---|---|---|');
  assert.equal(lines[headerIdx + 2], '| 16 | 4.1 | 4,096 | 212 |');
  assert.equal(lines[headerIdx + 3], '| 32 | 6.8 | 32,768 | 212 |');
  assert.equal(lines[headerIdx + 4], '| 64 | 14.2 | 262,144 | 212 |');

  assert.ok(lines.includes('    world.setLightGridResolution(32);'));
});

test('determinism holds across 10+ repeated calls of the rich fixture', () => {
  const input = buildRichFixture();
  const baseline = exportExperiment(input);
  for (let i = 0; i < 12; i += 1) {
    assert.equal(exportExperiment(input), baseline, `mismatch on repeated call #${i}`);
  }
});

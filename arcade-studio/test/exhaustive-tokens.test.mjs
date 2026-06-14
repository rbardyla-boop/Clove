import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCabinetBlock } from '../src/validation/validateArcadeAsset.js';
import { exportArcadeLayout } from '../src/importExport/exportArcadeLayout.js';
import { createEmptyLayout, addElement } from '../src/arcade/ArcadeLayout.js';
import { defaultCabinet, normalizeCabinet, randomCabinet } from '../src/cabinets/CabinetConfig.js';
import { CABINET_ENUMS } from '../src/validation/ArcadeAssetSchema.js';
import {
  THEMES, FLOOR_MATERIALS, WALL_MATERIALS, PROP_TYPES, SIGN_STYLES, ENTRANCE_STYLES,
  PALETTES, SCREEN_SHAKE_NAMES, PARTICLE_NAMES, LIGHTING_ZONE_PRESETS, AMBIENCE_ZONE_PRESETS,
} from '../src/validation/tokens.js';
import { SeededRandom } from '../src/utils/random.js';

function cabErrs(block) {
  const e = [];
  validateCabinetBlock(block, 'cabinet', e);
  return e;
}

test('EVERY token in EVERY cabinet enum field produces a valid cabinet block', () => {
  for (const [field, tokens] of Object.entries(CABINET_ENUMS)) {
    for (const token of tokens) {
      const block = normalizeCabinet({ ...defaultCabinet(), [field]: token });
      assert.deepEqual(cabErrs(block), [], `${field}=${token}: ${cabErrs(block).join('; ')}`);
    }
  }
});

test('EVERY theme exports a valid empty layout', async () => {
  for (const theme of THEMES) {
    const res = await exportArcadeLayout(createEmptyLayout({ id: `t-${theme}`, theme }));
    assert.equal(res.ok, true, `${theme}: ${res.report.errors.join('; ')}`);
  }
});

test('EVERY floor + wall material is accepted', async () => {
  for (const floor of FLOOR_MATERIALS) {
    const m = createEmptyLayout({ id: 'floors' });
    m.floor = { material: floor };
    const res = await exportArcadeLayout(m);
    assert.equal(res.ok, true, `floor ${floor}: ${res.report.errors.join('; ')}`);
  }
  for (const wall of WALL_MATERIALS) {
    const m = addElement(createEmptyLayout({ id: 'walls' }), 'walls', { material: wall, gx: 0, gy: 0, length: 2, orientation: 'north' });
    const res = await exportArcadeLayout(m);
    assert.equal(res.ok, true, `wall ${wall}: ${res.report.errors.join('; ')}`);
  }
});

test('EVERY prop type places + validates', async () => {
  let m = createEmptyLayout({ id: 'props' });
  PROP_TYPES.forEach((type, i) => {
    m = addElement(m, 'props', { type, gx: i % m.grid.cols, gy: Math.floor(i / m.grid.cols), rotation: 0, layer: 1 });
  });
  const res = await exportArcadeLayout(m);
  assert.equal(res.ok, true, res.report.errors.join('; '));
});

test('EVERY sign style + entrance style validates', async () => {
  let m = createEmptyLayout({ id: 'signs' });
  SIGN_STYLES.filter((s) => s !== 'none').forEach((style, i) => {
    m = addElement(m, 'signs', { style, text: 'PLAY', placement: 'apex', gx: i, gy: 0, palette: 'neon-cyan' });
  });
  ENTRANCE_STYLES.filter((s) => s !== 'none').forEach((style, i) => {
    m = addElement(m, 'entrances', { style, gx: i, gy: 1, facing: 'south' });
  });
  const res = await exportArcadeLayout(m);
  assert.equal(res.ok, true, res.report.errors.join('; '));

  // 'none' is a schema-valid display token (an explicit absence marker for signage / entrances). The
  // loops above skip it only to keep placement cells distinct, so cover it directly here: assert it is
  // part of the closed style vocab AND that a placed 'none' sign + 'none' entrance both validate.
  assert.ok(SIGN_STYLES.includes('none') && ENTRANCE_STYLES.includes('none'), 'none must be a closed style token');
  let mn = createEmptyLayout({ id: 'none-styles' });
  mn = addElement(mn, 'signs', { style: 'none', text: 'PLAY', placement: 'apex', gx: 0, gy: 0, palette: 'neon-cyan' });
  mn = addElement(mn, 'entrances', { style: 'none', gx: 1, gy: 0, facing: 'south' });
  const resNone = await exportArcadeLayout(mn);
  assert.equal(resNone.ok, true, `'none' sign/entrance styles must validate: ${resNone.report.errors.join('; ')}`);
});

test('EVERY palette + zone preset + effect token validates', async () => {
  let m = createEmptyLayout({ id: 'mix' });
  LIGHTING_ZONE_PRESETS.forEach((preset, i) => {
    m = addElement(m, 'zones', { kind: 'lighting', preset, palette: PALETTES[i % PALETTES.length], gx: 0, gy: 0, cols: 2, rows: 1, intensity: 'medium' });
  });
  AMBIENCE_ZONE_PRESETS.forEach((preset, i) => {
    m = addElement(m, 'zones', { kind: 'ambience', preset, palette: PALETTES[i % PALETTES.length], gx: 1, gy: 1, cols: 2, rows: 2, intensity: 'low' });
  });
  for (const shake of SCREEN_SHAKE_NAMES) {
    for (const particle of ['none', ...PARTICLE_NAMES]) {
      m.effects = { screen_shake: shake, particle };
      const res = await exportArcadeLayout(m);
      assert.equal(res.ok, true, `shake=${shake} particle=${particle}: ${res.report.errors.join('; ')}`);
    }
  }
});

test('fuzz: 300 random cabinet configs are always coerced to valid blocks', () => {
  const r = new SeededRandom('fuzz');
  for (let i = 0; i < 300; i++) {
    // mix valid randoms with junk fields/values to stress normalizeCabinet
    const block = randomCabinet(`c-${i}`);
    if (r.chance(0.5)) block.marquee_text = r.pick(['OK', '<b>x</b>', 'buy now', 'PLAYER 1', '']);
    const normalized = normalizeCabinet(block);
    assert.deepEqual(cabErrs(normalized), [], `fuzz ${i}: ${cabErrs(normalized).join('; ')}`);
  }
});

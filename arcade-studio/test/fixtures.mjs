/**
 * Shared, known-good + known-hostile fixtures for the validation/round-trip test suite.
 * Pure data only.
 */

export function validCabinetBlock() {
  return {
    type: 'upright',
    screen_style: 'crt-curve',
    marquee_style: 'backlit',
    marquee_text: 'NEON BLASTER',
    control_panel: 'dual-stick',
    trim_style: 'neon-edge',
    bevel_style: 'soft',
    palette: 'neon-cyan',
    glow_style: 'high',
    scanline: 'fine',
    decal: 'circuit-trace',
    attract_mode: 'marquee-chase',
  };
}

export function validAssetModel() {
  return {
    asset_id: 'neon-blaster-x',
    display_name: 'Neon Blaster X',
    cabinet: validCabinetBlock(),
    effects: { screen_shake: 'impact', particle: 'cabinet-glow' },
    metadata: { tags: ['shmup', 'two-player'], note: 'A fast shooter cabinet.' },
  };
}

export function validLayoutModel() {
  return {
    layout_id: 'neon-circuit-hall',
    display_name: 'Neon Circuit Hall',
    theme: 'neon-circuit',
    grid: { cols: 16, rows: 12 },
    floor: { material: 'neon-grid' },
    walls: [{ material: 'panel-dark', gx: 0, gy: 0, length: 16, orientation: 'north' }],
    entrances: [{ style: 'neon-portal', gx: 8, gy: 0, facing: 'south' }],
    props: [
      { type: 'bench', gx: 3, gy: 4, rotation: 0, layer: 1 },
      { type: 'planter', gx: 5, gy: 6, rotation: 90, layer: 1 },
    ],
    signs: [{ style: 'blade', text: 'ARCADE', placement: 'apex', gx: 8, gy: 0, palette: 'neon-magenta' }],
    cabinets: [{ cabinet: validCabinetBlock(), gx: 2, gy: 3, rotation: 90, layer: 2 }],
    zones: [{ kind: 'lighting', preset: 'neon-strip', palette: 'neon-cyan', gx: 0, gy: 0, cols: 4, rows: 1, intensity: 'medium' }],
    lighting: { ambient: 'neon-blue', intensity: 'medium', bloom: true, accent: 'neon-cyan' },
    effects: { screen_shake: 'subtle', particle: 'neon-motes' },
    metadata: { tags: ['demo'], note: 'Starter hall.' },
  };
}

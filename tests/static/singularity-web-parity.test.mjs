import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..', '..');
const gameRoot = join(root, 'game');
const index = readFileSync(join(gameRoot, 'index.html'), 'utf8');
const release = JSON.parse(
  readFileSync(join(gameRoot, 'SINGULARITY-RELEASE.json'), 'utf8'),
);

function assetPath(kind) {
  const match = index.match(
    new RegExp(`(?:src|href)="(/game/assets/[^"]+\\.${kind})"`),
  );
  assert.ok(match, `missing ${kind} asset reference`);
  return join(root, match[1].replace(/^\//, ''));
}

test('Singularity web package is the canonical Steam-source build', () => {
  assert.equal(release.title, 'Singularity Inc.');
  assert.equal(release.version, '1.0.0');
  assert.match(release.source_commit, /^[0-9a-f]{40}$/);
  assert.equal(release.parity_baseline, 'Steam Linux release source');
  assert.equal(release.gameplay_source, 'src/');
  assert.match(index, /name="singularity-version" content="1\.0\.0"/);

  const js = assetPath('js');
  const css = assetPath('css');
  assert.ok(existsSync(js));
  assert.ok(existsSync(css));
  assert.ok(statSync(js).size > 800_000);
  assert.ok(statSync(css).size > 10_000);

  const bundle = readFileSync(js, 'utf8');
  for (const marker of [
    'SELECT_DEPLOYMENT_ARCHETYPE',
    'DAILY_SCENARIO',
    'singularity_save_v3',
    'OPTIMAL_DISTRIBUTION',
    'CLOVELEARN',
  ]) {
    assert.ok(bundle.includes(marker), `missing release marker: ${marker}`);
  }
});

test('obsolete legacy web edition and its privacy leak are absent', () => {
  for (const obsolete of [
    'OrbitControls.js',
    'clovelearn-mobile.css',
    'clovelearn-mobile.js',
    'main.js',
    'style.css',
    'topojson-client.min.js',
  ]) {
    assert.equal(existsSync(join(gameRoot, obsolete)), false, obsolete);
  }

  const shippedText = [
    index,
    readFileSync(assetPath('js'), 'utf8'),
    readFileSync(assetPath('css'), 'utf8'),
  ].join('\n');
  assert.equal(shippedText.includes('rbardyla@gmail.com'), false);
  assert.equal(shippedText.includes('fonts.googleapis.com'), false);
  assert.equal(shippedText.includes('cdn.jsdelivr.net'), false);
});

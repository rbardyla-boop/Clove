/**
 * Output-path guard regression (closes the R3 review MEDIUM).
 *   node --test tests/creator/*.test.mjs
 *
 * Both local artifact assemblers (workshop bundle + editor staging) must refuse to write to the
 * production upload directory OR ANY SUBDIRECTORY of it, while still allowing safe /tmp destinations
 * and NOT falsely rejecting sibling names. `isUnsafeOut` is the pure predicate behind `assertSafeOut`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { isUnsafeOut as stagingUnsafe } from '../../scripts/build-creator-editor-staging.mjs';
import { isUnsafeOut as workshopUnsafe } from '../../scripts/build-creator-workshop-bundle.mjs';

const PROD_UPLOAD = join(homedir(), 'Downloads', 'clovelearn-phase6-client-upload');

for (const [name, isUnsafe] of [['staging', stagingUnsafe], ['workshop', workshopUnsafe]]) {
  test(`${name}: refuses the exact production upload directory`, () => {
    assert.equal(isUnsafe(PROD_UPLOAD), true);
  });

  test(`${name}: refuses a SUBDIRECTORY of the production upload directory (the closed MEDIUM)`, () => {
    assert.equal(isUnsafe(join(PROD_UPLOAD, 'subdir')), true);
    assert.equal(isUnsafe(join(PROD_UPLOAD, 'a', 'b', 'c')), true);
  });

  test(`${name}: refuses filesystem root, home, and the repo tree`, () => {
    assert.equal(isUnsafe('/'), true);
    assert.equal(isUnsafe(homedir()), true);
  });

  test(`${name}: allows safe /tmp destinations`, () => {
    assert.equal(isUnsafe('/tmp/creator-editor-staging-root'), false);
    assert.equal(isUnsafe('/tmp/creator-corner-workshop'), false);
  });

  test(`${name}: does NOT falsely reject a sibling name sharing the prefix`, () => {
    assert.equal(isUnsafe(`${PROD_UPLOAD}-old`), false);
    assert.equal(isUnsafe(`${PROD_UPLOAD}-backup/x`), false);
  });
}

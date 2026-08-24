import test from 'node:test';
import assert from 'node:assert/strict';
import { HARD_EXCLUDE_FILES, productionUploadFileList, isHardExcluded } from '../../scripts/build-production-upload.mjs';

test('DS-L1 production package uses the hardened boundary', () => {
  const { included, additionallyExcluded } = productionUploadFileList();

  for (const file of [
    'digital-stewardship.html',
    'digital-stewardship-content.js',
    'digital-stewardship.js',
    'digital-stewardship-00.html',
    'digital-stewardship-00.js',
  ]) assert.ok(included.includes(file), file);

  assert.equal(included.some((file) => file.startsWith('agent/')), false);
  assert.equal(included.some((file) => file.startsWith('new-work/')), false);
  assert.deepEqual(included.filter((file) => /\.zip$/i.test(file)), []);
  for (const file of HARD_EXCLUDE_FILES) assert.equal(included.includes(file), false, file);
  for (const file of additionallyExcluded) assert.equal(isHardExcluded(file), true, file);
});

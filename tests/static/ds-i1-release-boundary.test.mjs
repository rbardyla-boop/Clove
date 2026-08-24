import test from 'node:test';
import assert from 'node:assert/strict';
import { productionUploadFileList, isHardExcluded } from '../../scripts/build-production-upload.mjs';

test('DS-I1 assets are public and no longer hard-excluded', () => {
  const { included, excluded } = productionUploadFileList();
  for (const path of ['digital-stewardship-01.html','digital-stewardship-01.js']) {
    assert.equal(isHardExcluded(path), false, `${path} is still hard-excluded`);
    assert.equal(included.includes(path), true, `${path} missing from public upload`);
    assert.equal(excluded.includes(path), false, `${path} remains excluded`);
  }
});

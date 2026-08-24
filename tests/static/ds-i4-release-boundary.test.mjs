import test from 'node:test';
import assert from 'node:assert/strict';
import { productionUploadFileList, HARD_EXCLUDE_FILES } from '../../scripts/build-production-upload.mjs';

test('DS-I4 assets are public and no longer hard-excluded', () => {
  const { included } = productionUploadFileList();
  for (const file of ['digital-stewardship-04.html','digital-stewardship-04.js']) {
    assert.equal(HARD_EXCLUDE_FILES.has(file), false, `${file} remains hard-excluded`);
    assert.equal(included.includes(file), true, `${file} missing from public upload`);
  }
});

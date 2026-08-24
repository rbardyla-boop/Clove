import test from 'node:test';
import assert from 'node:assert/strict';
import { productionUploadFileList, isHardExcluded } from '../../scripts/build-production-upload.mjs';

const PUBLIC = ['digital-stewardship.html','digital-stewardship-00.html','digital-stewardship-00.js'];

test('DS public entry and DS-I0 assets are included in production', () => {
  const { included, excluded } = productionUploadFileList();
  for (const path of PUBLIC) {
    assert.equal(isHardExcluded(path), false, `${path} is still hard-excluded`);
    assert.equal(included.includes(path), true, `${path} missing from public upload`);
    assert.equal(excluded.includes(path), false, `${path} remains in exclusion ledger`);
  }
});

test('Mission 001 and the complete DS public boundary coexist', () => {
  const { included } = productionUploadFileList();
  for (const path of ['mission-001.html','mission-001-app.js','mission-private-store.js',...PUBLIC]) {
    assert.equal(included.includes(path), true, path);
  }
});

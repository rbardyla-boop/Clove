import test from 'node:test';
import assert from 'node:assert/strict';
import { productionUploadFileList, HARD_EXCLUDE_FILES } from '../../scripts/build-production-upload.mjs';

const PRIVATE=['digital-stewardship-04.html','digital-stewardship-04.js'];

test('DS-I4 files are hard-excluded from production',()=>{
  for(const file of PRIVATE) assert.equal(HARD_EXCLUDE_FILES.has(file),true,`${file} missing from hard exclusion`);
});

test('DS-I4 cannot enter curated production upload while Mission 001 remains public',()=>{
  const {included}=productionUploadFileList();
  for(const file of PRIVATE) assert.equal(included.includes(file),false,`${file} leaked into production`);
  for(const file of ['mission-001.html','mission-001-app.js','mission-private-store.js']) assert.equal(included.includes(file),true,`${file} missing`);
});

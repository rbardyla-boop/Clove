import test from 'node:test';
import assert from 'node:assert/strict';
import { productionUploadFileList, isHardExcluded } from '../../scripts/build-production-upload.mjs';

const PRIVATE_SLICE=['digital-stewardship-00.html','digital-stewardship-00.js'];

test('DS-I0 remains explicitly excluded from the public production upload',()=>{
  const {included,excluded,additionallyExcluded}=productionUploadFileList();
  for(const path of PRIVATE_SLICE){
    assert.equal(isHardExcluded(path),true,`${path} lacks an explicit hard exclusion`);
    assert.equal(included.includes(path),false,`${path} leaked into public upload`);
    assert.equal(excluded.includes(path),true,`${path} missing from excluded ledger`);
    assert.equal(additionallyExcluded.includes(path),true,`${path} was not excluded by production hardening`);
  }
});

test('Mission 001 production runtime remains included while DS-I0 stays private',()=>{
  const {included}=productionUploadFileList();
  for(const path of ['mission-001.html','mission-001-app.js','mission-private-store.js']) assert.equal(included.includes(path),true,path);
  for(const path of PRIVATE_SLICE) assert.equal(included.includes(path),false,path);
});

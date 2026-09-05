import test from 'node:test';
import assert from 'node:assert/strict';
import { productionUploadFileList, isHardExcluded } from '../../scripts/build-production-upload.mjs';

const PRIVATE=['digital-stewardship-01.html','digital-stewardship-01.js'];

test('DS-I1 is explicitly hard-excluded from public production',()=>{
  const {included,excluded,additionallyExcluded}=productionUploadFileList();
  for(const path of PRIVATE){
    assert.equal(isHardExcluded(path),true,`${path} lacks hard exclusion`);
    assert.equal(included.includes(path),false,`${path} leaked into production`);
    assert.equal(excluded.includes(path),true,`${path} absent from exclusion ledger`);
    assert.equal(additionallyExcluded.includes(path),true,`${path} not blocked by hardening layer`);
  }
});

test('repository operating instructions never enter the public production upload',()=>{
  assert.equal(isHardExcluded('AGENTS.md'), true);
  assert.equal(isHardExcluded('arcade/paper-firm/AGENTS.md'), true);
});

test('Mission 001 remains public while DS-I0 and DS-I1 remain private',()=>{
  const {included}=productionUploadFileList();
  for(const path of ['mission-001.html','mission-001-app.js','mission-private-store.js']) assert.equal(included.includes(path),true,path);
  for(const path of ['digital-stewardship-00.html','digital-stewardship-00.js',...PRIVATE]) assert.equal(included.includes(path),false,path);
});

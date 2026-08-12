import { curatedUploadFileList, isExcludedFromUpload } from './build-curated-client-upload.mjs';

const REQUIRED = Object.freeze([
  'index.html',
  'mission-001.html',
  'mission-001-app.js',
  'mission-private-store.js',
]);

const FORBIDDEN_SENTINELS = Object.freeze([
  'docs/CLOVE_V2_PROJECT_CONTROL.md',
  'tests/static/mission-001-contract.test.mjs',
  'workers/insights/src/contracts.ts',
  '.github/workflows/f1-verify.yml',
]);

const { included, excluded } = curatedUploadFileList();
const includedSet = new Set(included);
const errors = [];

for (const path of REQUIRED) {
  if (!includedSet.has(path)) errors.push(`required production file missing from curated upload: ${path}`);
}
for (const path of FORBIDDEN_SENTINELS) {
  if (includedSet.has(path)) errors.push(`forbidden development/server file leaked into curated upload: ${path}`);
}
for (const path of included) {
  if (isExcludedFromUpload(path)) errors.push(`denylisted path survived curation: ${path}`);
}

const missionRuntime = included.filter((p) => p === 'mission-001.html' || p === 'mission-001-app.js' || p === 'mission-private-store.js');
if (missionRuntime.length !== 3) errors.push(`Mission 001 runtime incomplete: expected 3 files, found ${missionRuntime.length}`);

const report = {
  status: errors.length ? 'REPAIR_REQUIRED' : 'PASS',
  included_count: included.length,
  excluded_count: excluded.length,
  required_files: REQUIRED,
  mission_runtime: missionRuntime,
  errors,
};

console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exit(1);

import { productionUploadFileList, isHardExcluded } from './build-production-upload.mjs';

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
  'agent/cost-constitution.json',
  'new-work/F2F3_GOLD_KEY_v0.3.1.csv',
  'master-map.md',
  'clovelearn-test-harness.html',
  // Digital Stewardship DS-I0 remains non-public until a separate release gate.
  'digital-stewardship-00.html',
  'digital-stewardship-00.js',
]);

const RISKY_PUBLIC_EXTENSIONS = Object.freeze(['.py', '.sh', '.xlsx', '.csv', '.yaml', '.yml']);

const { included, excluded, additionallyExcluded } = productionUploadFileList();
const includedSet = new Set(included);
const errors = [];

for (const path of REQUIRED) {
  if (!includedSet.has(path)) errors.push(`required production file missing: ${path}`);
}
for (const path of FORBIDDEN_SENTINELS) {
  if (includedSet.has(path)) errors.push(`forbidden repo-only file leaked into production: ${path}`);
}
for (const path of included) {
  if (isHardExcluded(path)) errors.push(`hard-excluded path survived production curation: ${path}`);
  if (RISKY_PUBLIC_EXTENSIONS.some((ext) => path.toLowerCase().endsWith(ext))) {
    errors.push(`unexpected risky file type in public upload: ${path}`);
  }
}

const missionRuntime = included.filter((p) => p === 'mission-001.html' || p === 'mission-001-app.js' || p === 'mission-private-store.js');
if (missionRuntime.length !== 3) errors.push(`Mission 001 runtime incomplete: expected 3 files, found ${missionRuntime.length}`);

const report = {
  status: errors.length ? 'REPAIR_REQUIRED' : 'PASS',
  included_count: included.length,
  excluded_count: excluded.length,
  hardening_excluded_count: additionallyExcluded.length,
  required_files: REQUIRED,
  forbidden_sentinels: FORBIDDEN_SENTINELS,
  mission_runtime: missionRuntime,
  errors,
};

console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exit(1);

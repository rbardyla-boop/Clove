#!/usr/bin/env node
/**
 * HiveWorld Agents — LAB evidence artifact writer (operator surface generator).
 *
 * ⚠️ SIMULATOR ONLY tooling: a local node script that regenerates the checked-in JSON evidence
 * artifacts under docs/lab/ from the deterministic lab suites. Run from the repo root:
 *
 *     node arcade/hiveworld-agents/write-evidence-artifacts.mjs
 *
 * Everything written is seeded and timestamp-free, so re-running on the same code produces
 * byte-identical files — a reviewer can verify an artifact by regenerating it. This script is
 * part of the denylisted lab directory: it ships nowhere and runs only by hand (or in tests).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildEvidencePack } from './attention-evidence.mjs';
import { buildStressSuite, replayArtifact } from './attention-stress.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'docs', 'lab');
mkdirSync(OUT, { recursive: true });

const write = (name, obj) => {
  const file = join(OUT, name);
  writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');
  console.log(`wrote ${name} (pass=${obj.result ? obj.result.pass : obj.pass})`);
};

// 1) the baseline W-6 evidence pack (C1–C10), seed 42 — the pack PR #63 landed on
write('attention-evidence-seed42.json', replayArtifact({ ...buildEvidencePack({ seed: 42 }), suite: 'attention-evidence', seed: 42 }));

// 2) the stress suite (S1–S8) across three independent seeds at 2000-round scale
write('attention-stress-suite.json', replayArtifact(buildStressSuite({ seeds: [42, 1337, 9001] })));

console.log('lab artifacts regenerated — deterministic, lab-only, never uploaded');

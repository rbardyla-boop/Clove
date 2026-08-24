#!/usr/bin/env node

/**
 * Create the controlled v0.10 successor from the verified v0.9 ancestor.
 *
 * This is intentionally a narrow transformation: it verifies the parent
 * bytes, replaces only the three non-schema status fields, preserves each
 * original wording as a qualifier, and writes the new canonical filename.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const EXPECTED_PARENT_SHA256 =
  'b2dd2052a9dcfc5f1b9f15b0815ae92d2c6c5eef5484a1fd765345e6054ab408';
const EXPECTED_CLAIM_IDS = Array.from({ length: 92 }, (_, index) => `EC-${String(index + 1).padStart(3, '0')}`)
  .flatMap((id) => (id === 'EC-051' ? [id, 'EC-051A'] : [id]));

const HEADER = `# EVIDENCE CONSOLIDATION LEDGER v0.10

Status: \`CANONICAL SUCCESSOR TO VERIFIED v0.9\`

Created: 2026-08-24

Parent artifact:
\`EVIDENCE_CONSOLIDATION_LEDGER_v0.9.md\`

Parent SHA-256:
\`${EXPECTED_PARENT_SHA256}\`

Provenance note:

> This v0.10 file was created on 2026-08-24 from the verified v0.9
> ancestor after the previously referenced v0.10 artifact could not be
> recovered. It is a new canonical successor, not a claim that the missing
> historical file was recovered.

Primary v0.10 change:
- normalize three non-schema evidence-status fields while preserving their
  original uncertainty as explicit qualifiers.

`;

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--parent') options.parent = argv[++index];
    else if (argument === '--out') options.out = argv[++index];
    else if (argument === '--help') options.help = true;
    else throw new Error(`unknown argument: ${argument}`);
  }
  return options;
}

function usage() {
  return [
    'Usage: node scripts/create-tds-ledger-v0-10.mjs --parent PATH --out PATH',
    '',
    'The parent must hash to the verified v0.9 SHA-256 before any output is written.',
  ].join('\n');
}

function claimIds(markdown) {
  return [...markdown.matchAll(/^###\s+(EC-\d+[A-Z]?)\s+[—-]/gm)].map((match) => match[1]);
}

function replaceStatus(markdown, rawStatus, frozenStatus) {
  const lines = markdown.split('\n');
  const expected = `**Status:** ${rawStatus}`;
  const matches = lines.reduce(
    (count, line) => count + (line.replace(/[ \\t]+$/, '') === expected ? 1 : 0),
    0,
  );
  if (matches !== 1) {
    throw new Error(`expected exactly one status field for ${rawStatus}; found ${matches}`);
  }
  const index = lines.findIndex((line) => line.replace(/[ \\t]+$/, '') === expected);
  lines.splice(index, 1, `**Status:** ${frozenStatus}`, `**Qualifier:** ${rawStatus}`);
  return lines.join('\n');
}

export async function createLedger({ parent, out }) {
  if (!parent || !out) throw new Error('both --parent and --out are required');
  if (path.basename(out) !== 'EVIDENCE_CONSOLIDATION_LEDGER_v0.10.md') {
    throw new Error('output basename must be EVIDENCE_CONSOLIDATION_LEDGER_v0.10.md');
  }

  const parentBytes = await readFile(parent);
  const parentSha256 = sha256(parentBytes);
  if (parentSha256 !== EXPECTED_PARENT_SHA256) {
    throw new Error(`parent SHA-256 mismatch: expected ${EXPECTED_PARENT_SHA256}, got ${parentSha256}`);
  }

  const parentMarkdown = parentBytes.toString('utf8');
  const ids = claimIds(parentMarkdown);
  if (ids.length !== EXPECTED_CLAIM_IDS.length || ids.some((id, index) => id !== EXPECTED_CLAIM_IDS[index])) {
    throw new Error(`parent claim topology mismatch: expected ${EXPECTED_CLAIM_IDS.length} ordered claims`);
  }

  let body = parentMarkdown.replace(/^# EVIDENCE CONSOLIDATION LEDGER v0\.\d+[ \t]*\r?\n/, '');
  if (body === parentMarkdown) throw new Error('ledger title line was not found at the start of the verified parent');

  body = replaceStatus(body, 'REPORTED / UNKNOWN CAUSATION', 'SPECULATIVE');
  body = replaceStatus(body, 'CONFLICTING_ARCHIVAL_RECORD / UNRESOLVED', 'PLAUSIBLE');
  body = replaceStatus(body, 'CURRENT PRACTICE — PARTY SPECIFIC', 'STRONG');

  const output = HEADER + body;
  const outputIds = claimIds(output);
  if (outputIds.length !== EXPECTED_CLAIM_IDS.length || outputIds.some((id, index) => id !== EXPECTED_CLAIM_IDS[index])) {
    throw new Error('output claim topology changed during v0.10 creation');
  }

  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, output, 'utf8');
  const outputBytes = Buffer.from(output, 'utf8');
  return {
    parent_sha256: parentSha256,
    v0_10_sha256: sha256(outputBytes),
    bytes: outputBytes.byteLength,
    claim_count: outputIds.length,
    repaired: [
      { id: 'EC-046', old_status: 'REPORTED / UNKNOWN CAUSATION', new_status: 'SPECULATIVE' },
      { id: 'EC-051A', old_status: 'CONFLICTING_ARCHIVAL_RECORD / UNRESOLVED', new_status: 'PLAUSIBLE' },
      { id: 'EC-086', old_status: 'CURRENT PRACTICE — PARTY SPECIFIC', new_status: 'STRONG' },
    ],
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) console.log(usage());
    else {
      const result = await createLedger(options);
      console.log(`TDS_LEDGER_V0_10_CREATE_PASS: ${result.claim_count} claims`);
      console.log(`PARENT_SHA256: ${result.parent_sha256}`);
      console.log(`V0_10_SHA256: ${result.v0_10_sha256}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildLedgerBundle,
  inventorySources,
  parseLedgerMarkdown,
  run,
  validateLedger,
} from '../scripts/build-tds-ledger.mjs';

const VALID_LEDGER = `# Evidence ledger\n\n## A. Architecture\n\n### EC-001 — A bounded claim\n**Status:** STRONG\n**Direct / primary source:** https://example.test/primary\n**Audit:** GREEN\n\nEvidence and boundary.\n\n## DO_NOT_RESURRECT CROSS-LINKS\n- “The evidence proves too much.” → REJECTED.\n`;

test('parses claim blocks without losing their raw markdown', () => {
  const claims = parseLedgerMarkdown(VALID_LEDGER);
  assert.equal(claims.length, 1);
  assert.equal(claims[0].id, 'EC-001');
  assert.equal(claims[0].status, 'STRONG');
  assert.equal(claims[0].audit, 'GREEN');
  assert.match(claims[0].raw_markdown, /Evidence and boundary\./);
  assert.deepEqual(claims[0].source_urls, ['https://example.test/primary']);
});

test('rejects non-frozen statuses and missing audit states', () => {
  const claims = parseLedgerMarkdown('### EC-001 — Broken\n**Status:** ARCHIVED_EVIDENCE_RECOVERED\n');
  assert.deepEqual(validateLedger(claims), [
    'EC-001: status is not one of the frozen statuses',
    'EC-001: audit is not GREEN, YELLOW, or RED',
  ]);
});

test('keeps the missing canonical source fail-closed', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tds-ledger-test-'));
  try {
    await writeFile(path.join(directory, 'EVIDENCE_CONSOLIDATION_LEDGER_v0.9.md'), VALID_LEDGER);
    const inventory = await inventorySources([directory]);
    assert.equal(inventory.canonical_matches.length, 0);
    assert.equal(inventory.historical_ledgers.length, 1);
    const result = await run(['--search-root', directory], directory);
    assert.equal(result.status, 'blocked');
    assert.equal(result.code, 'TDS_LEDGER_SOURCE_PACKET_MISSING');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('builds a lossless-derived bundle only from the exact canonical filename', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tds-ledger-test-'));
  try {
    const canonical = path.join(directory, 'EVIDENCE_CONSOLIDATION_LEDGER_v0.10.md');
    await writeFile(canonical, VALID_LEDGER);
    const result = await run(['--canonical', canonical], directory);
    assert.equal(result.status, 'built');
    assert.equal(result.bundle.coverage.claim_count, 1);
    assert.equal(result.bundle.coverage.killed_claim_count, 1);
    assert.equal(result.bundle.sources.length, 1);
    assert.equal(result.bundle.book_crosswalk.entries.length, 0);
    assert.match(result.bundle.claims[0].raw_markdown, /Evidence and boundary\./);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('bundle metadata never includes the local source path', () => {
  const bundle = buildLedgerBundle(VALID_LEDGER, {
    filename: 'EVIDENCE_CONSOLIDATION_LEDGER_v0.10.md',
    sha256: 'abc',
    bytes: Buffer.byteLength(VALID_LEDGER),
  });
  const serialized = JSON.stringify(bundle);
  assert.doesNotMatch(serialized, /\/home\/|\/tmp\//);
  assert.equal(bundle.source_manifest.canonical_filename, 'EVIDENCE_CONSOLIDATION_LEDGER_v0.10.md');
});

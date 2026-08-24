import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildLedgerBundle,
  CANONICAL_FILENAME,
  CANONICAL_VERSION,
  inventorySources,
  parseLedgerMarkdown,
  RELEASE_LOCK_FILENAME,
  run,
  validateLedger,
  validateReleaseLock,
} from '../scripts/build-tds-ledger.mjs';

const VALID_LEDGER = `# Evidence ledger\n\n## A. Architecture\n\n### EC-001 — A bounded claim\n**Publishable sentence:** A bounded claim.\n**Status:** STRONG\n**Direct / primary source:** https://example.test/primary\n**Audit:** GREEN\n\nEvidence and boundary.\n\n## DO_NOT_RESURRECT CROSS-LINKS\n- “The evidence proves too much.” → REJECTED.\n`;

const hash = (value) => createHash('sha256').update(value).digest('hex');

async function writeLockedCanonical(directory, markdown = VALID_LEDGER, lockOverrides = {}) {
  await mkdir(directory, { recursive: true });
  const canonical = path.join(directory, CANONICAL_FILENAME);
  await writeFile(canonical, markdown);
  await writeFile(path.join(directory, RELEASE_LOCK_FILENAME), `${JSON.stringify({
    version: CANONICAL_VERSION,
    filename: CANONICAL_FILENAME,
    sha256: hash(Buffer.from(markdown)),
    claim_count: parseLedgerMarkdown(markdown).length,
    ...lockOverrides,
  }, null, 2)}\n`);
  return canonical;
}

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

test('release lock passes for the exact source and fails closed on hash mismatch', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tds-ledger-test-'));
  try {
    const canonical = await writeLockedCanonical(directory);
    const markdown = await readFile(canonical);
    const metadata = { version: CANONICAL_VERSION, filename: CANONICAL_FILENAME, sha256: hash(markdown), bytes: markdown.byteLength };
    assert.deepEqual(validateReleaseLock({ ...metadata, claim_count: 1 }, metadata, 1), []);
    const result = await run(['--canonical', canonical], directory);
    assert.equal(result.status, 'built');
    await writeFile(path.join(directory, RELEASE_LOCK_FILENAME), JSON.stringify({
      version: CANONICAL_VERSION,
      filename: CANONICAL_FILENAME,
      sha256: '0'.repeat(64),
      claim_count: 1,
    }));
    const mismatch = await run(['--canonical', canonical], directory);
    assert.equal(mismatch.status, 'blocked');
    assert.equal(mismatch.code, 'TDS_LEDGER_RELEASE_LOCK_MISMATCH');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('duplicate canonical sources fail closed', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tds-ledger-test-'));
  try {
    await writeLockedCanonical(path.join(directory, 'one'));
    await writeLockedCanonical(path.join(directory, 'two'));
    const result = await run(['--search-root', directory], directory);
    assert.equal(result.status, 'blocked');
    assert.equal(result.code, 'TDS_LEDGER_SOURCE_PACKET_AMBIGUOUS');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('builds a public-safe bundle from the exact canonical filename', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tds-ledger-test-'));
  try {
    const canonical = await writeLockedCanonical(directory);
    const result = await run(['--canonical', canonical], directory);
    assert.equal(result.status, 'built');
    assert.equal(result.bundle.coverage.claim_count, 1);
    assert.equal(result.bundle.coverage.killed_claim_count, 1);
    assert.equal(result.bundle.sources.length, 2);
    assert.equal(result.bundle.book_crosswalk.entries.length, 0);
    assert.equal(result.bundle.claims[0].canonical_ledger_version, CANONICAL_VERSION);
    assert.equal(result.bundle.publication_firewall.status, 'PASS');
    assert.deepEqual(Object.keys(result.bundle.claims[0]).filter((key) => /raw|line_|path/.test(key)), []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('public classification holds unresolved and speculative records while preserving qualifiers', () => {
  const markdown = `# Ledger\n\n## Section\n\n### EC-046 — Personal report\n**Publishable sentence:** Report.\n**Status:** SPECULATIVE\n**Qualifier:** REPORTED / UNKNOWN CAUSATION\n**Direct source:** Author recollection; record not preserved.\n**Audit:** RED\n\n### EC-051A — Archival question\n**Publishable sentence:** Unresolved.\n**Status:** PLAUSIBLE\n**Qualifier:** CONFLICTING_ARCHIVAL_RECORD / UNRESOLVED\n**Evidence for:** compiled list; original roster not recovered.\n**Audit:** YELLOW\n\n### EC-086 — Party-specific practice\n**Publishable sentence:** Party-specific.\n**Status:** STRONG\n**Qualifier:** CURRENT PRACTICE — PARTY SPECIFIC\n**CANNOT CLAIM:** every party buys all data.\n**Audit:** GREEN\n`;
  const bundle = buildLedgerBundle(markdown, {
    version: CANONICAL_VERSION,
    filename: CANONICAL_FILENAME,
    sha256: 'abc',
    bytes: Buffer.byteLength(markdown),
  });
  const records = new Map(bundle.claims.map((claim) => [claim.claim_id, claim]));
  assert.equal(records.get('EC-046').public_classification, 'HOLD');
  assert.equal(records.get('EC-046').status_qualifier, 'REPORTED / UNKNOWN CAUSATION');
  assert.equal(records.get('EC-051A').public_classification, 'HOLD');
  assert.equal(records.get('EC-051A').status_qualifier, 'CONFLICTING_ARCHIVAL_RECORD / UNRESOLVED');
  assert.equal(records.get('EC-086').public_classification, 'CAUTION');
  assert.equal(records.get('EC-086').status_qualifier, 'CURRENT PRACTICE — PARTY SPECIFIC');
});

test('canonical v0.11 has the frozen topology, counts, killed claims, and provenance binding', async () => {
  const sourcePath = path.join(process.cwd(), 'research/source-packets/tds', CANONICAL_FILENAME);
  const lockPath = path.join(process.cwd(), 'research/source-packets/tds', RELEASE_LOCK_FILENAME);
  const [bytes, lockBytes] = await Promise.all([readFile(sourcePath), readFile(lockPath, 'utf8')]);
  const markdown = bytes.toString('utf8');
  const claims = parseLedgerMarkdown(markdown);
  const result = await run(['--canonical', sourcePath], process.cwd());
  assert.equal(result.status, 'built');
  assert.equal(claims.length, 93);
  assert.deepEqual(result.bundle.coverage.by_status, {
    ESTABLISHED: 66,
    STRONG: 23,
    PLAUSIBLE: 3,
    SPECULATIVE: 1,
  });
  assert.deepEqual(result.bundle.coverage.by_audit, { YELLOW: 16, GREEN: 76, RED: 1 });
  assert.equal(result.bundle.coverage.killed_claim_count, 66);
  assert.equal(result.bundle.provenance.canonical_sha256, hash(bytes));
  assert.equal(JSON.parse(lockBytes).sha256, hash(bytes));
  assert.equal(result.bundle.claims.find((claim) => claim.claim_id === 'EC-046').public_classification, 'HOLD');
  assert.equal(result.bundle.claims.find((claim) => claim.claim_id === 'EC-051A').status_qualifier, 'CONFLICTING_ARCHIVAL_RECORD / UNRESOLVED');
  assert.equal(result.bundle.claims.find((claim) => claim.claim_id === 'EC-086').status_qualifier, 'CURRENT PRACTICE — PARTY SPECIFIC');
  const serialized = JSON.stringify(result.bundle);
  assert.doesNotMatch(serialized, /\/home\/|\/tmp\//);
  assert.doesNotMatch(serialized, /__clove\/signal|google-analytics|gtag\(|segment\.io/i);
  assert.doesNotMatch(serialized, /deployed\s*[:=]\s*true/i);
});

#!/usr/bin/env node

/**
 * Build the TDS public proof ledger from the named canonical markdown artifact.
 *
 * This is deliberately source-gated. Historical ledgers are inventory evidence,
 * never substitutes for EVIDENCE_CONSOLIDATION_LEDGER_v0.10.md.
 */

import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

export const CANONICAL_FILENAME = 'EVIDENCE_CONSOLIDATION_LEDGER_v0.10.md';
export const FROZEN_STATUSES = Object.freeze([
  'ESTABLISHED',
  'STRONG',
  'PLAUSIBLE',
  'SPECULATIVE',
  'REJECTED',
]);
export const AUDIT_STATES = Object.freeze(['GREEN', 'YELLOW', 'RED']);

const SKIP_DIRECTORIES = new Set([
  '.git',
  '.hg',
  '.svn',
  '.venv',
  'node_modules',
  '.cache',
  '.smart-env',
]);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function unique(values) {
  return [...new Set(values)];
}

function cleanFieldName(value) {
  return value.trim().replace(/:+$/, '').trim().toLowerCase().replace(/\s+/g, '_');
}

function firstFrozenStatus(value) {
  const upper = String(value || '').toUpperCase();
  return FROZEN_STATUSES.find((status) => new RegExp(`\\b${status}\\b`).test(upper)) || null;
}

function firstAuditState(value) {
  const upper = String(value || '').toUpperCase();
  return AUDIT_STATES.find((state) => new RegExp(`\\b${state}\\b`).test(upper)) || null;
}

function headingLevel(line) {
  const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
  return match ? { level: match[1].length, text: match[2] } : null;
}

function claimHeading(line) {
  const match = /^###\s+(EC-\d+[A-Z]?)\s+[—-]\s+(.+?)\s*$/.exec(line);
  return match ? { id: match[1], title: match[2] } : null;
}

function fieldLine(line) {
  const match = /^\*\*([^*]+)\*\*\s*(.*)$/.exec(line);
  if (!match) return null;
  const name = cleanFieldName(match[1]);
  const value = match[2].replace(/^:\s*/, '').trim();
  return { name, value };
}

function urlsIn(value) {
  return unique(String(value || '').match(/https?:\/\/[^\s)>\]]+/g) || [])
    .map((url) => url.replace(/[.,;:]+$/, ''));
}

function claimBoundaries(lines) {
  const starts = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (claimHeading(lines[index])) starts.push(index);
  }
  return starts.map((start, position) => {
    const nextClaim = starts[position + 1] ?? lines.length;
    let end = nextClaim;
    for (let index = start + 1; index < nextClaim; index += 1) {
      const heading = headingLevel(lines[index]);
      if (heading?.level === 2) {
        end = index;
        break;
      }
    }
    return { start, end };
  });
}

/**
 * Parse claim blocks without discarding their original markdown. The `raw_markdown`
 * field is the byte-decoded source slice used to derive every structured field.
 */
export function parseLedgerMarkdown(markdown) {
  const lines = String(markdown).split('\n');
  const boundaries = claimBoundaries(lines);
  const claims = [];
  let parentSection = null;
  let parentSectionLevel = null;

  for (let index = 0; index < lines.length; index += 1) {
    const heading = headingLevel(lines[index]);
    if (heading && heading.level <= 2) {
      parentSection = heading.text;
      parentSectionLevel = heading.level;
    }
    const boundary = boundaries.find((candidate) => candidate.start === index);
    if (!boundary) continue;

    const headingData = claimHeading(lines[index]);
    const fields = {};
    let currentField = null;
    for (const line of lines.slice(boundary.start + 1, boundary.end)) {
      const parsedField = fieldLine(line);
      if (parsedField) {
        currentField = parsedField.name;
        fields[currentField] = parsedField.value;
      } else if (currentField && line.trim()) {
        fields[currentField] = `${fields[currentField]}\n${line}`.trim();
      }
    }
    const rawMarkdown = lines.slice(boundary.start, boundary.end).join('\n');
    const sourceText = Object.entries(fields)
      .filter(([name]) => /source|citation|reference|evidence/.test(name))
      .map(([, value]) => value)
      .join('\n');
    const sourceUrls = urlsIn(rawMarkdown);
    claims.push({
      id: headingData.id,
      title: headingData.title,
      section: parentSection,
      section_level: parentSectionLevel,
      line_start: boundary.start + 1,
      line_end: boundary.end,
      status: firstFrozenStatus(fields.status),
      status_raw: fields.status || null,
      audit: firstAuditState(fields.audit),
      audit_raw: fields.audit || null,
      fields,
      source_urls: sourceUrls,
      source_text: sourceText || null,
      raw_markdown: rawMarkdown,
    });
  }
  return claims;
}

function parseKilledClaims(markdown) {
  const lines = String(markdown).split('\n');
  const killed = [];
  let activeSection = null;
  for (const line of lines) {
    const heading = headingLevel(line);
    if (heading && heading.text.toUpperCase().includes('DO_NOT_RESURRECT')) {
      activeSection = heading.text;
      continue;
    }
    if (heading && heading.level <= 2) {
      activeSection = null;
      continue;
    }
    if (activeSection && /^\s*[-*]\s+/.test(line)) {
      killed.push({
        section: activeSection,
        text: line.replace(/^\s*[-*]\s+/, '').trim(),
        raw_markdown: line,
      });
    }
  }
  return killed;
}

export function validateLedger(claims) {
  const errors = [];
  const ids = new Set();
  for (const claim of claims) {
    if (ids.has(claim.id)) errors.push(`duplicate claim id: ${claim.id}`);
    ids.add(claim.id);
    if (!claim.status) errors.push(`${claim.id}: status is not one of the frozen statuses`);
    if (!claim.audit) errors.push(`${claim.id}: audit is not GREEN, YELLOW, or RED`);
    if (!claim.raw_markdown.trim()) errors.push(`${claim.id}: empty raw claim block`);
  }
  if (claims.length === 0) errors.push('no EC claim blocks found');
  return errors;
}

async function pathExists(candidate) {
  try {
    await stat(candidate);
    return true;
  } catch {
    return false;
  }
}

async function walkFiles(root) {
  const files = [];
  async function visit(directory) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.codex') continue;
      if (entry.isDirectory() && SKIP_DIRECTORIES.has(entry.name)) continue;
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(candidate);
      else if (entry.isFile()) files.push(candidate);
    }
  }
  if (await pathExists(root)) {
    const rootStat = await stat(root);
    if (rootStat.isFile()) return [root];
    await visit(root);
  }
  return files;
}

function displayRoot(root) {
  return path.basename(root) || root;
}

export async function inventorySources(searchRoots, explicitCanonical = null) {
  const roots = unique((searchRoots || []).map((root) => path.resolve(root)));
  const candidates = [];
  const historical = [];
  for (const root of roots) {
    for (const candidate of await walkFiles(root)) {
      const basename = path.basename(candidate);
      const relativePath = path.relative(root, candidate) || basename;
      const record = {
        root: displayRoot(root),
        relative_path: relativePath,
        filename: basename,
      };
      if (basename === CANONICAL_FILENAME) candidates.push({ ...record, path: candidate });
      if (/^EVIDENCE_CONSOLIDATION_LEDGER_v0\.\d+\.md$/i.test(basename)) {
        historical.push(record);
      }
    }
  }
  if (explicitCanonical) {
    const resolved = path.resolve(explicitCanonical);
    if (await pathExists(resolved)) {
      const record = {
        root: displayRoot(path.dirname(resolved)),
        relative_path: path.basename(resolved),
        filename: path.basename(resolved),
        path: resolved,
      };
      if (!candidates.some((candidate) => candidate.path === resolved)) candidates.push(record);
    }
  }
  const rootStates = await Promise.all(roots.map(async (root) => ({
    label: displayRoot(root),
    exists: await pathExists(root),
  })));
  return {
    required_filename: CANONICAL_FILENAME,
    roots: rootStates,
    canonical_matches: candidates,
    historical_ledgers: historical.sort((left, right) => left.filename.localeCompare(right.filename)),
  };
}

async function materializeRootStates(inventory) {
  return inventory.roots;
}

export async function renderInventoryReport(inventory) {
  const roots = await materializeRootStates(inventory);
  const gateCode = inventory.canonical_matches.length === 0
    ? 'TDS_LEDGER_SOURCE_PACKET_MISSING'
    : inventory.canonical_matches.length > 1
      ? 'TDS_LEDGER_SOURCE_PACKET_AMBIGUOUS'
      : null;
  const lines = [
    '# TDS Public Proof Ledger — Source Inventory',
    '',
    gateCode ? `Status: BLOCKED — ${gateCode}` : 'Status: READY FOR CANONICAL EXTRACTION',
    '',
    `Required canonical filename: \`${inventory.required_filename}\``,
    '',
    '## Search roots',
    '',
    ...roots.map((root) => `- ${root.label}: ${root.exists ? 'present' : 'not present'}`),
    '',
    '## Exact canonical matches',
    '',
    ...(inventory.canonical_matches.length
      ? inventory.canonical_matches.map((candidate) => `- ${candidate.root}/${candidate.relative_path}`)
      : ['- none']),
    '',
    '## Historical ledgers found',
    '',
    ...(inventory.historical_ledgers.length
      ? inventory.historical_ledgers.map((candidate) => `- ${candidate.root}/${candidate.relative_path}`)
      : ['- none']),
    '',
    '## Gate decision',
    '',
    gateCode
      ? '- v0.9 and earlier files are inventory evidence only; none may be relabeled as v0.10.'
      : '- The exact canonical source is available for extraction.',
    '- No public claims, dossiers, source crosswalk, or killed-claim output may be generated while this gate is blocked.',
    '- No claim or source counts are asserted by this report.',
    '',
  ];
  return lines.join('\n');
}

function sourceManifest(claims) {
  const byUrl = new Map();
  for (const claim of claims) {
    for (const url of claim.source_urls) {
      const existing = byUrl.get(url) || {
        source_id: `URL-${sha256(url).slice(0, 12)}`,
        identifier_type: 'derived_url_key',
        url,
        claim_ids: [],
      };
      existing.claim_ids.push(claim.id);
      byUrl.set(url, existing);
    }
  }
  return [...byUrl.values()]
    .map((source) => ({ ...source, claim_ids: unique(source.claim_ids).sort() }))
    .sort((left, right) => left.url.localeCompare(right.url));
}

export function buildLedgerBundle(markdown, sourceMetadata) {
  const claims = parseLedgerMarkdown(markdown);
  const validationErrors = validateLedger(claims);
  if (validationErrors.length) {
    const error = new Error('TDS_LEDGER_SCHEMA_INVALID');
    error.details = validationErrors;
    throw error;
  }
  const killedClaims = parseKilledClaims(markdown);
  const bySection = new Map();
  for (const claim of claims) {
    const section = claim.section || 'Unsectioned';
    const entry = bySection.get(section) || { section, claim_ids: [], raw_markdown: [] };
    entry.claim_ids.push(claim.id);
    entry.raw_markdown.push(claim.raw_markdown);
    bySection.set(section, entry);
  }
  const dossiers = [...bySection.values()].map((dossier) => ({
    section: dossier.section,
    claim_ids: dossier.claim_ids,
    raw_markdown: dossier.raw_markdown.join('\n\n'),
  }));
  const counts = (values) => values.reduce((result, value) => {
    result[value] = (result[value] || 0) + 1;
    return result;
  }, {});
  return {
    claims,
    sources: sourceManifest(claims),
    coverage: {
      claim_count: claims.length,
      by_status: counts(claims.map((claim) => claim.status)),
      by_audit: counts(claims.map((claim) => claim.audit)),
      by_section: counts(claims.map((claim) => claim.section || 'Unsectioned')),
      source_url_count: sourceManifest(claims).length,
      dossier_count: dossiers.length,
      killed_claim_count: killedClaims.length,
    },
    source_manifest: {
      schema_version: 'tds-source-manifest-v1',
      canonical_filename: sourceMetadata.filename,
      canonical_sha256: sourceMetadata.sha256,
      canonical_bytes: sourceMetadata.bytes,
      observed_urls: sourceManifest(claims),
    },
    book_crosswalk: {
      schema_version: 'tds-book-crosswalk-v1',
      note: 'No chapter mapping is inferred. Entries are populated only when the canonical source explicitly supplies one.',
      entries: [],
    },
    dossiers,
    killed_claims: killedClaims,
  };
}

async function writeBundle(outputDirectory, bundle) {
  await mkdir(outputDirectory, { recursive: true });
  const files = {
    'claims.json': bundle.claims,
    'sources.json': bundle.sources,
    'coverage.json': bundle.coverage,
    'source-manifest.json': bundle.source_manifest,
    'book-crosswalk.json': bundle.book_crosswalk,
    'dossiers.json': bundle.dossiers,
    'killed-claims.json': bundle.killed_claims,
  };
  await Promise.all(Object.entries(files).map(([filename, value]) => writeFile(
    path.join(outputDirectory, filename),
    `${JSON.stringify(value, null, 2)}\n`,
    'utf8',
  )));
}

function parseArgs(argv) {
  const options = { roots: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--canonical') options.canonical = argv[++index];
    else if (argument === '--search-root') options.roots.push(argv[++index]);
    else if (argument === '--out') options.out = argv[++index];
    else if (argument === '--inventory-out') options.inventoryOut = argv[++index];
    else if (argument === '--help') options.help = true;
    else throw new Error(`unknown argument: ${argument}`);
  }
  return options;
}

function usage() {
  return [
    'Usage: node scripts/build-tds-ledger.mjs [options]',
    '',
    `  --canonical PATH       exact ${CANONICAL_FILENAME} path`,
    '  --search-root PATH     root to inventory; may be repeated',
    '  --inventory-out PATH   write the source inventory report',
    '  --out PATH             write the public ledger bundle',
  ].join('\n');
}

export async function run(argv, cwd = process.cwd()) {
  const options = parseArgs(argv);
  if (options.help) return { status: 'help', output: usage() };
  const roots = options.roots.length ? options.roots : [cwd];
  const inventory = await inventorySources(roots, options.canonical || null);
  const report = await renderInventoryReport(inventory);
  if (options.inventoryOut) {
    await mkdir(path.dirname(path.resolve(options.inventoryOut)), { recursive: true });
    await writeFile(path.resolve(options.inventoryOut), report, 'utf8');
  }
  if (inventory.canonical_matches.length !== 1) {
    const code = inventory.canonical_matches.length === 0
      ? 'TDS_LEDGER_SOURCE_PACKET_MISSING'
      : 'TDS_LEDGER_SOURCE_PACKET_AMBIGUOUS';
    return {
      status: 'blocked',
      code,
      inventory,
      report,
    };
  }
  const source = inventory.canonical_matches[0].path;
  const bytes = await readFile(source);
  const markdown = bytes.toString('utf8');
  const bundle = buildLedgerBundle(markdown, {
    filename: path.basename(source),
    sha256: sha256(bytes),
    bytes: bytes.byteLength,
  });
  if (options.out) await writeBundle(path.resolve(options.out), bundle);
  return { status: 'built', inventory, bundle, source: path.basename(source) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const result = await run(process.argv.slice(2));
    if (result.status === 'help') {
      console.log(result.output);
    } else if (result.status === 'blocked') {
      console.error(result.code);
      console.error(result.report);
      process.exitCode = 2;
    } else {
      console.log(`TDS_LEDGER_BUILD_PASS: ${result.bundle.coverage.claim_count} claims`);
      console.log(`CANONICAL_SHA256: ${result.bundle.source_manifest.canonical_sha256}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    if (error?.details) for (const detail of error.details) console.error(`- ${detail}`);
    process.exitCode = 1;
  }
}

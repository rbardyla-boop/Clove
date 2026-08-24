#!/usr/bin/env node

/**
 * Build the TDS public proof ledger from the named canonical markdown artifact.
 *
 * This is deliberately source-gated. Historical ledgers are inventory evidence,
 * never substitutes for EVIDENCE_CONSOLIDATION_LEDGER_v0.11.md.
 */

import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

export const CANONICAL_VERSION = 'v0.11';
export const CANONICAL_FILENAME = 'EVIDENCE_CONSOLIDATION_LEDGER_v0.11.md';
export const RELEASE_LOCK_FILENAME = 'TDS_LEDGER_RELEASE_LOCK.json';
export const PARENT_VERSION = 'v0.9';
export const PARENT_SHA256 = 'b2dd2052a9dcfc5f1b9f15b0815ae92d2c6c5eef5484a1fd765345e6054ab408';
export const CREATED_DATE = '2026-08-24';
export const PUBLIC_CLASSIFICATIONS = Object.freeze(['PUBLIC', 'CAUTION', 'HOLD']);
export const SOURCE_CLASSIFICATIONS = Object.freeze([
  'DIRECT_URL',
  'NAMED_PRIMARY_SOURCE',
  'NAMED_SECONDARY_SOURCE',
  'SOURCE_PACKET_REFERENCE',
  'UNRESOLVED_SOURCE_REFERENCE',
  'NO_SOURCE',
]);
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

function firstField(fields, patterns) {
  const entry = Object.entries(fields || {}).find(([name]) => patterns.some((pattern) => pattern.test(name)));
  return entry ? entry[1] : null;
}

function claimField(claim, patterns) {
  return firstField(claim.fields, patterns);
}

function sourceEvidenceText(claim) {
  return unique([
    claim.source_text,
    claimField(claim, [/direct.*source/, /primary.*source/, /secondary.*source/, /source$/]),
    claimField(claim, [/^evidence$/, /reference/, /citation/]),
  ].filter(Boolean).flatMap((value) => String(value).split('\n').map((line) => line.trim()).filter(Boolean))).join('\n');
}

function classifySources(claim) {
  const text = sourceEvidenceText(claim);
  const classificationText = [
    text,
    claimField(claim, [/qualifier/, /prior_status_wording/, /counterevidence/, /cannot_claim/]),
  ].filter(Boolean).join('\n');
  const upper = classificationText.toUpperCase();
  const classifications = [];
  if (claim.source_urls.length) classifications.push('DIRECT_URL');
  if (/(DIRECT|PRIMARY|OFFICIAL|STATUTE|ACT|REGULATION|LAW|RECORD|ARCHIVE|FOIA|TRANSCRIPT|TRIAL|STUDY|EXPERIMENT|META-ANALYSIS|RCT|PNAS|PLOS|ELECTIONS CANADA|CRTC|NATIONAL ARCHIVES|FBI|CIA)/.test(upper)) {
    classifications.push('NAMED_PRIMARY_SOURCE');
  }
  if (/(SECONDARY|SCHOLARSHIP|LITERATURE|REVIEW|SYNTHESIS|MANIN|DAHL|WEBER|MEO|REUTERS INSTITUTE)/.test(upper)) {
    classifications.push('NAMED_SECONDARY_SOURCE');
  }
  if (/(SOURCE PACKET|RESEARCH PACKET|WINDOW [A-Z]|AUDIT|PROJECT|BRIEF)/.test(upper)) {
    classifications.push('SOURCE_PACKET_REFERENCE');
  }
  if (/(UNRESOLVED|NOT YET|NOT RECOVERED|REMAINS OPEN|REQUIRES .*SOURCE|REQUIRES .*RECEIPT|PENDING|ARCHIVAL.*CONFLICT|CONFLICTING|PARTY SPECIFIC|CURRENT PRACTICE)/.test(upper)) {
    classifications.push('UNRESOLVED_SOURCE_REFERENCE');
  }
  if (!classifications.length) classifications.push('NO_SOURCE');
  const priority = ['DIRECT_URL', 'UNRESOLVED_SOURCE_REFERENCE', 'SOURCE_PACKET_REFERENCE', 'NAMED_PRIMARY_SOURCE', 'NAMED_SECONDARY_SOURCE', 'NO_SOURCE'];
  const primary = priority.find((classification) => classifications.includes(classification)) || 'NO_SOURCE';
  const requiresResolution = classifications.some((classification) =>
    ['SOURCE_PACKET_REFERENCE', 'UNRESOLVED_SOURCE_REFERENCE', 'NO_SOURCE'].includes(classification));
  const sourceResolutionState = classifications.includes('UNRESOLVED_SOURCE_REFERENCE')
    ? 'UNRESOLVED_TEXTUAL_REFERENCE'
    : claim.source_urls.length
      ? 'DIRECT_URL_PRESENT'
      : primary === 'SOURCE_PACKET_REFERENCE'
        ? 'SOURCE_PACKET_NOT_URL_PINNED'
        : primary === 'NO_SOURCE'
          ? 'NO_SOURCE_IDENTITY_PRESERVED'
          : 'NAMED_SOURCE_NOT_URL_PINNED';
  return {
    source_classification: primary,
    source_classifications: unique(classifications),
    direct_urls: claim.source_urls,
    named_source_text: text || null,
    source_resolution_state: sourceResolutionState,
    source_resolution_required: requiresResolution,
  };
}

function classifyPublicClaim(claim, sourceCoverage) {
  const qualifier = claimField(claim, [/qualifier/, /prior_status_wording/]) || '';
  const combined = `${claim.status_raw || ''}\n${qualifier}\n${claim.audit_raw || ''}`.toUpperCase();
  if (
    claim.audit === 'RED'
    || claim.status === 'SPECULATIVE'
    || claim.status === 'REJECTED'
    || /UNRESOLVED.*ARCHIVAL|ARCHIVAL.*UNRESOLVED|CONFLICTING_ARCHIVAL_RECORD/.test(combined)
  ) return 'HOLD';
  if (
    claim.audit === 'YELLOW'
    || claim.status === 'PLAUSIBLE'
    || sourceCoverage.source_resolution_required
    || /PROPOSED|EXPERIMENTAL|OUTCOME UNRESOLVED/.test(combined)
  ) return 'CAUTION';
  return 'PUBLIC';
}

function publicClaimRecord(claim, sourceCoverage, metadata) {
  return {
    claim_id: claim.id,
    title: claim.title,
    publishable_sentence: claimField(claim, [/publishable_sentence/]),
    evidence_status: claim.status,
    status_qualifier: claimField(claim, [/qualifier/, /prior_status_wording/]),
    audit_state: claim.audit,
    public_classification: classifyPublicClaim(claim, sourceCoverage),
    direct_primary_source: claimField(claim, [/direct.*primary.*source/, /^direct_source$/, /^direct_sources$/]),
    best_secondary_source: claimField(claim, [/best.*secondary.*source/, /^secondary_source$/]),
    counterevidence_boundary: claimField(claim, [/counterevidence/, /boundary/]),
    effect_denominator: claimField(claim, [/effect.*denominator/, /^effect$/]),
    jurisdiction: claimField(claim, [/jurisdiction/]),
    cannot_claim: claimField(claim, [/cannot_claim/]),
    chapter_destination: claimField(claim, [/chapter/]),
    source_urls: sourceCoverage.direct_urls,
    source_resolution_state: sourceCoverage.source_resolution_state,
    source_resolution_required: sourceCoverage.source_resolution_required,
    canonical_ledger_version: metadata.version,
    canonical_ledger_sha256: metadata.sha256,
  };
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
      .filter(([name]) => /source|citation|reference|^evidence/.test(name))
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
      const text = line.replace(/^\s*[-*]\s+/, '').trim();
      const [claimOrMyth, ...dispositionParts] = text.split('→');
      killed.push({
        source_section: activeSection,
        claim_or_myth: claimOrMyth.trim(),
        reason_or_disposition: dispositionParts.length ? dispositionParts.join('→').trim() : null,
        replacement_theory: null,
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

export function validateReleaseLock(lock, sourceMetadata, claimCount) {
  const errors = [];
  if (!lock || typeof lock !== 'object') {
    return ['release lock is missing or not an object'];
  }
  if (lock.version !== CANONICAL_VERSION) errors.push(`release lock version mismatch: expected ${CANONICAL_VERSION}`);
  if (lock.filename !== CANONICAL_FILENAME) errors.push(`release lock filename mismatch: expected ${CANONICAL_FILENAME}`);
  if (lock.sha256 !== sourceMetadata.sha256) errors.push('release lock SHA-256 mismatch');
  if (lock.claim_count !== claimCount) errors.push(`release lock claim count mismatch: expected ${claimCount}`);
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
      if (basename !== CANONICAL_FILENAME && /^EVIDENCE_CONSOLIDATION_LEDGER_v0\.\d+\.md$/i.test(basename)) {
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
      ? '- v0.9 and earlier files are inventory evidence only; none may be relabeled as historical v0.10 or canonical v0.11.'
      : '- The exact canonical v0.11 source is available for extraction.',
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

function sourceRegistry(claims, sourceCoverageById, metadata) {
  const registry = new Map();
  const add = (key, entry) => {
    const existing = registry.get(key) || {
      source_id: entry.source_id,
      source_type: entry.source_type,
      label: entry.label,
      url: entry.url || null,
      claim_ids: [],
      canonical_ledger_version: metadata.version,
      canonical_ledger_sha256: metadata.sha256,
    };
    existing.claim_ids.push(entry.claim_id);
    registry.set(key, existing);
  };
  for (const claim of claims) {
    const coverage = sourceCoverageById.get(claim.id);
    for (const url of claim.source_urls) {
      add(`url:${url}`, {
        source_id: `URL-${sha256(url).slice(0, 12)}`,
        source_type: 'DIRECT_URL',
        label: url,
        url,
        claim_id: claim.id,
      });
    }
    if (coverage?.named_source_text) {
      const label = coverage.named_source_text;
      add(`text:${sha256(label)}`, {
        source_id: `SRC-${sha256(label).slice(0, 12)}`,
        source_type: coverage.source_classification,
        label,
        claim_id: claim.id,
      });
    }
  }
  return [...registry.values()]
    .map((source) => ({ ...source, claim_ids: unique(source.claim_ids).sort() }))
    .sort((left, right) => left.source_id.localeCompare(right.source_id));
}

function dossierIndex(publicClaims) {
  const bySection = new Map();
  for (const claim of publicClaims) {
    const section = claim.section || 'Unsectioned';
    const entry = bySection.get(section) || {
      section,
      claim_ids: [],
      by_public_classification: {},
      coverage_warnings: [],
    };
    entry.claim_ids.push(claim.claim_id);
    entry.by_public_classification[claim.public_classification] =
      (entry.by_public_classification[claim.public_classification] || 0) + 1;
    if (claim.source_resolution_required) {
      entry.coverage_warnings.push(`${claim.claim_id}: source resolution required before independent public display`);
    }
    if (claim.public_classification === 'HOLD') {
      entry.coverage_warnings.push(`${claim.claim_id}: held behind the publication firewall`);
    }
    bySection.set(section, entry);
  }
  return [...bySection.values()].map((entry) => ({
    section: entry.section,
    claim_count: entry.claim_ids.length,
    public_count: entry.by_public_classification.PUBLIC || 0,
    caution_count: entry.by_public_classification.CAUTION || 0,
    hold_count: entry.by_public_classification.HOLD || 0,
    claim_ids: entry.claim_ids,
    coverage_warnings: unique(entry.coverage_warnings),
  }));
}

function publicationFirewall(payload) {
  const serialized = JSON.stringify(payload);
  const checks = [
    {
      id: 'NO_LOCAL_ABSOLUTE_PATHS',
      pass: !/(\/home\/|\/tmp\/|file:\/\/|[A-Za-z]:\\\\)/.test(serialized),
    },
    {
      id: 'NO_PRIVATE_CREDENTIAL_MARKERS',
      pass: !(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:api[_-]?key|authorization)\s*[:=]\s*\S+/i.test(serialized)),
    },
    {
      id: 'NO_TRACKING_ENDPOINTS',
      pass: !(/\/__clove\/signal|google-analytics|gtag\(|segment\.io|plausible\.io/i.test(serialized)),
    },
    {
      id: 'NO_ACCOUNT_OR_DONATION_GATE',
      pass: !(/account required|sign in to view|donate to view|payment required/i.test(serialized)),
    },
    {
      id: 'NO_RAW_INTERNAL_FIELDS',
      pass: !(/raw_markdown|line_start|line_end|source_path|filesystem/i.test(serialized)),
    },
  ];
  return {
    status: checks.every((check) => check.pass) ? 'PASS' : 'FAIL',
    checks,
  };
}

export function renderSourceCoverageMarkdown(sourceCoverage, provenance) {
  const lines = [
    '# TDS Public Ledger Source Coverage',
    '',
    `Canonical version: \`${provenance.canonical_version}\``,
    '',
    `Canonical SHA-256: \`${provenance.canonical_sha256}\``,
    '',
    'This report distinguishes direct URLs from named sources and unresolved textual references. It does not fabricate URLs or imply independent verification merely because a source is named in the ledger.',
    '',
    '| Claim ID | Public class | Source classification | Direct URLs | Named source text | Resolution required |',
    '|---|---|---|---|---|---|',
  ];
  for (const entry of sourceCoverage) {
    const clean = (value) => String(value || '—').replace(/\|/g, '\\|').replace(/\n/g, '<br>');
    lines.push(`| ${entry.claim_id} | ${entry.public_classification} | ${entry.source_classification} | ${clean(entry.direct_urls.join('<br>'))} | ${clean(entry.named_source_text)} | ${entry.source_resolution_required ? 'YES' : 'NO'} |`);
  }
  return `${lines.join('\n')}\n`;
}

export function buildLedgerBundle(markdown, sourceMetadata) {
  const claims = parseLedgerMarkdown(markdown);
  const validationErrors = validateLedger(claims);
  if (validationErrors.length) {
    const error = new Error('TDS_LEDGER_SCHEMA_INVALID');
    error.details = validationErrors;
    throw error;
  }
  const metadata = {
    version: sourceMetadata.version || CANONICAL_VERSION,
    created: sourceMetadata.created || CREATED_DATE,
    parent_version: sourceMetadata.parent_version || PARENT_VERSION,
    parent_sha256: sourceMetadata.parent_sha256 || PARENT_SHA256,
    filename: sourceMetadata.filename,
    sha256: sourceMetadata.sha256,
    bytes: sourceMetadata.bytes,
  };
  const sourceCoverage = claims.map((claim) => ({
    claim_id: claim.id,
    ...classifySources(claim),
  }));
  const sourceCoverageById = new Map(sourceCoverage.map((coverage) => [coverage.claim_id, coverage]));
  const publicClaims = claims.map((claim) => {
    const record = publicClaimRecord(claim, sourceCoverageById.get(claim.id), metadata);
    return { ...record, section: claim.section || 'Unsectioned' };
  });
  for (const coverage of sourceCoverage) {
    coverage.public_classification = publicClaims.find((claim) => claim.claim_id === coverage.claim_id).public_classification;
  }
  const dossiers = dossierIndex(publicClaims);
  const killedClaims = parseKilledClaims(markdown).map((entry) => ({
    ...entry,
    canonical_ledger_version: metadata.version,
    canonical_ledger_sha256: metadata.sha256,
  }));
  const observedUrls = sourceManifest(claims);
  const sources = sourceRegistry(claims, sourceCoverageById, metadata);
  const counts = (values) => values.reduce((result, value) => {
    result[value] = (result[value] || 0) + 1;
    return result;
  }, {});
  const coverage = {
      claim_count: claims.length,
      by_status: counts(claims.map((claim) => claim.status)),
      by_audit: counts(claims.map((claim) => claim.audit)),
      by_public_classification: counts(publicClaims.map((claim) => claim.public_classification)),
      by_section: counts(publicClaims.map((claim) => claim.section)),
      source_url_count: observedUrls.length,
      source_registry_count: sources.length,
      source_classification: counts(sourceCoverage.map((entry) => entry.source_classification)),
      dossier_count: dossiers.length,
      killed_claim_count: killedClaims.length,
    };
  const provenance = {
    canonical_version: metadata.version,
    created: metadata.created,
    parent_version: metadata.parent_version,
    parent_sha256: metadata.parent_sha256,
    parent_artifact: 'EVIDENCE_CONSOLIDATION_LEDGER_v0.9.md',
    canonical_filename: metadata.filename,
    canonical_sha256: metadata.sha256,
    canonical_bytes: metadata.bytes,
    claim_count: claims.length,
  };
  const firewallPayload = { provenance, claims: publicClaims, sources, sourceCoverage, dossiers, killedClaims };
  return {
    claims: publicClaims,
    parsed_claims: claims,
    sources,
    source_coverage: sourceCoverage,
    coverage,
    provenance,
    publication_firewall: publicationFirewall(firewallPayload),
    source_manifest: {
      schema_version: 'tds-source-manifest-v1',
      canonical_version: metadata.version,
      canonical_filename: metadata.filename,
      canonical_sha256: metadata.sha256,
      canonical_bytes: metadata.bytes,
      observed_urls: observedUrls,
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
    'source-coverage.json': bundle.source_coverage,
    'coverage.json': bundle.coverage,
    'provenance.json': bundle.provenance,
    'publication-firewall.json': bundle.publication_firewall,
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
    else if (argument === '--source-coverage-out') options.sourceCoverageOut = argv[++index];
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
    '  --source-coverage-out PATH  write human-readable source coverage',
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
  const sourceMetadata = {
    version: CANONICAL_VERSION,
    filename: path.basename(source),
    sha256: sha256(bytes),
    bytes: bytes.byteLength,
  };
  const lockPath = path.join(path.dirname(source), RELEASE_LOCK_FILENAME);
  let lock;
  try {
    lock = JSON.parse(await readFile(lockPath, 'utf8'));
  } catch {
    return {
      status: 'blocked',
      code: 'TDS_LEDGER_RELEASE_LOCK_MISMATCH',
      details: [`release lock missing or invalid: ${RELEASE_LOCK_FILENAME}`],
      inventory,
      report,
    };
  }
  const lockErrors = validateReleaseLock(lock, sourceMetadata, parseLedgerMarkdown(markdown).length);
  if (lockErrors.length) {
    return {
      status: 'blocked',
      code: 'TDS_LEDGER_RELEASE_LOCK_MISMATCH',
      details: lockErrors,
      inventory,
      report,
    };
  }
  const bundle = buildLedgerBundle(markdown, sourceMetadata);
  if (bundle.publication_firewall.status !== 'PASS') {
    const error = new Error('TDS_LEDGER_PUBLICATION_FIREWALL_FAIL');
    error.details = bundle.publication_firewall.checks.filter((check) => !check.pass).map((check) => check.id);
    throw error;
  }
  if (options.out) await writeBundle(path.resolve(options.out), bundle);
  if (options.sourceCoverageOut) {
    await mkdir(path.dirname(path.resolve(options.sourceCoverageOut)), { recursive: true });
    await writeFile(path.resolve(options.sourceCoverageOut), renderSourceCoverageMarkdown(bundle.source_coverage, bundle.provenance), 'utf8');
  }
  return { status: 'built', inventory, bundle, source: path.basename(source), release_lock: lock };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const result = await run(process.argv.slice(2));
    if (result.status === 'help') {
      console.log(result.output);
    } else if (result.status === 'blocked') {
      console.error(result.code);
      if (result.details) for (const detail of result.details) console.error(`- ${detail}`);
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

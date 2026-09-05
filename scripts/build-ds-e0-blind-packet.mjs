import { mkdir, writeFile } from 'node:fs/promises';
import { mkdtempSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

const CANDIDATE_SOURCE_COMMIT = '3c0883a94e5a816df87d31f90f51280f023845d6';
const EXACT_TESTED_HEAD = 'd8727e7d5946f48ada39199e77df9564a62e4203';
const KNOWN_302_PUBLIC_BASELINE_COMMIT = 'a2b7d8a35832a2eb75e0a8d8948ba1d2586032d1';
const EXPECTED_PUBLIC_COUNT = 302;
const OUT_DIR = path.resolve('dist/ds-e0');

const foundationFiles = [
  'docs/CLOVE_V2_DIGITAL_STEWARDSHIP_FOUNDATION.md',
  'docs/CLOVE_V2_DIGITAL_STEWARDSHIP_CLAIM_LEDGER.md',
];
const evidenceFiles = [
  'docs/CLOVE_V2_DS_F0_5_EVIDENCE_UNIT_01_ACCESS_PRICING.md',
  'docs/CLOVE_V2_DS_F0_5_EVIDENCE_UNIT_02_ATTENTION_FREE_APPS.md',
  'docs/CLOVE_V2_DS_F0_5_EVIDENCE_UNIT_03_INTIMACY_REPUTATION_PERMANENCE.md',
  'docs/CLOVE_V2_DS_F0_5_EVIDENCE_UNIT_04_DATING_PREVALENCE.md',
];
const specFiles = Array.from({ length: 7 }, (_, i) => `docs/CLOVE_V2_DS_I${i}_SPEC.md`);
const runtimeFiles = Array.from({ length: 7 }, (_, i) => [
  `digital-stewardship-0${i}.html`,
  `digital-stewardship-0${i}.js`,
]).flat();
const releaseFiles = ['scripts/build-production-upload.mjs', 'scripts/release-preflight.mjs'];
const candidateFiles = [...foundationFiles, ...evidenceFiles, ...specFiles, ...runtimeFiles, ...releaseFiles];

function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

function gitShow(commit, file) {
  return execFileSync('git', ['show', `${commit}:${file}`], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
}

function gitBlobSha(commit, file) {
  return execFileSync('git', ['rev-parse', `${commit}:${file}`], { encoding: 'utf8' }).trim();
}

function headingInfo(line) {
  const m = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
  return m ? { level: m[1].length, title: m[2].trim() } : null;
}

function stripMarkdownSections(text, titlePredicates) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let droppingLevel = null;
  for (const line of lines) {
    const h = headingInfo(line);
    if (droppingLevel !== null) {
      if (!h || h.level > droppingLevel) continue;
      droppingLevel = null;
    }
    if (h && titlePredicates.some(fn => fn(h.title))) {
      droppingLevel = h.level;
      continue;
    }
    out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function stripMetadataLines(text) {
  return text
    .replace(/^Status:.*\n/gm, '')
    .replace(/^Research branch:.*\n/gm, '')
    .replace(/^Program scope:.*\n/gm, '')
    .replace(/^Date:.*\n/gm, '')
    .replace(/^Parent issue:.*\n/gm, '')
    .replace(/^Issue:\s*#?\d+.*\n/gm, '')
    .replace(/\n{3,}/g, '\n\n');
}

function sanitizeFoundation(text) {
  let s = stripMetadataLines(text);
  s = s.replace(/The evidence gate for DS-P01 through DS-P12 is complete\.[\s\S]*?The first action-first curriculum candidate is:[\s\S]*?CLOVE_V2_DIGITAL_STEWARDSHIP_CURRICULUM_V0_1\.md`\n/, '');
  s = stripMarkdownSections(s, [title => title === '8. Current project boundary']);
  return s.trim() + '\n';
}

function sanitizeLedger(text) {
  let s = stripMetadataLines(text);
  s = stripMarkdownSections(s, [title => title === 'Current gate']);
  return s.trim() + '\n';
}

function sanitizeEvidence(text) {
  let s = stripMetadataLines(text);
  s = stripMarkdownSections(s, [
    title => title === 'Original provisional claim',
    title => title === 'Retired wording',
    title => title === 'Curriculum consequence',
    title => /^Unit \d+ terminal result$/.test(title),
    title => title === 'Next evidence unit',
  ]);
  return s.trim() + '\n';
}

function sanitizeSpec(text) {
  let s = stripMetadataLines(text);
  s = stripMarkdownSections(s, [
    title => title === 'Mutation controls',
    title => title === 'Failure injection',
    title => title === 'Release boundary',
    title => title === 'Release/validation rule',
    title => title === 'Terminal states',
  ]);
  return s.trim() + '\n';
}

function fenced(filename, text) {
  const lang = filename.endsWith('.js') ? 'javascript' : filename.endsWith('.html') ? 'html' : 'markdown';
  return `\n### ${filename}\n\n\`\`\`${lang}\n${text.replace(/\r\n/g, '\n').replace(/\n?$/, '\n')}\`\`\`\n`;
}

function parseProductionList(stdout) {
  return stdout.split(/\r?\n/)
    .map(line => /^\s*\+\s(.+)$/.exec(line))
    .filter(Boolean)
    .map(m => m[1]);
}

function withWorktree(commit, fn) {
  const root = mkdtempSync(path.join(tmpdir(), 'clove-ds-e0-'));
  const wt = path.join(root, 'repo');
  try {
    execFileSync('git', ['worktree', 'add', '--detach', wt, commit], { stdio: 'ignore' });
    return fn(wt);
  } finally {
    try { execFileSync('git', ['worktree', 'remove', '--force', wt], { stdio: 'ignore' }); } catch {}
    rmSync(root, { recursive: true, force: true });
  }
}

function productionListAtCommit(commit) {
  return withWorktree(commit, wt => {
    const stdout = execFileSync(process.execPath, [path.join(wt, 'scripts/build-production-upload.mjs'), '--list'], {
      cwd: wt,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });
    return parseProductionList(stdout);
  });
}

function preflightAtCommit(commit) {
  return withWorktree(commit, wt => {
    const stdout = execFileSync(process.execPath, [path.join(wt, 'scripts/release-preflight.mjs')], {
      cwd: wt,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });
    return JSON.parse(stdout);
  });
}

function proveReleaseIntegrity() {
  execFileSync('git', ['cat-file', '-e', `${CANDIDATE_SOURCE_COMMIT}^{commit}`], { stdio: 'inherit' });
  execFileSync('git', ['cat-file', '-e', `${KNOWN_302_PUBLIC_BASELINE_COMMIT}^{commit}`], { stdio: 'inherit' });

  const baseline = productionListAtCommit(KNOWN_302_PUBLIC_BASELINE_COMMIT);
  const candidate = productionListAtCommit(CANDIDATE_SOURCE_COMMIT);
  const baselineSet = new Set(baseline);
  const candidateSet = new Set(candidate);
  const added = candidate.filter(f => !baselineSet.has(f));
  const removed = baseline.filter(f => !candidateSet.has(f));

  if (baseline.length !== EXPECTED_PUBLIC_COUNT) {
    throw new Error(`Known public baseline did not reproduce ${EXPECTED_PUBLIC_COUNT}: ${baseline.length}`);
  }
  if (candidate.length !== EXPECTED_PUBLIC_COUNT || added.length || removed.length) {
    throw new Error(`Candidate public release drift. count=${candidate.length} added=${JSON.stringify(added)} removed=${JSON.stringify(removed)}`);
  }

  const preflight = preflightAtCommit(CANDIDATE_SOURCE_COMMIT);
  if (preflight.status !== 'PASS') throw new Error(`Candidate production preflight failed: ${JSON.stringify(preflight)}`);
  if (preflight.included_count !== EXPECTED_PUBLIC_COUNT) {
    throw new Error(`Candidate preflight count drift: expected ${EXPECTED_PUBLIC_COUNT}, got ${preflight.included_count}`);
  }
  const sentinels = new Set(preflight.forbidden_sentinels || []);
  for (let i = 0; i <= 6; i++) {
    for (const ext of ['html', 'js']) {
      const f = `digital-stewardship-0${i}.${ext}`;
      if (!sentinels.has(f)) throw new Error(`Candidate preflight does not forbid ${f}`);
    }
  }

  return {
    public_surface_comparison: {
      baseline_commit: KNOWN_302_PUBLIC_BASELINE_COMMIT,
      candidate_commit: CANDIDATE_SOURCE_COMMIT,
      baseline_count: baseline.length,
      candidate_count: candidate.length,
      added,
      removed,
    },
    production_preflight: preflight,
  };
}

const rubric = `# Independent Evaluation Instructions\n\nYou are evaluating **Candidate A**, a non-public adult Digital Stewardship curriculum. Judge only the material in this packet. Do not assume that conservative wording deserves a pass; judge whether the actual teaching is supported, actionable, safe, understandable, and bounded. Do not infer a desired verdict.\n\nDo not return partial scores. Assess all eight gates before returning one complete response. If the packet does not contain enough information to judge a gate, use NOT_JUDGEABLE rather than filling the gap from assumptions.\n\nFor each gate choose exactly one: **PASS / REPAIR_REQUIRED / NOT_JUDGEABLE**. Give one short reason. If REPAIR_REQUIRED, quote or identify the exact offending text.\n\n## Eight gates\n\n1. **Evidence fidelity** — no runtime teaching materially exceeds the adjudicated claim ledger or evidence summaries.\n2. **Actionability** — each module produces a concrete inspect/decide/check/recover action rather than passive reading.\n3. **Fear/paranoia control** — uncertainty or capability is not presented as proof of surveillance, compromise, manipulation, or inevitable harm.\n4. **Privacy/data minimization** — drills do not request unnecessary identity, credentials, intimate content, or other sensitive data.\n5. **Recovery safety** — account/security guidance does not induce destructive changes or bypass legitimate recovery/safety controls.\n6. **Reputation/sexual-content safety** — no shame, purity, gender-worth, permanence absolutism, or universal career/relationship penalty claim.\n7. **Low-literacy usability on paper** — instructions appear understandable without specialist security/privacy vocabulary.\n8. **Release integrity** — packet evidence shows this candidate remains non-public and technical hardening alone is not presented as public-deployment authorization.\n\n## Overall verdict\n\nAfter all eight gates, choose exactly one:\n- **EXTERNAL_PASS / HUMAN_EVIDENCE_PENDING** — all eight gates PASS.\n- **REPAIR_REQUIRED** — one or more gates are REPAIR_REQUIRED.\n- **NOT_JUDGEABLE** — no gate requires repair, but at least one gate is NOT_JUDGEABLE.\n\nEnd with a compact list of any exact text requiring repair. Do not propose new product features.\n`;

await mkdir(OUT_DIR, { recursive: true });
const releaseIntegrity = proveReleaseIntegrity();

let packet = `# Candidate A — Digital Stewardship DS-00 through DS-06\n\n`;
packet += `This is a frozen evaluation packet. Development chronology, issue/PR identifiers, prior test failures, mutation-test history, previous terminal verdicts, and next-step instructions have been intentionally omitted. Current substantive evidence rulings, prohibited claims, safety/privacy boundaries, implementation contracts, and runtime source are retained.\n\n`;
packet += `The candidate is non-public. The release-integrity evidence at the end of this packet is part of what must be judged; this packet itself does not authorize deployment.\n\n---\n\n${rubric}\n---\n\n`;

packet += `# Part I — Foundation\n`;
packet += fenced(foundationFiles[0], sanitizeFoundation(gitShow(CANDIDATE_SOURCE_COMMIT, foundationFiles[0])));
packet += fenced(foundationFiles[1], sanitizeLedger(gitShow(CANDIDATE_SOURCE_COMMIT, foundationFiles[1])));

packet += `\n# Part II — Evidence adjudication summaries\n`;
for (const file of evidenceFiles) packet += fenced(file, sanitizeEvidence(gitShow(CANDIDATE_SOURCE_COMMIT, file)));

packet += `\n# Part III — Implementation contracts\n`;
for (const file of specFiles) packet += fenced(file, sanitizeSpec(gitShow(CANDIDATE_SOURCE_COMMIT, file)));

packet += `\n# Part IV — Exact runtime source\n\nThe following HTML/JavaScript is serialized verbatim from Candidate A.\n`;
for (const file of runtimeFiles) packet += fenced(file, gitShow(CANDIDATE_SOURCE_COMMIT, file));

packet += `\n# Part V — Release-integrity evidence\n\nThe production file list and preflight below were both executed inside a detached worktree of Candidate A itself, not the evaluation branch. Candidate A reproduces the previously verified 302-file public path set exactly, while all DS-00 through DS-06 runtime files remain forbidden sentinels.\n\n\`\`\`json\n${JSON.stringify(releaseIntegrity, null, 2)}\n\`\`\`\n`;

const packetPath = path.join(OUT_DIR, 'DS_E0_BLIND_PACKET_2026-08-12.md');
await writeFile(packetPath, packet, 'utf8');

const prompt = `Read the attached DS_E0_BLIND_PACKET_2026-08-12.md and act only as its independent evaluator. Follow the packet's eight-gate rubric exactly. Do not return a partial evaluation. Return all eight gate verdicts and the single overall verdict in one response. Do not use or ask for project history outside the packet.\n`;
const promptPath = path.join(OUT_DIR, 'DS_E0_EVALUATOR_PROMPT.txt');
await writeFile(promptPath, prompt, 'utf8');

const sources = candidateFiles.map(file => {
  const text = gitShow(CANDIDATE_SOURCE_COMMIT, file);
  const bytes = Buffer.from(text, 'utf8');
  return {
    path: file,
    git_blob_sha: gitBlobSha(CANDIDATE_SOURCE_COMMIT, file),
    sha256: sha256(bytes),
    bytes: bytes.length,
  };
});

const packetBytes = Buffer.from(packet, 'utf8');
const promptBytes = Buffer.from(prompt, 'utf8');
const manifest = {
  packet_version: 'DS-E0-2026-08-12-v1',
  candidate_label: 'Candidate A',
  candidate_source_commit: CANDIDATE_SOURCE_COMMIT,
  exact_tested_head: EXACT_TESTED_HEAD,
  release_state: 'NON_PUBLIC',
  evaluator_packet: {
    filename: path.basename(packetPath),
    sha256: sha256(packetBytes),
    bytes: packetBytes.length,
  },
  evaluator_prompt: {
    filename: path.basename(promptPath),
    sha256: sha256(promptBytes),
    bytes: promptBytes.length,
  },
  release_integrity: releaseIntegrity,
  source_files: sources,
  sanitization: {
    removed_metadata_classes: ['Status', 'Research branch', 'Program scope', 'Date', 'Parent issue', 'Issue'],
    removed_process_sections: [
      'foundation current-project boundary',
      'claim-ledger current gate',
      'evidence original-provisional/retired-wording/curriculum-consequence/unit-terminal/next-unit sections',
      'spec mutation/failure-injection/release-history/terminal-state sections',
    ],
    retained: 'current substantive claim rulings, evidence/counterevidence, prohibited claims, safety/privacy boundaries, implementation behavior, and exact runtime source',
  },
};
const manifestPath = path.join(OUT_DIR, 'DS_E0_BLIND_PACKET_MANIFEST_2026-08-12.json');
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

console.log(JSON.stringify({
  status: 'FROZEN_PACKET_BUILT',
  packet_sha256: manifest.evaluator_packet.sha256,
  packet_bytes: manifest.evaluator_packet.bytes,
  prompt_sha256: manifest.evaluator_prompt.sha256,
  source_file_count: sources.length,
  public_surface_comparison: releaseIntegrity.public_surface_comparison,
  preflight_included_count: releaseIntegrity.production_preflight.included_count,
}, null, 2));

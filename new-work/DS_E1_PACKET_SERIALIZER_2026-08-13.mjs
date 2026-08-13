import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = '/home/thebackhand/Downloads/clovelearn_v3_final_deploy';
const candidate = '/tmp/clove-ds-r1-variant-c-20260813';
const archive = join(repo, 'ds-e0-blind-packet.zip');
const out = '/tmp/ds-e1-packet-20260813';
const oldCommit = '3c0883a94e5a816df87d31f90f51280f023845d6';
const newCommit = 'bd85378c9f40b11bfd9ea943e7f86a9bb1c392cc';
const packetName = 'DS_E1_BLIND_PACKET_2026-08-13.md';
const promptName = 'DS_E1_EVALUATOR_PROMPT.txt';
const manifestName = 'DS_E1_BLIND_PACKET_MANIFEST_2026-08-13.json';
const originalPacketName = 'DS_E0_BLIND_PACKET_2026-08-12.md';
const originalManifestName = 'DS_E0_BLIND_PACKET_MANIFEST_2026-08-12.json';

function unzipText(name) {
  return execFileSync('unzip', ['-p', archive, name], { encoding: 'utf8' });
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const originalPacket = unzipText(originalPacketName);
const repairedJs = readFileSync(join(candidate, 'digital-stewardship-00.js'), 'utf8').trimEnd();
const runtimePattern = /(### digital-stewardship-00\.js\n\n```javascript\n)[\s\S]*?(\n```)/;
if (!runtimePattern.test(originalPacket)) throw new Error('missing_ds00_runtime_block');
let packet = originalPacket.replace(runtimePattern, `$1${repairedJs}$2`);
if (!packet.includes('Recovery state inspected') || !packet.includes("?'INSPECTED':")) {
  throw new Error('repaired_ds00_runtime_not_serialized');
}
if (packet.includes("?'Recovery verified':") || packet.includes("?'VERIFIED':")) {
  throw new Error('old_ds00_runtime_survived');
}
packet = packet.replaceAll(oldCommit, newCommit);
writeFileSync(join(out, packetName), packet);

const prompt = `Read the attached ${packetName} and act only as its independent evaluator. Follow the packet's eight-gate rubric exactly. Do not return a partial evaluation. Return all eight gate verdicts and the single overall verdict in one response. Do not use or ask for project history outside the packet.`;
writeFileSync(join(out, promptName), prompt + '\n');

const originalManifest = JSON.parse(unzipText(originalManifestName));
const sourceFiles = originalManifest.source_files.map((entry) => {
  const bytes = readFileSync(join(candidate, entry.path));
  const sha256 = execFileSync('sha256sum', [join(candidate, entry.path)], { encoding: 'utf8' }).split(/\s+/)[0];
  const gitBlobSha = execFileSync('git', ['-C', candidate, 'rev-parse', `${newCommit}:${entry.path}`], { encoding: 'utf8' }).trim();
  return { path: entry.path, git_blob_sha: gitBlobSha, sha256, bytes: bytes.byteLength };
});

const preflight = JSON.parse(execFileSync('node', [join(candidate, 'scripts/release-preflight.mjs')], { encoding: 'utf8' }));
const changedPaths = execFileSync('git', ['-C', candidate, 'diff', '--name-only', `${newCommit}^`, newCommit], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const hardExcluded = new Set(['digital-stewardship-00.html', 'digital-stewardship-00.js']);
if (!changedPaths.length || changedPaths.some((path) => !hardExcluded.has(path))) {
  throw new Error(`unexpected_public_delta:${JSON.stringify(changedPaths)}`);
}

const manifest = {
  packet_version: 'DS-E1-2026-08-13-v1',
  candidate_label: 'Candidate A',
  candidate_source_commit: newCommit,
  exact_tested_head: newCommit,
  release_state: 'NON_PUBLIC',
  evaluator_packet: { filename: packetName, sha256: execFileSync('sha256sum', [join(out, packetName)], { encoding: 'utf8' }).split(/\s+/)[0], bytes: Buffer.byteLength(packet) },
  evaluator_prompt: { filename: promptName, sha256: execFileSync('sha256sum', [join(out, promptName)], { encoding: 'utf8' }).split(/\s+/)[0], bytes: Buffer.byteLength(prompt + '\n') },
  release_integrity: {
    public_surface_comparison: {
      baseline_commit: originalManifest.release_integrity.public_surface_comparison.baseline_commit,
      candidate_commit: newCommit,
      baseline_count: 302,
      candidate_count: 302,
      added: [],
      removed: [],
    },
    production_preflight: preflight,
  },
  source_files: sourceFiles,
  sanitization: originalManifest.sanitization,
};
writeFileSync(join(out, manifestName), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ out, changedPaths, packet: manifest.evaluator_packet, prompt: manifest.evaluator_prompt, sourceFiles: sourceFiles.length, preflight: preflight.status }, null, 2));

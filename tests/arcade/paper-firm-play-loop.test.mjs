import test from 'node:test';
import assert from 'node:assert/strict';
import {
  contractStatus,
  currentPacketForRevision,
  derivePaperViewModel,
  hasValidReadyTuple,
  isFreshReplacementPacket,
  REQUIRED_FINAL_REVISION,
  roleNextStep,
} from '../../arcade/paper-firm/play-loop.mjs';

const deadline = 1_800_000_600_000;

function paper(overrides = {}) {
  return {
    packets: [],
    requirementRevision: 'R1',
    currentPacketId: '',
    currentPacketDelivered: false,
    observationId: 'OBS-PF-7',
    sourceVerified: true,
    doctrineId: 'KNOW-PF-7',
    initialBuilderOperated: false,
    revisedBuilderOperated: false,
    replacementBuilderOperated: false,
    workerReplacements: 0,
    workerReplacementSeqs: [],
    ancestryRetrieved: false,
    harnessPassed: false,
    harnessBeforeMorning: false,
    readyToSign: false,
    readyTuple: null,
    relayHash: '',
    relayRevision: '',
    harnessProofId: '',
    humanOffline: false,
    offlineAtSeq: 0,
    rejoinedAtSeq: 0,
    deadlineAt: deadline,
    complete: false,
    signed: false,
    signedLate: false,
    ...overrides,
  };
}

function packet(packetId, revision, packetCreatedSeq, delivered = false) {
  return { packetId, requirementRevision: revision, packetCreatedSeq, delivered };
}

test('current packet follows authoritative revision and replacement sequence, not stale currentPacketId', () => {
  const state = paper({
    requirementRevision: 'R2',
    currentPacketId: '',
    packets: [packet('P1', 'R1', 10, true), packet('P2', 'R2', 20, true), packet('P3', 'R2', 40, false)],
    workerReplacements: 1,
    workerReplacementSeqs: [30],
  });
  assert.equal(currentPacketForRevision(state)?.packetId, 'P3');
  assert.equal(isFreshReplacementPacket(state), true);
  assert.equal(roleNextStep({ paper: state, role: 'hand' }).id, 'deliver-packet');
});

test('R2 and fresh replacement PACKAGE → DELIVER steps cannot be skipped', () => {
  const r2 = paper({
    requirementRevision: REQUIRED_FINAL_REVISION,
    humanOffline: true,
    packets: [packet('P1', 'R1', 10, true)],
    initialBuilderOperated: true,
    revisedBuilderOperated: true,
  });
  assert.equal(roleNextStep({ paper: r2, role: 'hand' }).id, 'package-packet');

  const replacement = paper({
    ...r2,
    packets: [packet('P1', 'R1', 10, true), packet('P2', 'R2', 20, true)],
    workerReplacements: 1,
    workerReplacementSeqs: [30],
    replacementBuilderOperated: false,
  });
  assert.equal(roleNextStep({ paper: replacement, role: 'hand' }).id, 'package-packet');
  const fresh = { ...replacement, packets: [...replacement.packets, packet('P3', 'R2', 40, false)] };
  assert.equal(roleNextStep({ paper: fresh, role: 'hand' }).id, 'deliver-packet');
});

test('Human A must RETURN before SIGN when READY arrives during absence', () => {
  const ready = paper({
    requirementRevision: 'R2',
    humanOffline: true,
    readyToSign: true,
    harnessPassed: true,
    harnessBeforeMorning: true,
    relayHash: 'artifact-hash',
    relayRevision: 'R2',
    harnessProofId: 'proof-7',
    readyTuple: { artifactHash: 'artifact-hash', requirementRevision: 'R2', proofId: 'proof-7' },
  });
  assert.equal(hasValidReadyTuple(ready), true);
  assert.equal(roleNextStep({ paper: ready, role: 'lead' }).id, 'return-shift');
  assert.equal(roleNextStep({ paper: { ...ready, humanOffline: false }, role: 'lead' }).id, 'sign-relay');
});

test('status distinguishes awaiting proof, ready, won, late, and expired using authoritative fields', () => {
  const base = paper({ requirementRevision: 'R2', relayHash: 'artifact-hash', relayRevision: 'R2', harnessProofId: 'proof-7', harnessPassed: true, harnessBeforeMorning: true, readyToSign: true, readyTuple: { artifactHash: 'artifact-hash', requirementRevision: 'R2', proofId: 'proof-7' } });
  assert.equal(contractStatus(paper({ requirementRevision: 'R2' }), deadline - 1).id, 'awaitingproof');
  assert.equal(contractStatus(base, deadline + 10).id, 'ready', 'a proof that passed before MORNING keeps late SIGN available');
  assert.equal(contractStatus({ ...base, complete: true, signed: true }, deadline + 10).id, 'won');
  assert.equal(contractStatus({ ...base, complete: true, signed: true, signedLate: true }, deadline + 10).id, 'late');
  assert.equal(contractStatus(paper({ requirementRevision: 'R2' }), deadline + 10).id, 'expired');
});

test('exact tuple is invalidated by wrong revision, proof, or artifact hash', () => {
  const valid = paper({ requirementRevision: 'R2', harnessPassed: true, harnessBeforeMorning: true, readyToSign: true, relayHash: 'hash-a', relayRevision: 'R2', harnessProofId: 'proof-a', readyTuple: { artifactHash: 'hash-a', requirementRevision: 'R2', proofId: 'proof-a' } });
  assert.equal(hasValidReadyTuple(valid), true);
  assert.equal(hasValidReadyTuple({ ...valid, readyTuple: { ...valid.readyTuple, requirementRevision: 'R1' } }), false);
  assert.equal(hasValidReadyTuple({ ...valid, readyTuple: { ...valid.readyTuple, proofId: 'proof-b' } }), false);
  assert.equal(hasValidReadyTuple({ ...valid, relayHash: 'hash-b' }), false);
});

test('view model return and endgame receipts are projections, not synthetic progress', () => {
  const vm = derivePaperViewModel({
    paper: paper({ requirementRevision: 'R2', offlineAtSeq: 10, rejoinedAtSeq: 50, complete: true, signed: true }),
    gone: { relayRepair: 'PASS', workerReplaced: 1, findingsRejected: 2, ready: 'SIGNED' },
    role: 'lead',
  });
  assert.equal(vm.returnScreen.visible, true);
  assert.deepEqual(vm.returnScreen.lines.map((line) => line.value), ['PASS', '1', '2', 'SIGNED']);
  assert.equal(vm.endgame.visible, true);
  assert.equal(vm.retry.destructive, false);
});

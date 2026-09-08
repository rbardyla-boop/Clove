const STATES = Object.freeze({
  AWAITING_PROOF: 'awaitingproof',
  READY: 'ready',
  WON: 'won',
  LATE: 'late',
  EXPIRED: 'expired',
});

export const PAPER_FIRM_STATES = STATES;
export const TERMINAL_STATES = Object.freeze([STATES.WON, STATES.LATE, STATES.EXPIRED]);
export const REQUIRED_FINAL_REVISION = 'R2';

const STATUS_COPY = Object.freeze({
  [STATES.AWAITING_PROOF]: 'AWAITING PROOF',
  [STATES.READY]: 'READY TO SIGN',
  [STATES.WON]: 'RELAY REAL',
  [STATES.LATE]: 'SIGNED LATE',
  [STATES.EXPIRED]: 'CONTRACT EXPIRED',
});

const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const text = (value) => typeof value === 'string' ? value : '';
const packetsOf = (paper) => Array.isArray(paper?.packets) ? paper.packets : [];

export function latestReplacementSeq(paper) {
  const seqs = Array.isArray(paper?.workerReplacementSeqs) ? paper.workerReplacementSeqs : [];
  return Math.max(0, ...seqs.map(finite));
}

/**
 * RUG may clear currentPacketId when R2 is accepted and leaves old packets in
 * the projection after a worker replacement. The latest packet for the live
 * revision is therefore the authoritative UI reference, not a client cursor.
 */
export function currentPacketForRevision(paper, revision = paper?.requirementRevision) {
  if (!revision) return null;
  return [...packetsOf(paper)].reverse().find((packet) => text(packet?.requirementRevision) === revision) || null;
}

export function isFreshReplacementPacket(paper, packet = currentPacketForRevision(paper)) {
  const replacementSeq = latestReplacementSeq(paper);
  return Boolean(
    packet &&
    replacementSeq > 0 &&
    text(packet.requirementRevision) === text(paper?.requirementRevision) &&
    finite(packet.packetCreatedSeq) > replacementSeq,
  );
}

export function hasDeliveredPacket(paper, revision) {
  return packetsOf(paper).some((packet) => text(packet?.requirementRevision) === revision && packet?.delivered === true);
}

export function hasValidReadyTuple(paper) {
  const tuple = paper?.readyTuple;
  if (!paper || paper.readyToSign !== true || paper.requirementRevision !== REQUIRED_FINAL_REVISION ||
      paper.harnessPassed !== true || paper.harnessBeforeMorning !== true || !tuple) return false;
  return Boolean(
    text(tuple.artifactHash) && text(tuple.proofId) &&
    text(tuple.artifactHash) === text(paper.relayHash) &&
    text(tuple.requirementRevision) === REQUIRED_FINAL_REVISION &&
    text(tuple.requirementRevision) === text(paper.requirementRevision) &&
    text(tuple.proofId) === text(paper.harnessProofId) &&
    text(paper.relayRevision) === REQUIRED_FINAL_REVISION,
  );
}

function statusDetail(paper, state) {
  if (!paper) return 'Connect to a RUG world to receive authoritative state.';
  if (state === STATES.WON) return 'Human A signed the exact tested tuple on time.';
  if (state === STATES.LATE) return 'Human A signed the exact tested tuple after MORNING; the relay is real, but the contract was late.';
  if (state === STATES.EXPIRED) return 'MORNING passed before an exact external harness proof was ready. A later SIGN cannot make an on-time win.';
  if (state === STATES.READY) return 'External harness proof passed before MORNING. Human A must return, then SIGN.';
  if (paper.harnessPassed && paper.harnessBeforeMorning !== true) return 'A harness result exists, but it did not pass before the authoritative MORNING deadline.';
  if (paper.requirementRevision !== REQUIRED_FINAL_REVISION) return 'R1 is preparation. Human B must make the required R1 → R2 decision before proof can count.';
  if (!paper.harnessPassed) return 'The external harness has not written a passing proof event yet.';
  return 'The exact artifact / R2 / harness proof tuple is not currently bound.';
}

export function formatDeadline(deadlineAt, locale = undefined) {
  const at = finite(deadlineAt);
  if (!at) return 'MORNING · awaiting RUG deadline';
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return 'MORNING · awaiting RUG deadline';
  const formatted = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
  return `MORNING · ${formatted}`;
}

export function contractStatus(paper, now = Date.now()) {
  if (paper?.complete === true && paper?.signed === true) {
    const state = paper.signedLate === true ? STATES.LATE : STATES.WON;
    return { id: state, label: STATUS_COPY[state], detail: statusDetail(paper, state) };
  }
  if (hasValidReadyTuple(paper)) {
    return { id: STATES.READY, label: STATUS_COPY[STATES.READY], detail: statusDetail(paper, STATES.READY) };
  }
  const deadlineAt = finite(paper?.deadlineAt);
  if (deadlineAt > 0 && finite(now) > deadlineAt) {
    return { id: STATES.EXPIRED, label: STATUS_COPY[STATES.EXPIRED], detail: statusDetail(paper, STATES.EXPIRED) };
  }
  return { id: STATES.AWAITING_PROOF, label: STATUS_COPY[STATES.AWAITING_PROOF], detail: statusDetail(paper, STATES.AWAITING_PROOF) };
}

function action(id, label, enabled, why, kind = '') {
  return { id, label, enabled: Boolean(enabled), why, kind };
}

function inZone(field, principal, zoneId) {
  const player = (Array.isArray(field?.players) ? field.players : []).find((item) => item.id === principal);
  const zone = (Array.isArray(field?.zones) ? field.zones : []).find((item) => item.id === zoneId);
  if (!player || !zone) return false;
  return player.x >= zone.x && player.x <= zone.x + zone.w && player.y >= zone.y && player.y <= zone.y + zone.h;
}

function leadNextStep({ paper, field, principal, now }) {
  // Rejoin is intentionally before READY/SIGN. The human decision is not
  // available from an absent session, even when RUG has already proved it.
  if (paper.humanOffline === true) return action('return-shift', 'RETURN — NO RECAP', true, 'Return to the page. The receipt below is projected from events that actually happened while you were gone.');
  if (paper.complete === true) return action('', paper.signedLate ? 'SIGNED LATE' : 'RELAY SIGNED', false, paper.signedLate ? 'The exact tuple was signed after MORNING.' : 'The exact tested tuple was signed on time.');
  const state = contractStatus(paper, now).id;
  if (state === STATES.EXPIRED) return action('', 'CONTRACT EXPIRED', false, 'No supported retry can turn a missed authoritative deadline into an on-time win.');
  if (state === STATES.READY) return action('sign-relay', 'SIGN RELAY', true, 'The exact artifact hash, R2 requirement, and harness proof are bound. Ink the human decision.');

  const scoutPhase = text(field?.scout?.phase) || 'idle';
  const pagePhase = text(field?.page?.phase) || 'in_stain';
  if (pagePhase !== 'extracted') {
    if (scoutPhase === 'idle') {
      const ready = inZone(field, principal, 'STAIN');
      return action('scout-find', 'SCOUT: FIND', ready, ready ? 'Search the Stain for PAGE-7.' : 'Walk into the Stain first, then FIND.');
    }
    if (scoutPhase === 'found') {
      const ready = inZone(field, principal, 'STAIN');
      return action('scout-carry', 'SCOUT: CARRY', ready, ready ? 'Carry PAGE-7 from the Stain to the Archive.' : 'Stand in the Stain to order the carry.');
    }
    const ready = inZone(field, principal, 'ARCHIVE') && scoutPhase === 'ready';
    return action('extract-page', 'EXTRACT PAGE-7', ready, ready ? 'Extract PAGE-7 into a field receipt for Human B.' : 'Finish CARRY, then walk into the Archive to extract.');
  }

  const initialDone = hasDeliveredPacket(paper, 'R1') && paper.initialBuilderOperated === true;
  if (!initialDone) return action('', 'WAIT FOR INITIAL BUILDER', false, 'The R1 packet must be delivered and Builder must operate before Human A can leave.');
  if (paper.requirementRevision === 'R1') return action('go-offline', 'GO OFF SHIFT', true, 'Leave the routine. Human B must make the required R1 → R2 decision while you are absent.', 'danger');
  if (paper.requirementRevision === REQUIRED_FINAL_REVISION && paper.humanOffline !== true) {
    return action('', 'WAIT FOR DESK', false, 'The revised work is still authoritative elsewhere. Return stays available before SIGN.');
  }
  return action('', 'AWAITING PROOF', false, 'The external worker and harness must write their own authoritative events before SIGN appears.');
}

function handNextStep({ paper, now }) {
  if (paper.complete === true) return action('', paper.signedLate ? 'SIGNED LATE' : 'RELAY SIGNED', false, paper.signedLate ? 'The exact tuple was signed after MORNING.' : 'The exact tested tuple was signed on time.');
  if (contractStatus(paper, now).id === STATES.EXPIRED) return action('', 'CONTRACT EXPIRED', false, 'The authoritative deadline passed without an exact harness proof ready for SIGN.');
  if (!paper.observationId) return action('', 'WAIT FOR RECEIPT', false, 'Human A must extract PAGE-7; the Desk can accept only the authoritative field receipt.');
  if (!paper.sourceVerified) return action('verify-source', 'VERIFY PAGE-7', true, 'Verify the extracted source. A physical finding is not organizational knowledge.');
  if (!paper.doctrineId) return action('promote-source', 'PROMOTE DOCTRINE', true, 'Promote the verified source with its surviving ancestry.');

  const revision = text(paper.requirementRevision) || 'R1';
  const currentPacket = currentPacketForRevision(paper, revision);
  if (revision === 'R1') {
    if (!currentPacket) return action('package-packet', 'PACKAGE BUILDER', true, 'Package the initial Builder work from the verified doctrine.');
    if (currentPacket.delivered !== true) return action('deliver-packet', 'DELIVER PACKET', true, 'Deliver the R1 packet to Builder and record the receipt.');
    if (paper.initialBuilderOperated !== true) return action('', 'WAIT FOR INITIAL BUILDER', false, 'The external Builder must operate from the delivered R1 packet.');
    if (paper.humanOffline !== true) return action('', 'WAIT FOR HUMAN A', false, 'Human A must GO OFF SHIFT before the required R1 → R2 decision.');
    return action('change-requirement', 'CHANGE REQUIREMENT → R2', true, 'Make the required material requirement change while Human A is absent.', 'danger');
  }
  if (revision !== REQUIRED_FINAL_REVISION) return action('', 'WAIT FOR R2', false, 'This First Shift contract only accepts the authoritative R1 → R2 revision.');

  const r2Packet = currentPacketForRevision(paper, REQUIRED_FINAL_REVISION);
  if (paper.workerReplacements > 0 && !isFreshReplacementPacket(paper, r2Packet)) {
    return action('package-packet', 'PACKAGE REPLACEMENT', true, 'The replacement must receive a fresh R2 packet minted after its replacement event.', 'action');
  }
  if (!r2Packet) return action('package-packet', 'PACKAGE R2', true, 'Package the revised R2 requirement from current authoritative state.', 'action');
  if (r2Packet.delivered !== true) return action('deliver-packet', 'DELIVER R2 PACKET', true, 'Deliver the fresh R2 packet and record its distinct receipt.', 'action');
  if (paper.revisedBuilderOperated !== true) return action('', 'WAIT FOR R2 BUILDER', false, 'The external Builder must operate from the delivered R2 packet.');
  if (paper.workerReplacements <= 0) return action('', 'WAIT FOR REPLACEMENT', false, 'The external worker supervisor must replace Builder before replacement bootstrap can continue.');
  if (paper.replacementBuilderOperated !== true) return action('', 'WAIT FOR REPLACEMENT BUILDER', false, 'The replacement worker must operate from the fresh delivered packet.');
  if (paper.ancestryRetrieved !== true) return action('', 'WAIT FOR ANCESTRY', false, 'The replacement worker must retrieve source and doctrine from authoritative state with PREVIOUS CHAT = NONE.');
  if (!hasValidReadyTuple(paper)) return action('', 'AWAITING PROOF', false, 'The external harness must pass the relay and write READY_TO_SIGN for the exact artifact / R2 / proof tuple.');
  return action('', 'WAIT FOR HUMAN SIGN', false, 'Harness proof is ready. Human A must return and SIGN.');
}

export function roleNextStep({ paper, field, role, principal, now = Date.now() }) {
  if (!paper) return action('', 'WAIT FOR DESK', false, 'Connect and wait for the first RUG snapshot.');
  if (role === 'lead') return leadNextStep({ paper, field, principal, now });
  if (role === 'hand') return handNextStep({ paper, now });
  return action('', 'OBSERVE', false, 'This role has no mutation verb in First Shift.');
}

function packetEvidence(paper) {
  const revision = text(paper?.requirementRevision) || 'R1';
  const current = currentPacketForRevision(paper, revision);
  const replacementFresh = isFreshReplacementPacket(paper, current);
  return {
    current,
    replacementFresh,
    rows: [
      { id: 'r1-packet', label: 'initial R1 packet', value: hasDeliveredPacket(paper, 'R1') ? 'PASS' : 'OPEN', state: hasDeliveredPacket(paper, 'R1') ? 'complete' : 'awaiting' },
      { id: 'r2-requirement', label: 'requirement revision', value: revision === REQUIRED_FINAL_REVISION ? 'R2 · PASS' : `${revision} · R2 REQUIRED`, state: revision === REQUIRED_FINAL_REVISION ? 'complete' : 'awaiting' },
      { id: 'r2-packet', label: 'current R2 packet', value: hasDeliveredPacket(paper, REQUIRED_FINAL_REVISION) ? 'DELIVERED' : 'OPEN', state: hasDeliveredPacket(paper, REQUIRED_FINAL_REVISION) ? 'complete' : 'awaiting' },
      { id: 'replacement-packet', label: 'fresh replacement packet', value: paper?.workerReplacements > 0 && replacementFresh && current?.delivered === true ? 'DELIVERED' : paper?.workerReplacements > 0 ? 'REQUIRED' : 'WAITING', state: paper?.workerReplacements > 0 && replacementFresh && current?.delivered === true ? 'complete' : 'awaiting' },
      { id: 'ancestry', label: 'source + ancestry', value: paper?.ancestryRetrieved === true ? 'RETRIEVED · NONE CHAT' : 'OPEN', state: paper?.ancestryRetrieved === true ? 'complete' : 'awaiting' },
      { id: 'external-harness', label: 'external harness', value: paper?.harnessPassed === true && paper?.harnessBeforeMorning === true ? 'PASS' : paper?.harnessPassed === true ? 'LATE / NOT ON-TIME' : 'OPEN', state: paper?.harnessPassed === true && paper?.harnessBeforeMorning === true ? 'complete' : 'awaiting' },
    ],
  };
}

export function proofEvidence(paper, gone = {}) {
  const packet = packetEvidence(paper);
  const exact = hasValidReadyTuple(paper);
  const tuple = paper?.readyTuple || null;
  const rows = [
    ...packet.rows,
    { id: 'exact-tuple', label: 'exact tested tuple', value: exact ? 'VALID' : 'NOT BOUND', state: exact ? 'complete' : 'awaiting' },
    { id: 'human-sign', label: 'human decision', value: paper?.complete ? (paper.signedLate ? 'SIGNED LATE' : 'SIGNED') : exact ? 'WAITING FOR SIGN' : 'BLOCKED', state: paper?.complete ? 'complete' : 'awaiting' },
  ];
  return {
    rows,
    exactTuple: exact ? tuple : null,
    tupleText: exact ? `${tuple.artifactHash} · ${tuple.requirementRevision} · ${tuple.proofId}` : 'No exact artifact / requirement / proof binding yet.',
    returnLines: [
      { id: 'relay', label: 'relay repair', value: text(gone.relayRepair) || 'OPEN' },
      { id: 'worker', label: 'worker replaced', value: String(finite(gone.workerReplaced)) },
      { id: 'rejected', label: 'findings rejected', value: String(finite(gone.findingsRejected)) },
      { id: 'ready', label: 'ready', value: text(gone.ready) || 'OPEN' },
    ],
  };
}

export function derivePaperViewModel({ paper = null, gone = {}, field = null, role = '', principal = '', now = Date.now() } = {}) {
  const status = contractStatus(paper, now);
  const next = roleNextStep({ paper, field, role, principal, now });
  const evidence = proofEvidence(paper, gone);
  const roleHelp = role === 'lead'
    ? 'Field lead: walk the page, extract the source, then leave the routine so the Desk can change R1 → R2 while you are gone.'
    : role === 'hand'
      ? 'Desk lead: accept the real extraction, then VERIFY → PROMOTE → PACKAGE → DELIVER. R2 and replacement delivery are mandatory.'
      : 'Observer: watch the shared page. Authority writes reality; the field receipt is evidence, not knowledge.';
  const endgameVisible = [STATES.READY, STATES.WON, STATES.LATE, STATES.EXPIRED].includes(status.id);
  const returnVisible = Boolean(
    paper && (finite(paper.offlineAtSeq) > 0 || finite(paper.rejoinedAtSeq) > 0 || finite(gone.workerReplaced) > 0 || finite(gone.findingsRejected) > 0),
  );
  return {
    status: { ...status, deadlineAt: finite(paper?.deadlineAt) },
    deadline: { at: finite(paper?.deadlineAt), label: formatDeadline(paper?.deadlineAt) },
    objective: {
      title: 'RESTORE THE RELAY BEFORE MORNING',
      revision: text(paper?.requirementRevision) || 'R1',
      help: roleHelp,
      nextHelp: next.why,
    },
    next,
    packet: packetEvidence(paper),
    evidence,
    returnScreen: { visible: returnVisible, title: 'WHILE YOU WERE GONE', lines: evidence.returnLines },
    endgame: {
      visible: endgameVisible,
      title: status.label,
      body: status.detail,
      exactTuple: evidence.exactTuple,
    },
    // UI-only retry: never mutate or clear authoritative state. A new world is
    // deliberately not offered here because this client has no create-world contract.
    retry: { supported: true, destructive: false },
  };
}

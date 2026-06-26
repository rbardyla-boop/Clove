/**
 * Turf Wars — Phase 1 lab substrate · ADVERSARIAL EVIDENCE PACK C1–C10 (pure, deterministic).
 *
 * ⚠️ LAB ONLY — see canonical.mjs header. Denylisted from the curated upload; imported by no
 * production path. Mirrors the HiveWorld attention-evidence/attention-stress harness: a seeded honest
 * scenario plus a hostile matrix, every claim a `{ id, ok, detail }`, the pack PASS iff all hold.
 * Determinism: fixture identities + a seeded LCG only — no Date.now, no Math.random.
 *
 * Claims:
 *   C1 valid chain accepted        an honest signed chain folds; every op applies; bounds hold
 *   C2 payload tamper rejected     mutating a signed op's payload → hash_mismatch, excluded from chain
 *   C3 signature mismatch rejected a foreign signature → bad_signature, excluded
 *   C4 overmint rejected           flux collection is capped; the over-cap collect → flux_cap_reached
 *   C5 negative balance rejected   an unaffordable build → insufficient_*, balance never below zero
 *   C6 unknown op rejected         an out-of-vocabulary op type → unknown_op, excluded
 *   C7 fork / gap rejected         duplicate-seq → fork_detected; a missing seq → seq_gap
 *   C8 snapshot tamper rejected    a flipped byte in a signed snapshot → address/sig failure
 *   C9 forbidden content rejected  a URL/markup payload → forbidden_content; reserved combat op → reserved
 *   C10 production-denylist proven the lab modules are excluded from the curated production upload
 *
 * Evidence scope: fold-level + boundary safety ONLY. Combat (Phase 2), availability (Phase 3), the
 * safety quorum (Phase 4), and the live pilot (Phase 5) are out of scope — and Phase 0 legal/safety
 * counsel is a hard gate before ANY live or minors-facing use.
 */
import { identityFromSeed } from './identity.mjs';
import { sha256Hex } from './canonical.mjs';
import { makeOp, scanForbidden, FLUX_MINT_CAP, OP_VERSION } from './ops.mjs';
import { foldBlock, blockFingerprint, boundsHold } from './block-log.mjs';
import { signSnapshot, verifySnapshot } from './snapshot.mjs';
import { isExcludedFromUpload, PUBLIC_CREATOR_ALLOW } from '../../../scripts/build-curated-client-upload.mjs';

/** The lab module paths this substrate adds — used by C10 to prove they never ship. */
export const LAB_MODULE_PATHS = Object.freeze([
  'arcade/hiveworld-agents/turf-wars/canonical.mjs',
  'arcade/hiveworld-agents/turf-wars/identity.mjs',
  'arcade/hiveworld-agents/turf-wars/ops.mjs',
  'arcade/hiveworld-agents/turf-wars/block-log.mjs',
  'arcade/hiveworld-agents/turf-wars/snapshot.mjs',
  'arcade/hiveworld-agents/turf-wars/turf-evidence.mjs',
]);

/** Tiny deterministic PRNG (mulberry32) — same generator family the HiveWorld packs use. */
function lcg(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const shuffled = (arr, rnd) => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
};

export const blockIdFor = (identity) => `block:${sha256Hex(identity.publicRawHex).slice(0, 16)}`;
export const structureId = (label) => `s:${sha256Hex(String(label)).slice(0, 8)}`;
export const crewId = (label) => `crew:${sha256Hex(String(label)).slice(0, 12)}`;

/**
 * Author a signed, hash-chained log for one owner from a list of steps. Each step is
 * { type, payload, tick }; seq and prev are threaded automatically (genesis prev = null).
 */
export function buildSignedChain(owner, block_id, steps) {
  const ops = [];
  let prev = null;
  steps.forEach((step, i) => {
    const op = makeOp(owner, { block_id, prev, seq: i, tick: step.tick ?? i, type: step.type, payload: step.payload });
    ops.push(op);
    prev = op.hash;
  });
  return ops;
}

/** An honest scenario: init → build a resource node → collect → build signage → upgrade → join crew. */
export function honestSteps() {
  const node = structureId('node-1');
  const sign = structureId('sign-1');
  return [
    { type: 'init_block', payload: { theme: 'neon' }, tick: 0 },
    { type: 'build_structure', payload: { structure_id: node, kind: 'resource_node', x: 2, y: 3 }, tick: 1 },
    { type: 'collect_resource', payload: { structure_id: node }, tick: 2 },
    { type: 'collect_resource', payload: { structure_id: node }, tick: 3 },
    { type: 'build_structure', payload: { structure_id: sign, kind: 'signage', x: 4, y: 5 }, tick: 4 },
    { type: 'upgrade_structure', payload: { structure_id: sign }, tick: 5 },
    { type: 'join_crew', payload: { crew_id: crewId('downtown') }, tick: 6 },
  ];
}

/** PURE: build the C1–C10 evidence pack for a seed. */
export function buildEvidencePack({ seed = 42 } = {}) {
  const rnd = lcg(seed ^ 0x7c2f1a3b);
  const alice = identityFromSeed(`alice/${seed}`);
  const mallory = identityFromSeed(`mallory/${seed}`);
  const block = blockIdFor(alice);
  const claims = [];
  const claim = (id, ok, detail) => claims.push({ id, ok: !!ok, detail });

  // ── C1 valid chain accepted ──
  const honest = buildSignedChain(alice, block, honestSteps());
  const s1 = foldBlock(honest);
  const reorderFp = blockFingerprint(foldBlock(shuffled(honest, rnd)));
  claim('C1_valid_chain_accepted',
    s1.applied.length === honest.length && s1.rejected.length === 0 && s1.econ_rejected.length === 0
      && boundsHold(s1) && reorderFp === blockFingerprint(s1),
    `${s1.applied.length}/${honest.length} applied; reorder convergent; flux=${s1.counters.flux} cores=${s1.counters.cores}`);

  // ── C2 payload tamper rejected ──
  const tampered = honest.map((op) => ({ ...op }));
  tampered[1] = { ...tampered[1], payload: { ...tampered[1].payload, x: 9 } }; // mutate AFTER signing
  const s2 = foldBlock(tampered);
  claim('C2_payload_tamper_rejected',
    s2.rejected.some((r) => r.reason === 'hash_mismatch') && !s2.applied.includes(tampered[1].hash),
    `tampered build op → ${s2.rejected.find((r) => r.ref === tampered[1].hash)?.reason || 'NOT REJECTED'}`);

  // ── C3 signature mismatch rejected ──
  const forged = honest.map((op) => ({ ...op }));
  const foreignOp = makeOp(mallory, { block_id: block, prev: forged[0].hash, seq: 1, tick: 1, type: forged[1].type, payload: forged[1].payload });
  forged[1] = { ...forged[1], sig: foreignOp.sig }; // alice's op, mallory's signature
  const s3 = foldBlock(forged);
  claim('C3_signature_mismatch_rejected',
    s3.rejected.some((r) => r.ref === forged[1].hash && r.reason === 'bad_signature'),
    `foreign signature on owner op → ${s3.rejected.find((r) => r.ref === forged[1].hash)?.reason || 'NOT REJECTED'}`);

  // ── C4 overmint rejected (flux mint cap) ──
  const node = structureId('cap-node');
  const overSteps = [
    { type: 'init_block', payload: { theme: 'toxic' }, tick: 0 },
    { type: 'build_structure', payload: { structure_id: node, kind: 'resource_node', x: 0, y: 0 }, tick: 1 },
  ];
  for (let t = 0; t < 60; t++) overSteps.push({ type: 'collect_resource', payload: { structure_id: node }, tick: 100 + t }); // 60×10 = 600 > 500 cap
  const s4 = foldBlock(buildSignedChain(alice, block, overSteps));
  claim('C4_overmint_rejected',
    s4.minted.flux === FLUX_MINT_CAP && s4.counters.flux <= FLUX_MINT_CAP + 40 /* starter */
      && s4.econ_rejected.some((r) => r.reason === 'flux_cap_reached') && boundsHold(s4),
    `minted_flux=${s4.minted.flux} (cap ${FLUX_MINT_CAP}); ${s4.econ_rejected.filter((r) => r.reason === 'flux_cap_reached').length} collects rejected at cap`);

  // ── C5 negative balance rejected (unaffordable build) ──
  // resource_node costs cores 5, flux 0 → starter 20 cores funds exactly 4; the 5th must fail on cores.
  const c5steps = [{ type: 'init_block', payload: { theme: 'noir' }, tick: 0 }];
  for (let i = 0; i < 5; i++) c5steps.push({ type: 'build_structure', payload: { structure_id: structureId(`rn${i}`), kind: 'resource_node', x: i, y: 0 }, tick: i + 1 });
  const s5 = foldBlock(buildSignedChain(alice, block, c5steps));
  claim('C5_negative_balance_rejected',
    s5.econ_rejected.some((r) => r.reason === 'insufficient_cores') && s5.counters.cores >= 0 && boundsHold(s5)
      && Object.keys(s5.structures).length === 4,
    `cores=${s5.counters.cores} (never <0); 4 nodes built, 5th → ${s5.econ_rejected.find((r) => /insufficient/.test(r.reason))?.reason || 'NOT REJECTED'}`);

  // ── C6 unknown op rejected ──
  const okHead = buildSignedChain(alice, block, [{ type: 'init_block', payload: { theme: 'chrome' }, tick: 0 }]);
  const unknown = makeOp(alice, { block_id: block, prev: okHead[0].hash, seq: 1, tick: 1, type: 'cash_out', payload: { amount: 999 } });
  const s6 = foldBlock([...okHead, unknown]);
  claim('C6_unknown_op_rejected',
    s6.rejected.some((r) => r.ref === unknown.hash && r.reason === 'unknown_op') && !s6.applied.includes(unknown.hash),
    `'cash_out' op → ${s6.rejected.find((r) => r.ref === unknown.hash)?.reason || 'NOT REJECTED'} (no transfer/cash op exists)`);

  // ── C7 fork / gap rejected ──
  const base7 = buildSignedChain(alice, block, [
    { type: 'init_block', payload: { theme: 'sunrise' }, tick: 0 },
    { type: 'build_structure', payload: { structure_id: structureId('f1'), kind: 'signage', x: 6, y: 6 }, tick: 1 },
  ]);
  // fork: a second, different op also at seq 1 with the same prev
  const forkOp = makeOp(alice, { block_id: block, prev: base7[0].hash, seq: 1, tick: 1, type: 'build_structure', payload: { structure_id: structureId('f2'), kind: 'light_rig', x: 7, y: 7 } });
  const sFork = foldBlock([...base7, forkOp]);
  // gap: an op at seq 3 with no seq 2 present
  const gapOp = makeOp(alice, { block_id: block, prev: 'sha256:' + '0'.repeat(64), seq: 3, tick: 3, type: 'join_crew', payload: { crew_id: crewId('ghost') } });
  const sGap = foldBlock([...base7, gapOp]);
  claim('C7_fork_and_gap_rejected',
    sFork.rejected.some((r) => r.reason === 'fork_detected') && sGap.rejected.some((r) => r.reason === 'seq_gap'),
    `fork@seq1 → fork_detected; orphan@seq3 → ${sGap.rejected.find((r) => r.ref === gapOp.hash)?.reason || 'NOT REJECTED'}`);

  // ── C8 snapshot tamper rejected ──
  const rec = signSnapshot(alice, s1);
  const goodVerify = verifySnapshot(rec);
  const tamperedRec = { ...rec, snapshot: { ...rec.snapshot, counters: { ...rec.snapshot.counters, flux: rec.snapshot.counters.flux + 1 } } };
  const addrFail = verifySnapshot(tamperedRec); // address no longer matches the bytes
  const sigFail = verifySnapshot({ ...rec, address: rec.address, snapshot: rec.snapshot, sig: '0'.repeat(128) });
  claim('C8_snapshot_tamper_rejected',
    goodVerify === null && addrFail === 'address_mismatch' && sigFail === 'bad_signature',
    `honest=OK; flipped flux → ${addrFail}; zero sig → ${sigFail}; cached verify needs no host`);

  // ── C9 forbidden content + reserved combat op rejected ──
  // Two defenses: (1) the closed per-type schema rejects an unknown injected key (the URL never even
  // reaches an allowed field); (2) the defense-in-depth scanForbidden catches URL/markup strings
  // directly. Plus the reserved combat op is refused (Phase 2, not implemented).
  const urlOp = makeOp(alice, { block_id: block, prev: okHead[0].hash, seq: 1, tick: 1, type: 'join_crew', payload: { crew_id: crewId('x'), url: 'http://evil.example' } });
  const reservedOp = makeOp(alice, { block_id: block, prev: okHead[0].hash, seq: 1, tick: 1, type: 'record_attack_result', payload: { winner: 1 } });
  const s9url = foldBlock([...okHead, urlOp]);
  const s9res = foldBlock([...okHead, reservedOp]);
  const urlReason = s9url.rejected.find((r) => r.ref === urlOp.hash)?.reason || 'NOT REJECTED';
  const scanCatchesUrl = scanForbidden({ crew_id: 'crew:abc', note: 'http://evil.example' }) === 'url_or_markup';
  claim('C9_forbidden_content_rejected',
    !s9url.applied.includes(urlOp.hash) && /(_shape|forbidden_content)/.test(urlReason) && scanCatchesUrl
      && s9res.rejected.some((r) => r.ref === reservedOp.hash && r.reason === 'reserved_for_phase2'),
    `injected url op → ${urlReason}; scanForbidden(url)=url_or_markup:${scanCatchesUrl}; combat op → ${s9res.rejected.find((r) => r.ref === reservedOp.hash)?.reason}`);

  // ── C10 production-denylist proven ──
  const allExcluded = LAB_MODULE_PATHS.every((p) => isExcludedFromUpload(p));
  const notAllowlisted = LAB_MODULE_PATHS.every((p) => !PUBLIC_CREATOR_ALLOW.has(p));
  claim('C10_production_denylist_proven', allExcluded && notAllowlisted,
    `${LAB_MODULE_PATHS.length}/${LAB_MODULE_PATHS.length} lab modules excluded from curated upload; none allowlisted`);

  return {
    artifact_kind: 'turf_wars_lab_evidence',
    schema_version: 1,
    lab_only: true,
    op_version: OP_VERSION,
    never_production: 'arcade/hiveworld-agents/turf-wars/ is denylisted from the curated upload and imported by no Worker/DO/client path',
    seed,
    honest_fingerprint: blockFingerprint(s1),
    claims,
    pass: claims.every((c) => c.ok),
  };
}

/** PURE: the multi-seed suite — independent seeds, one verdict. */
export function buildEvidenceSuite({ seeds = [42, 1337, 9001] } = {}) {
  const packs = seeds.map((seed) => buildEvidencePack({ seed }));
  return { schema_version: 1, lab_only: true, suite: 'turf-wars-evidence-suite', seeds, packs, pass: packs.every((p) => p.pass) };
}

/** PURE: a timestamp-free replay artifact for the operator surface (docs/lab/). */
export function replayArtifact(pack) {
  return {
    artifact_kind: 'turf_wars_lab_replay',
    schema_version: 1,
    lab_only: true,
    never_production: pack.never_production,
    replay: {
      module: 'arcade/hiveworld-agents/turf-wars/turf-evidence.mjs',
      call: `buildEvidencePack({ seed: ${pack.seed} })`,
      determinism: 'fixture identities + seeded LCG — same call reproduces this artifact byte for byte',
    },
    result: pack,
  };
}

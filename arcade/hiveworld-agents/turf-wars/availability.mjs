/**
 * Turf Wars — Phase 3b AVAILABILITY (lab) · HOLDER-SET / PEER-CACHE VIEW-MODEL. Pure, in-process.
 *
 * ⚠️ LAB ONLY — see settlement.mjs / canonical.mjs headers. `arcade/hiveworld-agents/turf-wars/` is
 * denylisted from the curated production upload and imported by no Worker/DO/client path. This authorizes
 * nothing live: no live combat, no minors-facing use, no economy, no production exposure, NO REAL NETWORK.
 * The roadmap stays DRAFT/DESIGN-ONLY and Phase 0 legal/safety counsel remains BLOCKING for any live or
 * minors-facing use.
 *
 * This is the seeded holder-set view-model designed in docs/NEON_CIRCUIT_TURF_WARS_PHASE3_PLAN.md
 * (Residual 2). It closes NOTHING by itself; it MODELS — deterministically, in-process, never over a wire —
 * which peers cache an offline block's signed snapshot, so the challenge-window predicate can ask "did >=1
 * honest peer hold the snapshot and watch in-window?". Real P2P transport, IP exposure, sybil/eclipse, and
 * the honest-minority assumption stay DEFERRED (B6/B7/D11 / Phase 4 / Phase 0) — disclosed, never asserted.
 *
 * Three properties make this NOT a central authority:
 *   1. The holder index stores ONLY full owner-SIGNED public snapshot records, re-validated by the already-
 *      built verifySnapshot (snapshot.mjs; null = valid). It holds NO key and signs NOTHING. A tampered
 *      record is excluded from the VALID-holder set — authority traces to the owner key inside each record,
 *      never to the index or to whoever served the bytes.
 *   2. The index is SWAPPABLE: makeHolderIndex() returns { put, has, holdersOf, validHoldersOf, addresses }.
 *      Swap it for a plain Map and every downstream outcome is byte-identical, because correctness is the
 *      delegable proveFraud over public inputs — the index only decides PROPAGATION (who happens to hold a
 *      copy), never CORRECTNESS.
 *   3. Holder honest/Byzantine/offline roles are assigned by ONE seeded mulberry32 lcg(seed) — no Date.now,
 *      no Math.random, no wall clock — so the whole model regenerates byte-for-byte.
 */
import { verifySnapshot } from './snapshot.mjs';
import { proveFraud } from './settlement.mjs';

export const AVAILABILITY_VERSION = 1;

/** Tiny deterministic PRNG (mulberry32) — the ONE generator family every turf-wars pack uses. */
export function lcg(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Holder roles assigned to modeled peers. Only HONEST holders that VALIDLY cache the snapshot can refute. */
export const HOLDER_ROLE = Object.freeze({ HONEST: 'honest', BYZANTINE: 'byzantine', OFFLINE: 'offline' });

/**
 * A content-addressed holder index: snapshot_hash (= record.address) -> Set<holderId>.
 *
 * SIGNING-KEYLESS and SWAPPABLE: it stores only signed public snapshot records and holds no key. `put`
 * records that `holderId` caches `record`; the holder is counted in `validHoldersOf` ONLY if verifySnapshot
 * returns null for the cached bytes (a tampered record is held but never counted as valid). Correctness is
 * unaffected if this whole object is replaced by a plain Map of address -> holders — the swap-the-index test
 * (A4) proves it. Authority is the owner key inside each record, never this index.
 */
export function makeHolderIndex() {
  // address -> Map<holderId, record>  (the cached bytes per holder, so validity is per-cached-copy)
  const byAddress = new Map();

  function put(holderId, record) {
    if (typeof holderId !== 'string' || !record || typeof record !== 'object' || typeof record.address !== 'string') {
      return false;
    }
    if (!byAddress.has(record.address)) byAddress.set(record.address, new Map());
    byAddress.get(record.address).set(holderId, record);
    return true;
  }

  /** Does ANY holder claim to cache this address (valid or not)? */
  function has(address) {
    const m = byAddress.get(address);
    return !!m && m.size > 0;
  }

  /** Every holderId that caches `address`, regardless of whether the cached bytes verify. */
  function holdersOf(address) {
    const m = byAddress.get(address);
    return m ? new Set(m.keys()) : new Set();
  }

  /** Only holders whose CACHED record passes verifySnapshot (null) — a tampered copy is excluded. */
  function validHoldersOf(address) {
    const m = byAddress.get(address);
    const out = new Set();
    if (!m) return out;
    for (const [holderId, record] of m) {
      if (verifySnapshot(record) === null) out.add(holderId);
    }
    return out;
  }

  /** All addresses any holder caches (for enumeration / debug). */
  function addresses() {
    return new Set(byAddress.keys());
  }

  return { put, has, holdersOf, validHoldersOf, addresses };
}

/**
 * PURE: assign N modeled holders deterministic roles from a seed. Returns an array of
 * { id, role } where role ∈ HOLDER_ROLE. Distribution is seeded only — no wall clock. The caller decides
 * how many of each role it needs by inspecting the result; this is the raw seeded population.
 */
export function assignHolders({ seed = 42, count = 6 } = {}) {
  const rnd = lcg((seed >>> 0) ^ 0x4d0e7a11);
  const roles = [HOLDER_ROLE.HONEST, HOLDER_ROLE.BYZANTINE, HOLDER_ROLE.OFFLINE];
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push({ id: `holder/${seed}/${i}`, role: roles[Math.floor(rnd() * roles.length)] });
  }
  return out;
}

/**
 * PURE: the watcher-model predicate. A settlement claim against an offline victim is PROTECTED iff at least
 * one HONEST peer (a) is in `watchingSet`, (b) holds a VALID cached snapshot for the base's address, AND (c)
 * that peer's proveFraud over the PUBLIC inputs (baseRecord, plan, claim) catches the forgery (mismatch).
 *
 * The defender's own online-ness is irrelevant — proveFraud is delegable over public, signed inputs, so any
 * honest holder substitutes for the offline victim. Returns a boolean.
 *
 *   @param settlementClaim  the (possibly forged) settlement record
 *   @param baseRecord       the defender's signed snapshot record (the public input proveFraud needs)
 *   @param plan             the attack plan (public input)
 *   @param holderIndex      a makeHolderIndex() (or swap-compatible) instance
 *   @param watchingSet      Set<holderId> of peers actually watching this window
 *   @param honestSet        Set<holderId> of peers that are honest (will run proveFraud truthfully)
 */
export function protectedIffWatched(settlementClaim, baseRecord, plan, holderIndex, watchingSet, honestSet) {
  if (!baseRecord || typeof baseRecord.address !== 'string') return false;
  const valid = holderIndex.validHoldersOf(baseRecord.address);
  const watching = watchingSet instanceof Set ? watchingSet : new Set();
  const honest = honestSet instanceof Set ? honestSet : new Set();
  // The honest fraud-proof is identical for every honest holder (proveFraud is pure over public inputs); a
  // forged claim yields a non-null mismatch. A holder only counts if it is honest, watching, AND holds valid.
  const fraud = proveFraud(baseRecord, plan, settlementClaim);
  const forgeryCatchable = !!fraud && fraud.mismatch === true;
  if (!forgeryCatchable) return false; // an HONEST claim is never "protected against" — there is nothing to refute
  for (const holderId of valid) {
    if (honest.has(holderId) && watching.has(holderId)) return true;
  }
  return false;
}

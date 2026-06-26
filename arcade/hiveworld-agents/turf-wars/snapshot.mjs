/**
 * Turf Wars — Phase 1 lab substrate · CONTENT-ADDRESSED, HOST-SIGNED SNAPSHOTS (pure, deterministic).
 *
 * ⚠️ LAB ONLY — see canonical.mjs header. No production exposure.
 *
 * A snapshot is a deterministic PROJECTION of folded block state, content-addressed by sha256 of its
 * canonical JSON and signed by the block owner. This is the unit a peer caches and serves so a block
 * is reachable when its host is OFFLINE: verification needs only the record (snapshot + address +
 * owner public key + signature) — no host, no server, no network. Authority still traces to the
 * owner's key, never to whoever served the bytes.
 *
 * Proven here: identical state → identical address; one flipped byte → different address AND a failed
 * signature; a cached record verifies with no access to the original signer. The snapshot excludes
 * volatile bookkeeping (applied/rejected/occupied/collected_at) so it is a stable, replay-independent
 * summary — two peers that folded the same log publish the same address.
 */
import { contentAddress, isContentAddress } from './canonical.mjs';
import { signBytes, verifyBytes, playerIdFromPublicRawHex } from './identity.mjs';

export const SNAPSHOT_SCHEMA_VERSION = 1;

/** PURE: deterministic projection of folded block state into a canonical snapshot object. */
export function projectSnapshot(state) {
  const structures = {};
  for (const id of Object.keys(state.structures || {}).sort()) {
    const st = state.structures[id];
    structures[id] = { kind: st.kind, level: st.level, x: st.x, y: st.y };
  }
  return {
    schema_version: SNAPSHOT_SCHEMA_VERSION,
    lab_only: true,
    block_id: state.block_id,
    owner: state.owner,
    owner_player_id: state.owner_player_id,
    theme: state.theme,
    counters: { flux: state.counters.flux, cores: state.counters.cores },
    minted: { flux: state.minted.flux, cores: state.minted.cores },
    structures,
    crew: state.crew,
    published_snapshot: state.published_snapshot,
    seq_height: state.seq_height,
    chain_head: state.chain_head,
  };
}

/** PURE: the content address (`sha256:…`) of a snapshot object. */
export function snapshotAddress(snapshot) {
  return contentAddress(snapshot);
}

/**
 * Sign a snapshot of `state` with the owner identity. Returns a self-contained, cacheable record. The
 * signature is over the content ADDRESS, so verifying the record proves both integrity (address
 * re-derives from the bytes) and origin (owner signed that address).
 */
export function signSnapshot(identity, state) {
  const snapshot = projectSnapshot(state);
  const address = snapshotAddress(snapshot);
  return {
    record_kind: 'turf_wars_block_snapshot',
    schema_version: SNAPSHOT_SCHEMA_VERSION,
    lab_only: true,
    snapshot,
    address,
    owner: identity.publicRawHex,
    owner_player_id: identity.playerId,
    sig: signBytes(identity.privateKey, address),
  };
}

/**
 * PURE: verify a cached snapshot record with NO access to the signer. Returns null if valid, else a
 * reason. Checks: address re-derives from the snapshot bytes (integrity); the embedded owner key signs
 * the snapshot's own owner field (binding); the owner_player_id matches the key; the signature over the
 * address verifies (origin).
 */
export function verifySnapshot(record) {
  if (!record || typeof record !== 'object' || !record.snapshot) return 'malformed_record';
  const { snapshot, address, owner, owner_player_id, sig } = record;
  if (!isContentAddress(address)) return 'bad_address';
  if (typeof owner !== 'string' || !/^[0-9a-f]{64}$/.test(owner)) return 'bad_owner_key';
  if (snapshot.owner !== owner) return 'owner_mismatch';        // record owner must match snapshot owner
  let derivedPlayer;
  try { derivedPlayer = playerIdFromPublicRawHex(owner); } catch { return 'bad_owner_key'; }
  if (owner_player_id !== derivedPlayer || snapshot.owner_player_id !== derivedPlayer) return 'player_id_mismatch';
  if (snapshotAddress(snapshot) !== address) return 'address_mismatch'; // integrity (tamper-evident)
  if (!verifyBytes(owner, address, sig)) return 'bad_signature';        // origin
  return null;
}

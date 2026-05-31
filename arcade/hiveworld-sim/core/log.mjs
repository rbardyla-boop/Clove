/**
 * Sideband CRDT Log — the single append-only event fabric.
 *
 * Convergence model (this is the heart of the proof):
 *   1. Every node accumulates a SET of events, de-duplicated by event_id.
 *   2. To compute a world view, the set is sorted into ONE canonical total order
 *      and folded by deterministic reducers (see world.mjs).
 *   3. Two nodes that hold the same accepted set therefore compute byte-identical
 *      state — regardless of the order in which events arrived, how many times a
 *      duplicate showed up, or how long an event was delayed.
 *
 * So delayed / out-of-order / duplicate convergence is true *by construction*,
 * not by hand-tuned merge logic. That is what makes this a CRDT-style log.
 *
 * Structural validation (signature, hash, known sideband, forbidden type) happens
 * here at ingest, so bad envelopes never enter the fabric. Authority/semantic
 * rejection (busy cabinet, expired slot, ...) happens later, during the fold,
 * because it depends on accumulated world state.
 */
import { validateEnvelope } from './events.mjs';

/**
 * Canonical total order:
 *   logical_tick  -> actor_id -> seq -> content_hash
 * Tick is the logical clock. actor_id+seq preserves each actor's own causal
 * order. content_hash is the final, fully deterministic tiebreaker so every node
 * agrees on the winner of a same-tick conflict.
 */
export function compareEvents(a, b) {
  if (a.logical_tick !== b.logical_tick) return a.logical_tick - b.logical_tick;
  if (a.actor_id !== b.actor_id) return a.actor_id < b.actor_id ? -1 : 1;
  if (a.seq !== b.seq) return a.seq - b.seq;
  if (a.content_hash === b.content_hash) return 0;
  return a.content_hash < b.content_hash ? -1 : 1;
}

export class SidebandCRDTLog {
  constructor() {
    this._byId = new Map(); // event_id -> frozen event
    this._ingestOrder = []; // event_ids in arrival order (for the live stream)
  }

  get size() {
    return this._byId.size;
  }

  has(eventId) {
    return this._byId.has(eventId);
  }

  /**
   * Try to add an event to the fabric.
   * Returns { status: 'accepted'|'ignored_duplicate'|'rejected', reason, event }.
   */
  ingest(event) {
    const check = validateEnvelope(event);
    if (!check.ok) {
      return { status: 'rejected', phase: 'ingest', reason: check.reason, event };
    }
    if (this._byId.has(event.event_id)) {
      return { status: 'ignored_duplicate', reason: 'duplicate_event_id', event };
    }
    this._byId.set(event.event_id, event);
    this._ingestOrder.push(event.event_id);
    return { status: 'accepted', reason: null, event };
  }

  /** Events in the order they were ingested (useful for the live event stream). */
  arrivalOrder() {
    return this._ingestOrder.map((id) => this._byId.get(id));
  }

  /** Events in canonical total order (the order used for every fold). */
  ordered() {
    return Array.from(this._byId.values()).sort(compareEvents);
  }

  /** A stable fingerprint of the accepted set (order-independent). */
  setFingerprint() {
    return Array.from(this._byId.keys()).sort().join('|');
  }

  /** Snapshot copy — used to seed a fresh node during replay/recovery. */
  snapshot() {
    return this.ordered();
  }
}

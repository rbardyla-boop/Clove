/**
 * HiveNode — the base for any participant on the fabric (players AND rooms).
 *
 * A node has a stable id, its own append-only source chain (seq + prev_hash via
 * createEvent), a local replica of the events it has heard (`known`), and a
 * subscription filter. It is deliberately NOT authoritative: emit() only
 * *proposes*; whether a proposal changes world state is decided later by the
 * canonical fold (view()). receive() does structural validation + de-dup only.
 */
import { createEvent, validateEnvelope } from './events.mjs';
import { compareEvents } from './log.mjs';
import { fold } from './world.mjs';
import { DEFAULT_CTX } from './state-util.mjs';

export class HiveNode {
  constructor({ id, role = 'player', name, subscriptions = null }) {
    this.id = id;
    this.role = role;
    this.name = name || id;
    this.subscriptions = subscriptions ? new Set(subscriptions) : null; // null = all sidebands
    this.online = true;

    this._head = null; // source-chain head (last emitted event)
    this._seq = 0;
    this.journal = []; // events this node authored, in order
    this.known = new Map(); // event_id -> event : this node's replica of the fabric
  }

  isSubscribed(sideband) {
    return !this.subscriptions || this.subscriptions.has(sideband);
  }

  /** Author + sign a new event on this node's source chain. Always self-known. */
  emit({ eventType, sideband, roomId = null, cellId = null, payload = {}, tick }) {
    const ev = createEvent({
      actorId: this.id,
      eventType,
      sideband,
      roomId,
      cellId,
      payload,
      logicalTick: tick,
      prevEvent: this._head,
      seq: this._seq,
    });
    this._head = ev;
    this._seq += 1;
    this.journal.push(ev);
    this.known.set(ev.event_id, ev);
    return ev;
  }

  /**
   * Receive an event from the fabric. Returns
   * { status: 'accepted'|'rejected'|'ignored_duplicate'|'unsubscribed'|'dropped', reason }.
   * An offline node drops everything (used to model disconnects).
   */
  receive(ev) {
    if (!this.online) return { status: 'dropped', reason: 'offline' };
    const check = validateEnvelope(ev);
    if (!check.ok) return { status: 'rejected', reason: check.reason };
    if (!this.isSubscribed(ev.sideband)) return { status: 'unsubscribed', reason: ev.sideband };
    if (this.known.has(ev.event_id)) return { status: 'ignored_duplicate', reason: 'duplicate_event_id' };
    this.known.set(ev.event_id, ev);
    return { status: 'accepted', reason: null };
  }

  /**
   * Replay/recovery ingest: pull a batch (e.g. the canonical log snapshot) into
   * this node's replica, ignoring offline state. Returns count added. This is how
   * a reconnecting node — or a recovered base station — catches up.
   */
  syncFrom(events) {
    let added = 0;
    for (const ev of events) {
      if (!validateEnvelope(ev).ok) continue;
      if (!this.isSubscribed(ev.sideband)) continue;
      if (this.known.has(ev.event_id)) continue;
      this.known.set(ev.event_id, ev);
      added += 1;
    }
    return added;
  }

  knownOrdered() {
    return Array.from(this.known.values()).sort(compareEvents);
  }

  /**
   * Fingerprint of the event-id SET this node holds (order-independent). Because
   * the fold is a pure function of the set, two nodes with equal set fingerprints
   * provably compute identical world state — so this is a sound, cheap way to
   * check convergence without re-folding.
   */
  knownSetFingerprint() {
    return Array.from(this.known.keys()).sort().join('|');
  }

  /** This node's local world view = canonical fold of its replica. */
  view(ctx = DEFAULT_CTX) {
    return fold(this.knownOrdered(), ctx);
  }

  fingerprint(ctx = DEFAULT_CTX) {
    return this.view(ctx).fingerprint;
  }

  /** Structural validity check an agent can run before trusting an event. */
  detectInvalid(ev) {
    const check = validateEnvelope(ev);
    return check.ok ? null : check.reason;
  }

  setOnline(v) {
    this.online = !!v;
  }
}

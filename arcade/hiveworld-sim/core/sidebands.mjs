/**
 * Sideband registry.
 *
 * A "sideband" is a logical radio channel for one class of world state. The name
 * borrows the radio metaphor only — there is NO real RF here. Each sideband has
 * a behavioural class that the reducers and the debug UI both rely on:
 *
 *   ephemeral     high-churn, decays, not meant to be authoritative or replayed
 *                 as history (presence, discovery, weather)
 *   persistent    every event is retained and fully replayable (ar_anchor,
 *                 asset_sync, event_log)
 *   authoritative a base station / world authority owns the truth; conflicting
 *                 claims are resolved deterministically (occupancy, object_state,
 *                 moderation)
 *   validated     slow, every event is semantically checked before it applies
 *                 (market)
 *   proposal      a node may *propose* but can NEVER override authority
 *                 (agent_intent)
 */

export const SIDEBAND_CLASS = Object.freeze({
  EPHEMERAL: 'ephemeral',
  PERSISTENT: 'persistent',
  AUTHORITATIVE: 'authoritative',
  VALIDATED: 'validated',
  PROPOSAL: 'proposal',
});

const C = SIDEBAND_CLASS;

/** Ordered so the spectrum UI always draws channels in a stable layout. */
export const SIDEBANDS = Object.freeze({
  discovery:    { klass: C.EPHEMERAL,     persistent: false, authority: 'none',  highFrequency: true,  description: 'Who/what is nearby; node + role announcements.' },
  presence:     { klass: C.EPHEMERAL,     persistent: false, authority: 'none',  highFrequency: true,  description: 'Live position/heartbeat; decays quickly.' },
  occupancy:    { klass: C.AUTHORITATIVE, persistent: true,  authority: 'room',  highFrequency: false, description: 'Who holds a cabinet; room is fast authority.' },
  object_state: { klass: C.AUTHORITATIVE, persistent: true,  authority: 'room',  highFrequency: false, description: 'Short-lived object locks inside a room.' },
  ar_anchor:    { klass: C.PERSISTENT,    persistent: true,  authority: 'world', highFrequency: false, description: 'Placed AR anchor references (placeholders).' },
  asset_sync:   { klass: C.PERSISTENT,    persistent: true,  authority: 'world', highFrequency: false, description: 'Digital-good ownership + cosmetics sync.' },
  agent_intent: { klass: C.PROPOSAL,      persistent: false, authority: 'none',  highFrequency: true,  description: 'Agent proposals; never override authority.' },
  market:       { klass: C.VALIDATED,     persistent: true,  authority: 'world', highFrequency: false, description: 'Internal credits + bound goods; slow, validated.' },
  moderation:   { klass: C.AUTHORITATIVE, persistent: true,  authority: 'world', highFrequency: false, description: 'Suspend slots/objects; moderator authority only.' },
  event_log:    { klass: C.PERSISTENT,    persistent: true,  authority: 'world', highFrequency: false, description: 'Durable world events (round results, audit).' },
  weather:      { klass: C.EPHEMERAL,     persistent: false, authority: 'none',  highFrequency: true,  description: 'Ambient world flavour per cell; broadcast.' },
});

export const SIDEBAND_NAMES = Object.freeze(Object.keys(SIDEBANDS));

export function isKnownSideband(name) {
  return Object.prototype.hasOwnProperty.call(SIDEBANDS, name);
}

export function getSidebandMeta(name) {
  return isKnownSideband(name) ? SIDEBANDS[name] : null;
}

export function isEphemeral(name) {
  return getSidebandMeta(name)?.klass === C.EPHEMERAL;
}

export function isPersistent(name) {
  return getSidebandMeta(name)?.persistent === true;
}

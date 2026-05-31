/**
 * PlayerAgentNode — a player's carried node.
 *
 * Adds intent helpers and convenience accessors on top of HiveNode. The agent
 * holds a trustScore that the simulator lowers whenever one of this agent's
 * emitted events is rejected by the authoritative fold (e.g. a malicious actor
 * spamming busy-cabinet claims), so adversarial behaviour is observable.
 *
 * inventory()/credits() are DERIVED from the agent's own folded view — never set
 * directly. The agent cannot mint itself goods or credits by fiat; it can only
 * emit market events that the reducers may or may not accept.
 */
import { HiveNode } from './node.mjs';
import { DEFAULT_CTX } from './state-util.mjs';

export class PlayerAgentNode extends HiveNode {
  constructor(opts) {
    super({ ...opts, role: opts.role || 'player' });
    this.trustScore = 1.0;
    this.currentRoom = null;
    this.currentCell = opts.cellId || null;
  }

  announce(tick) {
    return this.emit({ eventType: 'agent_announce', sideband: 'discovery', payload: { role: this.role, name: this.name }, tick });
  }

  ping(tick, roomId = this.currentRoom, cellId = this.currentCell) {
    return this.emit({ eventType: 'presence_ping', sideband: 'presence', roomId, cellId, payload: {}, tick });
  }

  occupy(roomId, machineId, tick, expectedRev) {
    this.currentRoom = roomId;
    const payload = expectedRev === undefined ? { machineId } : { machineId, expectedRev };
    return this.emit({ eventType: 'occupy_cabinet', sideband: 'occupancy', roomId, payload, tick });
  }

  release(roomId, machineId, tick) {
    return this.emit({ eventType: 'release_cabinet', sideband: 'occupancy', roomId, payload: { machineId }, tick });
  }

  finishRound(roomId, machineId, result, tick) {
    return this.emit({ eventType: 'finish_round', sideband: 'event_log', roomId, payload: { machineId, ...result }, tick });
  }

  leaseSlot(cellId, slot, tick) {
    return this.emit({ eventType: 'lease_slot', sideband: 'event_log', cellId, payload: { cellId, ...slot }, tick });
  }

  renewSlot(slotId, extendTicks, tick) {
    return this.emit({ eventType: 'renew_slot', sideband: 'event_log', payload: { slotId, extendTicks }, tick });
  }

  expireSlot(slotId, tick) {
    return this.emit({ eventType: 'expire_slot', sideband: 'event_log', payload: { slotId }, tick });
  }

  placeObject(slotId, objectId, opts, tick) {
    return this.emit({ eventType: 'place_object', sideband: 'event_log', payload: { slotId, objectId, ...opts }, tick });
  }

  removeObject(slotId, objectId, tick) {
    return this.emit({ eventType: 'remove_object', sideband: 'event_log', payload: { slotId, objectId }, tick });
  }

  grantCredits(to, amount, tick) {
    return this.emit({ eventType: 'grant_credits', sideband: 'market', payload: { to, amount }, tick });
  }

  spendCredits(amount, reason, tick) {
    return this.emit({ eventType: 'spend_credits', sideband: 'market', payload: { amount, reason }, tick });
  }

  mintBoundGood(goodId, goodType, cost, tick) {
    return this.emit({ eventType: 'mint_bound_good', sideband: 'market', payload: { goodId, goodType, cost }, tick });
  }

  equipGood(goodId, tick) {
    return this.emit({ eventType: 'equip_good', sideband: 'asset_sync', payload: { goodId }, tick });
  }

  unequipGood(goodId, tick) {
    return this.emit({ eventType: 'unequip_good', sideband: 'asset_sync', payload: { goodId }, tick });
  }

  /** Record a proposal. Never authoritative — see ambient.agent_intent. */
  intent(intentName, detail, tick) {
    return this.emit({ eventType: 'agent_intent', sideband: 'agent_intent', payload: { intent: intentName, ...detail }, tick });
  }

  credits(ctx = DEFAULT_CTX) {
    return this.view(ctx).state.economy.credits[this.id] || 0;
  }

  inventory(ctx = DEFAULT_CTX) {
    const goods = this.view(ctx).state.economy.goods;
    return Object.entries(goods)
      .filter(([, g]) => g.owner === this.id)
      .map(([id, g]) => ({ id, type: g.type, bound: g.bound }));
  }

  penalizeTrust(amount = 0.1) {
    this.trustScore = Math.max(0, Math.round((this.trustScore - amount) * 1000) / 1000);
  }
}

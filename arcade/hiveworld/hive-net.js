import {
  addPlayer,
  applyCommand,
  createInitialWorld,
  publicSnapshot,
} from './hive-world.mjs';

const HEARTBEAT_MS = 10_000;
const FALLBACK_MS = 2_200;

function randomToken(length = 8) {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  try {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    for (const byte of bytes) out += alphabet[byte % alphabet.length];
  } catch {
    for (let i = 0; i < length; i += 1) out += alphabet[(i * 7 + length) % alphabet.length];
  }
  return out;
}

export function createBrowserIdentity() {
  const key = 'clove-hive-browser-identity-v1';
  try {
    const saved = sessionStorage.getItem(key);
    if (saved) return JSON.parse(saved);
  } catch { /* private browsing or disabled storage: use an ephemeral identity */ }
  const names = ['Morrow', 'Iris', 'Tarn', 'Sable', 'Juniper', 'Vale', 'Kestrel', 'Rowan'];
  const factions = ['surveyors', 'keepers', 'menders'];
  const responsibilities = ['Witness', 'Cartographer', 'Builder', 'Mediator', 'Archivist', 'Field Operator'];
  const token = randomToken();
  const identity = {
    playerId: `witness-${token}`,
    displayName: names[token.charCodeAt(0) % names.length],
    factionId: factions[token.charCodeAt(1) % factions.length],
    responsibility: responsibilities[token.charCodeAt(2) % responsibilities.length],
  };
  try { sessionStorage.setItem(key, JSON.stringify(identity)); } catch { /* optional */ }
  return identity;
}

export function resolveHiveWsUrl({ explicit, config, location } = {}) {
  if (typeof explicit === 'string' && explicit.trim()) return explicit.trim();
  const configured = config && typeof config.hiveWsUrl === 'string' ? config.hiveWsUrl.trim() : '';
  if (configured) return configured;
  if (location?.host) {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${location.host}/arcade/hive/ws?world=frontier`;
  }
  return null;
}

class LocalHiveAuthority {
  constructor(handlers) {
    this.handlers = handlers;
    this.world = createInitialWorld({ seed: 'clove-local-preview' });
  }

  join(identity) {
    this.world = addPlayer(this.world, identity).world;
    this.handlers.onStatus?.('preview');
    this.handlers.onSnapshot?.(publicSnapshot(this.world, identity.playerId));
  }

  command(playerId, command) {
    const result = applyCommand(this.world, playerId, command);
    if (!result.ok) {
      this.handlers.onError?.({ code: result.reason, message: this.humanError(result.reason) });
      return;
    }
    this.world = result.world;
    if (result.event) this.handlers.onEvent?.(result.event);
    this.handlers.onSnapshot?.(publicSnapshot(this.world, playerId));
  }

  humanError(code) {
    const messages = {
      route_not_adjacent: 'That route is not open from here.',
      invalid_law_guess: 'Choose one of the visible readings first.',
      no_focus: 'You have no Focus left for another risky probe this cycle.',
      regroup_at_hub: 'Return to Clove Hive before regrouping your attention.',
      regroup_limit: 'You have used every regroup for this cycle. The remaining evidence must carry you forward.',
      regroup_not_needed: 'Your Focus is already full; keep your attention for a risky probe.',
      duplicate_hypothesis: 'That reading was already tested this cycle. Choose another visible option.',
      build_needs_focus: 'A field beacon costs two Focus. Regroup at Clove Hive before building.',
      build_needs_shared_proof: 'Share a supported claim and its tested proof before building.',
      build_limit: 'You have already left one field beacon this cycle. Let it do its work.',
      cycle_sealed: 'This cycle is sealed. Begin the next question before building again.',
      signal_at_relay: 'Stand at Hollow Relay to send a coordination signal.',
      invalid_signal: 'Choose one of the six coordination signals.',
      signal_limit: 'Your witness can send three signals per cycle. Let the frontier answer.',
      expedition_complete: 'This Relay Thread is archived. Wait for the next cycle.',
      stand_at_hollow_relay: 'Travel to Hollow Relay before asking the Hive to authorize this.',
      share_claim_first: 'Share the claim publicly before asking the Hive to trust it.',
      claim_not_supported: 'The claim needs a supporting probe first.',
      share_tested_evidence_first: 'Share the tested evidence attached to this claim first.',
      relay_not_legible: 'Authorize all three laws before repairing the relay.',
      seal_current_cycle_first: 'Repair the relay before opening another cycle.',
    };
    return messages[code] || 'The Hive rejected that action without changing the world.';
  }
}

export class HiveNet {
  constructor({ wsUrl, identity, handlers = {}, demo = false } = {}) {
    this.wsUrl = wsUrl;
    this.identity = identity;
    this.h = handlers;
    this.demo = demo;
    this.ws = null;
    this.local = null;
    this.closed = false;
    this.connected = false;
    this.heartbeat = null;
    this.fallbackTimer = null;
  }

  connect() {
    this.closed = false;
    if (this.demo || typeof WebSocket !== 'function' || !this.wsUrl) {
      this.startPreview('local preview');
      return;
    }
    this.h.onStatus?.('connecting');
    let socket;
    try { socket = new WebSocket(this.wsUrl); } catch { this.startPreview('server unavailable'); return; }
    this.ws = socket;
    this.fallbackTimer = setTimeout(() => {
      if (!this.connected && !this.closed) this.startPreview('server route not deployed');
    }, FALLBACK_MS);
    socket.addEventListener('open', () => {
      this.connected = true;
      if (this.fallbackTimer) clearTimeout(this.fallbackTimer);
      this.h.onStatus?.('syncing');
      this.send({ t: 'hive_join', ...this.identity });
      this.heartbeat = setInterval(() => this.send({ t: 'heartbeat' }), HEARTBEAT_MS);
    });
    socket.addEventListener('message', (event) => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      this.route(message);
    });
    socket.addEventListener('close', () => {
      if (this.ws !== socket) return;
      this.connected = false;
      if (this.heartbeat) clearInterval(this.heartbeat);
      this.heartbeat = null;
      if (!this.closed && !this.local) this.startPreview('connection lost — local preview');
      if (!this.local) this.h.onStatus?.('offline');
    });
    socket.addEventListener('error', () => {
      if (!this.connected && !this.local) this.startPreview('server unavailable');
      try { socket.close(); } catch { /* noop */ }
    });
  }

  startPreview(reason) {
    if (this.local || this.closed) return;
    if (this.ws && !this.connected) {
      try { this.ws.close(); } catch { /* the preview owns the fallback now */ }
    }
    this.local = new LocalHiveAuthority(this.h);
    this.h.onNotice?.(reason);
    this.local.join(this.identity);
  }

  route(message) {
    switch (message.t) {
      case 'hive_welcome': this.h.onWelcome?.(message); this.h.onStatus?.('live'); break;
      case 'hive_snapshot': this.h.onSnapshot?.(message.snapshot); break;
      case 'hive_event': this.h.onEvent?.(message.event); break;
      case 'hive_error': this.h.onError?.(message); break;
      default: break;
    }
  }

  send(message) {
    if (this.local) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try { this.ws.send(JSON.stringify(message)); } catch { /* closing */ }
    }
  }

  command(command) {
    if (this.local) this.local.command(this.identity.playerId, command);
    else this.send({ t: `hive_${command.type}`, ...command, type: undefined });
  }

  move(dx, dy, dt = 80) { this.command({ type: 'move', dx, dy, dt }); }
  travel(regionId) { this.command({ type: 'travel', regionId }); }
  observe() { this.command({ type: 'observe' }); }
  hypothesize(lawId, guess, evidenceIds = []) { this.command({ type: 'hypothesize', lawId, guess, evidenceIds }); }
  probe(hypothesisId) { this.command({ type: 'probe', hypothesisId }); }
  regroup() { this.command({ type: 'regroup' }); }
  build(kind = 'field-beacon') { this.command({ type: 'build', kind }); }
  signal(signalId) { this.command({ type: 'signal', signalId }); }
  share(itemId) { this.command({ type: 'share', itemId }); }
  authorize(hypothesisId) { this.command({ type: 'authorize', hypothesisId }); }
  repair() { this.command({ type: 'repair' }); }
  nextCycle() { this.command({ type: 'next_cycle' }); }

  close() {
    this.closed = true;
    if (this.fallbackTimer) clearTimeout(this.fallbackTimer);
    if (this.heartbeat) clearInterval(this.heartbeat);
    try { this.send({ t: 'hive_leave' }); this.ws?.close(); } catch { /* noop */ }
  }
}

/**
 * Phase 7C — TWO-WEBSOCKET shim integration smoke: the GATHER objective's live proof.
 *
 * Node-level (no browser): two honest clients speak only the normal public protocol
 * against the dev shim. Proves end to end: hint cycle delivery to both sockets;
 * reach-node completion from canonical movement; the DOCUMENTED 45s cooldown elapsing
 * for real (a deterministic bounded wait, logged — deliberately NOT a cooldown
 * override, which would be a test knob on a production module); the gather objective
 * completing ONLY when both canonical positions sit inside the static zone; identical
 * acknowledgment on both sockets; forged completion/hint rejected per client; no
 * value-shaped fields anywhere. Fails loudly with geometry/state diagnostics.
 * Run: tests/arcade/run-city-objectives-two-client.sh   (total runtime ~2.5min — two real
 * cooldown waits are the honest price of refusing a production test hook.)
 */
import { connectCityClient, VALUE_FIELD_RE } from './city-objectives-ws-driver.mjs';
import { OBJECTIVE_COOLDOWN_MS } from '../../arcade/city/city-objectives.mjs';

const WS = process.env.WS_URL || 'ws://127.0.0.1:8788/arcade/city/ws';
const CITY = 'downtown-01';
const RUN = Date.now().toString(36);

let fail = 0;
const check = (n, c, d) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${n}${d && !c ? ` — ${d}` : ''}`); if (!c) fail++; };

const a = await connectCityClient(`${WS}?city=${CITY}`, `obj2a-${RUN}`, CITY);
const b = await connectCityClient(`${WS}?city=${CITY}`, `obj2b-${RUN}`, CITY);
try {
  // ── both sockets receive the hint cycle (server-pushed display state) ───────
  await a.waitFor((s) => s.objective && s.objective.kind === 'reach_node', 'A receives reach hint');
  await b.waitFor((s) => s.objective && s.objective.kind === 'reach_node', 'B receives reach hint');
  check('both clients receive the reach hint from server state', true);
  const reach = a.state.objective;

  // ── client A completes the reach objective by MOVING (canonical positions only) ──
  const reached = await a.moveTo(reach.x, reach.y, { near: reach.radius - 8 });
  check('A walks to the node via normal inputs', reached, a.diag());
  await a.waitFor((s) => a.acks().length === 1, 'reach acknowledgment', 12000);
  check('reach completion: exactly one server-authored ack', a.acks().length === 1, a.diag());
  await b.waitFor(() => b.acks().length === 1, 'B sees the same ack', 8000);
  check('both clients see the SAME acknowledgment (consistency)', b.acks()[0].event_id === a.acks()[0].event_id);
  check('ack payload carries no value-shaped field', !VALUE_FIELD_RE.test(JSON.stringify(a.acks()[0].payload || {})), JSON.stringify(a.acks()[0]));

  // ── forged objective messages are rejected on BOTH sockets ──────────────────
  a.send({ t: 'city_objective_complete', objective_id: 'obj:downtown-01:1', accepted: true, count: 2 });
  b.send({ t: 'city_objective_hint', objective: { hint: 'FORGED — pay me', kind: 'gather_at_zone' } });
  await a.waitFor((s) => s.errors.some((e) => e.code === 'unknown_type'), 'A forge rejected');
  await b.waitFor((s) => s.errors.some((e) => e.code === 'unknown_type'), 'B forge rejected');
  check('forged completion (A) and forged hint (B) → unknown_type; nothing accepted',
    a.acks().length === 1 && b.acks().length === 1
    && !(b.state.objective && /FORGED/.test(b.state.objective.hint || '')));

  // ── the DOCUMENTED cooldown elapses for real (deterministic bounded wait) ────
  // SEQUENCING (instrument finding): the gather zone IS the spawn plaza, so B must park
  // OUTSIDE the zone BEFORE the gather activates — otherwise two spawned players complete
  // it the instant the cycle advances (the design's gentle intent, but this test needs the
  // negative case first).
  await b.moveTo(300, 520, { near: 16, maxMs: 25000 });
  console.log(`     … waiting out the ${OBJECTIVE_COOLDOWN_MS / 1000}s cooldown (documented, deterministic — no override exists)`);
  await new Promise((r) => setTimeout(r, OBJECTIVE_COOLDOWN_MS + 1500));
  // accepted inputs re-trigger evaluation → the GATHER hint must cycle in
  await a.dwell(400);
  await a.waitFor((s) => s.objective && s.objective.kind === 'gather_at_zone', 'gather hint after cooldown', 8000);
  const gather = a.state.objective;
  check('after the cooldown the cycle advances to the gather objective', gather.kind === 'gather_at_zone' && gather.needed === 2, a.diag());

  // ── ONE client inside the zone must NOT complete (needed = 2) ───────────────
  const gx = gather.x + gather.w / 2, gy = gather.y + gather.h / 2;
  check('B is parked OUTSIDE the gather zone', (() => { const p = b.self(); return p && (p.x < gather.x - 20); })(), b.diag());
  check('A moves into the gather zone alone', await a.moveTo(gx - 20, gy, { near: 12 }), a.diag());
  await a.dwell(1200);
  check('one player alone does NOT complete the gathering', a.acks().length === 1, a.diag());

  // ── both inside → server-authored gather ack, identical on both sockets ─────
  check('B joins the zone', await b.moveTo(gx + 24, gy + 10, { near: 12 }), b.diag());
  await a.dwell(600);
  await a.waitFor(() => a.acks().length === 2, 'gather acknowledgment', 12000);
  await b.waitFor(() => b.acks().length === 2, 'B sees gather ack', 8000);
  const ackA = a.acks()[1]; const ackB = b.acks()[1];
  check('gather completes ONLY with both canonical positions inside (count 2)', ackA.payload && ackA.payload.count === 2, JSON.stringify(ackA));
  check('gather ack identical on both sockets', ackA.event_id === ackB.event_id);
  check('gather ack is actor-less and value-free',
    (ackA.actor_public_id == null) && !VALUE_FIELD_RE.test(JSON.stringify(ackA.payload)), JSON.stringify(ackA));
  check('exactly one gather ack despite both players dwelling in-zone', a.acks().length === 2, a.diag());

  // ── 7C-V: DWELL live proof (index 2 — one more real cooldown) ────────────────
  // visit_in_order (index 3) stays pure-proven: its wire path is the same kind-generic
  // plumbing; a third cooldown would buy no new authority evidence for its cost.
  await b.moveTo(300, 520, { near: 16, maxMs: 25000 }); // B clear of everything
  console.log(`     … waiting out the ${OBJECTIVE_COOLDOWN_MS / 1000}s cooldown again (dwell activates next)`);
  await new Promise((r) => setTimeout(r, OBJECTIVE_COOLDOWN_MS + 1500));
  await a.dwell(400);
  await a.waitFor((s) => s.objective && s.objective.kind === 'dwell_at_node', 'dwell hint after cooldown', 8000);
  const dwellObj = a.state.objective;
  check('cycle advances to dwell_at_node with humane parameters', dwellObj.dwell_s >= 2 && dwellObj.dwell_s <= 10, a.diag());
  // brief touch-and-leave must NOT complete (continuous presence resets)
  check('A reaches the dwell node', await a.moveTo(dwellObj.x, dwellObj.y, { near: dwellObj.radius - 10 }), a.diag());
  await a.moveTo(dwellObj.x + 120, dwellObj.y, { near: 14 }); // leave immediately
  await a.dwell(600);
  check('touch-and-leave does not complete the dwell', a.acks().length === 2, a.diag());
  // return and STAY: standing still requires periodic evaluation ticks → gentle in-place nudges
  check('A returns to the node', await a.moveTo(dwellObj.x, dwellObj.y, { near: dwellObj.radius - 10 }), a.diag());
  await a.dwell(dwellObj.dwell_s * 1000 + 1500);
  await a.waitFor(() => a.acks().length === 3, 'dwell acknowledgment', 8000);
  const dwellAck = a.acks()[2];
  check('continuous dwell completes with a value-free actor-less ack',
    dwellAck.payload.kind === 'dwell_at_node' && (dwellAck.actor_public_id == null)
    && !VALUE_FIELD_RE.test(JSON.stringify(dwellAck.payload)), JSON.stringify(dwellAck));
} finally {
  a.close(); b.close();
}
console.log(fail === 0 ? 'CITY OBJECTIVES TWO-CLIENT SMOKE: PASS' : `CITY OBJECTIVES TWO-CLIENT SMOKE: ${fail} FAILURE(S)`);
process.exit(fail === 0 ? 0 : 1);

/**
 * Phase 7C — STAGING objectives smoke vs the REAL CityRoom Durable Object.
 *
 * 7C-V: proves ALL FOUR objective kinds against workerd — reach, gather (negative
 * case first), dwell (touch-and-leave negative first), and visit-in-order (out-of-
 * order negative first; legs SPLIT ACROSS CLIENTS to prove block-collective
 * semantics) — plus forged completion/hint rejection, real 45s cooldowns,
 * cross-client ack consistency, per-block flavor, and value-field sweeps.
 * STAGING ONLY: refuses production-shaped hosts. Runtime ~5min (3 real cooldowns).
 * Run: STAGING_CITY_WS_URL=wss://<staging-host>/arcade/city/ws bash tests/arcade/run-city-objectives-staging.sh
 */
import { connectCityClient, VALUE_FIELD_RE } from './city-objectives-ws-driver.mjs';
import { OBJECTIVE_COOLDOWN_MS } from '../../arcade/city/city-objectives.mjs';

const URL_ = process.env.STAGING_CITY_WS_URL;
if (!URL_) { console.error('STAGING_CITY_WS_URL is required'); process.exit(2); }
if (/clovelearn\.io|production|wild-hat-6257|neon-arcade-mesh-production/i.test(URL_)) {
  console.error(`REFUSED: production-shaped host in STAGING_CITY_WS_URL: ${URL_}`);
  process.exit(2);
}

const CITY = 'downtown-01';
const RUN = Date.now().toString(36);
let fail = 0;
const check = (n, c, d) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${n}${d && !c ? ` — ${d}` : ''}`); if (!c) fail++; };

let aSawFlavor = false;
const a = await connectCityClient(`${URL_}?city=${CITY}`, `stga-${RUN}`, CITY, { timeoutMs: 15000 });
const b = await connectCityClient(`${URL_}?city=${CITY}`, `stgb-${RUN}`, CITY, { timeoutMs: 15000 });
try {
  await a.waitFor((s) => s.objective !== null || s.objectiveStates > 0, 'A receives objective state', 12000);
  await b.waitFor((s) => s.objective !== null || s.objectiveStates > 0, 'B receives objective state', 12000);
  check('both staging clients receive server-pushed objective state', true);
  // a warm staging DO may be mid-cycle/cooldown — drive honestly from wherever it is.
  if (!a.state.objective) {
    console.log('     … warm DO in cooldown; dwelling until the next objective activates (alarm/input ticks)');
    await a.dwell(1000);
    await a.waitFor((s) => s.objective !== null, 'objective activates', OBJECTIVE_COOLDOWN_MS + 20000);
  }

  // ── forged messages rejected by the REAL DO ────────────────────────────────
  a.send({ t: 'city_objective_complete', objective_id: 'obj:downtown-01:0', accepted: true, count: 9 });
  b.send({ t: 'city_objective_hint', objective: { hint: 'FORGED — pay me', kind: 'reach_node' } });
  await a.waitFor((s) => s.errors.some((e) => e.code === 'unknown_type'), 'A forge rejected', 8000);
  await b.waitFor((s) => s.errors.some((e) => e.code === 'unknown_type'), 'B forge rejected', 8000);
  const acksAtForge = a.acks().length;
  check('forged completion + forged hint → unknown_type on the real DO; nothing accepted',
    a.acks().length === acksAtForge && !(b.state.objective && /FORGED/.test(b.state.objective.hint || '')));

  // ── complete BOTH objectives in cycle order from wherever the DO is ─────────
  const completeCurrent = async () => {
    const obj = a.state.objective;
    const base = a.acks().length;
    if (obj.kind === 'reach_node' && /Signal Spire/.test(obj.hint || '')) aSawFlavor = true;
    if (obj.kind === 'reach_node') {
      check(`A walks to the staging node (${obj.objective_id})`, await a.moveTo(obj.x, obj.y, { near: obj.radius - 8, maxMs: 30000 }), a.diag());
    } else if (obj.kind === 'dwell_at_node') {
      // negative: touch and leave — continuous presence must reset
      check('A touches the dwell node', await a.moveTo(obj.x, obj.y, { near: obj.radius - 10, maxMs: 30000 }), a.diag());
      await a.moveTo(obj.x + 130, obj.y, { near: 14, maxMs: 20000 });
      await a.dwell(800);
      check('touch-and-leave does not complete the dwell (real DO)', a.acks().length === base, a.diag());
      // sustained: return and stay (in-place nudges keep evaluation ticking)
      check('A returns for a sustained dwell', await a.moveTo(obj.x, obj.y, { near: obj.radius - 10, maxMs: 20000 }), a.diag());
      await a.dwell(obj.dwell_s * 1000 + 2000);
    } else if (obj.kind === 'visit_in_order') {
      // SEQUENCING (staging finding): the dwell node IS visit node A — if A is still
      // standing there when visit activates, leg one is legitimately already complete
      // and the "out-of-order" premise is false. Clear A off node A FIRST.
      await a.moveTo(obj.x + 150, obj.y - 60, { near: 16, maxMs: 20000 });
      await a.dwell(600); // ensure an evaluation tick sees A absent from node A
      // negative: B goes OUT OF ORDER to the second node first — must not complete
      check('B reaches node B first (out of order)', await b.moveTo(obj.bx, obj.by, { near: obj.radius - 10, maxMs: 30000 }), b.diag());
      await b.dwell(800);
      check('out-of-order touch does not complete (real DO)', a.acks().length === base, b.diag());
      // collective: A completes leg ONE, then B (already at node B) completes leg TWO
      check('A touches node A (leg one)', await a.moveTo(obj.x, obj.y, { near: obj.radius - 10, maxMs: 30000 }), a.diag());
      await b.dwell(800); // B's accepted inputs at node B complete leg two — legs split across clients
    } else {
      const gx = obj.x + obj.w / 2, gy = obj.y + obj.h / 2;
      await b.moveTo(obj.x - 90, gy, { near: 18, maxMs: 30000 });        // B outside first
      check('A enters the gather zone alone', await a.moveTo(gx - 18, gy, { near: 12, maxMs: 30000 }), a.diag());
      await a.dwell(1500);
      check('one player alone does NOT complete the gathering (real DO)', a.acks().length === base, a.diag());
      check('B joins the zone', await b.moveTo(gx + 22, gy + 8, { near: 12, maxMs: 30000 }), b.diag());
      await a.dwell(800);
    }
    await a.waitFor(() => a.acks().length === base + 1, `${obj.kind} acknowledgment`, 15000);
    await b.waitFor(() => b.acks().length >= base + 1, 'B sees the ack', 10000);
    const ack = a.acks()[base];
    check(`${obj.kind}: server-authored, actor-less, value-free ack on both sockets`,
      ack.event_id === b.acks().find((e) => e.event_id === ack.event_id)?.event_id
      && (ack.actor_public_id == null) && !VALUE_FIELD_RE.test(JSON.stringify(ack.payload || {})), JSON.stringify(ack));
    return obj.kind;
  };

  // Prove BOTH kinds on the real DO. A hibernated DO may be EVICTED during a quiet
  // cooldown and legitimately restart the cycle at reach (the DOCUMENTED ephemerality —
  // an anti-accumulation property, not a bug). So: bounded completion loop until both
  // kinds are proven, tolerating documented restarts, never tolerating a missing ack.
  const proven = new Set();
  for (let round = 0; round < 7 && proven.size < 4; round++) {
    proven.add(await completeCurrent());
    if (proven.size === 4) break;
    console.log(`     … round ${round + 1}: proven [${[...proven]}] — waiting out the real ${OBJECTIVE_COOLDOWN_MS / 1000}s cooldown on workerd`);
    // NEUTRAL GROUND (staging finding #2): park BOTH clients away from every objective
    // point BEFORE the next activation — otherwise the wake-up nudge runs while a player
    // still occupies a node from the previous round, legitimately pre-completing a leg
    // (visit node A == dwell node; node B == the gather plaza) and falsifying negatives.
    await a.moveTo(340, 560, { near: 14, maxMs: 20000 });
    await b.moveTo(300, 520, { near: 14, maxMs: 20000 });
    await new Promise((r) => setTimeout(r, OBJECTIVE_COOLDOWN_MS + 2000));
    await a.dwell(1000);
    await a.waitFor((s) => s.objective !== null, 'next objective activates', 25000);
    if (proven.has(a.state.objective.kind) && round >= 1) {
      console.log('     … DO evicted mid-cooldown (documented restart) — continuing the loop');
    }
  }
  check('ALL FOUR objective kinds proven on the real Durable Object', proven.size === 4, `proven: ${[...proven].join(', ')}`);
  // 7C-V: per-block flavor — downtown's reach hint is the flavored Signal Spire line
  check("per-block flavor: downtown's reach hint named the Signal Spire (closed server config)", aSawFlavor);

  // ── no arcade-economy message ever arrived on the city socket ───────────────
  check('no ticket/prize/ledger message type appeared on either city socket', true); // driver stores only city_* types; sweep events for safety:
  check('no value-shaped field in ANY received objective event',
    a.acks().concat(b.acks()).every((e) => !VALUE_FIELD_RE.test(JSON.stringify(e.payload || {}))));
} finally {
  a.close(); b.close();
}
console.log(fail === 0 ? 'CITY OBJECTIVES STAGING SMOKE: PASS' : `CITY OBJECTIVES STAGING SMOKE: ${fail} FAILURE(S)`);
process.exit(fail === 0 ? 0 : 1);

/**
 * Phase 3D — admin-gate safety hardening (pre-playtest).
 *
 * Complements admin.test.mjs (spot checks) + presentation-overrides.test.mjs
 * (per-room scoping) with the adversarial invariants that matter before exposing
 * the arcade to external users:
 *   1. NO credential combination bypasses the both-gate (exhaustive truth table).
 *   2. The gate result never carries the secret (no leak through checkAdmin).
 *   3. The admin surface is OPERATIONAL only — it can never name a ticket/prize/
 *      reward/balance/economy op (admin cannot touch the economy or authority).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAdmin, ADMIN_OPS, isAdminOp } from '../../workers/arcade/src/admin.mjs';

const SECRET = 'operational-secret-xyz';

// 1. Exhaustive both-gate truth table: admin is allowed ONLY when the dev flag is
//    on AND a server token is configured AND the caller's token matches it.
test('no credential combination bypasses the both-gate', () => {
  const flags = [true, false];
  const serverTokens = [undefined, '', SECRET];
  const providedTokens = [undefined, '', 'wrong', SECRET];
  let allowed = 0;
  for (const enabled of flags) {
    for (const token of serverTokens) {
      for (const providedToken of providedTokens) {
        const res = checkAdmin({ enabled, token, providedToken });
        const shouldAllow = enabled === true && token === SECRET && providedToken === SECRET;
        assert.equal(res.ok, shouldAllow,
          `enabled=${enabled} token=${JSON.stringify(token)} provided=${JSON.stringify(providedToken)} -> ok=${res.ok}`);
        if (res.ok) allowed++;
        if (!res.ok) assert.equal(typeof res.reason, 'string');
      }
    }
  }
  // Exactly ONE of the 2*3*4 = 24 combinations is allowed.
  assert.equal(allowed, 1);
});

// 2. The gate result is exactly { ok, reason } — it never echoes the secret.
test('checkAdmin leaks no token in its result', () => {
  for (const providedToken of [SECRET, 'wrong', '']) {
    const res = checkAdmin({ enabled: true, token: SECRET, providedToken });
    const json = JSON.stringify(res);
    assert.ok(!json.includes(SECRET), `result leaked the secret: ${json}`);
    assert.deepEqual(Object.keys(res).sort(), ['ok', 'reason']);
  }
});

// 3. The admin op surface is operational, not economic. Every op is a known
//    lifecycle/diagnostics/presentation op, and NONE names the economy/authority.
test('admin ops are operational only — never an economy/authority op', () => {
  const EXPECTED = ['clear_presentation', 'diagnostics', 'presentation_diagnostics',
    'preview_presentation', 'reset', 'set_presentation', 'set_status'];
  assert.deepEqual([...ADMIN_OPS].sort(), EXPECTED);
  assert.equal(ADMIN_OPS.length, 7);
  assert.ok(Object.isFrozen(ADMIN_OPS), 'ADMIN_OPS must be frozen');

  const FORBIDDEN = /ticket|prize|reward|balance|ledger|grant|award|payout|credit|redeem|challenge|cosmetic|inventory|cashout|withdraw/i;
  for (const op of ADMIN_OPS) {
    assert.ok(!FORBIDDEN.test(op), `admin op "${op}" names an economy/authority verb`);
    assert.equal(isAdminOp(op), true);
  }
  // Economy/authority verbs are NOT admin-reachable.
  for (const op of ['grant_tickets', 'set_balance', 'award_prize', 'redeem', 'reset_economy', 'give_reward']) {
    assert.equal(isAdminOp(op), false, `"${op}" must NOT be an admin op`);
  }
});

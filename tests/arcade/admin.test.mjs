/**
 * Phase 2b — admin gating (dev flag + token) + room status model.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAdmin, adminEnabled, isAdminOp, ADMIN_OPS } from '../../workers/arcade/src/admin.mjs';
import {
  ROOM_STATUSES, isRoomStatus, isJoinableStatus, effectiveStatus, roomListPayload, roomMetaPayload,
} from '../../workers/arcade/src/rooms.mjs';

// ── admin gating ──────────────────────────────────────────────────────────────
test('admin requires BOTH the dev flag AND a configured + matching token', () => {
  // dev flag off → disabled regardless of token
  assert.equal(checkAdmin({ enabled: false, token: 't', providedToken: 't' }).reason, 'admin_disabled');
  // flag on but no server token configured → admin is off (safe default)
  assert.equal(checkAdmin({ enabled: true, token: undefined, providedToken: 't' }).reason, 'admin_not_configured');
  assert.equal(checkAdmin({ enabled: true, token: '', providedToken: 't' }).reason, 'admin_not_configured');
  // configured but caller sends nothing / wrong token
  assert.equal(checkAdmin({ enabled: true, token: 'secret', providedToken: '' }).reason, 'missing_admin_token');
  assert.equal(checkAdmin({ enabled: true, token: 'secret', providedToken: 'nope' }).reason, 'bad_admin_token');
  // both present + matching → ok
  assert.deepEqual(checkAdmin({ enabled: true, token: 'secret', providedToken: 'secret' }), { ok: true, reason: null });
});

test('adminEnabled reads the dev flag from an env-like object', () => {
  assert.equal(adminEnabled({ ADMIN_ENABLED: 'true' }), true);
  assert.equal(adminEnabled({ ADMIN_ENABLED: 'false' }), false);
  assert.equal(adminEnabled({}), false);
  assert.equal(adminEnabled(null), false);
});

test('only known admin ops are accepted (Phase 2c diagnostics + Phase 2i presentation ops)', () => {
  assert.deepEqual([...ADMIN_OPS].sort(), [
    'clear_presentation', 'diagnostics', 'presentation_diagnostics', 'preview_presentation',
    'reset', 'set_presentation', 'set_status',
  ]);
  assert.equal(isAdminOp('reset'), true);
  assert.equal(isAdminOp('set_status'), true);
  assert.equal(isAdminOp('diagnostics'), true);
  assert.equal(isAdminOp('set_presentation'), true);    // Phase 2i
  assert.equal(isAdminOp('clear_presentation'), true);  // Phase 2i
  assert.equal(isAdminOp('preview_presentation'), true);// Phase 2i
  assert.equal(isAdminOp('presentation_diagnostics'), true); // Phase 2i
  assert.equal(isAdminOp('delete_everything'), false);
});

// ── Phase 2c: admin diagnostics gating reuses the SAME both-gate as reset/status ──
test('diagnostics is gated by the same dev-flag AND token rule', () => {
  // The op is only reached after checkAdmin passes; prove the gate denies every
  // missing-credential case and allows only flag + matching token.
  assert.equal(checkAdmin({ enabled: false, token: 'secret', providedToken: 'secret' }).reason, 'admin_disabled');
  assert.equal(checkAdmin({ enabled: true, token: undefined, providedToken: 'secret' }).reason, 'admin_not_configured');
  assert.equal(checkAdmin({ enabled: true, token: 'secret', providedToken: '' }).reason, 'missing_admin_token');
  assert.equal(checkAdmin({ enabled: true, token: 'secret', providedToken: 'wrong' }).reason, 'bad_admin_token');
  assert.equal(checkAdmin({ enabled: true, token: 'secret', providedToken: 'secret' }).ok, true);
});

// ── room status model ────────────────────────────────────────────────────────
test('room statuses: open/closed/maintenance, only open is joinable', () => {
  assert.deepEqual([...ROOM_STATUSES], ['open', 'closed', 'maintenance']);
  assert.equal(isRoomStatus('maintenance'), true);
  assert.equal(isRoomStatus('exploded'), false);
  assert.equal(isJoinableStatus('open'), true);
  assert.equal(isJoinableStatus('closed'), false);
  assert.equal(isJoinableStatus('maintenance'), false);
});

test('effective status applies an admin override, else the configured status', () => {
  assert.equal(effectiveStatus('main-floor', {}), 'open');                       // configured
  assert.equal(effectiveStatus('main-floor', { 'main-floor': 'closed' }), 'closed'); // override
  assert.equal(effectiveStatus('main-floor', { 'main-floor': 'bogus' }), 'open');    // bad override ignored
  assert.equal(effectiveStatus('nope', {}), 'closed');                          // unknown room → not joinable
});

test('the room list + meta payloads reflect admin status overrides', () => {
  const list = roomListPayload({ 'neon-training': 1 }, { 'neon-training': 'maintenance' }).rooms;
  const nt = list.find((r) => r.room_id === 'neon-training');
  assert.equal(nt.status, 'maintenance');
  assert.equal(nt.population, 1);
  assert.equal(roomListPayload({}, {}).rooms.find((r) => r.room_id === 'main-floor').status, 'open');
  assert.equal(roomMetaPayload('main-floor', 0, { 'main-floor': 'closed' }).status, 'closed');
});

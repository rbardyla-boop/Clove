/**
 * Phase 3A — production config safety gate, as a unit test.
 *
 * Wraps tests/arcade/check-production-config.mjs so the production-deploy safety
 * assertions run inside the standard `node --test tests/arcade/*.test.mjs` gate.
 * Each individual safety assertion is surfaced as its own subtest so a failure
 * points straight at the unsafe setting.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runProductionConfigChecks } from './check-production-config.mjs';

test('production deploy config is safe (no dev/test controls live)', async (t) => {
  const { ok, results } = runProductionConfigChecks();
  assert.ok(results.length > 0, 'expected at least one config check to run');
  for (const r of results) {
    await t.test(r.name, () => {
      assert.ok(r.ok, r.detail || r.name);
    });
  }
  assert.ok(ok, 'production config check must pass overall');
});

// A SAFE production env block, re-used as the base for the negative cases below.
const SAFE_TOML = `
[env.production.vars]
ENVIRONMENT = "production"
ADMIN_ENABLED = "false"
EVENT_PREROLL_LEAD_MS = "120000"
EVENT_COUNTDOWN_REFRESH_MS = "1000"
EVENT_SHOW_NEXT = "true"
EVENT_SHOW_FEATURED = "true"

[env.production.durable_objects]
bindings = [
  { name = "ARCADE_ROOM", class_name = "ArcadeRoom" },
  { name = "ROOM_REGISTRY", class_name = "RoomRegistry" }
]

[[env.production.migrations]]
tag = "v1"
new_sqlite_classes = ["ArcadeRoom"]

[[env.production.migrations]]
tag = "v2"
new_sqlite_classes = ["RoomRegistry"]
`;
const SAFE_ARCADE_ROOM = 'case "__test_set_event_now": { if (this.env.ENVIRONMENT === "development") { doThing(); } break; }';

const named = (toml, arcadeRoom = SAFE_ARCADE_ROOM) =>
  Object.fromEntries(runProductionConfigChecks({ toml, arcadeRoom }).results.map((r) => [r.name, r.ok]));

test('gate is not vacuous — synthetic SAFE config passes', () => {
  const { ok } = runProductionConfigChecks({ toml: SAFE_TOML, arcadeRoom: SAFE_ARCADE_ROOM });
  assert.equal(ok, true);
});

test('gate CATCHES ENVIRONMENT=development', () => {
  const r = named(SAFE_TOML.replace('ENVIRONMENT = "production"', 'ENVIRONMENT = "development"'));
  assert.equal(r['ENVIRONMENT is production (not development)'], false);
});

test('gate CATCHES ADMIN_ENABLED=true', () => {
  const r = named(SAFE_TOML.replace('ADMIN_ENABLED = "false"', 'ADMIN_ENABLED = "true"'));
  assert.equal(r['ADMIN_ENABLED is false'], false);
});

test('gate CATCHES a committed ADMIN_TOKEN secret', () => {
  const r = named(SAFE_TOML + '\nADMIN_TOKEN = "super-secret"\n');
  assert.equal(r['no ADMIN_TOKEN committed in wrangler.toml'], false);
});

test('gate CATCHES an out-of-range EVENT_* value (silent clamp)', () => {
  const r = named(SAFE_TOML.replace('EVENT_PREROLL_LEAD_MS = "120000"', 'EVENT_PREROLL_LEAD_MS = "5"'));
  assert.equal(r['EVENT_PREROLL_LEAD_MS within clamp bounds'], false);
});

test('gate CATCHES a missing production DO binding', () => {
  const r = named(SAFE_TOML.replace(/{ name = "ROOM_REGISTRY"[^}]*}/, ''));
  assert.equal(r['production re-declares RoomRegistry DO binding'], false);
});

test('gate CATCHES an un-gated test-clock hook', () => {
  const r = named(SAFE_TOML, 'case "__test_set_event_now": { doThing(); break; }');
  assert.equal(r['__test_set_event_now is dev-gated in arcade-room.ts'], false);
});

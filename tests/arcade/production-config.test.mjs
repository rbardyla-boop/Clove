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
  { name = "ROOM_REGISTRY", class_name = "RoomRegistry" },
  { name = "CITY_ROOM", class_name = "CityRoom" },
  { name = "CITY_REGISTRY", class_name = "CityRegistry" }
]

[[env.production.migrations]]
tag = "v1"
new_sqlite_classes = ["ArcadeRoom"]

[[env.production.migrations]]
tag = "v2"
new_sqlite_classes = ["RoomRegistry"]

[[env.production.migrations]]
tag = "v3"
new_sqlite_classes = ["CityRoom"]

[[env.production.migrations]]
tag = "v4"
new_sqlite_classes = ["CityRegistry"]

[env.staging.vars]
ENVIRONMENT = "staging"
ADMIN_ENABLED = "false"
EVENT_PREROLL_LEAD_MS = "120000"
EVENT_COUNTDOWN_REFRESH_MS = "1000"
EVENT_SHOW_NEXT = "true"
EVENT_SHOW_FEATURED = "true"

[env.staging.durable_objects]
bindings = [
  { name = "ARCADE_ROOM", class_name = "ArcadeRoom" },
  { name = "ROOM_REGISTRY", class_name = "RoomRegistry" },
  { name = "CITY_ROOM", class_name = "CityRoom" },
  { name = "CITY_REGISTRY", class_name = "CityRegistry" }
]

[[env.staging.migrations]]
tag = "v1"
new_sqlite_classes = ["ArcadeRoom"]

[[env.staging.migrations]]
tag = "v2"
new_sqlite_classes = ["RoomRegistry"]

[[env.staging.migrations]]
tag = "v3"
new_sqlite_classes = ["CityRoom"]

[[env.staging.migrations]]
tag = "v4"
new_sqlite_classes = ["CityRegistry"]
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

// ── staging (enforce-if-present): no deployable named env may ship development ──
test('gate CATCHES staging ENVIRONMENT=development', () => {
  // Replace the staging value specifically (production stays "production").
  const r = named(SAFE_TOML.replace('ENVIRONMENT = "staging"', 'ENVIRONMENT = "development"'));
  assert.equal(r['staging ENVIRONMENT is not development'], false);
});

test('gate CATCHES a missing staging DO binding', () => {
  // Drop the staging ROOM_REGISTRY binding (the staging block is second in SAFE_TOML).
  const idx = SAFE_TOML.indexOf('[env.staging.durable_objects]');
  const broken = SAFE_TOML.slice(0, idx) + SAFE_TOML.slice(idx).replace(/{ name = "ROOM_REGISTRY"[^}]*}/, '');
  const r = named(broken);
  assert.equal(r['staging re-declares all DO bindings'], false);
});

test('gate CATCHES a missing CityRoom production binding (Phase 4A)', () => {
  const noBinding = named(SAFE_TOML.replace(/{ name = "CITY_ROOM"[^}]*}/, ''));
  assert.equal(noBinding['production re-declares CityRoom DO binding'], false);
});

test('staging checks are skipped when no [env.staging] exists (optional env)', () => {
  // SAFE_TOML minus the staging section → only production checks run, still PASS.
  const prodOnly = SAFE_TOML.slice(0, SAFE_TOML.indexOf('[env.staging.vars]'));
  const { ok, results } = runProductionConfigChecks({ toml: prodOnly, arcadeRoom: SAFE_ARCADE_ROOM });
  assert.equal(ok, true);
  assert.equal(results.some((r) => r.name.startsWith('staging ')), false);
});

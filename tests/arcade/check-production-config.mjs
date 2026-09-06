/**
 * Phase 3A — production config safety gate (deploy pre-flight).
 *
 * A deterministic, dependency-free check that FAILS if the production deploy
 * configuration would ship test/development controls live. Run it before any
 * `wrangler deploy --env production`:
 *
 *     node tests/arcade/check-production-config.mjs
 *
 * Exits 0 when production config is safe, 1 (with a report) when it is not.
 * The same checks run inside the unit gate via production-config.test.mjs.
 *
 * What it proves (the Phase 2i deployment blockers):
 *   * `[env.production].ENVIRONMENT` is "production", never "development" — so the
 *     `__test_set_event_now` event-clock hook (dev-gated in arcade-room.ts) is rejected.
 *   * `[env.production].ADMIN_ENABLED` is "false" — admin/live-ops surface off by default.
 *   * No ADMIN_TOKEN secret is committed to wrangler.toml.
 *   * EVENT_* display-only values are within the server's clamp bounds (no silent clamping).
 *   * The production environment still re-declares both Durable Object bindings + their
 *     SQLite migrations (named envs do not inherit them).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveEventPresentation, PRESENTATION_BOUNDS } from '../../workers/arcade/src/room-events.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WRANGLER_PATH = join(ROOT, 'workers/arcade/wrangler.toml');
const ARCADE_ROOM_PATH = join(ROOT, 'workers/arcade/src/arcade-room.ts');

/** Body text of a TOML table `[header]`, up to the next `[` header (or EOF). */
function tableBody(toml, header) {
  const esc = header.replace(/[.[\]]/g, (c) => `\\${c}`);
  const m = toml.match(new RegExp(`(?:^|\\n)\\[${esc}\\][ \\t]*\\n([\\s\\S]*?)(?=\\n\\[|$)`));
  return m ? m[1] : null;
}
/** Text for one migration scope, excluding later named environments. */
function migrationBody(toml, env) {
  const marker = env === 'base' ? '[[migrations]]' : `[[env.${env}.migrations]]`;
  const start = toml.indexOf(marker);
  if (start < 0) return '';
  const tail = toml.slice(start);
  const nextEnvironment = tail.search(/\n\[env\./);
  return nextEnvironment < 0 ? tail : tail.slice(0, nextEnvironment);
}
/** Require the class and tag to occur in the same migration array block. */
function hasMigrationAtTag(migrations, tag, className) {
  return migrations
    .split(/\n(?=\[\[[^\]]*migrations\]\])/)
    .some((block) => new RegExp(`tag\\s*=\\s*"${tag}"`).test(block)
      && new RegExp(`new_sqlite_classes\\s*=\\s*\\[[^\\]]*"${className}"[^\\]]*\\]`).test(block));
}
/** Value of a quoted `key = "value"` assignment on a non-comment line within `body`. */
function tomlString(body, key) {
  if (!body) return undefined;
  const m = body.match(new RegExp(`(?:^|\\n)[ \\t]*${key}[ \\t]*=[ \\t]*"([^"]*)"`));
  return m ? m[1] : undefined;
}

/**
 * Run every production-config safety assertion. Returns { ok, results: [{ name,
 * ok, detail }] }. By default it reads the real wrangler.toml + arcade-room.ts;
 * pass `{ toml, arcadeRoom }` to assert against synthetic sources (used by the
 * negative tests that prove the gate actually catches an unsafe config).
 */
export function runProductionConfigChecks(sources = {}) {
  const results = [];
  const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail });

  let toml = sources.toml;
  let arcadeRoom = sources.arcadeRoom;
  if (toml == null) { try { toml = readFileSync(WRANGLER_PATH, 'utf8'); } catch (e) { toml = ''; } }
  if (arcadeRoom == null) { try { arcadeRoom = readFileSync(ARCADE_ROOM_PATH, 'utf8'); } catch (e) { arcadeRoom = ''; } }

  const prodVars = tableBody(toml, 'env.production.vars');
  check('production env block exists', !!prodVars,
    prodVars ? 'found [env.production.vars]' : 'MISSING [env.production.vars] — production would ship dev defaults');

  const environment = tomlString(prodVars, 'ENVIRONMENT');
  check('ENVIRONMENT is production (not development)',
    environment === 'production',
    `ENVIRONMENT="${environment}" (must be "production")`);

  const adminEnabled = tomlString(prodVars, 'ADMIN_ENABLED');
  check('ADMIN_ENABLED is false',
    adminEnabled === 'false',
    `ADMIN_ENABLED="${adminEnabled}" (must be "false")`);

  // No committed admin secret. A commented mention (# ... ADMIN_TOKEN ...) is fine;
  // only an actual non-comment assignment is a leak.
  const adminTokenAssigned = toml
    .split('\n')
    .some((line) => /^[ \t]*ADMIN_TOKEN[ \t]*=/.test(line));
  check('no ADMIN_TOKEN committed in wrangler.toml', !adminTokenAssigned,
    adminTokenAssigned ? 'ADMIN_TOKEN is assigned in wrangler.toml — rotate + remove (use `wrangler secret put`)' : 'no committed secret');

  // EVENT_* display-only values must already be within clamp bounds (resolve == input).
  const eventChecks = [
    ['EVENT_PREROLL_LEAD_MS', 'preroll_lead_ms', PRESENTATION_BOUNDS.preroll_lead_ms],
    ['EVENT_COUNTDOWN_REFRESH_MS', 'countdown_refresh_ms', PRESENTATION_BOUNDS.countdown_refresh_ms],
  ];
  for (const [envKey, resolvedKey, bounds] of eventChecks) {
    const raw = tomlString(prodVars, envKey);
    const n = Number(raw);
    const resolved = resolveEventPresentation({ [resolvedKey]: raw })[resolvedKey];
    const inBounds = Number.isFinite(n) && n === resolved;
    check(`${envKey} within clamp bounds`, inBounds,
      `${envKey}="${raw}" resolves to ${resolved} (safe range ${bounds.min}..${bounds.max})`);
  }
  for (const envKey of ['EVENT_SHOW_NEXT', 'EVENT_SHOW_FEATURED']) {
    const raw = tomlString(prodVars, envKey);
    check(`${envKey} is a boolean string`, raw === 'true' || raw === 'false',
      `${envKey}="${raw}" (must be "true"|"false")`);
  }

  const baseMigrations = migrationBody(toml, 'base');
  check('base declares HiveRoom v5 migration', hasMigrationAtTag(baseMigrations, 'v5', 'HiveRoom'),
    baseMigrations ? 'v5 HiveRoom migration present' : 'MISSING [[migrations]] v5');
  check('base declares PaperFirmRoom v6 migration', hasMigrationAtTag(baseMigrations, 'v6', 'PaperFirmRoom'),
    baseMigrations ? 'v6 PaperFirmRoom migration present' : 'MISSING [[migrations]] v6');

  // Named environments do not inherit bindings/migrations — production must re-declare them.
  const prodDo = tableBody(toml, 'env.production.durable_objects') || '';
  check('production re-declares ArcadeRoom DO binding', /class_name\s*=\s*"ArcadeRoom"/.test(prodDo),
    prodDo ? 'ArcadeRoom binding present' : 'MISSING ArcadeRoom in [env.production.durable_objects]');
  check('production re-declares RoomRegistry DO binding', /class_name\s*=\s*"RoomRegistry"/.test(prodDo),
    prodDo ? 'RoomRegistry binding present' : 'MISSING RoomRegistry in [env.production.durable_objects]');
  // Phase 4A: the isolated city-block DO must also be re-declared in production.
  check('production re-declares CityRoom DO binding', /class_name\s*=\s*"CityRoom"/.test(prodDo),
    prodDo ? 'CityRoom binding present' : 'MISSING CityRoom in [env.production.durable_objects]');
  // Phase 5C: the city-block presence coordinator DO must also be re-declared in production.
  check('production re-declares CityRegistry DO binding', /class_name\s*=\s*"CityRegistry"/.test(prodDo),
    prodDo ? 'CityRegistry binding present' : 'MISSING CityRegistry in [env.production.durable_objects]');
  check('production re-declares HiveRoom DO binding', /class_name\s*=\s*"HiveRoom"/.test(prodDo),
    prodDo ? 'HiveRoom binding present' : 'MISSING HiveRoom in [env.production.durable_objects]');
  check('production re-declares PaperFirmRoom DO binding', /class_name\s*=\s*"PaperFirmRoom"/.test(prodDo),
    prodDo ? 'PaperFirmRoom binding present' : 'MISSING PaperFirmRoom in [env.production.durable_objects]');

  const prodMigrations = migrationBody(toml, 'production');
  check('production re-declares ArcadeRoom v1 migration', hasMigrationAtTag(prodMigrations, 'v1', 'ArcadeRoom'),
    prodMigrations ? 'v1 ArcadeRoom migration present' : 'MISSING [[env.production.migrations]] v1');
  check('production re-declares RoomRegistry v2 migration', hasMigrationAtTag(prodMigrations, 'v2', 'RoomRegistry'),
    prodMigrations ? 'v2 RoomRegistry migration present' : 'MISSING [[env.production.migrations]] v2');
  check('production re-declares CityRoom v3 migration', hasMigrationAtTag(prodMigrations, 'v3', 'CityRoom'),
    prodMigrations ? 'v3 CityRoom migration present' : 'MISSING [[env.production.migrations]] v3');
  check('production re-declares CityRegistry v4 migration', hasMigrationAtTag(prodMigrations, 'v4', 'CityRegistry'),
    prodMigrations ? 'v4 CityRegistry migration present' : 'MISSING [[env.production.migrations]] v4');
  check('production re-declares HiveRoom v5 migration', hasMigrationAtTag(prodMigrations, 'v5', 'HiveRoom'),
    prodMigrations ? 'v5 HiveRoom migration present' : 'MISSING [[env.production.migrations]] v5');
  check('production re-declares PaperFirmRoom v6 migration', hasMigrationAtTag(prodMigrations, 'v6', 'PaperFirmRoom'),
    prodMigrations ? 'v6 PaperFirmRoom migration present' : 'MISSING [[env.production.migrations]] v6');

  // The test-clock hook must stay dev-gated in code, so ENVIRONMENT=production rejects it.
  const hookDevGated = /case\s+"__test_set_event_now"\s*:\s*{[\s\S]*?env\.ENVIRONMENT\s*===\s*"development"/.test(arcadeRoom);
  check('__test_set_event_now is dev-gated in arcade-room.ts', hookDevGated,
    hookDevGated ? 'hook guarded by ENVIRONMENT === "development"' : 'test-clock hook is NOT dev-gated — would be live in production');

  // ── staging (enforce-if-present): the pre-production smoke target must ALSO never ──
  // ship ENVIRONMENT=development, so NO deployable named env can expose the test hook.
  // Staging is optional; these checks only run when [env.staging.vars] exists.
  const stagingVars = tableBody(toml, 'env.staging.vars');
  if (stagingVars != null) {
    const stagingEnv = tomlString(stagingVars, 'ENVIRONMENT');
    check('staging ENVIRONMENT is not development',
      typeof stagingEnv === 'string' && stagingEnv.length > 0 && stagingEnv !== 'development',
      `ENVIRONMENT="${stagingEnv}" (must be a non-"development" value, e.g. "staging")`);

    const stagingAdmin = tomlString(stagingVars, 'ADMIN_ENABLED');
    check('staging ADMIN_ENABLED is false', stagingAdmin === 'false',
      `ADMIN_ENABLED="${stagingAdmin}" (must be "false")`);

    for (const [envKey, resolvedKey, bounds] of eventChecks) {
      const raw = tomlString(stagingVars, envKey);
      const n = Number(raw);
      const resolved = resolveEventPresentation({ [resolvedKey]: raw })[resolvedKey];
      check(`staging ${envKey} within clamp bounds`, Number.isFinite(n) && n === resolved,
        `${envKey}="${raw}" resolves to ${resolved} (safe range ${bounds.min}..${bounds.max})`);
    }

    const stagingDo = tableBody(toml, 'env.staging.durable_objects') || '';
    check('staging re-declares all DO bindings',
      /class_name\s*=\s*"ArcadeRoom"/.test(stagingDo) && /class_name\s*=\s*"RoomRegistry"/.test(stagingDo)
        && /class_name\s*=\s*"CityRoom"/.test(stagingDo) && /class_name\s*=\s*"CityRegistry"/.test(stagingDo)
        && /class_name\s*=\s*"HiveRoom"/.test(stagingDo) && /class_name\s*=\s*"PaperFirmRoom"/.test(stagingDo),
      stagingDo ? 'ArcadeRoom + RoomRegistry + CityRoom + CityRegistry + HiveRoom + PaperFirmRoom present' : 'MISSING [env.staging.durable_objects]');

    const stagingMig = migrationBody(toml, 'staging');
    check('staging re-declares all DO migrations',
      hasMigrationAtTag(stagingMig, 'v1', 'ArcadeRoom')
        && hasMigrationAtTag(stagingMig, 'v2', 'RoomRegistry')
        && hasMigrationAtTag(stagingMig, 'v3', 'CityRoom')
        && hasMigrationAtTag(stagingMig, 'v4', 'CityRegistry')
        && hasMigrationAtTag(stagingMig, 'v5', 'HiveRoom')
        && hasMigrationAtTag(stagingMig, 'v6', 'PaperFirmRoom'),
      stagingMig ? 'v1 + v2 + v3 + v4 + v5 + v6 present' : 'MISSING [[env.staging.migrations]]');
  }

  return { ok: results.every((r) => r.ok), results };
}

// Run as a standalone deploy gate when invoked directly.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { ok, results } = runProductionConfigChecks();
  for (const r of results) {
    process.stdout.write(`${r.ok ? 'ok  ' : 'FAIL'}  ${r.name}${r.detail ? `  — ${r.detail}` : ''}\n`);
  }
  process.stdout.write(`\nPRODUCTION CONFIG CHECK: ${ok ? 'PASS' : 'FAIL'}\n`);
  process.exit(ok ? 0 : 1);
}

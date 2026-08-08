var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/cost-authority.ts
import { DurableObject } from "cloudflare:workers";

// ../../agent/cost-constitution.json
var cost_constitution_default = {
  name: "CLOVE_RESEARCH_COST_CONSTITUTION",
  version: 1,
  scope: "clove-research-beta",
  release: {
    required_plan: "workers_free",
    maximum_paid_usd: 0,
    budget_period: "utc_day",
    reserve_fraction: 0.9,
    over_limit_behavior: "fail_closed",
    allowed_services: [
      "workers",
      "d1",
      "workers_ai",
      "browser_run",
      "durable_objects"
    ]
  },
  resources: {
    worker_requests: {
      unit: "requests_per_utc_day",
      cloudflare_limit: 1e5,
      clove_hard_limit: 9e4,
      default_reservation: 1
    },
    ai_neurons: {
      unit: "neurons_per_utc_day",
      cloudflare_limit: 1e4,
      clove_hard_limit: 9e3,
      default_reservation: 900
    },
    browser_ms: {
      unit: "milliseconds_per_utc_day",
      cloudflare_limit: 6e5,
      clove_hard_limit: 54e4,
      default_reservation: 6e4
    },
    d1_rows_read: {
      unit: "rows_per_utc_day",
      cloudflare_limit: 5e6,
      clove_hard_limit: 45e5,
      default_reservation: 250
    },
    d1_rows_written: {
      unit: "rows_per_utc_day",
      cloudflare_limit: 1e5,
      clove_hard_limit: 9e4,
      default_reservation: 25
    },
    d1_storage_bytes: {
      unit: "bytes_total",
      cloudflare_limit: 5e9,
      clove_hard_limit: 45e8,
      default_reservation: 0
    }
  },
  operation_costs: {
    cached_evidence: {
      d1_rows_read: 10,
      d1_rows_written: 0,
      ai_neurons: 0,
      browser_ms: 0
    },
    deep_research: {
      d1_rows_read: 250,
      d1_rows_written: 25,
      ai_neurons: 900,
      browser_ms: 0
    },
    browser_source: {
      d1_rows_read: 0,
      d1_rows_written: 0,
      ai_neurons: 0,
      browser_ms: 6e4
    }
  },
  hard_stop: {
    new_research_response_status: 429,
    new_research_response_code: "research_capacity_exhausted",
    existing_evidence_remains_available: true,
    must_not_call_after_refusal: [
      "workers_ai",
      "browser_run",
      "d1_write"
    ]
  },
  sources: {
    worker_requests: "https://developers.cloudflare.com/workers/platform/limits/",
    ai_neurons: "https://developers.cloudflare.com/workers-ai/platform/pricing/",
    browser_ms: "https://developers.cloudflare.com/browser-run/pricing/",
    d1: "https://developers.cloudflare.com/d1/platform/pricing/",
    durable_objects: "https://developers.cloudflare.com/durable-objects/"
  }
};

// src/cost-authority.ts
var RESOURCE_NAMES = [
  "worker_requests",
  "ai_neurons",
  "browser_ms",
  "d1_rows_read",
  "d1_rows_written",
  "d1_storage_bytes"
];
var RESERVABLE_RESOURCES = [
  "ai_neurons",
  "browser_ms",
  "d1_rows_read",
  "d1_rows_written",
  "d1_storage_bytes"
];
var DEFAULT_TTL_MS = 15 * 60 * 1e3;
var MAX_TTL_MS = 60 * 60 * 1e3;
var DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
var OPERATION_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
function column(resource, kind) {
  return `${resource}_${kind}`;
}
__name(column, "column");
function emptyUsage() {
  return Object.fromEntries(RESOURCE_NAMES.map((resource) => [resource, 0]));
}
__name(emptyUsage, "emptyUsage");
function copyCosts(costs) {
  return Object.freeze({ ...costs });
}
__name(copyCosts, "copyCosts");
function jsonCosts(costs) {
  return JSON.stringify(
    Object.fromEntries(RESERVABLE_RESOURCES.map((resource) => [resource, costs[resource] ?? 0]))
  );
}
__name(jsonCosts, "jsonCosts");
function parseCosts(value) {
  if (value === "{}") return {};
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid_stored_costs");
  return normalizeCosts(parsed, true);
}
__name(parseCosts, "parseCosts");
function assertDayKey(dayKey) {
  if (typeof dayKey !== "string" || !DAY_KEY_PATTERN.test(dayKey)) throw new Error("invalid_day_key");
  const date = /* @__PURE__ */ new Date(`${dayKey}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== dayKey) throw new Error("invalid_day_key");
}
__name(assertDayKey, "assertDayKey");
function assertOperationId(operationId) {
  if (typeof operationId !== "string" || !OPERATION_ID_PATTERN.test(operationId)) throw new Error("invalid_operation_id");
}
__name(assertOperationId, "assertOperationId");
function normalizeCosts(value, allowEmpty = false) {
  const normalized = {};
  for (const key of Object.keys(value)) {
    if (!RESERVABLE_RESOURCES.includes(key)) throw new Error("invalid_cost_resource");
    const amount = value[key];
    if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("invalid_cost_amount");
    if (amount > 0) normalized[key] = amount;
  }
  if (Object.keys(normalized).length === 0 && !allowEmpty) throw new Error("empty_costs");
  return normalized;
}
__name(normalizeCosts, "normalizeCosts");
function ttlMs(value) {
  if (value === void 0) return DEFAULT_TTL_MS;
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_TTL_MS) throw new Error("invalid_reservation_ttl");
  return value;
}
__name(ttlMs, "ttlMs");
function currentDayKey() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
__name(currentDayKey, "currentDayKey");
var CostAuthority = class extends DurableObject {
  static {
    __name(this, "CostAuthority");
  }
  constructor(ctx, env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS authority_meta (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS budget_ledger (
          day_key TEXT PRIMARY KEY,
          worker_requests_used INTEGER NOT NULL DEFAULT 0,
          worker_requests_reserved INTEGER NOT NULL DEFAULT 0,
          ai_neurons_used INTEGER NOT NULL DEFAULT 0,
          ai_neurons_reserved INTEGER NOT NULL DEFAULT 0,
          browser_ms_used INTEGER NOT NULL DEFAULT 0,
          browser_ms_reserved INTEGER NOT NULL DEFAULT 0,
          d1_rows_read_used INTEGER NOT NULL DEFAULT 0,
          d1_rows_read_reserved INTEGER NOT NULL DEFAULT 0,
          d1_rows_written_used INTEGER NOT NULL DEFAULT 0,
          d1_rows_written_reserved INTEGER NOT NULL DEFAULT 0,
          d1_storage_bytes_used INTEGER NOT NULL DEFAULT 0,
          d1_storage_bytes_reserved INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS reservations (
          operation_id TEXT PRIMARY KEY,
          day_key TEXT NOT NULL,
          state TEXT NOT NULL CHECK (state IN ('reserved', 'committed', 'released', 'expired')),
          reserved_json TEXT NOT NULL,
          actual_json TEXT NOT NULL DEFAULT '{}',
          expires_at INTEGER NOT NULL,
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS reservations_expiry_idx
          ON reservations(day_key, state, expires_at);
      `);
    });
  }
  async reserve(request) {
    try {
      assertDayKey(request.dayKey);
      assertOperationId(request.operationId);
      const costs = normalizeCosts(request.costs);
      const expiresAt = Date.now() + ttlMs(request.reservationTtlMs);
      this.ensureDay(request.dayKey);
      this.expireReservations(request.dayKey, Date.now());
      const existing = this.findReservation(request.operationId);
      if (existing) return this.replayReserve(existing, request.dayKey, costs);
      const ledger = this.readLedger(request.dayKey);
      const exhausted = RESERVABLE_RESOURCES.find((resource) => {
        const amount = costs[resource] ?? 0;
        const limit = cost_constitution_default.resources[resource].clove_hard_limit;
        return ledger[`${resource}_used`] + ledger[`${resource}_reserved`] + amount > limit;
      });
      if (exhausted) {
        return {
          status: "denied",
          code: "budget_exhausted",
          resource: exhausted,
          message: `Daily ${exhausted} capacity is exhausted; existing evidence remains available.`
        };
      }
      this.ctx.storage.sql.exec(
        `INSERT INTO reservations (operation_id, day_key, state, reserved_json, actual_json, expires_at, created_at)
         VALUES (?, ?, 'reserved', ?, '{}', ?, ?)`,
        request.operationId,
        request.dayKey,
        jsonCosts(costs),
        expiresAt,
        Date.now()
      );
      this.adjustReserved(request.dayKey, costs, 1);
      return { status: "approved", dayKey: request.dayKey, operationId: request.operationId, reserved: copyCosts(costs), expiresAt };
    } catch (error) {
      return this.invalidRequest(error);
    }
  }
  async commit(request) {
    try {
      assertDayKey(request.dayKey);
      assertOperationId(request.operationId);
      const actualUsage = normalizeCosts(request.actualUsage, true);
      this.ensureDay(request.dayKey);
      this.expireReservations(request.dayKey, Date.now());
      const existing = this.findReservation(request.operationId);
      if (!existing || existing.dayKey !== request.dayKey) {
        return { status: "denied", code: "invalid_request", message: "Reservation was not found." };
      }
      if (existing.state === "committed") {
        return { status: "already_committed", dayKey: request.dayKey, operationId: request.operationId, actualUsage: copyCosts(existing.actualUsage) };
      }
      if (existing.state !== "reserved") {
        return { status: "denied", code: "invalid_request", message: `Reservation is ${existing.state}.` };
      }
      if (RESERVABLE_RESOURCES.some((resource) => (actualUsage[resource] ?? 0) > (existing.reserved[resource] ?? 0))) {
        return { status: "denied", code: "invalid_request", message: "Actual usage exceeds the reservation; reserve more before spending." };
      }
      this.adjustReserved(request.dayKey, existing.reserved, -1);
      this.adjustUsed(request.dayKey, actualUsage, 1);
      this.ctx.storage.sql.exec(
        "UPDATE reservations SET state = 'committed', actual_json = ? WHERE operation_id = ?",
        jsonCosts(actualUsage),
        request.operationId
      );
      return { status: "committed", dayKey: request.dayKey, operationId: request.operationId, actualUsage: copyCosts(actualUsage) };
    } catch (error) {
      return this.invalidRequest(error);
    }
  }
  async release(request) {
    try {
      assertDayKey(request.dayKey);
      assertOperationId(request.operationId);
      this.ensureDay(request.dayKey);
      this.expireReservations(request.dayKey, Date.now());
      const existing = this.findReservation(request.operationId);
      if (!existing || existing.dayKey !== request.dayKey) {
        return { status: "denied", code: "invalid_request", message: "Reservation was not found." };
      }
      if (existing.state === "reserved") {
        this.adjustReserved(request.dayKey, existing.reserved, -1);
        this.ctx.storage.sql.exec("UPDATE reservations SET state = 'released' WHERE operation_id = ?", request.operationId);
        return { status: "released", dayKey: request.dayKey, operationId: request.operationId };
      }
      if (existing.state === "committed") return { status: "already_committed", dayKey: request.dayKey, operationId: request.operationId };
      if (existing.state === "expired") return { status: "already_expired", dayKey: request.dayKey, operationId: request.operationId };
      return { status: "already_released", dayKey: request.dayKey, operationId: request.operationId };
    } catch (error) {
      return this.invalidRequest(error);
    }
  }
  async recoverExpired(dayKey) {
    assertDayKey(dayKey);
    this.ensureDay(dayKey);
    const recovered = this.expireReservations(dayKey, Date.now());
    return { dayKey, recovered };
  }
  async snapshot(dayKey) {
    assertDayKey(dayKey);
    this.ensureDay(dayKey);
    this.expireReservations(dayKey, Date.now());
    const row = this.readLedger(dayKey);
    const usage = emptyUsage();
    const reserved = emptyUsage();
    for (const resource of RESOURCE_NAMES) {
      usage[resource] = row[`${resource}_used`];
      reserved[resource] = row[`${resource}_reserved`];
    }
    const active = this.ctx.storage.sql.exec(
      "SELECT COUNT(*) AS count FROM reservations WHERE day_key = ? AND state = 'reserved'",
      dayKey
    ).one();
    return { dayKey, usage, reserved, activeReservations: active.count };
  }
  async reservation(dayKey, operationId) {
    assertDayKey(dayKey);
    assertOperationId(operationId);
    this.ensureDay(dayKey);
    this.expireReservations(dayKey, Date.now());
    const found = this.findReservation(operationId);
    return found && found.dayKey === dayKey ? found : null;
  }
  ensureDay(dayKey) {
    const metadata = this.ctx.storage.sql.exec(
      "SELECT value FROM authority_meta WHERE key = 'day_key'"
    ).toArray();
    if (metadata.length === 0) {
      this.ctx.storage.sql.exec("INSERT INTO authority_meta (key, value) VALUES ('day_key', ?)", dayKey);
    } else if (metadata[0].value !== dayKey) {
      throw new Error("day_ledger_mismatch");
    }
    this.ctx.storage.sql.exec(
      `INSERT INTO budget_ledger (day_key) VALUES (?) ON CONFLICT(day_key) DO NOTHING`,
      dayKey
    );
  }
  readLedger(dayKey) {
    const row = this.ctx.storage.sql.exec(
      "SELECT * FROM budget_ledger WHERE day_key = ?",
      dayKey
    ).one();
    const values = {};
    for (const resource of RESOURCE_NAMES) {
      values[`${resource}_used`] = Number(row[`${resource}_used`] ?? 0);
      values[`${resource}_reserved`] = Number(row[`${resource}_reserved`] ?? 0);
    }
    return values;
  }
  adjustReserved(dayKey, costs, direction) {
    this.adjustLedger(dayKey, costs, "reserved", direction);
  }
  adjustUsed(dayKey, costs, direction) {
    this.adjustLedger(dayKey, costs, "used", direction);
  }
  adjustLedger(dayKey, costs, kind, direction) {
    const changes = RESERVABLE_RESOURCES.filter((resource) => (costs[resource] ?? 0) !== 0).map((resource) => `${column(resource, kind)} = ${column(resource, kind)} ${direction === 1 ? "+" : "-"} ?`);
    const values = RESERVABLE_RESOURCES.filter((resource) => (costs[resource] ?? 0) !== 0).map((resource) => costs[resource]);
    if (changes.length === 0) return;
    this.ctx.storage.sql.exec(
      `UPDATE budget_ledger SET ${changes.join(", ")} WHERE day_key = ?`,
      ...values,
      dayKey
    );
  }
  findReservation(operationId) {
    const rows = this.ctx.storage.sql.exec(
      "SELECT operation_id, day_key, state, reserved_json, actual_json, expires_at FROM reservations WHERE operation_id = ?",
      operationId
    ).toArray();
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      operationId: String(row.operation_id),
      dayKey: String(row.day_key),
      state: String(row.state),
      reserved: parseCosts(String(row.reserved_json)),
      actualUsage: parseCosts(String(row.actual_json)),
      expiresAt: Number(row.expires_at)
    };
  }
  replayReserve(existing, dayKey, costs) {
    if (existing.dayKey !== dayKey || jsonCosts(existing.reserved) !== jsonCosts(costs)) {
      return { status: "denied", code: "operation_id_conflict", message: "operationId is already bound to a different reservation." };
    }
    if (existing.state === "reserved") {
      return { status: "approved", dayKey, operationId: existing.operationId, reserved: copyCosts(existing.reserved), expiresAt: existing.expiresAt };
    }
    if (existing.state === "committed") return { status: "already_committed", dayKey, operationId: existing.operationId, actualUsage: copyCosts(existing.actualUsage) };
    if (existing.state === "expired") return { status: "already_expired", dayKey, operationId: existing.operationId };
    return { status: "already_released", dayKey, operationId: existing.operationId };
  }
  expireReservations(dayKey, now) {
    const rows = this.ctx.storage.sql.exec(
      "SELECT operation_id, reserved_json FROM reservations WHERE day_key = ? AND state = 'reserved' AND expires_at <= ? LIMIT 1000",
      dayKey,
      now
    ).toArray();
    for (const row of rows) {
      const costs = parseCosts(String(row.reserved_json));
      this.adjustReserved(dayKey, costs, -1);
      this.ctx.storage.sql.exec("UPDATE reservations SET state = 'expired' WHERE operation_id = ?", String(row.operation_id));
    }
    return rows.length;
  }
  invalidRequest(error) {
    const message = error instanceof Error ? error.message : "invalid_request";
    return { status: "denied", code: "invalid_request", message };
  }
};

// src/client.ts
function utcDayKey(now = /* @__PURE__ */ new Date()) {
  return now.toISOString().slice(0, 10);
}
__name(utcDayKey, "utcDayKey");
function authorityForDay(env, dayKey = utcDayKey()) {
  return env.COST_AUTHORITY.getByName(`clove-cost-${dayKey}`);
}
__name(authorityForDay, "authorityForDay");
async function reserveBeforeSpend(env, request) {
  const dayKey = request.dayKey ?? utcDayKey();
  return authorityForDay(env, dayKey).reserve({ ...request, dayKey });
}
__name(reserveBeforeSpend, "reserveBeforeSpend");
async function runReservedSpend(env, request) {
  const dayKey = request.dayKey ?? utcDayKey();
  const stub = authorityForDay(env, dayKey);
  const reservation = await stub.reserve({
    dayKey,
    operationId: request.operationId,
    costs: request.costs
  });
  if (reservation.status !== "approved") return { status: "denied", reservation };
  try {
    const value = await request.execute();
    const commitRequest = {
      dayKey,
      operationId: request.operationId,
      actualUsage: request.actualUsage(value)
    };
    const committed = await stub.commit(commitRequest);
    if (committed.status !== "committed" && committed.status !== "already_committed") {
      await stub.release({ dayKey, operationId: request.operationId });
      return { status: "denied", reservation: committed };
    }
    return { status: "committed", value };
  } catch (error) {
    await stub.release({ dayKey, operationId: request.operationId });
    throw error;
  }
}
__name(runReservedSpend, "runReservedSpend");

// src/index.ts
var index_default = {
  async fetch() {
    return Response.json({ ok: false, code: "internal_only" }, { status: 404 });
  }
};
export {
  CostAuthority,
  authorityForDay,
  currentDayKey,
  index_default as default,
  reserveBeforeSpend,
  runReservedSpend,
  utcDayKey
};
//# sourceMappingURL=index.js.map

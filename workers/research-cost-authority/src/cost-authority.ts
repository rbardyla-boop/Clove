import { DurableObject } from 'cloudflare:workers';
import constitution from '../../../agent/cost-constitution.json' with { type: 'json' };

const RESOURCE_NAMES = [
  'worker_requests',
  'ai_neurons',
  'browser_ms',
  'd1_rows_read',
  'd1_rows_written',
  'd1_storage_bytes',
] as const;

const RESERVABLE_RESOURCES = [
  'ai_neurons',
  'browser_ms',
  'd1_rows_read',
  'd1_rows_written',
  'd1_storage_bytes',
] as const;

type ResourceName = typeof RESOURCE_NAMES[number];
type ReservableResource = typeof RESERVABLE_RESOURCES[number];
type Usage = Record<ResourceName, number>;
export type ReservationCosts = Partial<Record<ReservableResource, number>>;
type ReservationState = 'reserved' | 'committed' | 'released' | 'expired';

export interface ReservationRequest {
  dayKey: string;
  operationId: string;
  costs: ReservationCosts;
  reservationTtlMs?: number;
}

export interface CommitRequest {
  dayKey: string;
  operationId: string;
  actualUsage: ReservationCosts;
}

export interface OperationRequest {
  dayKey: string;
  operationId: string;
}

export interface ReservationApproved {
  status: 'approved';
  dayKey: string;
  operationId: string;
  reserved: ReservationCosts;
  expiresAt: number;
}

export interface ReservationClosed {
  status: 'already_committed' | 'already_released' | 'already_expired';
  dayKey: string;
  operationId: string;
  actualUsage?: ReservationCosts;
}

export interface ReservationDenied {
  status: 'denied';
  code: 'budget_exhausted' | 'operation_id_conflict' | 'invalid_request';
  resource?: ResourceName;
  message: string;
}

export type ReserveResult = ReservationApproved | ReservationClosed | ReservationDenied;

export interface CommitResult {
  status: 'committed' | 'already_committed';
  dayKey: string;
  operationId: string;
  actualUsage: ReservationCosts;
}

export interface ReleaseResult {
  status: 'released' | 'already_released' | 'already_committed' | 'already_expired';
  dayKey: string;
  operationId: string;
}

export interface LedgerSnapshot {
  dayKey: string;
  usage: Usage;
  reserved: Usage;
  activeReservations: number;
}

type LedgerRow = Record<string, string | number | null>;
export type StoredReservation = {
  operationId: string;
  dayKey: string;
  state: ReservationState;
  reserved: ReservationCosts;
  actualUsage: ReservationCosts;
  expiresAt: number;
};

const DEFAULT_TTL_MS = 15 * 60 * 1000;
const MAX_TTL_MS = 60 * 60 * 1000;
const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const OPERATION_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

function column(resource: ResourceName, kind: 'used' | 'reserved'): string {
  return `${resource}_${kind}`;
}

function emptyUsage(): Usage {
  return Object.fromEntries(RESOURCE_NAMES.map((resource) => [resource, 0])) as Usage;
}

function copyCosts(costs: ReservationCosts): ReservationCosts {
  return Object.freeze({ ...costs });
}

function jsonCosts(costs: ReservationCosts): string {
  return JSON.stringify(
    Object.fromEntries(RESERVABLE_RESOURCES.map((resource) => [resource, costs[resource] ?? 0])),
  );
}

function parseCosts(value: string): ReservationCosts {
  if (value === '{}') return {};
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid_stored_costs');
  return normalizeCosts(parsed as Record<string, unknown>, true);
}

function assertDayKey(dayKey: string): void {
  if (typeof dayKey !== 'string' || !DAY_KEY_PATTERN.test(dayKey)) throw new Error('invalid_day_key');
  const date = new Date(`${dayKey}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== dayKey) throw new Error('invalid_day_key');
}

function assertOperationId(operationId: string): void {
  if (typeof operationId !== 'string' || !OPERATION_ID_PATTERN.test(operationId)) throw new Error('invalid_operation_id');
}

function normalizeCosts(value: Record<string, unknown>, allowEmpty = false): ReservationCosts {
  const normalized: ReservationCosts = {};
  for (const key of Object.keys(value)) {
    if (!RESERVABLE_RESOURCES.includes(key as ReservableResource)) throw new Error('invalid_cost_resource');
    const amount = value[key];
    if (!Number.isSafeInteger(amount) || (amount as number) < 0) throw new Error('invalid_cost_amount');
    if ((amount as number) > 0) normalized[key as ReservableResource] = amount as number;
  }
  if (Object.keys(normalized).length === 0 && !allowEmpty) throw new Error('empty_costs');
  return normalized;
}

function ttlMs(value: number | undefined): number {
  if (value === undefined) return DEFAULT_TTL_MS;
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_TTL_MS) throw new Error('invalid_reservation_ttl');
  return value;
}

function currentDayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export class CostAuthority extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
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

  async reserve(request: ReservationRequest): Promise<ReserveResult> {
    try {
      assertDayKey(request.dayKey);
      assertOperationId(request.operationId);
      const costs = normalizeCosts(request.costs as Record<string, unknown>);
      const expiresAt = Date.now() + ttlMs(request.reservationTtlMs);
      this.ensureDay(request.dayKey);
      this.expireReservations(request.dayKey, Date.now());

      const existing = this.findReservation(request.operationId);
      if (existing) return this.replayReserve(existing, request.dayKey, costs);

      const ledger = this.readLedger(request.dayKey);
      const exhausted = RESERVABLE_RESOURCES.find((resource) => {
        const amount = costs[resource] ?? 0;
        const limit = constitution.resources[resource].clove_hard_limit;
        return ledger[`${resource}_used`] + ledger[`${resource}_reserved`] + amount > limit;
      });
      if (exhausted) {
        return {
          status: 'denied',
          code: 'budget_exhausted',
          resource: exhausted,
          message: `Daily ${exhausted} capacity is exhausted; existing evidence remains available.`,
        };
      }

      this.ctx.storage.sql.exec(
        `INSERT INTO reservations (operation_id, day_key, state, reserved_json, actual_json, expires_at, created_at)
         VALUES (?, ?, 'reserved', ?, '{}', ?, ?)`,
        request.operationId,
        request.dayKey,
        jsonCosts(costs),
        expiresAt,
        Date.now(),
      );
      this.adjustReserved(request.dayKey, costs, 1);
      return { status: 'approved', dayKey: request.dayKey, operationId: request.operationId, reserved: copyCosts(costs), expiresAt };
    } catch (error) {
      return this.invalidRequest(error);
    }
  }

  async commit(request: CommitRequest): Promise<CommitResult | ReservationDenied> {
    try {
      assertDayKey(request.dayKey);
      assertOperationId(request.operationId);
      const actualUsage = normalizeCosts(request.actualUsage as Record<string, unknown>, true);
      this.ensureDay(request.dayKey);
      this.expireReservations(request.dayKey, Date.now());
      const existing = this.findReservation(request.operationId);
      if (!existing || existing.dayKey !== request.dayKey) {
        return { status: 'denied', code: 'invalid_request', message: 'Reservation was not found.' };
      }
      if (existing.state === 'committed') {
        return { status: 'already_committed', dayKey: request.dayKey, operationId: request.operationId, actualUsage: copyCosts(existing.actualUsage) };
      }
      if (existing.state !== 'reserved') {
        return { status: 'denied', code: 'invalid_request', message: `Reservation is ${existing.state}.` };
      }
      if (RESERVABLE_RESOURCES.some((resource) => (actualUsage[resource] ?? 0) > (existing.reserved[resource] ?? 0))) {
        return { status: 'denied', code: 'invalid_request', message: 'Actual usage exceeds the reservation; reserve more before spending.' };
      }

      this.adjustReserved(request.dayKey, existing.reserved, -1);
      this.adjustUsed(request.dayKey, actualUsage, 1);
      this.ctx.storage.sql.exec(
        "UPDATE reservations SET state = 'committed', actual_json = ? WHERE operation_id = ?",
        jsonCosts(actualUsage),
        request.operationId,
      );
      return { status: 'committed', dayKey: request.dayKey, operationId: request.operationId, actualUsage: copyCosts(actualUsage) };
    } catch (error) {
      return this.invalidRequest(error);
    }
  }

  async release(request: OperationRequest): Promise<ReleaseResult | ReservationDenied> {
    try {
      assertDayKey(request.dayKey);
      assertOperationId(request.operationId);
      this.ensureDay(request.dayKey);
      this.expireReservations(request.dayKey, Date.now());
      const existing = this.findReservation(request.operationId);
      if (!existing || existing.dayKey !== request.dayKey) {
        return { status: 'denied', code: 'invalid_request', message: 'Reservation was not found.' };
      }
      if (existing.state === 'reserved') {
        this.adjustReserved(request.dayKey, existing.reserved, -1);
        this.ctx.storage.sql.exec("UPDATE reservations SET state = 'released' WHERE operation_id = ?", request.operationId);
        return { status: 'released', dayKey: request.dayKey, operationId: request.operationId };
      }
      if (existing.state === 'committed') return { status: 'already_committed', dayKey: request.dayKey, operationId: request.operationId };
      if (existing.state === 'expired') return { status: 'already_expired', dayKey: request.dayKey, operationId: request.operationId };
      return { status: 'already_released', dayKey: request.dayKey, operationId: request.operationId };
    } catch (error) {
      return this.invalidRequest(error);
    }
  }

  async recoverExpired(dayKey: string): Promise<{ dayKey: string; recovered: number }> {
    assertDayKey(dayKey);
    this.ensureDay(dayKey);
    const recovered = this.expireReservations(dayKey, Date.now());
    return { dayKey, recovered };
  }

  async snapshot(dayKey: string): Promise<LedgerSnapshot> {
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
    const active = this.ctx.storage.sql.exec<{ count: number }>(
      "SELECT COUNT(*) AS count FROM reservations WHERE day_key = ? AND state = 'reserved'",
      dayKey,
    ).one();
    return { dayKey, usage, reserved, activeReservations: active.count };
  }

  async reservation(dayKey: string, operationId: string): Promise<StoredReservation | null> {
    assertDayKey(dayKey);
    assertOperationId(operationId);
    this.ensureDay(dayKey);
    this.expireReservations(dayKey, Date.now());
    const found = this.findReservation(operationId);
    return found && found.dayKey === dayKey ? found : null;
  }

  private ensureDay(dayKey: string): void {
    const metadata = this.ctx.storage.sql.exec<{ value: string }>(
      "SELECT value FROM authority_meta WHERE key = 'day_key'",
    ).toArray();
    if (metadata.length === 0) {
      this.ctx.storage.sql.exec("INSERT INTO authority_meta (key, value) VALUES ('day_key', ?)", dayKey);
    } else if (metadata[0].value !== dayKey) {
      throw new Error('day_ledger_mismatch');
    }
    this.ctx.storage.sql.exec(
      `INSERT INTO budget_ledger (day_key) VALUES (?) ON CONFLICT(day_key) DO NOTHING`,
      dayKey,
    );
  }

  private readLedger(dayKey: string): Record<string, number> {
    const row = this.ctx.storage.sql.exec<LedgerRow>(
      "SELECT * FROM budget_ledger WHERE day_key = ?",
      dayKey,
    ).one();
    const values: Record<string, number> = {};
    for (const resource of RESOURCE_NAMES) {
      values[`${resource}_used`] = Number(row[`${resource}_used`] ?? 0);
      values[`${resource}_reserved`] = Number(row[`${resource}_reserved`] ?? 0);
    }
    return values;
  }

  private adjustReserved(dayKey: string, costs: ReservationCosts, direction: 1 | -1): void {
    this.adjustLedger(dayKey, costs, 'reserved', direction);
  }

  private adjustUsed(dayKey: string, costs: ReservationCosts, direction: 1 | -1): void {
    this.adjustLedger(dayKey, costs, 'used', direction);
  }

  private adjustLedger(dayKey: string, costs: ReservationCosts, kind: 'used' | 'reserved', direction: 1 | -1): void {
    const changes = RESERVABLE_RESOURCES
      .filter((resource) => (costs[resource] ?? 0) !== 0)
      .map((resource) => `${column(resource, kind)} = ${column(resource, kind)} ${direction === 1 ? '+' : '-'} ?`);
    const values = RESERVABLE_RESOURCES
      .filter((resource) => (costs[resource] ?? 0) !== 0)
      .map((resource) => costs[resource] as number);
    if (changes.length === 0) return;
    this.ctx.storage.sql.exec(
      `UPDATE budget_ledger SET ${changes.join(', ')} WHERE day_key = ?`,
      ...values,
      dayKey,
    );
  }

  private findReservation(operationId: string): StoredReservation | null {
    const rows = this.ctx.storage.sql.exec<LedgerRow>(
      "SELECT operation_id, day_key, state, reserved_json, actual_json, expires_at FROM reservations WHERE operation_id = ?",
      operationId,
    ).toArray();
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      operationId: String(row.operation_id),
      dayKey: String(row.day_key),
      state: String(row.state) as ReservationState,
      reserved: parseCosts(String(row.reserved_json)),
      actualUsage: parseCosts(String(row.actual_json)),
      expiresAt: Number(row.expires_at),
    };
  }

  private replayReserve(existing: StoredReservation, dayKey: string, costs: ReservationCosts): ReserveResult {
    if (existing.dayKey !== dayKey || jsonCosts(existing.reserved) !== jsonCosts(costs)) {
      return { status: 'denied', code: 'operation_id_conflict', message: 'operationId is already bound to a different reservation.' };
    }
    if (existing.state === 'reserved') {
      return { status: 'approved', dayKey, operationId: existing.operationId, reserved: copyCosts(existing.reserved), expiresAt: existing.expiresAt };
    }
    if (existing.state === 'committed') return { status: 'already_committed', dayKey, operationId: existing.operationId, actualUsage: copyCosts(existing.actualUsage) };
    if (existing.state === 'expired') return { status: 'already_expired', dayKey, operationId: existing.operationId };
    return { status: 'already_released', dayKey, operationId: existing.operationId };
  }

  private expireReservations(dayKey: string, now: number): number {
    const rows = this.ctx.storage.sql.exec<LedgerRow>(
      "SELECT operation_id, reserved_json FROM reservations WHERE day_key = ? AND state = 'reserved' AND expires_at <= ? LIMIT 1000",
      dayKey,
      now,
    ).toArray();
    for (const row of rows) {
      const costs = parseCosts(String(row.reserved_json));
      this.adjustReserved(dayKey, costs, -1);
      this.ctx.storage.sql.exec("UPDATE reservations SET state = 'expired' WHERE operation_id = ?", String(row.operation_id));
    }
    return rows.length;
  }

  private invalidRequest(error: unknown): ReservationDenied {
    const message = error instanceof Error ? error.message : 'invalid_request';
    return { status: 'denied', code: 'invalid_request', message };
  }
}

export { currentDayKey };

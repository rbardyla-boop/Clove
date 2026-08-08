import { env, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { authorityForDay, runReservedSpend, utcDayKey } from '../src/client';
import type { CostAuthority } from '../src/cost-authority';

const dayKey = utcDayKey();

function authority(label: string) {
  return env.COST_AUTHORITY.getByName(`test-${label}-${crypto.randomUUID()}`);
}

describe('CostAuthority', () => {
  it('reserves before spend, commits actual usage, and makes retries idempotent', async () => {
    const stub = authority('commit');
    const operationId = 'operation-commit-1';
    const reservation = await stub.reserve({
      dayKey,
      operationId,
      costs: { d1_rows_written: 25, ai_neurons: 900 },
    });
    expect(reservation.status).toBe('approved');

    const duplicate = await stub.reserve({
      dayKey,
      operationId,
      costs: { ai_neurons: 900, d1_rows_written: 25 },
    });
    expect(duplicate.status).toBe('approved');

    const committed = await stub.commit({
      dayKey,
      operationId,
      actualUsage: { ai_neurons: 700, d1_rows_written: 20 },
    });
    expect(committed.status).toBe('committed');

    const retry = await stub.commit({
      dayKey,
      operationId,
      actualUsage: { ai_neurons: 700, d1_rows_written: 20 },
    });
    expect(retry.status).toBe('already_committed');

    const zeroUsage = await stub.reserve({
      dayKey,
      operationId: 'zero-usage',
      costs: { d1_rows_written: 1 },
    });
    expect(zeroUsage.status).toBe('approved');
    const zeroCommit = await stub.commit({
      dayKey,
      operationId: 'zero-usage',
      actualUsage: {},
    });
    expect(zeroCommit.status).toBe('committed');

    const snapshot = await stub.snapshot(dayKey);
    expect(snapshot.usage.ai_neurons).toBe(700);
    expect(snapshot.usage.d1_rows_written).toBe(20);
    expect(snapshot.reserved.ai_neurons).toBe(0);
  });

  it('cannot oversubscribe the hard limit under concurrent reservations', async () => {
    const stub = authority('race');
    const results = await Promise.all(Array.from({ length: 64 }, (_, index) => stub.reserve({
      dayKey,
      operationId: `operation-race-${index}`,
      costs: { ai_neurons: 900 },
    })));

    expect(results.filter((result) => result.status === 'approved')).toHaveLength(10);
    expect(results.filter((result) => result.status === 'denied')).toHaveLength(54);
    const snapshot = await stub.snapshot(dayKey);
    expect(snapshot.reserved.ai_neurons).toBe(9000);
    expect(snapshot.reserved.ai_neurons).toBeLessThanOrEqual(9000);
  });

  it('denies atomically and keeps a reservation intact when actual usage is too high', async () => {
    const stub = authority('boundaries');
    const denied = await stub.reserve({
      dayKey,
      operationId: 'operation-atomic-denial',
      costs: { ai_neurons: 9000, d1_rows_written: 90001 },
    });
    expect(denied.status).toBe('denied');
    if (denied.status !== 'denied') throw new Error('expected atomic denial');
    expect(denied.code).toBe('budget_exhausted');
    expect(denied.resource).toBe('d1_rows_written');
    expect(denied.message).toContain('existing evidence remains available');

    const empty = await stub.snapshot(dayKey);
    expect(empty.usage.ai_neurons).toBe(0);
    expect(empty.reserved.ai_neurons).toBe(0);
    expect(empty.reserved.d1_rows_written).toBe(0);

    const reservation = await stub.reserve({
      dayKey,
      operationId: 'operation-over-commit',
      costs: { ai_neurons: 900 },
    });
    expect(reservation.status).toBe('approved');
    const overCommit = await stub.commit({
      dayKey,
      operationId: 'operation-over-commit',
      actualUsage: { ai_neurons: 901 },
    });
    expect(overCommit.status).toBe('denied');
    const stillReserved = await stub.reservation(dayKey, 'operation-over-commit');
    expect(stillReserved?.state).toBe('reserved');
  });

  it('observes the reservation before invoking scarce work', async () => {
    const stub = authorityForDay(env, dayKey);
    let observedState: string | undefined;
    const result = await runReservedSpend(env, {
      dayKey,
      operationId: 'operation-ordering',
      costs: { ai_neurons: 900 },
      execute: async () => {
        observedState = (await stub.reservation(dayKey, 'operation-ordering'))?.state;
        return 'provider-result';
      },
      actualUsage: () => ({ ai_neurons: 850 }),
    });

    expect(observedState).toBe('reserved');
    expect(result.status).toBe('committed');
  });

  it('releases failed work and recovers expired reservations', async () => {
    const stub = authorityForDay(env, dayKey);
    const failed = await runReservedSpend(env, {
      dayKey,
      operationId: 'operation-failed',
      costs: { ai_neurons: 900 },
      execute: async () => { throw new Error('simulated_provider_failure'); },
      actualUsage: () => ({ ai_neurons: 0 }),
    }).catch((error: unknown) => error);
    expect(failed).toBeInstanceOf(Error);

    const released = await stub.snapshot(dayKey);
    expect(released.reserved.ai_neurons).toBe(0);

    const expiring = await stub.reserve({
      dayKey,
      operationId: 'operation-expiring',
      costs: { ai_neurons: 900 },
      reservationTtlMs: 1,
    });
    expect(expiring.status).toBe('approved');
    await new Promise((resolve) => setTimeout(resolve, 10));
    const recovered = await stub.recoverExpired(dayKey);
    expect(recovered.recovered).toBe(1);
    const afterRecovery = await stub.snapshot(dayKey);
    expect(afterRecovery.reserved.ai_neurons).toBe(0);
    const oldRetry = await stub.reserve({
      dayKey,
      operationId: 'operation-expiring',
      costs: { ai_neurons: 900 },
    });
    expect(oldRetry.status).toBe('already_expired');
  });

  it('gets a fresh ledger from a new daily authority object', async () => {
    const today = authority('today');
    const tomorrow = authority('tomorrow');
    await today.reserve({ dayKey, operationId: 'today-operation', costs: { ai_neurons: 900 } });
    const tomorrowKey = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    await tomorrow.reserve({ dayKey: tomorrowKey, operationId: 'tomorrow-operation', costs: { ai_neurons: 900 } });

    expect((await today.snapshot(dayKey)).reserved.ai_neurons).toBe(900);
    expect((await tomorrow.snapshot(tomorrowKey)).reserved.ai_neurons).toBe(900);
  });

  it('does not expose a public HTTP route', async () => {
    const response = await SELF.fetch('https://cost-authority.invalid/anything');
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ ok: false, code: 'internal_only' });
  });
});

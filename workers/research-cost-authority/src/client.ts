import type {
  CostAuthority,
  CommitRequest,
  CommitResult,
  ReservationCosts,
  ReservationRequest,
  ReserveResult,
} from './cost-authority';

export interface CostAuthorityEnv {
  COST_AUTHORITY: DurableObjectNamespace<CostAuthority>;
}

export interface ReservedSpend<T> {
  dayKey?: string;
  operationId: string;
  costs: ReservationCosts;
  execute: () => Promise<T>;
  actualUsage: (value: T) => ReservationCosts;
}

export function utcDayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function authorityForDay(env: CostAuthorityEnv, dayKey = utcDayKey()): DurableObjectStub<CostAuthority> {
  return env.COST_AUTHORITY.getByName(`clove-cost-${dayKey}`);
}

export async function reserveBeforeSpend(
  env: CostAuthorityEnv,
  request: Omit<ReservationRequest, 'dayKey'> & { dayKey?: string },
): Promise<ReserveResult> {
  const dayKey = request.dayKey ?? utcDayKey();
  return authorityForDay(env, dayKey).reserve({ ...request, dayKey });
}

export async function runReservedSpend<T>(env: CostAuthorityEnv, request: ReservedSpend<T>): Promise<{
  status: 'committed';
  value: T;
} | { status: 'denied'; reservation: ReserveResult | CommitResult }> {
  const dayKey = request.dayKey ?? utcDayKey();
  const stub = authorityForDay(env, dayKey);
  const reservation = await stub.reserve({
    dayKey,
    operationId: request.operationId,
    costs: request.costs,
  });
  if (reservation.status !== 'approved') return { status: 'denied', reservation };

  try {
    const value = await request.execute();
    const commitRequest: CommitRequest = {
      dayKey,
      operationId: request.operationId,
      actualUsage: request.actualUsage(value),
    };
    const committed = await stub.commit(commitRequest);
    if (committed.status !== 'committed' && committed.status !== 'already_committed') {
      await stub.release({ dayKey, operationId: request.operationId });
      return { status: 'denied', reservation: committed };
    }
    return { status: 'committed', value };
  } catch (error) {
    await stub.release({ dayKey, operationId: request.operationId });
    throw error;
  }
}

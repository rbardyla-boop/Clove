export { CostAuthority, currentDayKey } from './cost-authority';
export { authorityForDay, reserveBeforeSpend, runReservedSpend, utcDayKey } from './client';

export default {
  async fetch(): Promise<Response> {
    return Response.json({ ok: false, code: 'internal_only' }, { status: 404 });
  },
};

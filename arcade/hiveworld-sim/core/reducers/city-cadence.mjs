/**
 * District presence-push cadence reducer (HiveWorld v1.2 — Phase 5C/5D/5E timing mirror).
 *
 * `city_presence_alarm`: a block's alarm boundary fires (the 30s-alarm analog). The block re-reads the
 * registry aggregate (state.district.blocks) and PUSHES a refreshed snapshot to its clients — this is
 * when that block learns of OTHER blocks' presence changes (cross-block, alarm-bound). Same-block changes
 * were already pushed immediately by district_presence_delta. The first alarm is the baseline snapshot
 * (no activity, like the product's initial city_blocks); subsequent alarms derive public-safe activity
 * for the blocks that changed since the block's last push (5E cadence).
 *
 * Deterministic + convergent: the pushed view is a pure function of (canonically-ordered deltas + alarms),
 * so delayed/duplicated/out-of-order cadence events fold to the same fingerprint. No economy/private data.
 */
import { ok, rej } from '../state-util.mjs';
import { isKnownBlock, CITY_IDS } from '../phase1/city-blocks.mjs';
import { snapshotAllBlocks, diffPushedView } from '../phase1/district-presence-push.mjs';
import { activityForPresence, appendActivity } from '../phase1/district-activity.mjs';

export function city_presence_alarm(state, ev) {
  const cityId = ev.cell_id || (ev.payload && ev.payload.city_id);
  if (!isKnownBlock(cityId)) return rej(state, 'unknown_block');
  if (ev.actor_id !== cityId) return rej(state, 'not_authority'); // a block fires only its own alarm
  const d = state.district;
  const tick = ev.logical_tick;
  const prevPushed = d.pushedView[cityId] || {};
  const next = snapshotAllBlocks(d.blocks, tick); // refreshed cross-block view from the registry
  const hadFullSnapshot = CITY_IDS.every((id) => prevPushed[id]);

  let activity = d.activity;
  if (hadFullSnapshot) {
    for (const changedId of diffPushedView(prevPushed, next)) {
      const item = activityForPresence(prevPushed[changedId], next[changedId], tick);
      activity = appendActivity(activity, item); // public-safe, bounded, deduped
    }
  }
  const nd = { ...d, pushedView: { ...d.pushedView, [cityId]: next }, activity };
  return ok({ ...state, district: nd });
}

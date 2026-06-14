/**
 * Import an arcade BUILDING LAYOUT from JSON text or a parsed object — PURE, cross-env.
 * Validates deny-by-default; only a passing layout is returned. Returns { ok, layout, hash, errors }.
 */

import { validateArcadeLayout } from '../validation/validateArcadeLayout.js';
import { hashAsset } from './hashAsset.js';

function parse(input, errors) {
  if (typeof input === 'string') {
    try {
      return JSON.parse(input);
    } catch (e) {
      errors.push(`invalid JSON: ${e.message}`);
      return null;
    }
  }
  return input;
}

export async function importArcadeLayout(input) {
  const errors = [];
  const data = parse(input, errors);
  if (errors.length) return { ok: false, layout: null, hash: null, errors };

  const report = validateArcadeLayout(data);
  if (!report.ok) return { ok: false, layout: null, hash: null, errors: report.errors };

  const hash = await hashAsset(data);
  return { ok: true, layout: data, hash, errors: [] };
}

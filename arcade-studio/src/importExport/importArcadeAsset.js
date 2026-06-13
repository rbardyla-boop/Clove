/**
 * Import an arcade CABINET asset from JSON text or a parsed object — PURE, cross-env.
 *
 * Parses (if given a string), validates deny-by-default, and ONLY returns the asset when it passes.
 * Untrusted input never reaches the scene unvalidated. Returns { ok, asset, hash, errors }.
 */

import { validateArcadeAsset } from '../validation/validateArcadeAsset.js';
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

export async function importArcadeAsset(input) {
  const errors = [];
  const data = parse(input, errors);
  if (errors.length) return { ok: false, asset: null, hash: null, errors };

  const report = validateArcadeAsset(data);
  if (!report.ok) return { ok: false, asset: null, hash: null, errors: report.errors };

  const hash = await hashAsset(data);
  return { ok: true, asset: data, hash, errors: [] };
}

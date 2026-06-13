/**
 * Deterministic id + slug helpers. Ids are derived from a monotonic counter seeded by content,
 * NOT from Date.now()/Math.random(), so exports are reproducible and diff-friendly.
 */

import { hashSeed } from './random.js';

/** kebab-case a string, strip everything unsafe, bound length. Used for asset/layout ids. */
export function slugify(input, max = 48) {
  return String(input ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max) || 'untitled';
}

/**
 * A short, stable id derived from a base label + an integer index. Deterministic: the same
 * (label, index) always yields the same id, so re-running an export is byte-identical.
 */
export function stableId(label, index) {
  const h = hashSeed(`${label}#${index}`).toString(36).slice(0, 6);
  return `${slugify(label, 24)}-${h}`;
}

/** A simple incrementing handle factory for *runtime* (non-exported) object identity. */
export function createCounter(start = 1) {
  let n = start;
  return () => n++;
}

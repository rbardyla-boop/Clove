/**
 * Forbidden-surface checks — PURE, cross-env, no Three.js.
 *
 * Defense-in-depth ON TOP of the deny-by-default schema validators. Even if a future schema change
 * accidentally widened an allowlist, these checks fail an asset closed when it carries any of the
 * dangerous surfaces the goal forbids: arbitrary script/code, upload/remote-submit, external asset
 * URLs, live-world loading, or economy/ownership/reward/prize/ticket/ledger/marketplace/crypto/NFT
 * mechanics. Also asserts the required self-describing safety constraints are present and true.
 */

import { REQUIRED_CONSTRAINTS } from './tokens.js';
import { eachKey, FORBIDDEN_CAPABILITY_KEYS, isPlainObject } from './safety.js';

/** Top-level / nested key NAMES that must never appear anywhere in an exported asset. */
export const FORBIDDEN_KEY_NAMES = Object.freeze([
  ...FORBIDDEN_CAPABILITY_KEYS,
  'script', 'scripts', 'code', 'eval', 'fn', 'handler', 'callback',
  'url', 'uri', 'href', 'src', 'endpoint', 'fetch', 'webhook',
  'submit', 'upload', 'publish', 'remote', 'sync', 'push',
  'economy', 'rewards', 'reward', 'prize', 'prizes', 'tickets', 'ticket',
  'ledger', 'wallet', 'marketplace', 'market', 'crypto', 'nft', 'mint',
  'owner', 'ownership', 'price', 'cost', 'currency', 'balance',
]);
const FORBIDDEN_KEY_SET = new Set(FORBIDDEN_KEY_NAMES.map((k) => k.toLowerCase()));

/** Some forbidden names double as legitimate descriptive fields; none are in our schemas, so the
 *  blanket ban is safe. (Documented here so a future maintainer doesn't "rescue" one by accident.) */

/**
 * Scan an arbitrary object for forbidden capability/economy/network key names anywhere in the tree.
 * Returns the list of offending paths (empty = clean) and pushes readable errors.
 */
export function checkForbiddenSurface(obj, errors = []) {
  const offences = [];
  eachKey(obj, (k, path) => {
    if (FORBIDDEN_KEY_SET.has(String(k).toLowerCase())) {
      offences.push(path);
      errors.push(`forbidden capability/economy/network key "${k}" at ${path}`);
    }
  });
  return offences;
}

/**
 * Verify the `constraints` block exists and asserts EXACTLY the required safety flags, all true.
 * Extra keys or any non-true value fails closed.
 */
export function checkRequiredConstraints(constraints, errors = []) {
  if (!isPlainObject(constraints)) {
    errors.push('constraints block missing or not an object');
    return false;
  }
  let ok = true;
  const required = Object.keys(REQUIRED_CONSTRAINTS);
  for (const k of Object.keys(constraints)) {
    if (!required.includes(k)) {
      errors.push(`constraints: unknown key "${k}"`);
      ok = false;
    }
  }
  for (const k of required) {
    if (constraints[k] !== true) {
      errors.push(`constraints.${k} must be true`);
      ok = false;
    }
  }
  return ok;
}

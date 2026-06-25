/**
 * Creator Foundation CF-4 — Arcade package IMPORTER (pure, cross-env).
 *
 * Takes an operator's LOCAL arcade package (manifest + module source text) and decides whether it is
 * safe to run in the CF-4 LOCAL SANDBOX. It reuses the CF-1 manifest validator (validate-arcade-package)
 * and adds the file-level checks a folder import needs:
 *   - the entry + adapter module files referenced by the manifest exist, and NO extra files do
 *     (no bundled assets — assets must be empty);
 *   - a CODE-AWARE static safety scan of each module source (sandbox-escape + capability vectors);
 *   - static import specifiers are constrained (game has no imports; adapter imports only ./game.mjs);
 *   - the real file total is within the declared budget AND the schema hard cap.
 *
 * NB: the data-package FORBIDDEN_CONTENT_RE forbids ALL code (functions/arrows/backticks), so it CANNOT
 * scan arcade module SOURCE — this module ships its own code-aware deny-list instead.
 *
 * This is local creator tooling: NO live-world load, NO production, NO Worker change, NO ticket/prize/
 * ledger/Host-Rank/Stewardship/Trial/economy coupling. Any result a package proposes is, by contract,
 * an UNTRUSTED LOCAL PROPOSAL. See docs/CREATOR_FOUNDATION_CF4_ARCADE_IMPORTER.md.
 */

import { validateArcadePackage } from '../validator/validate-arcade-package.mjs';
import { utf8Bytes, FORBIDDEN_TERMS_RE } from '../validator/validation-report.mjs';
import { SIZE_BUDGET_MAX_BYTES, FRAME_CONTRACTS } from '../schemas/arcade-game-package-schema.mjs';

/** Native logical dimensions per approved frame contract (the sandbox sizes its frame to these). */
export const FRAME_CONTRACT_DIMS = Object.freeze({
  'cabinet-360x640': Object.freeze({ width: 360, height: 640 }),
  'cabinet-640x360': Object.freeze({ width: 640, height: 360 }),
  'cabinet-480x480': Object.freeze({ width: 480, height: 480 }),
});

/**
 * Code-aware deny-list for arcade module SOURCE. Each entry is a sandbox-escape or capability vector
 * the package must not contain — defense-in-depth ALONGSIDE the runtime iframe sandbox + CSP. (Normal
 * JS — functions, arrows, template literals — is allowed; only these dangerous APIs are rejected.)
 */
export const SOURCE_FORBIDDEN = Object.freeze([
  ['network: fetch', /\bfetch\s*\(/],
  ['network: XMLHttpRequest', /\bXMLHttpRequest\b/],
  ['network: WebSocket', /\bWebSocket\b/],
  ['network: EventSource', /\bEventSource\b/],
  ['network: sendBeacon', /\bsendBeacon\b/],
  ['worker import', /\bimportScripts\s*\(/],
  ['worker', /\bnew\s+(Shared)?Worker\b/],
  ['dynamic import', /\bimport\s*\(/],
  ['eval', /\beval\s*\(/],
  ['new Function', /\bnew\s+Function\b/],
  ['storage: localStorage', /\blocalStorage\b/],
  ['storage: sessionStorage', /\bsessionStorage\b/],
  ['storage: indexedDB', /\bindexedDB\b/],
  ['cookies', /document\s*\.\s*cookie/],
  ['external url', /\b(?:https?|wss?|ftp):\/\//i],
  ['protocol-relative url', /["'`]\s*\/\//],
  ['markup/script injection', /<\/?\s*(?:script|iframe|object|embed|link|meta)\b|<\/script/i],
  ['service worker', /serviceWorker/],
  ['top/parent navigation', /\b(?:top|parent)\s*\.\s*location\b/],
  ['cross-window open', /\bwindow\s*\.\s*open\s*\(/],
  ['postMessage from package', /\bpostMessage\s*\(/],            // the trusted bootstrap owns the channel
  ['Function-constructor escape', /\.\s*constructor\s*\.\s*constructor|\[\s*['"]constructor['"]\s*\]/],
  ['indirect eval', /\(\s*0\s*,\s*eval\s*\)/],                  // (0, eval)('...') sidesteps /\beval\s*\(/
  ['bracket access on a global', /\b(?:window|globalThis|self|top|parent|frames|document)\s*\[/], // window['fe'+'tch']
  ['bracket access on this', /\bthis\s*\[/],                    // this['constructor']['constructor'] etc.
  ['blob object url', /createObjectURL/],
  ['import.meta', /\bimport\s*\.\s*meta\b/],
  ['unicode/hex identifier escape', /\\u00|\\x[0-9a-f]{2}/i],     // obfuscated identifiers (fetch via \u..)
]);

// `from`-imports may span newlines; side-effect imports (`import 'x'`) have no `from`.
const FROM_IMPORT_RE = /\bimport\b[\s\S]*?\bfrom\s*['"]([^'"]+)['"]/g;
const SIDE_EFFECT_IMPORT_RE = /(^|\n)\s*import\s*['"]([^'"]+)['"]\s*;?/;

/** Scan one module's source. game.mjs must have NO imports; adapter.mjs may import ONLY './game.mjs'. */
export function scanSource(name, source, role, errors) {
  if (typeof source !== 'string' || source.length === 0) { errors.push(`${name}: source missing or empty`); return; }
  for (const [label, re] of SOURCE_FORBIDDEN) if (re.test(source)) errors.push(`${name}: forbidden (${label})`);
  if (FORBIDDEN_TERMS_RE.test(source)) errors.push(`${name}: forbidden economy/ownership term`);
  // side-effect imports are never allowed (in either role)
  const se = SIDE_EFFECT_IMPORT_RE.exec(source);
  if (se) errors.push(`${name}: side-effect import not allowed (found '${se[2]}')`);
  // from-imports (multiline-tolerant): entry none; adapter only './game.mjs'
  let m;
  FROM_IMPORT_RE.lastIndex = 0;
  while ((m = FROM_IMPORT_RE.exec(source)) !== null) {
    const spec = m[1];
    if (role === 'entry') errors.push(`${name}: entry module must not import (found '${spec}')`);
    else if (spec !== './game.mjs') errors.push(`${name}: adapter may import only './game.mjs' (found '${spec}')`);
  }
}

/**
 * Import + vet a local arcade package. `files` is a map of filename → source text (manifest may be an
 * object or its JSON text). Returns a structured report; `ok` means it is safe to run in the LOCAL
 * sandbox (never the live world). PURE — no I/O.
 */
export function importArcadePackage({ manifest, files }) {
  const errors = [];
  const warnings = [];
  const f = (files && typeof files === 'object') ? files : {};

  // 1. manifest validation (reuse CF-1 — single source of manifest truth)
  const mv = validateArcadePackage(manifest);
  for (const e of mv.errors) errors.push(`manifest: ${e}`);

  const entry = manifest && typeof manifest.entry === 'string' ? manifest.entry : null;
  const adapter = manifest && typeof manifest.adapter === 'string' ? manifest.adapter : null;

  // 2. referenced module files must exist; NO extra files (no bundled assets)
  if (entry && !(entry in f)) errors.push(`missing file referenced by entry: ${entry}`);
  if (adapter && !(adapter in f)) errors.push(`missing file referenced by adapter: ${adapter}`);
  const allowed = new Set(['manifest.json', entry, adapter].filter(Boolean));
  for (const fn of Object.keys(f)) if (!allowed.has(fn)) errors.push(`unexpected bundled file (assets must be empty): ${fn}`);

  // 3. code-aware static source scan
  if (entry && entry in f) scanSource(entry, f[entry], 'entry', errors);
  if (adapter && adapter in f) scanSource(adapter, f[adapter], 'adapter', errors);

  // 4. real file total vs declared budget + schema hard cap
  let total = 0;
  for (const v of Object.values(f)) total += utf8Bytes(typeof v === 'string' ? v : JSON.stringify(v));
  const budget = manifest && manifest.size_budget_bytes;
  if (Number.isInteger(budget) && total > budget) errors.push(`files (${total}B) exceed declared size_budget_bytes (${budget}B)`);
  if (total > SIZE_BUDGET_MAX_BYTES) errors.push(`files (${total}B) exceed hard cap (${SIZE_BUDGET_MAX_BYTES}B)`);

  // 5. frame contract → known dimensions for the sandbox frame
  const fcid = manifest && manifest.frame_contract_id;
  const dims = (fcid && FRAME_CONTRACT_DIMS[fcid]) || null;
  if (FRAME_CONTRACTS.includes(fcid) && !dims) errors.push(`no sandbox dimensions for frame_contract_id: ${fcid}`);

  // 6. capabilities deny-by-default (manifest validator already enforces; surface here too)
  const capabilities = Array.isArray(manifest && manifest.capabilities) ? manifest.capabilities : [];

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    limits: { total_bytes: total, size_budget_bytes: Number.isInteger(budget) ? budget : 0 },
    capabilities,
    frame_contract_id: fcid || null,
    frame_dims: dims,
    entry,
    adapter,
    // The contract: a package result is NEVER trusted by the host. The sandbox surfaces it as a local
    // proposal only; no server ticket/prize/score authority is ever granted here.
    result_trust: 'untrusted_local_proposal',
  };
}

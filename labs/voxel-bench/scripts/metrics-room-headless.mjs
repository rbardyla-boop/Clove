/**
 * Voxel Lab Bench — headless metrics/readout room cross-validation (Gate C).
 *
 * The room (src/metrics-room.mjs, wired into bench-boot.mjs as window.__bench.
 * getMetricsRoom()) is only useful as a teaching surface if its numbers are PROVABLY the
 * same numbers the rest of the bench already reports — a "unified readout" that quietly
 * disagreed with meshStats()/strategyDelta()/getLightMetrics()/lodInstanceCount() would
 * be worse than no readout at all. This harness boots the real bench and cross-checks
 * every field in getMetricsRoom()'s report against those EXISTING, independent APIs,
 * then asserts the report is stable (deterministic) across repeated calls.
 *
 * Self-contained: spins up its own tiny static file server (Node's built-in `http`
 * module) rooted at the REPO ROOT, then drives the cached Playwright chromium against
 * it with the same swiftshader launch args the sibling harnesses already use
 * (bench-headless.mjs, lod-pop-harness.mjs, light-volume-headless.mjs).
 *
 * Run from the REPO ROOT:
 *   node labs/voxel-bench/scripts/metrics-room-headless.mjs
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../');
const PAGE_PATH = '/labs/voxel-bench/index.html';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

/** Minimal static file server, repo-root-rooted, GET-only, no directory listing. */
function startStaticServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      try {
        const reqUrl = new URL(req.url, 'http://127.0.0.1');
        const relPath = decodeURIComponent(reqUrl.pathname);
        const filePath = path.join(REPO_ROOT, relPath);
        if (!filePath.startsWith(REPO_ROOT)) {
          res.writeHead(403);
          res.end('forbidden');
          return;
        }
        const data = fs.readFileSync(filePath);
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        res.end(data);
      } catch (err) {
        res.writeHead(404);
        res.end('not found');
      }
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

const server = await startStaticServer();
const { port } = server.address();
const url = `http://127.0.0.1:${port}${PAGE_PATH}`;
console.log(`[metrics-room-headless] serving ${REPO_ROOT} -> ${url}`);

const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); else console.log(`  ✓ ${msg}`); };

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });

const consoleErrors = [];
const pageErrors = [];
page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) consoleErrors.push(m.text()); });
page.on('pageerror', (e) => pageErrors.push(e.message));

try {
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__bench && window.__bench.ready === true, { timeout: 20000 });
  ok(await page.evaluate(() => window.__bench.ready === true), 'bench booted (window.__bench.ready)');

  await page.evaluate(() => window.__bench.step(1 / 60));

  const room = await page.evaluate(() => window.__bench.getMetricsRoom());
  const strategyDelta = await page.evaluate(() => window.__bench.strategyDelta());
  const lightMetrics = await page.evaluate(() => window.__bench.getLightMetrics());

  console.log('\n[metrics-room-headless] unified room readout:');
  console.log(`  instancedCubes: drawCalls=${room.instancedCubes.drawCalls} instanceCount=${room.instancedCubes.instanceCount} triangleCount=${room.instancedCubes.triangleCount}`);
  console.log(`  greedyQuads:    drawCalls=${room.greedyQuads.drawCalls} quadCount=${room.greedyQuads.quadCount} triangleCount=${room.greedyQuads.triangleCount}`);
  console.log(`  meshReduction:  ratio=${room.meshReduction.ratio.toFixed(2)}x (instanced triangles / greedy triangles)`);
  console.log(`  lod:            fineInstanceCount=${room.lod.fineInstanceCount} coarseInstanceCount=${room.lod.coarseInstanceCount} ratio=${room.lod.ratio.toFixed(3)}`);
  console.log('  lightVolume:');
  for (const row of room.lightVolume) {
    console.log(`    resolution=${row.resolution}  lightVolumeBytes=${row.lightVolumeBytes}`);
  }

  // --- Cross-validation: the room's numbers must match the bench's OWN independent
  // readout APIs exactly — not just be internally self-consistent. ---
  ok(
    room.instancedCubes.drawCalls === strategyDelta.instancedCubes.drawCalls &&
      room.instancedCubes.triangleCount === strategyDelta.instancedCubes.triangleCount,
    `instancedCubes matches window.__bench.strategyDelta() exactly (room=${room.instancedCubes.triangleCount} tris, strategyDelta=${strategyDelta.instancedCubes.triangleCount} tris)`,
  );
  ok(
    room.greedyQuads.drawCalls === strategyDelta.greedyQuads.drawCalls &&
      room.greedyQuads.triangleCount === strategyDelta.greedyQuads.triangleCount,
    `greedyQuads matches window.__bench.strategyDelta() exactly (room=${room.greedyQuads.triangleCount} tris, strategyDelta=${strategyDelta.greedyQuads.triangleCount} tris)`,
  );

  const roomAtDefaultResolution = room.lightVolume.find((r) => r.resolution === lightMetrics.resolution);
  ok(
    !!roomAtDefaultResolution && roomAtDefaultResolution.lightVolumeBytes === lightMetrics.lightVolumeBytes,
    `lightVolume at the bench's current resolution (${lightMetrics.resolution}) matches window.__bench.getLightMetrics() exactly (room=${roomAtDefaultResolution?.lightVolumeBytes}, live=${lightMetrics.lightVolumeBytes})`,
  );

  // Cross-validate LOD by actually driving the live LOD object to each level and
  // comparing its real rendered instance count against the room's fine/coarse numbers.
  await page.evaluate(() => { window.__bench.aimAtLodObject(); window.__bench.setCameraDistance(0); window.__bench.step(1 / 60); });
  const fineLodInstanceCount = await page.evaluate(() => window.__bench.lodInstanceCount());
  ok(
    fineLodInstanceCount === room.lod.fineInstanceCount,
    `room.lod.fineInstanceCount matches the live LOD object's instance count at near distance (room=${room.lod.fineInstanceCount}, live=${fineLodInstanceCount})`,
  );

  await page.evaluate(() => { window.__bench.setCameraDistance(20); window.__bench.step(1 / 60); });
  const coarseLodInstanceCount = await page.evaluate(() => window.__bench.lodInstanceCount());
  ok(
    coarseLodInstanceCount === room.lod.coarseInstanceCount,
    `room.lod.coarseInstanceCount matches the live LOD object's instance count at far distance (room=${room.lod.coarseInstanceCount}, live=${coarseLodInstanceCount})`,
  );

  // --- Determinism: repeated calls on the same (unchanged) bench state must be
  // byte-for-byte identical. ---
  const roomAgain = await page.evaluate(() => window.__bench.getMetricsRoom());
  ok(
    JSON.stringify(room) === JSON.stringify(roomAgain),
    'getMetricsRoom() is deterministic — repeated calls on unchanged state produce an identical report',
  );

  ok(pageErrors.length === 0, `no uncaught page errors${pageErrors.length ? ' → ' + pageErrors.join(' | ') : ''}`);
  ok(consoleErrors.length === 0, `no console errors${consoleErrors.length ? ' → ' + consoleErrors.slice(0, 3).join(' | ') : ''}`);
} catch (err) {
  fails.push(`metrics-room-headless threw: ${err.message}\n${err.stack || ''}`);
} finally {
  await browser.close();
  server.close();
}

if (fails.length) {
  console.error('\n[metrics-room-headless] FAIL:');
  for (const f of fails) console.error(`  ✕ ${f}`);
  process.exit(1);
}
console.log('\n[metrics-room-headless] PASS — unified room readout matches every independent live API, deterministic');

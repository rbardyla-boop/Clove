import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let server;
let baseUrl;
const port = 8765;

const questions = {
  population: "What was Canada's population in the latest complete annual period?",
  law: 'What federal law governs possession of cannabis by young persons in Canada?',
  science: 'Does creatine supplementation affect cognitive performance in healthy adults?',
};

function makeSource(id, title, url, authority = 'primary') {
  return { sourceId: id, sourceClass: 'bounded', title, url, authority, institution: 'First-party source', identifiers: {}, discoveryMethod: 'test_fixture', queryUsed: '', provenance: { provider: 'fixture', retrievedAt: '2026-08-08T12:00:00.000Z', endpoint: url } };
}

function graph(claimId, sourceId) {
  return {
    nodes: [
      { id: 'question', type: 'question', label: 'Question' },
      { id: 'answer', type: 'answer', label: 'Best supported answer' },
      { id: `claim-${claimId}`, type: 'claim', label: 'Claim', claimId, sourceId },
      { id: `source-${sourceId}`, type: 'source', label: 'First-party source', sourceId },
    ],
    edges: [
      { from: 'question', to: 'answer', relation: 'asks' },
      { from: `claim-${claimId}`, to: 'answer', relation: 'supports' },
      { from: `claim-${claimId}`, to: `source-${sourceId}`, relation: 'published_by' },
    ],
  };
}

function baseResearch(question, recipeId, status, claim, source) {
  return {
    status,
    question,
    recipeId,
    answer: { text: claim.proposition, claimIds: [claim.id] },
    whyThisAnswer: 'The result is limited to the typed claims and source fragments shown below.',
    claims: [claim],
    sources: [source],
    challenge: { status: 'not_available', label: 'Bounded challenger', detail: 'No independent challenger configured in this fixture.', claimIds: [] },
    graph: graph(claim.id, source.sourceId),
    unknowns: ['The fixture does not prove every adjacent claim.'],
    timeline: [
      { label: 'Classified source recipe', state: 'complete', detail: 'A deterministic recipe matched.' },
      { label: 'Retrieved source material', state: 'complete', detail: 'Source material was retrieved.' },
      { label: 'Extracted and validated claim', state: 'complete', detail: 'The claim has visible provenance.' },
      { label: 'Challenger', state: 'partial', detail: 'No independent challenger configured.' },
    ],
    generatedAt: '2026-08-08T12:00:00.000Z',
    export: {
      rootPath: 'Research/Investigation.md',
      files: [
        { path: 'Research/Investigation.md', content: '# Investigation' },
        { path: `Research/Claims/${claim.id}.md`, content: '# Claim' },
        { path: `Research/Sources/${source.sourceId}.md`, content: '# Source' },
      ],
    },
  };
}

function fixtureFor(question) {
  if (question === questions.population) {
    const source = makeSource('statcan-cube-17100005', 'Population estimates on July 1', 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1710000501');
    const claim = { id: 'statcan-population-2025', proposition: "Canada's population was 41,651,653 on July 1, 2025.", value: 41651653, unit: 'persons', measurementPeriod: '2025-07-01', sourceId: source.sourceId, sourceLocation: { table: '17100005', row: 'Canada · Total gender · All ages', column: '2025-07-01' }, sourceFragment: 'vectorId=466668; refPerRaw=2025-07-01; value=41651653', evidenceRole: 'supports', status: 'ESTABLISHED' };
    const result = baseResearch(question, 'official_canadian_statistic', 'QUALIFIED', claim, source);
    result.strongestDatapoint = claim;
    return result;
  }
  if (question === questions.law) {
    const source = makeSource('justice-cannabis-act', 'Cannabis Act — current consolidated XML', 'https://laws-lois.justice.gc.ca/eng/acts/C-24.5/index.html');
    const claim = { id: 'cannabis-act-section-8-possession', proposition: 'Cannabis Act section 8(1)(c) sets the five-gram dried-cannabis-equivalent threshold for a young person.', sourceId: source.sourceId, sourceLocation: { statuteSection: '8(1)(c)' }, sourceFragment: 'for a young person to possess cannabis ... more than 5 g of dried cannabis;', evidenceRole: 'supports', status: 'ESTABLISHED' };
    const result = baseResearch(question, 'canadian_law', 'QUALIFIED', claim, source);
    result.legal = { officialText: 'for a young person to possess cannabis ... more than 5 g of dried cannabis;\n\n12 years of age or older but under 18 years of age', interpretation: 'This is a bounded textual reading, not legal advice.', interpretationStatus: 'bounded_textual_reading' };
    result.challenge = { status: 'not_available', label: 'Independent legal interpretation', detail: 'The official statute is shown; case-law interpretation remains unknown.', claimIds: [] };
    return result;
  }
  const source = makeSource('crossref-review', 'Crossref bibliographic record', 'https://api.crossref.org/works/10.1097/ebp.0000000000002506', 'metadata');
  const claim = { id: 'crossref-review', proposition: 'Crossref metadata identifies a potentially relevant work; metadata alone does not establish what the study found.', sourceId: source.sourceId, sourceLocation: { section: 'work metadata' }, sourceFragment: 'DOI: 10.1097/ebp.0000000000002506', evidenceRole: 'metadata_only', status: 'METADATA_ONLY' };
  const result = baseResearch(question, 'scientific_finding', 'RESEARCH_REQUIRED', claim, source);
  result.science = { evidenceLevel: 'METADATA_ONLY', worksFound: 2 };
  result.challenge = { status: 'incomplete', label: 'Independent scientific challenge', detail: 'Study-level result extraction remains required.', claimIds: [] };
  return result;
}

async function startServer() {
  server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
  await new Promise((resolve) => setTimeout(resolve, 120));
  baseUrl = `http://127.0.0.1:${port}`;
}

before(startServer);
after(() => server?.kill());

test('the research page visibly completes population, law, and science bounded paths', async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'POST' && (url.pathname === '/research' || url.pathname === '/research/' || url.pathname === '/research/challenge')) {
      const body = JSON.parse(route.request().postData() || '{}');
      const result = fixtureFor(body.question);
      if (url.pathname === '/research/challenge') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, status: 'challenge_executed', challenge: { ...result.challenge, status: 'executed', detail: 'Challenger ran and its result remains visible.', claimIds: [] } }) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, status: 'research_complete', research: result }) });
      }
      return;
    }
    await route.continue();
  });

  await page.goto(`${baseUrl}/research/`);
  assert.match(await page.title(), /Clove Research/);
  for (const [kind, question] of Object.entries(questions)) {
    await page.locator('#question').fill(question);
    await page.locator('#investigate').click();
    await page.locator('[data-testid="research-status"]').waitFor();
    const expected = kind === 'science' ? 'RESEARCH_REQUIRED' : 'QUALIFIED';
    assert.equal(await page.locator('[data-testid="research-status"]').textContent(), expected);
    assert.equal(await page.locator('.source-list a').count(), 1);
    assert.ok(await page.locator('.unknown-list').isVisible());
    assert.ok(await page.locator('.timeline').isVisible());
    assert.ok(await page.locator('.graph-node').count() >= 4);
    if (kind === 'population') assert.match(await page.locator('.datapoint').textContent(), /41,651,653/);
    if (kind === 'law') {
      assert.match(await page.locator('.official').textContent(), /5 g of dried cannabis/);
      assert.match(await page.locator('.interpretation').textContent(), /bounded textual reading/);
    }
    if (kind === 'science') assert.match(await page.locator('.science-note').textContent(), /METADATA_ONLY/);
  }

  await page.locator('#question').fill(questions.population);
  await page.locator('#investigate').click();
  await page.locator('[data-testid="research-status"]').waitFor();
  await page.locator('.graph-node').nth(2).click();
  assert.notEqual(await page.locator('.graph-detail').textContent(), 'Select a node to inspect its role.');
  await page.locator('button', { hasText: 'SHOW ME THE SOURCE' }).click();
  assert.match(await page.locator('.action-note').textContent(), /Source selected/);
  const downloadPromise = page.waitForEvent('download');
  await page.locator('button', { hasText: 'EXPORT RESEARCH' }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), 'clove-research-export.md');
  await browser.close();
});

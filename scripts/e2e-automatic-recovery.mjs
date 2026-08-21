import assert from 'node:assert/strict';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.TRIPWEAVE_URL || 'http://127.0.0.1:5173';
const outputDirectory = 'test-output';
await mkdir(outputDirectory, { recursive: true });

const cachedFiles = await readdir('server/.cache').catch(() => []);
const records = (await Promise.all(cachedFiles.filter((file) => file.endsWith('.json')).map(async (file) => {
  try { return JSON.parse(await readFile(`server/.cache/${file}`, 'utf8')); } catch { return null; }
}))).filter((record) => record?.result?.result?.journeys?.length);
const cached = records.sort((a, b) => b.at - a.at)[0]?.result;
assert.ok(cached, 'Run one real trip first so the recovery UI can be tested with a genuine cached result.');

const tripId = 'automatic-recovery-test';
const activeJob = {
  ...cached,
  id: tripId,
  status: 'partial',
  recoveries: {
    kayak: {
      collectorKey: 'kayak', taskKey: 'kayak', label: 'KAYAK', kind: 'flight', reason: 'empty_output',
      status: 'analyzing', message: 'Scraper Studio is rewriting the failed extraction logic.',
    },
  },
};
const recoveredJob = {
  ...activeJob,
  status: 'ready',
  recoveries: {
    kayak: { ...activeJob.recoveries.kayak, status: 'recovered', recoveredRows: 8, message: '8 live rows recovered and added to this trip.' },
  },
};
const fullJob = { ...recoveredJob, id: 'full-comparison-test', options: { includeReferenceSources: true, fullComparison: true } };

const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [{ width: 1440, height: 960, name: 'desktop' }, { width: 390, height: 844, name: 'mobile' }]) {
    const page = await browser.newPage({ viewport });
    let reads = 0;
    let expansionPayload = null;
    await page.route(`**/api/trips/${tripId}`, async (route) => {
      reads += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reads < 4 ? activeJob : recoveredJob) });
    });
    await page.route('**/api/trips/full-comparison-test', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fullJob) }));
    await page.route('**/api/trips', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      expansionPayload = route.request().postDataJSON();
      return route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ id: fullJob.id, status: 'queued' }) });
    });
    await page.goto(`${baseUrl}/trip/${tripId}`, { waitUntil: 'domcontentloaded' });
    const recoveryHeading = page.getByText('A changed travel site is repairing itself');
    await recoveryHeading.waitFor();
    assert.ok(await page.getByText('Rewriting scraper').isVisible(), 'The automatic repair stage must be visible without an approval button.');
    if (viewport.name === 'mobile') await recoveryHeading.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${outputDirectory}/automatic-recovery-${viewport.name}.png`, fullPage: false });
    await page.getByText('The live data gap was repaired').waitFor({ timeout: 8_000 });
    assert.ok(await page.getByText('8 live rows recovered and added to this trip.').isVisible(), 'Recovered rows must be announced in the open trip.');
    assert.equal(await page.getByRole('button', { name: /approve/i }).count(), 0, 'Production recovery must not wait for a user approval button.');
    const expansionButton = page.getByRole('button', { name: 'Check more websites' });
    assert.ok(await expansionButton.isVisible(), 'A completed budgeted search must offer an explicit full-comparison action.');
    if (viewport.name === 'desktop') {
      await expansionButton.click();
      await page.waitForURL('**/trip/full-comparison-test');
      await page.getByText('Full comparison requested').waitFor();
      assert.equal(expansionPayload?.fullComparison, true);
      assert.equal(expansionPayload?.includeReferenceSources, true);
      assert.equal(await page.getByRole('button', { name: 'Check more websites' }).count(), 0, 'The expansion action must disappear once the complete compatible source set is active.');
      await page.screenshot({ path: `${outputDirectory}/full-comparison-desktop.png`, fullPage: false });
    }
    await page.close();
  }
  console.log(JSON.stringify({ ok: true, automaticDetection: true, automaticPatch: true, automaticVerification: true, approvalButton: false, explicitFullComparison: true, desktop: true, mobile: true }, null, 2));
} finally {
  await browser.close();
}

import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.TRIPWEAVE_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  let runCount = 0;
  let approved = false;
  await page.route('**/api/self-heal/config', (route) => route.fulfill({ json: {
    connected: true, configured: true, collectorId: 'c_test_recovery',
    targetHealthyUrl: `${baseUrl}/self-heal-target?version=healthy`,
    targetBrokenUrl: `${baseUrl}/self-heal-target?version=broken`,
  } }));
  await page.route('**/api/self-heal/run', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    runCount += 1;
    return route.fulfill({ status: 202, json: { collectionId: `j_test${runCount}`, version: runCount === 1 ? 'healthy' : 'broken' } });
  });
  await page.route('**/api/self-heal/run/j_test*', (route) => {
    const id = route.request().url().match(/j_test\d/)?.[0];
    const records = id === 'j_test2' ? [] : [{ hotels: [{ name: 'Rambagh Palace', location: 'Jaipur', rating: 4.9, price: '₹18,500' }] }];
    return route.fulfill({ json: { status: 'ready', collectionId: id, records } });
  });
  await page.route('**/api/self-heal/heal', (route) => {
    if (route.request().method() === 'POST') return route.fulfill({ status: 202, json: { collectorId: 'c_test_recovery' } });
    return route.fulfill({ json: approved
      ? { status: 'done', terminal: true, completedSteps: ['repair saved'] }
      : { status: 'pending_answer', awaitingApproval: true, completedSteps: ['page inspected'], previewResult: [{ hotels: [{ name: 'Rambagh Palace' }] }], diff: { template_b: { steps: [1] } } } });
  });
  await page.route('**/api/self-heal/heal/decision', (route) => { approved = true; return route.fulfill({ json: { approved: true } }); });

  await page.goto(`${baseUrl}/self-heal`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('.real-target-panel').count(), 1, 'target website should render separately');
  assert.equal(await page.locator('.real-control-panel').count(), 1, 'Bright Data control should render separately');

  await page.getByRole('button', { name: 'Run healthy collector' }).click();
  await page.getByRole('button', { name: 'Break target website' }).waitFor({ timeout: 5_000 });
  assert.match(await page.locator('.real-dataset').innerText(), /1 extracted hotels/i);
  await page.getByRole('button', { name: 'Break target website' }).click();
  await page.getByRole('button', { name: 'Run same collector again' }).click();
  await page.getByRole('button', { name: 'Start real self-heal' }).waitFor({ timeout: 5_000 });
  assert.match(await page.locator('.real-dataset').innerText(), /0 extracted hotels/i);
  await page.getByRole('button', { name: 'Start real self-heal' }).click();
  await page.getByRole('button', { name: 'Approve and save repair' }).waitFor({ timeout: 5_000 });
  await page.getByRole('button', { name: 'Approve and save repair' }).click();
  await page.getByRole('button', { name: 'Verify repaired collector' }).waitFor({ timeout: 5_000 });
  await page.getByRole('button', { name: 'Verify repaired collector' }).click();
  await page.getByRole('button', { name: 'Recovery verified' }).waitFor({ timeout: 5_000 });
  assert.match(await page.locator('.real-dataset').innerText(), /1 extracted hotels/i);

  const healthy = await browser.newPage();
  await healthy.goto(`${baseUrl}/self-heal-target?version=healthy`, { waitUntil: 'networkidle' });
  assert.equal(await healthy.locator('[data-qa="property-card"]').count(), 3, 'healthy target should expose V1 selectors');
  assert.equal(await healthy.locator('[data-qa="listing-tile-v2"]').count(), 0);
  await healthy.goto(`${baseUrl}/self-heal-target?version=broken`, { waitUntil: 'networkidle' });
  assert.equal(await healthy.locator('[data-qa="property-card"]').count(), 0, 'broken target should remove every V1 card selector');
  assert.equal(await healthy.locator('[data-qa="listing-tile-v2"]').count(), 3, 'broken target should expose V2 selectors');

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, 'mobile recovery lab must not overflow horizontally');
  console.log(JSON.stringify({ ok: true, baselineHotels: 1, brokenHotels: 0, verifiedHotels: 1, approvalGate: true, targetDomVersions: 2, mobileOverflow: overflow }));
} finally {
  await browser.close();
}

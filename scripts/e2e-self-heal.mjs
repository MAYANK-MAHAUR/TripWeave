import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.TRIPWEAVE_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${baseUrl}/self-heal`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('.self-heal-page').count(), 1, 'self-heal page should render');
  assert.equal(await page.locator('.fixture-list article').count(), 3, 'healthy fixture should show three properties');
  assert.equal(await page.locator('.output-row').count(), 3, 'healthy collector should return three records');

  await page.getByRole('button', { name: 'Break the page' }).click();
  await page.getByText('BROKEN', { exact: true }).waitFor({ timeout: 2_000 });
  assert.equal(await page.locator('.empty-output').count(), 1, 'changed selectors should return an explicit empty state');
  assert.equal(await page.locator('.output-row').count(), 0, 'broken collector must not invent records');

  await page.getByRole('button', { name: 'Run self-heal' }).click();
  await page.getByText('HEALED', { exact: true }).waitFor({ timeout: 3_000 });
  assert.equal(await page.locator('.output-row').count(), 3, 'healed selector recipe should restore all records');
  assert.match(await page.locator('.json-preview').innerText(), /Rambagh Palace/, 'healed JSON should contain a real fixture record');

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, 'mobile demo must not overflow horizontally');
  console.log(JSON.stringify({ ok: true, healthyRecords: 3, brokenRecords: 0, healedRecords: 3, mobileOverflow: overflow }));
} finally {
  await browser.close();
}

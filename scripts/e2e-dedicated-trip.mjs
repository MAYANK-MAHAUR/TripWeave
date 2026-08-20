import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.TRIPWEAVE_URL || 'http://127.0.0.1:5173';
const knownTripId = process.env.TRIPWEAVE_TEST_TRIP_ID || 'ff84c155-1767-4f49-8640-90934c2e9d73';
const outputDirectory = 'test-output';
await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({ headless: true });
const browserMessages = [];
const watchPage = (page) => {
  page.on('pageerror', (error) => browserMessages.push(`pageerror: ${error.message}`));
  page.on('requestfailed', (request) => browserMessages.push(`requestfailed: ${request.url()} / ${request.failure()?.errorText || 'unknown'}`));
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type()) && !/GL Driver Message/.test(message.text())) browserMessages.push(`${message.type()}: ${message.text()}`);
  });
};

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
  watchPage(desktop);
  await desktop.goto(baseUrl, { waitUntil: 'networkidle' });
  const cityFields = desktop.locator('input[placeholder="City or airport"]');
  await cityFields.nth(0).fill('Delhi');
  await cityFields.nth(1).fill('Mumbai');
  const dateFields = desktop.locator('input[type="date"]');
  await dateFields.nth(0).fill('2026-10-12');
  await dateFields.nth(1).fill('2026-10-14');
  await desktop.getByRole('button', { name: 'Search live trip' }).click();
  await desktop.waitForURL(/\/trip\/[0-9a-f-]+$/, { timeout: 15_000 });
  await desktop.getByText('Delhi → Mumbai', { exact: false }).first().waitFor({ timeout: 15_000 });
  assert.equal(await desktop.locator('.hero').count(), 0, 'The landing hero must not render on a trip page.');
  assert.equal(await desktop.locator('.trip-page').count(), 1, 'The result must render on a dedicated trip page.');
  assert.equal(await desktop.locator('.trip-row').count(), 3, 'The cached real test job should expose three composed journeys.');
  await desktop.screenshot({ path: `${outputDirectory}/trip-page-desktop.png`, fullPage: false });

  await desktop.evaluate(() => window.scrollTo(0, 1200));
  await desktop.reload({ waitUntil: 'networkidle' });
  await desktop.locator('.trip-row').first().waitFor({ timeout: 15_000 });
  await desktop.waitForTimeout(300);
  assert.ok((await desktop.evaluate(() => window.scrollY)) < 5, 'A refreshed trip page must restore at the top.');

  await desktop.getByRole('button', { name: 'Open guided route' }).click();
  await desktop.locator('canvas').waitFor({ timeout: 20_000 });
  await desktop.getByRole('button', { name: 'Next stop' }).click();
  await desktop.getByRole('heading', { name: 'Mumbai arrival' }).waitFor();
  await desktop.waitForTimeout(3000);
  await desktop.screenshot({ path: `${outputDirectory}/guided-route-desktop.png`, fullPage: false });
  await desktop.getByRole('button', { name: 'Close guided route' }).click();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  watchPage(mobile);
  await mobile.goto(`${baseUrl}/trip/${knownTripId}`, { waitUntil: 'networkidle' });
  await mobile.locator('.trip-row').first().waitFor({ timeout: 15_000 });
  assert.ok((await mobile.evaluate(() => window.scrollY)) < 5, 'A direct mobile trip URL must open at the top.');
  assert.equal(await mobile.locator('.hero').count(), 0, 'The landing hero must stay off the mobile trip page.');
  await mobile.screenshot({ path: `${outputDirectory}/trip-page-mobile.png`, fullPage: false });

  assert.deepEqual(browserMessages, [], `Browser emitted errors or warnings:\n${browserMessages.join('\n')}`);
  console.log(JSON.stringify({ ok: true, tripUrl: desktop.url(), desktopJourneys: 3, globeCanvas: true, mobile: true }, null, 2));
} finally {
  await browser.close();
}

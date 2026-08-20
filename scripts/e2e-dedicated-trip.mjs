import assert from 'node:assert/strict';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.TRIPWEAVE_URL || 'http://127.0.0.1:5173';
const outputDirectory = 'test-output';
await mkdir(outputDirectory, { recursive: true });

const cachedFiles = await readdir('server/.cache').catch(() => []);
const cachedRecords = (await Promise.all(cachedFiles.filter((file) => file.endsWith('.json')).map(async (file) => {
  try { return JSON.parse(await readFile(`server/.cache/${file}`, 'utf8')); } catch { return null; }
}))).filter((record) => record?.result?.result?.journeys?.length);
const selectedCache = cachedRecords
  .filter((record) => !process.env.TRIPWEAVE_TEST_TRIP_ID || record.result.id === process.env.TRIPWEAVE_TEST_TRIP_ID)
  .sort((a, b) => b.at - a.at)[0];
assert.ok(selectedCache, 'Run one real trip first, or set TRIPWEAVE_TEST_TRIP_ID to a cached real job.');
const knownTripId = selectedCache.result.id;
const knownQuery = selectedCache.result.query;
const knownDestination = selectedCache.result.result.destination;
const expectedJourneys = selectedCache.result.result.journeys.length;
const canReuseFormCache = Date.now() - selectedCache.at < 14 * 60 * 1000;

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
  await desktop.screenshot({ path: `${outputDirectory}/home-desktop.png`, fullPage: false });
  if (canReuseFormCache) {
    const cityFields = desktop.locator('input[placeholder="City or airport"]');
    await cityFields.nth(0).fill(knownQuery.from);
    await cityFields.nth(1).fill(knownQuery.to);
    const dateFields = desktop.locator('input[type="date"]');
    await dateFields.nth(0).fill(knownQuery.departDate);
    await dateFields.nth(1).fill(knownQuery.returnDate);
    await desktop.locator('input[type="number"]').fill(String(knownQuery.adults));
    await desktop.getByRole('button', { name: 'Search live trip' }).click();
    await desktop.waitForURL(/\/trip\/[0-9a-f-]+$/, { timeout: 15_000 });
  } else {
    await desktop.goto(`${baseUrl}/trip/${knownTripId}`, { waitUntil: 'networkidle' });
  }
  await desktop.getByText(`${knownQuery.from} → ${knownQuery.to}`, { exact: false }).first().waitFor({ timeout: 15_000 });
  assert.equal(await desktop.locator('.hero').count(), 0, 'The landing hero must not render on a trip page.');
  assert.equal(await desktop.locator('.trip-page').count(), 1, 'The result must render on a dedicated trip page.');
  assert.equal(await desktop.locator('.trip-row').count(), expectedJourneys, 'The UI must render every composed journey in the cached real job.');
  await desktop.screenshot({ path: `${outputDirectory}/trip-page-desktop.png`, fullPage: false });

  await desktop.evaluate(() => window.scrollTo(0, 1200));
  await desktop.reload({ waitUntil: 'networkidle' });
  await desktop.locator('.trip-row').first().waitFor({ timeout: 15_000 });
  await desktop.waitForTimeout(300);
  assert.ok((await desktop.evaluate(() => window.scrollY)) < 5, 'A refreshed trip page must restore at the top.');

  await desktop.getByRole('button', { name: 'Open guided route' }).click();
  await desktop.locator('canvas').waitFor({ timeout: 20_000 });
  await desktop.getByRole('button', { name: 'Next stop' }).click();
  await desktop.getByRole('heading', { name: `${knownDestination.name} arrival` }).waitFor();
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
  console.log(JSON.stringify({ ok: true, tripUrl: desktop.url(), formNavigationTested: canReuseFormCache, desktopJourneys: expectedJourneys, globeCanvas: true, mobile: true }, null, 2));
} finally {
  await browser.close();
}

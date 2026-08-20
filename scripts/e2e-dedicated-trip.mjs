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
const knownHotel = selectedCache.result.result.journeys[0].hotel.name;
const expectedJourneys = selectedCache.result.result.journeys.length;
const canReuseFormCache = Date.now() - selectedCache.at < 14 * 60 * 1000;

const browser = await chromium.launch({ headless: true });
const browserMessages = [];
const watchPage = (page) => {
  page.on('pageerror', (error) => browserMessages.push(`pageerror: ${error.message}`));
  page.on('requestfailed', (request) => {
    const expectedCancellation = request.failure()?.errorText === 'net::ERR_ABORTED';
    if (!expectedCancellation) browserMessages.push(`requestfailed: ${request.url()} / ${request.failure()?.errorText || 'unknown'}`);
  });
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
  const routeHeading = desktop.locator('.trip-summary-copy h1');
  await routeHeading.waitFor({ timeout: 15_000 });
  await desktop.waitForFunction(({ from, to }) => {
    const text = document.querySelector('.trip-summary-copy h1')?.textContent?.toLowerCase() || '';
    return text.includes(from.toLowerCase()) && text.includes(to.toLowerCase());
  }, { from: knownQuery.from, to: knownQuery.to }, { timeout: 15_000 });
  const routeHeadingText = (await routeHeading.innerText()).toLowerCase();
  assert.ok(routeHeadingText.includes(knownQuery.from.toLowerCase()) && routeHeadingText.includes(knownQuery.to.toLowerCase()), 'The trip heading must show the selected route.');
  assert.equal(await desktop.locator('.hero').count(), 0, 'The landing hero must not render on a trip page.');
  assert.equal(await desktop.locator('.trip-page').count(), 1, 'The result must render on a dedicated trip page.');
  assert.equal(await desktop.locator('.trip-row').count(), expectedJourneys, 'The UI must render every composed journey in the cached real job.');
  await desktop.screenshot({ path: `${outputDirectory}/trip-page-desktop.png`, fullPage: false });

  await desktop.evaluate(() => window.scrollTo(0, 1200));
  await desktop.reload({ waitUntil: 'networkidle' });
  await desktop.locator('.trip-row').first().waitFor({ timeout: 15_000 });
  await desktop.waitForTimeout(300);
  assert.ok((await desktop.evaluate(() => window.scrollY)) < 5, 'A refreshed trip page must restore at the top.');

  await desktop.locator('.trip-row').first().click();
  await desktop.locator('.plan-detail-modal').waitFor();
  const modalBox = await desktop.locator('.plan-detail-shell').boundingBox();
  assert.ok(modalBox && modalBox.y >= 0 && modalBox.y + modalBox.height <= 960, 'Plan details must open fully inside the desktop viewport.');
  const kayakPlan = desktop.locator('.trip-row').filter({ hasText: 'KAYAK' }).first();
  if (await kayakPlan.count()) {
    await desktop.getByRole('button', { name: 'Close plan details' }).click();
    await kayakPlan.click();
    const kayakHref = await desktop.getByRole('link', { name: 'Open search result' }).getAttribute('href');
    assert.match(kayakHref || '', /kayak\.com\/flights\//, 'KAYAK plans must link to the stable route search page.');
    assert.doesNotMatch(kayakHref || '', /\/book\/flight/, 'Ephemeral KAYAK booking links must never reach the UI.');
  }
  await desktop.getByRole('button', { name: 'Start guided trip' }).click();
  await desktop.locator('.route-tour-overlay').waitFor();
  await desktop.locator('.tour-globe-scene canvas').waitFor({ timeout: 20_000 });
  const tourBox = await desktop.locator('.route-tour-overlay').boundingBox();
  assert.ok(tourBox && tourBox.x === 0 && tourBox.y === 0 && Math.round(tourBox.width) === 1440 && Math.round(tourBox.height) === 960, 'The guided trip must occupy the complete viewport.');
  const stageButtons = desktop.locator('.tour-stage-dots button');
  const hotelStageIndex = await stageButtons.evaluateAll((buttons, hotelName) => buttons.findIndex((button) => (button.getAttribute('aria-label') || '').includes(hotelName)), knownHotel);
  assert.ok(hotelStageIndex >= 0, 'The guided trip must include a hotel stage.');
  await stageButtons.nth(hotelStageIndex).click({ force: true });
  await desktop.locator('.tour-map-canvas canvas').waitFor({ timeout: 20_000 });
  await desktop.locator('.tour-hotel-card').waitFor();
  assert.equal(await desktop.locator('.tour-hotel-card img').count(), 1, 'The selected hotel must have a visual preview.');
  assert.ok(await desktop.getByText(/Matched hotel location|Approximate hotel area/).isVisible(), 'The hotel location accuracy must be visible.');
  await desktop.screenshot({ path: `${outputDirectory}/guided-route-desktop.png`, fullPage: false });
  await desktop.keyboard.press('Escape');
  await desktop.locator('.route-tour-overlay').waitFor({ state: 'detached' });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  watchPage(mobile);
  await mobile.goto(`${baseUrl}/trip/${knownTripId}`, { waitUntil: 'networkidle' });
  await mobile.locator('.trip-row').first().waitFor({ timeout: 15_000 });
  assert.ok((await mobile.evaluate(() => window.scrollY)) < 5, 'A direct mobile trip URL must open at the top.');
  assert.equal(await mobile.locator('.hero').count(), 0, 'The landing hero must stay off the mobile trip page.');
  await mobile.screenshot({ path: `${outputDirectory}/trip-page-mobile.png`, fullPage: false });
  await mobile.locator('.trip-row').first().click();
  await mobile.getByRole('button', { name: 'Start guided trip' }).click();
  await mobile.locator('.route-tour-overlay').waitFor();
  const mobileTourBox = await mobile.locator('.route-tour-overlay').boundingBox();
  assert.ok(mobileTourBox && Math.round(mobileTourBox.width) === 390 && Math.round(mobileTourBox.height) === 844, 'The mobile tour must remain inside the viewport.');
  const mobileHotelStage = mobile.locator('.tour-stage-dots button').filter({ has: mobile.locator('span', { hasText: 'hotel' }) });
  await mobileHotelStage.click({ force: true });
  await mobile.locator('.tour-hotel-card').waitFor();
  await mobile.locator('.tour-scene-map .tour-visual-loading').waitFor({ state: 'hidden', timeout: 20_000 });
  await mobile.screenshot({ path: `${outputDirectory}/guided-route-mobile.png`, fullPage: false });
  await mobile.getByRole('button', { name: 'Close guided route' }).click();

  const reduced = await browser.newPage({ viewport: { width: 1100, height: 760 }, reducedMotion: 'reduce' });
  watchPage(reduced);
  await reduced.goto(`${baseUrl}/trip/${knownTripId}`, { waitUntil: 'networkidle' });
  await reduced.locator('.trip-row').first().click();
  await reduced.getByRole('button', { name: 'Start guided trip' }).click();
  await reduced.locator('.tour-play-toggle').filter({ hasText: 'Next stop' }).waitFor();
  const reducedStage = await reduced.locator('.tour-step-label').innerText();
  await reduced.waitForTimeout(1200);
  assert.equal(await reduced.locator('.tour-step-label').innerText(), reducedStage, 'Reduced-motion mode must not autoplay animated stages.');
  await reduced.keyboard.press('Escape');
  await reduced.close();

  assert.deepEqual(browserMessages, [], `Browser emitted errors or warnings:\n${browserMessages.join('\n')}`);
  console.log(JSON.stringify({ ok: true, tripUrl: desktop.url(), formNavigationTested: canReuseFormCache, desktopJourneys: expectedJourneys, globeCanvas: true, localMapCanvas: true, hotelReveal: true, mobile: true }, null, 2));
} finally {
  await browser.close();
}

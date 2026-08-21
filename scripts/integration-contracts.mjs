import assert from 'node:assert/strict';
import { COLLECTORS, DEFAULT_COLLECTOR_IDS } from '../server/config.js';
import { buildCollectorUrls, normalizeTripQuery } from '../server/urls.js';
import { pairRoundTripTransports, stableTransportSourceUrl } from '../server/normalize.js';
import { buildTourPayload, buildTourStages } from '../server/tour.js';
import { interpolateGreatCircle } from '../src/tourGeometry.js';
import { selectCollectorsForRoute, selectFallbackCollectors } from '../server/collectorPolicy.js';
import { buildAutomaticHealPrompt, findAutomaticRecoveryCandidates } from '../server/collectorRecovery.js';
import { decideCollectorSelfHealing, readCollectorSelfHealingProgress, triggerCollectorSelfHealing } from '../server/selfHealing.js';

const expectedCollectorIds = {
  kayak: '',
  skyscanner: 'c_mt33xxeo1713z4li9p',
  omio: 'c_mt337hga2lec1lla6q',
  twelveGo: 'c_mt33etd41dqlhth1m7',
  redBus: 'c_mt33jayw26hs1jhoie',
  booking: 'c_mt3447092rktiat9du',
  expedia: 'c_mt33v27020zig1s19b',
  tripAdvisor: 'c_mt33qv8j48f0fd34q',
};

assert.deepEqual(DEFAULT_COLLECTOR_IDS, expectedCollectorIds, 'Committed fallbacks must point only to the newly supplied account collectors.');
assert.deepEqual(Object.fromEntries(Object.entries(COLLECTORS).map(([key, value]) => [key, value.id])), expectedCollectorIds);
assert.ok(['twelveGo', 'redBus', 'booking', 'expedia'].every((key) => COLLECTORS[key].enabled), 'Every collector that passed the project contract must remain enabled.');
assert.ok(['kayak', 'skyscanner', 'omio', 'tripAdvisor'].every((key) => !COLLECTORS[key].enabled), 'Missing, broken, route-unsafe, or runaway collectors must remain quarantined.');
assert.ok(Object.values(COLLECTORS).every((collector) => collector.allowBatch === false), 'Automatic batch replay must stay disabled to prevent duplicate page-load spend.');
assert.equal(COLLECTORS.booking.selfHealing, false, 'The pre-built Booking.com source must not be rewritten by the custom Scraper Studio repair flow.');
assert.ok(['twelveGo', 'redBus', 'expedia'].every((key) => COLLECTORS[key].selfHealing), 'Every active custom production collector must opt into automatic Self-Healing.');
assert.equal(COLLECTORS.tripAdvisor.composable, false, 'Undated TripAdvisor prices must not enter composed totals.');
assert.equal(COLLECTORS.tripAdvisor.input.max_pages, 1, 'The optional TripAdvisor reference crawl must stay on one listing page.');

const query = normalizeTripQuery({ from: 'Singapore', to: 'Kochi', departDate: '2026-11-05', returnDate: '2026-11-09', adults: 3 });
const urls = buildCollectorUrls(query, { name: 'Singapore', iata: 'SIN' }, { name: 'Kochi', iata: 'COK' }, { tripAdvisorLocationId: '297633' });
assert.equal(Object.values(urls).filter(Boolean).length, 9);
assert.match(urls.kayak, /SIN-COK\/2026-11-05\/2026-11-09/);
assert.match(urls.skyscanner, /sin\/cok\/261105\/261109/);
assert.match(urls.twelveGo, /singapore\/kochi\?date=2026-11-05&people=3/);
assert.match(urls.twelveGoReturn, /kochi\/singapore\?date=2026-11-09&people=3/);
assert.match(urls.redBus, /singapore-to-kochi\?onward=05-Nov-2026/);
assert.match(urls.redBusReturn, /kochi-to-singapore\?onward=09-Nov-2026/);
assert.match(urls.booking, /ss=Kochi.*checkin=2026-11-05.*checkout=2026-11-09.*group_adults=3/);
assert.match(urls.expedia, /destination=Kochi.*startDate=2026-11-05.*endDate=2026-11-09.*adults=3/);
assert.match(urls.tripAdvisor, /Hotels-g297633-Kochi-Hotels\.html/);
assert.throws(() => normalizeTripQuery({ from: 'A', to: 'B', departDate: '2026-11-09', returnDate: '2026-11-05' }), /after departure/);
assert.equal(stableTransportSourceUrl({ booking_url: 'https://www.kayak.com/book/flight?code=expired' }, { key: 'kayak', url: urls.kayak }), urls.kayak, 'KAYAK must use the stable route search URL instead of an expiring booking URL.');

const paired = pairRoundTripTransports([
  { id: 'out', tripLeg: 'outbound', collectorKey: 'redBus', mode: 'Bus', operator: 'Out Bus', amountInr: 1200, source: 'redBus', sourceUrl: 'https://example.com/out', durationMinutes: 600 },
  { id: 'back', tripLeg: 'return', collectorKey: 'redBus', mode: 'Bus', operator: 'Back Bus', amountInr: 900, source: 'redBus', sourceUrl: 'https://example.com/back', durationMinutes: 590 },
]);
assert.equal(paired.length, 1);
assert.equal(paired[0].amountInr, 2100, 'Separated ground legs must be summed once.');
assert.deepEqual(paired[0].missing, [], 'A paired ground route must include the return leg.');

const incomplete = pairRoundTripTransports([
  { id: 'one-way', tripLeg: 'outbound', collectorKey: 'twelveGo', mode: 'Train', operator: 'Rail', amountInr: 700, source: '12Go', durationMinutes: 300 },
]);
assert.deepEqual(incomplete[0].missing, ['return transport'], 'One-way ground prices must stay explicitly partial.');

const tourOrigin = { name: 'Delhi', iata: 'DEL', lat: 28.5562, lng: 77.1, airport: 'Indira Gandhi International Airport', country: 'IN' };
const tourDestination = { name: 'New York', iata: 'JFK', lat: 40.6413, lng: -73.7781, airport: 'John F. Kennedy International Airport', country: 'US' };
const tourHotel = { id: 'stay-1', name: 'Test Stay', location: 'Manhattan', sourceUrl: 'https://example.com/hotel', amountInr: 32000 };
const tourPlaces = [
  { name: 'Museum One', category: 'museum', lat: 40.7794, lng: -73.9632 },
  { name: 'Viewpoint Two', category: 'viewpoint', lat: 40.7484, lng: -73.9857 },
  { name: 'Attraction Three', category: 'attraction', lat: 40.6892, lng: -74.0445 },
];
const tourStages = buildTourStages({ origin: tourOrigin, destination: tourDestination, hotel: { ...tourHotel, lat: 40.77, lng: -73.98 }, places: tourPlaces, mode: 'Flight' });
assert.deepEqual(tourStages.map((stage) => stage.kind), ['overview', 'origin', 'route', 'arrival', 'city', 'hotel', 'attraction', 'attraction', 'finish']);
assert.equal(tourStages.filter((stage) => stage.kind === 'attraction').length, 2, 'Autoplay must visit no more than two nearby places.');
assert.ok(tourStages.reduce((total, stage) => total + stage.durationMs, 0) >= 30_000, 'The complete cinematic tour should run for roughly thirty seconds.');
const tourPayload = buildTourPayload({
  job: { id: 'trip-1', result: { origin: tourOrigin, destination: tourDestination, places: tourPlaces, journeys: [] } },
  journey: { id: 'journey-1', modes: ['Flight', 'Hotel'], totalText: '₹1,00,000', totalInr: 100000, breakdown: [], coverage: { complete: true, missing: [] }, transport: { mode: 'Flight' }, hotel: tourHotel },
  hotelLocation: { lat: 40.7707, lng: -73.9804, displayName: 'West 63rd Street', locationAccuracy: 'matched' },
});
assert.equal(tourPayload.hotel.locationAccuracy, 'matched');
assert.equal(tourPayload.places.length, 3, 'The local map may display up to four real place pins.');
const dateLineMidpoint = interpolateGreatCircle({ lat: 10, lng: 170 }, { lat: 10, lng: -170 }, 0.5);
assert.ok(Math.abs(Math.abs(dateLineMidpoint.lng) - 180) < 0.001, 'Great-circle interpolation must cross the antimeridian by the short path.');
const longRoutePolicy = selectCollectorsForRoute(COLLECTORS, tourOrigin, tourDestination);
assert.deepEqual(longRoutePolicy.primaryEntries.map(([key]) => key), ['booking'], 'Long-distance searches must not spend credits on quarantined flight collectors.');
assert.deepEqual(longRoutePolicy.fallbackEntries.map(([key]) => key), ['expedia'], 'Only verified long-distance alternatives may remain available as fallbacks.');
const fullLongRoutePolicy = selectCollectorsForRoute(COLLECTORS, tourOrigin, tourDestination, { fullComparison: true, includeReferenceSources: true });
assert.deepEqual(fullLongRoutePolicy.primaryEntries.map(([key]) => key), ['booking', 'expedia'], 'A requested full comparison must still exclude quarantined sources.');
assert.deepEqual(fullLongRoutePolicy.fallbackEntries, [], 'Full comparison sources must run in one explicit wave rather than as automatic fallbacks.');
const shortRoutePolicy = selectCollectorsForRoute(COLLECTORS, { lat: 28.6139, lng: 77.209 }, { lat: 26.9124, lng: 75.7873 });
assert.ok(shortRoutePolicy.primaryEntries.some(([key]) => key === 'twelveGo'), 'Short routes should start with a multimodal ground source.');
assert.ok(shortRoutePolicy.fallbackEntries.some(([key]) => key === 'redBus'), 'redBus must remain available when the primary ground source has too few offers.');
assert.ok(!shortRoutePolicy.primaryEntries.some(([key]) => key === 'tripAdvisor'), 'Reference-only collectors should run only when explicitly requested.');
const longDomesticPolicy = selectCollectorsForRoute(COLLECTORS, { lat: 28.6139, lng: 77.209, country: 'IN' }, { lat: 9.9312, lng: 76.2673, country: 'IN' });
assert.ok(longDomesticPolicy.primaryEntries.some(([key]) => key === 'twelveGo'), 'Long domestic routes must retain train and ground options in the primary wave.');
const enoughCoreOffers = {
  offers: {
    transports: [
      ...Array.from({ length: 4 }, (_, index) => ({ mode: 'Flight', id: `flight-${index}` })),
      ...Array.from({ length: 4 }, (_, index) => ({ mode: 'Train', id: `ground-${index}` })),
    ],
    hotels: Array.from({ length: 4 }, (_, index) => ({ id: `hotel-${index}` })),
  },
};
assert.deepEqual(selectFallbackCollectors(shortRoutePolicy.fallbackEntries, enoughCoreOffers).map(([key]) => key), [], 'Fallback collectors must not run when core category coverage is already useful.');
const missingCoreOffers = { offers: { transports: [], hotels: [] } };
assert.deepEqual(selectFallbackCollectors(shortRoutePolicy.fallbackEntries, missingCoreOffers).map(([key]) => key), ['redBus', 'expedia'], 'Only verified missing-category fallbacks should run.');

const failedGroundTask = {
  key: 'twelveGo', collectorKey: 'twelveGo', url: urls.twelveGo,
  definition: { ...COLLECTORS.twelveGo, collectorKey: 'twelveGo', sourceLabel: '12Go', tripLeg: 'outbound' },
};
const automaticHealPrompt = buildAutomaticHealPrompt({
  task: failedGroundTask,
  source: { status: 'failed', error: 'The current selector returned no route cards after the public layout changed.' },
});
assert.ok(automaticHealPrompt.length <= 1000, 'Production Self-Healing prompts must respect Bright Data’s 1,000-character limit.');
assert.match(automaticHealPrompt, /same|current output schema/i);
assert.match(automaticHealPrompt, /at most 20/i);
assert.match(automaticHealPrompt, /Do not paginate/i);
const recoveryCandidates = findAutomaticRecoveryCandidates({
  tasks: [failedGroundTask, { key: 'booking', collectorKey: 'booking', url: urls.booking, definition: { ...COLLECTORS.booking, collectorKey: 'booking', sourceLabel: 'Booking.com' } }],
  normalized: { sources: [
    { key: 'twelveGo', status: 'failed', rows: 0, error: 'Selectors no longer match.' },
    { key: 'booking', status: 'complete', rows: 0 },
  ] },
  maxCandidates: 2,
});
assert.deepEqual(recoveryCandidates.map((candidate) => candidate.task.collectorKey), ['twelveGo'], 'Only failed or empty custom collectors should enter the automatic repair queue.');
assert.deepEqual(findAutomaticRecoveryCandidates({ tasks: [failedGroundTask], normalized: { sources: [{ key: 'twelveGo', status: 'failed', rows: 0, error: 'Selectors no longer match.' }] }, maxCandidates: 0 }), [], 'Setting the per-trip repair budget to zero must disable automatic repair completely.');
assert.deepEqual(findAutomaticRecoveryCandidates({ tasks: [failedGroundTask], normalized: { sources: [{ key: 'twelveGo', status: 'failed', rows: 0, error: 'Bright Data credit quota is exhausted.' }] }, maxCandidates: 1 }), [], 'Authentication, quota, and credit failures must never trigger a scraper rewrite.');
assert.deepEqual(findAutomaticRecoveryCandidates({ tasks: [failedGroundTask], normalized: { sources: [{ key: 'twelveGo', kind: 'route', status: 'complete', rows: 0 }] }, maxCandidates: 1 }), [], 'A legitimate no-results route must not trigger a rewrite without evidence from a working peer source.');
assert.deepEqual(findAutomaticRecoveryCandidates({ tasks: [failedGroundTask], normalized: { sources: [{ key: 'twelveGo', kind: 'route', status: 'complete', rows: 0 }, { key: 'redBus', kind: 'bus', status: 'complete', rows: 5 }] }, maxCandidates: 1 }).map((candidate) => candidate.task.collectorKey), ['twelveGo'], 'Empty output should trigger repair when a peer source proves that the route has live listings.');

const originalFetch = globalThis.fetch;
const originalBrightDataToken = process.env.BRIGHT_DATA_API_TOKEN;
const selfHealingRequests = [];
process.env.BRIGHT_DATA_API_TOKEN = 'contract-test-token';
globalThis.fetch = async (url, options = {}) => {
  selfHealingRequests.push({ url: String(url), options });
  if (String(url).endsWith('/progress')) return new Response(JSON.stringify({ status: 'pending_answer', step: 'diff_ready' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
await triggerCollectorSelfHealing({ collectorId: COLLECTORS.twelveGo.id, targetUrl: urls.twelveGo, prompt: automaticHealPrompt });
const mockedProgress = await readCollectorSelfHealingProgress(COLLECTORS.twelveGo.id);
await decideCollectorSelfHealing({ collectorId: COLLECTORS.twelveGo.id, approve: true, autoSave: true });
globalThis.fetch = originalFetch;
if (originalBrightDataToken === undefined) delete process.env.BRIGHT_DATA_API_TOKEN;
else process.env.BRIGHT_DATA_API_TOKEN = originalBrightDataToken;
assert.equal(mockedProgress.awaitingApproval, true);
assert.match(selfHealingRequests[0].url, new RegExp(`${COLLECTORS.twelveGo.id}/refactor_template$`));
assert.deepEqual(JSON.parse(selfHealingRequests[0].options.body).custom_input, [{ url: urls.twelveGo }]);
assert.deepEqual(JSON.parse(selfHealingRequests[2].options.body), { message: true, auto_save: true }, 'Automatic recovery must approve and auto-save the patch to the same Collector ID.');

console.log(JSON.stringify({ ok: true, configuredCollectors: Object.keys(expectedCollectorIds).length, activeCollectors: Object.values(COLLECTORS).filter((collector) => collector.enabled).length, primaryLongRouteInputs: 1, fullLongRouteInputs: 2, primaryDomesticInputs: 2, fallbackOnlyWhenNeeded: true, quarantinedCollectorsExcluded: true, userRequestedFullComparison: true, batchReplayDisabled: true, automaticSelfHealing: true, selfHealingAutoSave: true, dynamicRoute: 'SIN→COK', groundRoundTripPairing: true, cinematicTourStages: tourStages.length, antimeridianRoute: true }, null, 2));

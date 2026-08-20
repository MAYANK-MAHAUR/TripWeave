import assert from 'node:assert/strict';
import { COLLECTORS } from '../server/config.js';
import { buildCollectorUrls, normalizeTripQuery } from '../server/urls.js';
import { pairRoundTripTransports } from '../server/normalize.js';

const expectedCollectorIds = {
  kayak: 'c_mt1kuf7t24xwbky91k',
  skyscanner: 'c_mt1gvyy0zo7nkno1q',
  omio: 'c_mt1l31is2bxc0ik7xc',
  twelveGo: 'c_mt1kwgiug9ovbtk0m',
  redBus: 'c_mt1kvbvy1jp1i1waqf',
  booking: 'c_mt1gsvms2n4aypgvl9',
  expedia: 'c_mt1han2523l6qju6c4',
  tripAdvisor: 'c_mt1hc6x0rqqlh3jzi',
};

assert.deepEqual(Object.fromEntries(Object.entries(COLLECTORS).map(([key, value]) => [key, value.id])), expectedCollectorIds);
assert.ok(Object.values(COLLECTORS).every((collector) => collector.enabled), 'Every user-provided collector must remain enabled.');
assert.equal(COLLECTORS.tripAdvisor.composable, false, 'Undated TripAdvisor prices must not enter composed totals.');

const query = normalizeTripQuery({ from: 'Singapore', to: 'Kochi', departDate: '2026-11-05', returnDate: '2026-11-09', adults: 3 });
const urls = buildCollectorUrls(query, { name: 'Singapore', iata: 'SIN' }, { name: 'Kochi', iata: 'COK' }, { tripAdvisorLocationId: '297633' });
assert.equal(Object.values(urls).filter(Boolean).length, 11);
assert.match(urls.kayak, /SIN-COK\/2026-11-05\/2026-11-09/);
assert.match(urls.skyscanner, /sin\/cok\/261105\/261109/);
assert.match(urls.omio, /singapore\/kochi\?date=2026-11-05/);
assert.match(urls.omioReturn, /kochi\/singapore\?date=2026-11-09/);
assert.match(urls.twelveGo, /singapore\/kochi\?date=2026-11-05&people=3/);
assert.match(urls.twelveGoReturn, /kochi\/singapore\?date=2026-11-09&people=3/);
assert.match(urls.redBus, /singapore-to-kochi\?onward=05-Nov-2026/);
assert.match(urls.redBusReturn, /kochi-to-singapore\?onward=09-Nov-2026/);
assert.match(urls.booking, /ss=Kochi.*checkin=2026-11-05.*checkout=2026-11-09.*group_adults=3/);
assert.match(urls.expedia, /destination=Kochi.*startDate=2026-11-05.*endDate=2026-11-09.*adults=3/);
assert.match(urls.tripAdvisor, /Hotels-g297633-Kochi-Hotels\.html/);
assert.throws(() => normalizeTripQuery({ from: 'A', to: 'B', departDate: '2026-11-09', returnDate: '2026-11-05' }), /after departure/);

const paired = pairRoundTripTransports([
  { id: 'out', tripLeg: 'outbound', collectorKey: 'redBus', mode: 'Bus', operator: 'Out Bus', amountInr: 1200, source: 'redBus', sourceUrl: 'https://example.com/out', durationMinutes: 600 },
  { id: 'back', tripLeg: 'return', collectorKey: 'redBus', mode: 'Bus', operator: 'Back Bus', amountInr: 900, source: 'redBus', sourceUrl: 'https://example.com/back', durationMinutes: 590 },
]);
assert.equal(paired.length, 1);
assert.equal(paired[0].amountInr, 2100, 'Separated ground legs must be summed once.');
assert.deepEqual(paired[0].missing, [], 'A paired ground route must include the return leg.');

const incomplete = pairRoundTripTransports([
  { id: 'one-way', tripLeg: 'outbound', collectorKey: 'omio', mode: 'Train', operator: 'Rail', amountInr: 700, source: 'Omio', durationMinutes: 300 },
]);
assert.deepEqual(incomplete[0].missing, ['return transport'], 'One-way ground prices must stay explicitly partial.');

console.log(JSON.stringify({ ok: true, collectors: Object.keys(expectedCollectorIds).length, requestsPerTrip: 11, dynamicRoute: 'SIN→COK', datedSources: 7, referenceSources: 1, groundRoundTripPairing: true }, null, 2));

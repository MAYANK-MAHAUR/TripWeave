import assert from 'node:assert/strict';
import { COLLECTORS } from '../server/config.js';
import { buildCollectorUrls, normalizeTripQuery } from '../server/urls.js';
import { pairRoundTripTransports, stableTransportSourceUrl } from '../server/normalize.js';
import { buildTourPayload, buildTourStages } from '../server/tour.js';
import { interpolateGreatCircle } from '../src/tourGeometry.js';
import { selectCollectorsForRoute } from '../server/collectorPolicy.js';

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
assert.equal(stableTransportSourceUrl({ booking_url: 'https://www.kayak.com/book/flight?code=expired' }, { key: 'kayak', url: urls.kayak }), urls.kayak, 'KAYAK must use the stable route search URL instead of an expiring booking URL.');

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
assert.deepEqual(longRoutePolicy.entries.map(([key]) => key), ['kayak', 'skyscanner', 'booking', 'expedia'], 'Long-distance searches should not spend credits on incompatible ground or reference-only collectors.');
const shortRoutePolicy = selectCollectorsForRoute(COLLECTORS, { lat: 28.6139, lng: 77.209 }, { lat: 26.9124, lng: 75.7873 });
assert.ok(shortRoutePolicy.entries.some(([key]) => key === 'redBus'), 'Short routes should retain useful ground transport collectors.');
assert.ok(!shortRoutePolicy.entries.some(([key]) => key === 'tripAdvisor'), 'Reference-only collectors should run only when explicitly requested.');
const longDomesticPolicy = selectCollectorsForRoute(COLLECTORS, { lat: 28.6139, lng: 77.209, country: 'IN' }, { lat: 9.9312, lng: 76.2673, country: 'IN' });
assert.ok(longDomesticPolicy.entries.some(([key]) => key === 'omio'), 'Long domestic routes must retain train and ground options.');

console.log(JSON.stringify({ ok: true, collectors: Object.keys(expectedCollectorIds).length, requestsPerTrip: 11, dynamicRoute: 'SIN→COK', datedSources: 7, referenceSources: 1, groundRoundTripPairing: true, cinematicTourStages: tourStages.length, antimeridianRoute: true, longRouteCollectors: longRoutePolicy.entries.length, referenceSourcesOnDemand: true }, null, 2));

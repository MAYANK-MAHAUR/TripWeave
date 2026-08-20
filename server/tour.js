const finitePoint = (point) => Number.isFinite(Number(point?.lat)) && Number.isFinite(Number(point?.lng));

export function buildTourStages({ origin, destination, hotel, places = [], mode = 'Flight' }) {
  const selectedPlaces = places.filter(finitePoint).slice(0, 2);
  return [
    { id: 'overview', scene: 'globe', kind: 'overview', title: `${origin.name} to ${destination.name}`, detail: 'Your complete route, from departure to check-in.', durationMs: 2500, target: origin },
    { id: 'origin', scene: 'globe', kind: 'origin', title: `Starting in ${origin.name}`, detail: `${origin.airport || origin.iata} is the first stop.`, durationMs: 3000, target: origin },
    { id: 'route', scene: 'globe', kind: 'route', title: `${mode} to ${destination.name}`, detail: mode === 'Flight' ? 'Following the great-circle flight path.' : 'Following an approximate geographic route.', durationMs: 6000, target: destination },
    { id: 'arrival', scene: 'globe', kind: 'arrival', title: `Arriving in ${destination.name}`, detail: `${destination.airport || destination.iata} connects the journey to your stay.`, durationMs: 3000, target: destination },
    { id: 'city', scene: 'local', kind: 'city', title: `${destination.name}, up close`, detail: 'Switching from the world view to the streets around your stay.', durationMs: 2600, target: destination },
    { id: 'hotel', scene: 'local', kind: 'hotel', title: hotel.name, detail: hotel.location || destination.name, durationMs: 6000, target: hotel },
    ...selectedPlaces.map((place, index) => ({ id: `place-${index + 1}`, scene: 'local', kind: 'attraction', title: place.name, detail: place.category || 'Nearby place', durationMs: 3000, target: place })),
    { id: 'finish', scene: 'local', kind: 'finish', title: 'Your trip, woven together', detail: `${mode}, stay and nearby places in one plan.`, durationMs: 2500, target: hotel },
  ];
}

export function buildTourPayload({ job, journey, hotelLocation }) {
  const trip = job.result;
  const origin = trip.origin || job.locations?.origin;
  const destination = trip.destination || job.locations?.destination;
  const hotel = {
    ...journey.hotel,
    lat: Number(hotelLocation.lat),
    lng: Number(hotelLocation.lng),
    geocodedDisplayName: hotelLocation.displayName || journey.hotel.location || destination.name,
    locationAccuracy: hotelLocation.locationAccuracy || 'city_fallback',
  };
  const places = (trip.places?.length ? trip.places : trip.allPlaces || []).filter(finitePoint).slice(0, 4);
  const mode = journey.transport?.mode || journey.modes?.find((item) => item !== 'Hotel') || 'Flight';
  return {
    tripId: job.id,
    journeyId: journey.id,
    generatedAt: new Date().toISOString(),
    origin,
    destination,
    transport: journey.transport || null,
    hotel,
    places,
    totalText: journey.totalText,
    totalInr: journey.totalInr,
    breakdown: journey.breakdown || [],
    coverage: journey.coverage,
    mode,
    pathAccuracy: mode === 'Flight' ? 'great_circle' : 'approximate',
    stages: buildTourStages({ origin, destination, hotel, places, mode }),
  };
}

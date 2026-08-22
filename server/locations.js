import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const airportPath = require.resolve('airports');
const airports = JSON.parse(fs.readFileSync(airportPath, 'utf8'))
  .filter((airport) => airport.status === 1 && airport.iata && airport.lat && airport.lon);
const locationCache = new Map();
const tripAdvisorCache = new Map();
const hotelLocationCache = new Map();
let nominatimQueue = Promise.resolve();
let lastNominatimRequestAt = 0;
const nominatimSpacingMs = 1100;

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function nominatimSearch(query, { limit = 1 } = {}) {
  const task = nominatimQueue.then(async () => {
    const delay = Math.max(0, nominatimSpacingMs - (Date.now() - lastNominatimRequestAt));
    if (delay) await wait(delay);
    lastNominatimRequestAt = Date.now();
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=${limit}&addressdetails=1&q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'TripWeave-hackathon/1.0 (travel comparison prototype)',
        'Accept-Language': 'en',
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error(`Could not resolve ${query}.`);
    return response.json();
  });
  nominatimQueue = task.catch(() => undefined);
  return task;
}

const radians = (degrees) => Number(degrees) * Math.PI / 180;
const distanceKm = (a, b) => {
  const earth = 6371;
  const latDelta = radians(b.lat - a.lat);
  const lngDelta = radians(b.lng - a.lng);
  const value = Math.sin(latDelta / 2) ** 2
    + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(lngDelta / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

function nearestAirport(coordinates) {
  const ranked = airports.map((airport) => ({
    ...airport,
    distanceKm: distanceKm(coordinates, { lat: Number(airport.lat), lng: Number(airport.lon) }),
  })).sort((a, b) => {
    const sizeRank = { large: 0, medium: 1, small: 2 };
    const unsuitable = (airport) => /air base|military|naval|raf\b/i.test(airport.name) ? 180 : 0;
    const aAdjusted = a.distanceKm + (sizeRank[a.size] ?? 2) * 35 + unsuitable(a);
    const bAdjusted = b.distanceKm + (sizeRank[b.size] ?? 2) * 35 + unsuitable(b);
    return aAdjusted - bAdjusted;
  });
  return ranked[0];
}

export async function resolveLocation(input) {
  const raw = String(input || '').trim();
  if (!raw) throw new Error('A location is required.');
  const key = raw.toLowerCase();
  if (locationCache.has(key)) return locationCache.get(key);

  const directAirport = raw.length === 3 ? airports.find((airport) => airport.iata === raw.toUpperCase()) : null;
  if (directAirport) {
    const value = { query: raw, name: directAirport.name, lat: Number(directAirport.lat), lng: Number(directAirport.lon), iata: directAirport.iata, airport: directAirport.name, country: directAirport.iso, distanceToAirportKm: 0 };
    locationCache.set(key, value);
    return value;
  }

  const [place] = await nominatimSearch(raw);
  if (!place) throw new Error(`No location found for ${raw}.`);
  const coordinates = { lat: Number(place.lat), lng: Number(place.lon) };
  const airport = nearestAirport(coordinates);
  const name = place.address?.city || place.address?.town || place.address?.state || place.name || raw;
  const value = { query: raw, name, ...coordinates, iata: airport.iata, airport: airport.name, country: place.address?.country_code?.toUpperCase() || airport.iso, distanceToAirportKm: Math.round(airport.distanceKm) };
  locationCache.set(key, value);
  return value;
}

export async function resolveHotelLocation(hotel, destination) {
  const destinationFallback = {
    lat: Number(destination?.lat),
    lng: Number(destination?.lng),
    displayName: destination?.name || hotel?.location || 'Destination area',
    locationAccuracy: 'city_fallback',
  };
  const hotelName = String(hotel?.name || '').trim();
  if (!hotelName || !Number.isFinite(destinationFallback.lat) || !Number.isFinite(destinationFallback.lng)) return destinationFallback;
  const query = [hotelName, destination?.name || hotel?.location, destination?.country].filter(Boolean).join(', ');
  const key = query.toLowerCase().replace(/\s+/g, ' ');
  if (hotelLocationCache.has(key)) return hotelLocationCache.get(key);
  try {
    const candidates = await nominatimSearch(query, { limit: 3 });
    const nearby = candidates.map((place) => ({
      lat: Number(place.lat),
      lng: Number(place.lon),
      displayName: place.display_name || hotel?.location || destination?.name,
    })).filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lng))
      .map((place) => ({ ...place, distanceKm: distanceKm(destinationFallback, place) }))
      .filter((place) => place.distanceKm <= 80)
      .sort((a, b) => a.distanceKm - b.distanceKm)[0];
    const resolved = nearby
      ? { ...nearby, locationAccuracy: 'matched' }
      : destinationFallback;
    hotelLocationCache.set(key, resolved);
    return resolved;
  } catch {
    hotelLocationCache.set(key, destinationFallback);
    return destinationFallback;
  }
}

export async function findTripAdvisorLocationId(input) {
  const location = input && typeof input === 'object' ? input : null;
  const raw = String(location?.name || input || '').trim();
  if (!raw) return null;
  const target = Number.isFinite(Number(location?.lat)) && Number.isFinite(Number(location?.lng))
    ? { lat: Number(location.lat), lng: Number(location.lng) }
    : null;
  const key = `${raw.toLowerCase()}:${target ? `${target.lat.toFixed(3)},${target.lng.toFixed(3)}` : 'name-only'}`;
  if (tripAdvisorCache.has(key)) return tripAdvisorCache.get(key);
  try {
    const searchResponse = await fetch(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(raw)}&language=en&format=json&limit=6&origin=*`, {
      headers: { 'User-Agent': 'TripWeave-hackathon/1.0 (travel comparison prototype)' },
      signal: AbortSignal.timeout(12000),
    });
    if (!searchResponse.ok) throw new Error('Wikidata search failed.');
    const search = await searchResponse.json();
    const ids = (search.search || []).map((item) => item.id).filter(Boolean);
    if (!ids.length) throw new Error('No Wikidata destination found.');
    const entityResponse = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(ids.join('|'))}&props=claims|labels&languages=en&format=json&origin=*`, {
      headers: { 'User-Agent': 'TripWeave-hackathon/1.0 (travel comparison prototype)' },
      signal: AbortSignal.timeout(12000),
    });
    if (!entityResponse.ok) throw new Error('Wikidata entity lookup failed.');
    const entityData = await entityResponse.json();
    const candidates = ids.map((id) => {
      const entity = entityData.entities?.[id];
      const tripAdvisorId = String(entity?.claims?.P3134?.[0]?.mainsnak?.datavalue?.value || '') || null;
      const coordinates = entity?.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
      const point = Number.isFinite(Number(coordinates?.latitude)) && Number.isFinite(Number(coordinates?.longitude))
        ? { lat: Number(coordinates.latitude), lng: Number(coordinates.longitude) }
        : null;
      return {
        id,
        tripAdvisorId,
        exactName: entity?.labels?.en?.value?.toLowerCase() === raw.toLowerCase(),
        distanceKm: target && point ? distanceKm(target, point) : Number.POSITIVE_INFINITY,
      };
    }).filter((candidate) => candidate.tripAdvisorId);
    const nearest = target
      ? [...candidates].filter((candidate) => Number.isFinite(candidate.distanceKm)).sort((a, b) => a.distanceKm - b.distanceKm)[0]
      : null;
    const match = nearest || candidates.find((candidate) => candidate.exactName) || candidates[0];
    const value = match?.tripAdvisorId || null;
    tripAdvisorCache.set(key, value);
    return value;
  } catch {
    tripAdvisorCache.set(key, null);
    return null;
  }
}

export async function findAttractions(destination) {
  const query = `[out:json][timeout:18];(node["tourism"~"attraction|museum|viewpoint"](around:18000,${destination.lat},${destination.lng});way["tourism"~"attraction|museum|viewpoint"](around:18000,${destination.lat},${destination.lng}););out center tags 18;`;
  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'TripWeave-hackathon/1.0' },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(22000),
    });
    if (!response.ok) return [];
    const data = await response.json();
    const seen = new Set();
    return data.elements.map((element) => ({
      name: element.tags?.name || element.tags?.['name:en'],
      category: element.tags?.tourism || 'attraction',
      lat: Number(element.lat ?? element.center?.lat),
      lng: Number(element.lon ?? element.center?.lon),
      website: element.tags?.website || element.tags?.['contact:website'] || null,
    })).filter((item) => item.name && Number.isFinite(item.lat) && !seen.has(item.name) && seen.add(item.name)).slice(0, 10);
  } catch {
    return [];
  }
}

import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const airportPath = require.resolve('airports');
const airports = JSON.parse(fs.readFileSync(airportPath, 'utf8'))
  .filter((airport) => airport.status === 1 && airport.iata && airport.lat && airport.lon);
const locationCache = new Map();
const tripAdvisorCache = new Map();

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

  const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=${encodeURIComponent(raw)}`, {
    headers: { 'User-Agent': 'TripWeave-hackathon/1.0 (travel comparison prototype)' },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`Could not resolve ${raw}.`);
  const [place] = await response.json();
  if (!place) throw new Error(`No location found for ${raw}.`);
  const coordinates = { lat: Number(place.lat), lng: Number(place.lon) };
  const airport = nearestAirport(coordinates);
  const name = place.address?.city || place.address?.town || place.address?.state || place.name || raw;
  const value = { query: raw, name, ...coordinates, iata: airport.iata, airport: airport.name, country: place.address?.country_code?.toUpperCase() || airport.iso, distanceToAirportKm: Math.round(airport.distanceKm) };
  locationCache.set(key, value);
  return value;
}

export async function findTripAdvisorLocationId(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  const key = raw.toLowerCase();
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
    const exact = ids.find((id) => entityData.entities?.[id]?.labels?.en?.value?.toLowerCase() === key && entityData.entities?.[id]?.claims?.P3134?.length);
    const match = exact || ids.find((id) => entityData.entities?.[id]?.claims?.P3134?.length);
    const value = match ? String(entityData.entities[match].claims.P3134[0]?.mainsnak?.datavalue?.value || '') || null : null;
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

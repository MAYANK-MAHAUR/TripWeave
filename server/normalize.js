import crypto from 'node:crypto';
import { getInrRates, toInr } from './rates.js';

const containers = {
  flight: ['flights', 'routes', 'results', 'data'],
  route: ['routes', 'flights', 'buses', 'results', 'data'],
  bus: ['buses', 'routes', 'results', 'data'],
  hotel: ['hotels', 'results', 'properties', 'data'],
};

const first = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');
const absoluteUrl = (value, fallback) => {
  if (!value) return fallback || null;
  try { return new URL(value, fallback).href; } catch { return fallback || null; }
};
const text = (value) => value === undefined || value === null ? null : String(value).trim() || null;
const number = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value && typeof value === 'object') return number(first(value.value, value.amount, value.price, value.total));
  const normalized = String(value || '').replace(/,/g, '');
  const matches = normalized.match(/\d+(?:\.\d+)?/g);
  return matches?.length ? Number(matches[matches.length - 1]) : null;
};
const currency = (row, value, fallback = null) => {
  const explicit = first(row.currency, value?.currency, value?.currency_code, value?.code);
  if (explicit) return String(explicit).replace(/[^A-Za-z]/g, '').toUpperCase() || fallback;
  const raw = JSON.stringify(value ?? '');
  if (raw.includes('₹')) return 'INR';
  if (raw.includes('$')) return 'USD';
  if (raw.includes('€')) return 'EUR';
  if (raw.includes('£')) return 'GBP';
  return fallback;
};
const durationMinutes = (value) => {
  const raw = String(value || '').toLowerCase();
  const hours = Number(raw.match(/(\d+(?:\.\d+)?)\s*h/)?.[1] || 0);
  const minutes = Number(raw.match(/(\d+)\s*m/)?.[1] || 0);
  return hours || minutes ? Math.round(hours * 60 + minutes) : null;
};
const modeName = (value, fallback) => {
  const raw = String(value || fallback || '').toLowerCase();
  if (raw.includes('train') || raw.includes('rail')) return 'Train';
  if (raw.includes('bus') || raw.includes('coach')) return 'Bus';
  if (raw.includes('taxi') || raw.includes('cab') || raw.includes('car')) return 'Cab';
  if (raw.includes('van')) return 'Van';
  if (fallback === 'bus') return 'Bus';
  return 'Flight';
};
const formatInr = (value) => Number.isFinite(value) ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value) : null;

function rowsFrom(payload, kind) {
  const roots = Array.isArray(payload) ? payload : payload ? [payload] : [];
  const rows = [];
  for (const root of roots) {
    if (!root || typeof root !== 'object' || root.error) continue;
    let nested = false;
    for (const key of containers[kind] || []) {
      if (Array.isArray(root[key])) { rows.push(...root[key]); nested = true; }
    }
    if (!nested && Object.keys(root).length > 1 && !root.product_page_url) rows.push(root);
  }
  return rows.filter((row) => row && typeof row === 'object' && !row.error);
}

function normalizeTransport(row, result, rates, origin, destination) {
  const priceValue = first(row.total_price, row.price, row.price_value, row.price_text, row.estimated_price_value, row.estimated_price_text);
  const code = currency(row, priceValue, result.key === 'redBus' ? 'INR' : null);
  const amount = number(priceValue);
  const amountInr = toInr(amount, code, rates);
  const mode = modeName(first(row.mode, row.transport_type, row.bus_type), result.kind === 'bus' ? 'bus' : result.kind);
  const departure = text(first(row.departure_datetime, row.departure_time_outbound, row.outbound_departure_time, row.departure_time, row.departure));
  const arrival = text(first(row.arrival_datetime, row.arrival_time_outbound, row.outbound_arrival_time, row.arrival_time, row.arrival));
  const duration = text(first(row.duration, row.duration_outbound, row.outbound_duration));
  const url = absoluteUrl(first(row.booking_url, row.source_url), result.url);
  const operator = text(first(row.airline, row.operator, row.bus_name, row.provider, row.company)) || result.label;
  return {
    id: crypto.createHash('sha1').update(`${result.key}-${operator}-${departure}-${arrival}-${amount}-${url}`).digest('hex').slice(0, 12),
    kind: 'transport', mode, operator,
    serviceNumber: text(first(row.flight_number, row.service_or_flight_number, row.bus_name)),
    origin: text(first(row.origin, row.departure_airport_outbound, row.departure_airport, row.departure_station, row.departure)) || origin.iata,
    destination: text(first(row.destination, row.arrival_airport_outbound, row.arrival_airport, row.arrival_station, row.arrival)) || destination.iata,
    departure, arrival, duration, durationMinutes: durationMinutes(duration),
    stops: text(first(row.stops, row.stops_outbound, row.outbound_stops, row.transfers, row.changes)),
    className: text(first(row.cabin_class, row.class, row.bus_type)),
    seats: text(row.seats_available), rating: number(row.rating),
    amount, currency: code, amountInr, priceText: text(first(row.price_text, typeof priceValue === 'string' ? priceValue : null)) || formatInr(amountInr),
    source: result.label, sourceUrl: url, collectorKey: result.key,
  };
}

function normalizeHotel(row, result, rates, nights) {
  const totalValue = first(row.total_price, row.price_value, row.price_text);
  const nightlyValue = first(row.nightly_price, row.price_per_night);
  const chosen = totalValue ?? nightlyValue;
  const code = currency(row, chosen, null);
  const totalAmount = number(totalValue);
  const nightlyAmount = number(nightlyValue);
  const amount = Number.isFinite(totalAmount) ? totalAmount : Number.isFinite(nightlyAmount) ? nightlyAmount * nights : null;
  const amountInr = toInr(amount, code, rates);
  const url = absoluteUrl(first(row.hotel_url, row.source_url), result.url);
  const name = text(first(row.name, row.title, row.hotel_name));
  return {
    id: crypto.createHash('sha1').update(`${result.key}-${name}-${amount}-${url}`).digest('hex').slice(0, 12),
    kind: 'hotel', name, location: text(first(row.location, row.address, row.area)),
    rating: number(row.rating), reviewCount: number(row.review_count), roomType: text(row.room_type),
    cancellation: text(row.cancellation_policy), amenities: Array.isArray(row.amenities) ? row.amenities.map(text).filter(Boolean) : [],
    imageUrl: absoluteUrl(row.image_url, result.url), amount, currency: code, amountInr,
    nightlyAmountInr: toInr(nightlyAmount, code, rates), priceText: text(first(row.price_text, typeof chosen === 'string' ? chosen : null)) || formatInr(amountInr),
    taxesText: text(row.taxes_text), source: result.label, sourceUrl: url, collectorKey: result.key,
  };
}

const uniqueBy = (items, getKey) => Array.from(new Map(items.map((item) => [getKey(item), item])).values());
const readableDuration = (minutes) => Number.isFinite(minutes) ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : 'Duration unavailable';

function composeJourneys(transports, hotels, query, origin, destination) {
  const pricedTransportPool = transports.filter((item) => Number.isFinite(item.amountInr) && item.amountInr > 0).sort((a, b) => a.amountInr - b.amountInr);
  const transportGroups = new Map();
  pricedTransportPool.forEach((item) => { const key = `${item.mode}-${item.source}`; transportGroups.set(key, [...(transportGroups.get(key) || []), item]); });
  const pricedTransport = Array.from(transportGroups.values()).flatMap((items) => items.slice(0, 4));
  const pricedHotels = hotels.filter((item) => Number.isFinite(item.amountInr) && item.amountInr > 0).sort((a, b) => a.amountInr - b.amountInr).slice(0, 7);
  const candidates = [];
  for (const transport of pricedTransport) {
    for (const hotel of pricedHotels) {
      const totalInr = transport.amountInr + hotel.amountInr;
      const missing = transport.mode === 'Cab' ? [] : ['local transfer'];
      candidates.push({
        id: `${transport.id}-${hotel.id}`,
        label: `${transport.mode} + ${hotel.name}`,
        eyebrow: missing.length ? 'PARTIAL DOOR-TO-DOOR' : 'COMPLETE ROUTE',
        totalInr,
        totalText: formatInr(totalInr),
        durationMinutes: transport.durationMinutes,
        durationText: readableDuration(transport.durationMinutes),
        modes: uniqueBy([transport.mode, 'Hotel'], (value) => value),
        sources: uniqueBy([transport.source, hotel.source], (value) => value),
        sourceUrl: transport.sourceUrl || hotel.sourceUrl,
        coverage: { complete: missing.length === 0, missing },
        confidence: Math.max(55, Math.min(98, 62 + (transport.amountInr ? 12 : 0) + (hotel.amountInr ? 12 : 0) + (transport.departure ? 5 : 0) + (hotel.rating ? 4 : 0) - missing.length * 6)),
        note: `${transport.operator} with ${hotel.name}. ${missing.length ? `Still missing a live ${missing.join(', ')} quote.` : 'All priced legs are covered.'}`,
        breakdown: [
          { label: `${transport.mode} · ${transport.operator}`, amountInr: transport.amountInr, text: transport.priceText, source: transport.source, url: transport.sourceUrl },
          { label: `${hotel.name} · stay`, amountInr: hotel.amountInr, text: hotel.priceText, source: hotel.source, url: hotel.sourceUrl },
        ],
        timeline: [
          { label: origin.iata, time: transport.departure, detail: `${transport.mode} · ${transport.operator}`, lat: origin.lat, lng: origin.lng, kind: 'transport', source: transport.source, url: transport.sourceUrl },
          { label: destination.iata, time: transport.arrival, detail: transport.duration || transport.stops || 'Arrival', lat: destination.lat, lng: destination.lng, kind: 'arrival', source: transport.source, url: transport.sourceUrl },
          { label: hotel.name, time: query.departDate, detail: `${hotel.location || destination.name} · hotel`, lat: destination.lat, lng: destination.lng, kind: 'hotel', source: hotel.source, url: hotel.sourceUrl },
        ],
        transport,
        hotel,
      });
    }
  }
  if (!candidates.length) return [];
  const cheapest = [...candidates].sort((a, b) => a.totalInr - b.totalInr)[0];
  const fastest = [...candidates].filter((item) => item.durationMinutes).sort((a, b) => a.durationMinutes - b.durationMinutes)[0];
  const highestRated = [...candidates].filter((item) => item.hotel.rating).sort((a, b) => b.hotel.rating - a.hotel.rating || a.totalInr - b.totalInr)[0];
  const balanced = [...candidates].sort((a, b) => (b.confidence - a.confidence) || (a.totalInr - b.totalInr))[0];
  const selected = uniqueBy([balanced, cheapest, fastest, highestRated, ...candidates.slice(0, 3)].filter(Boolean), (item) => item.id).slice(0, 6);
  return selected.map((item, index) => ({ ...item, label: index === 0 ? 'Best verified route' : item.id === cheapest.id ? 'Lowest observed total' : item.id === fastest?.id ? 'Fastest observed route' : item.id === highestRated?.id ? 'Highest-rated stay' : item.label, eyebrow: index === 0 ? 'RECOMMENDED' : item.eyebrow }));
}

export async function normalizeCollectorResults(results, context) {
  const rates = await getInrRates();
  const nights = Math.max(1, Math.round((new Date(context.query.returnDate) - new Date(context.query.departDate)) / 86400000));
  const transports = [];
  const hotels = [];
  const sources = [];
  for (const result of results) {
    const rawRows = result.status === 'complete' ? rowsFrom(result.payload, result.kind) : [];
    if (result.kind === 'hotel') hotels.push(...rawRows.map((row) => normalizeHotel(row, result, rates, nights)).filter((item) => item.name));
    else transports.push(...rawRows.map((row) => normalizeTransport(row, result, rates, context.origin, context.destination)));
    sources.push({ key: result.key, label: result.label, kind: result.kind, status: result.status, rows: rawRows.length, durationMs: result.durationMs, url: result.url, error: result.error || null });
  }
  const cleanTransports = uniqueBy(transports.filter((item) => item.operator), (item) => `${item.mode}-${item.operator}-${item.departure}-${item.amountInr}`);
  const cleanHotels = uniqueBy(hotels, (item) => `${item.name}-${item.amountInr}`);
  const journeys = composeJourneys(cleanTransports, cleanHotels, context.query, context.origin, context.destination);
  const totals = journeys.map((journey) => journey.totalInr);
  return {
    query: context.query,
    origin: context.origin,
    destination: context.destination,
    offers: { transports: cleanTransports, hotels: cleanHotels },
    journeys,
    observedRange: totals.length ? { minInr: Math.min(...totals), maxInr: Math.max(...totals), minText: formatInr(Math.min(...totals)), maxText: formatInr(Math.max(...totals)) } : null,
    sources,
    collectedAt: new Date().toISOString(),
  };
}

const slug = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const addDays = (date, days) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
const redBusDate = (date) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`)).replace(/ /g, '-');
const compactDate = (date) => date.slice(2).replaceAll('-', '');
const tripAdvisorSlug = (value) => String(value || '').trim().replace(/[^a-z0-9]+/gi, '_').replace(/(^_|_$)/g, '');

export function normalizeTripQuery(input = {}) {
  const departDate = /^\d{4}-\d{2}-\d{2}$/.test(input.departDate || input.date) ? (input.departDate || input.date) : null;
  if (!departDate) throw new Error('Choose a valid departure date.');
  const returnDate = /^\d{4}-\d{2}-\d{2}$/.test(input.returnDate) ? input.returnDate : addDays(departDate, 2);
  if (returnDate <= departDate) throw new Error('Return date must be after departure.');
  return {
    from: String(input.from || '').trim(),
    to: String(input.to || '').trim(),
    departDate,
    returnDate,
    adults: Math.min(4, Math.max(1, Number.parseInt(input.adults || input.travellers || 1, 10) || 1)),
    currency: String(input.currency || 'INR').toUpperCase(),
  };
}

export function buildCollectorUrls(query, origin, destination, { tripAdvisorLocationId = null } = {}) {
  const fromSlug = slug(origin.name || query.from);
  const toSlug = slug(destination.name || query.to);
  return {
    kayak: `https://www.kayak.com/flights/${origin.iata}-${destination.iata}/${query.departDate}/${query.returnDate}?sort=bestflight_a&fs=adults=${query.adults}`,
    tripFlights: `https://www.trip.com/flights/${fromSlug}-to-${toSlug}/tickets-${origin.iata.toLowerCase()}-${destination.iata.toLowerCase()}?dcity=${origin.iata.toLowerCase()}&acity=${destination.iata.toLowerCase()}&ddate=${query.departDate}&rdate=${query.returnDate}`,
    skyscanner: `https://www.skyscanner.net/transport/flights/${origin.iata.toLowerCase()}/${destination.iata.toLowerCase()}/${compactDate(query.departDate)}/${compactDate(query.returnDate)}/?adultsv2=${query.adults}&cabinclass=economy&rtn=1`,
    omio: `https://www.omio.com/flights/${fromSlug}/${toSlug}`,
    twelveGo: `https://12go.asia/en/travel/${fromSlug}/${toSlug}?date=${query.departDate}&people=${query.adults}`,
    twelveGoReturn: `https://12go.asia/en/travel/${toSlug}/${fromSlug}?date=${query.returnDate}&people=${query.adults}`,
    redBus: `https://www.redbus.in/bus-tickets/${fromSlug}-to-${toSlug}?onward=${encodeURIComponent(redBusDate(query.departDate))}`,
    redBusReturn: `https://www.redbus.in/bus-tickets/${toSlug}-to-${fromSlug}?onward=${encodeURIComponent(redBusDate(query.returnDate))}`,
    booking: `https://www.booking.com/searchresults.en-gb.html?ss=${encodeURIComponent(destination.name || query.to)}&checkin=${query.departDate}&checkout=${query.returnDate}&group_adults=${query.adults}&no_rooms=1`,
    expedia: `https://www.expedia.com/Hotel-Search?destination=${encodeURIComponent(destination.name || query.to)}&startDate=${query.departDate}&endDate=${query.returnDate}&adults=${query.adults}&rooms=1`,
    tripAdvisor: tripAdvisorLocationId ? `https://www.tripadvisor.com/Hotels-g${tripAdvisorLocationId}-${tripAdvisorSlug(destination.name || query.to)}-Hotels.html` : null,
  };
}

const sane = (root, selectors) => {
  for (const selector of selectors) {
    const value = root.find(selector).text_sane();
    if (value) return value;
  }
  return null;
};
const first = (root, selectors, name) => {
  for (const selector of selectors) {
    const value = root.find(selector).attr(name);
    if (value) return value;
  }
  return null;
};
const amount = value => {
  const match = value && String(value).replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
};
const cards = $('.bus-item, .bus-item-details, [class*="bus-item"]').toArray();
return cards.map(element => {
  const card = $(element);
  const price = sane(card, ['.fare', '[class*="fare"]', '[class*="price"]']);
  const link = first(card, ['a[href*="bus"]', 'a'], 'href');
  return {
    operator: sane(card, ['.travels', '[class*="travels"]', '[class*="operator"]']),
    bus_type: sane(card, ['.bus-type', '[class*="bus-type"]', '[class*="busType"]']),
    departure_text: sane(card, ['.dp-time', '[class*="dp-time"]', '[class*="departure"]']),
    arrival_text: sane(card, ['.bp-time', '[class*="bp-time"]', '[class*="arrival"]']),
    duration_text: sane(card, ['.duration', '[class*="duration"]']),
    boarding_points: sane(card, ['.boarding-point', '[class*="boarding"]']),
    dropping_points: sane(card, ['.dropping-point', '[class*="dropping"]']),
    seats_available: amount(sane(card, ['.seat-left', '[class*="seat-left"]', '[class*="seat"]'])),
    price_value: amount(price),
    currency: price ? (price.match(/[₹$€£]|\b[A-Z]{3}\b/) || [null])[0] : null,
    rating: amount(sane(card, ['.rating', '[class*="rating"]'])),
    amenities: sane(card, ['.amenities', '[class*="amenit"]']),
    booking_url: link ? new URL(link, location.href).href : null,
    source_url: location.href,
    fetched_at: new Date().toISOString()
  };
});

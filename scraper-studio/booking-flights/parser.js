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
const cards = $('[data-testid="flight-card"], [data-testid*="flight"], .flight-card, [class*="flight-card"]').toArray();
return cards.map(element => {
  const card = $(element);
  const price = sane(card, ['[data-testid*="price"]', '.price', '[class*="price"]']);
  const link = first(card, ['a[href*="flight"]', 'a'], 'href');
  return {
    airline: sane(card, ['[data-testid*="airline"]', '.airline', '[class*="airline"]']),
    flight_number: sane(card, ['[data-testid*="flight-number"]', '[class*="flight-number"]']),
    origin: sane(card, ['[data-testid*="origin"]', '[class*="origin"]']),
    destination: sane(card, ['[data-testid*="destination"]', '[class*="destination"]']),
    depart: sane(card, ['[data-testid*="departure"]', '[class*="departure"]']),
    arrive: sane(card, ['[data-testid*="arrival"]', '[class*="arrival"]']),
    duration: sane(card, ['[data-testid*="duration"]', '[class*="duration"]']),
    stops: sane(card, ['[data-testid*="stop"]', '[class*="stop"]']),
    price_value: amount(price),
    currency: price ? (price.match(/[₹$€£]|\b[A-Z]{3}\b/) || [null])[0] : null,
    booking_url: link ? new URL(link, location.href).href : null,
    source_url: location.href,
    fetched_at: new Date().toISOString()
  };
});

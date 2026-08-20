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
const minutes = value => {
  if (!value) return null;
  const normalized = String(value).toLowerCase();
  const hours = Number((normalized.match(/(\d+(?:\.\d+)?)\s*h/) || [0, 0])[1]);
  const mins = Number((normalized.match(/(\d+)\s*m/) || [0, 0])[1]);
  if (hours || mins) return Math.round(hours * 60 + mins);
  return amount(value);
};
const cards = $('.route, .transport-card, [data-testid*="route"], [class*="route-card"], [class*="transport-option"]').toArray();
return cards.map(element => {
  const card = $(element);
  const price = sane(card, ['.price', '[class*="price"]', '[data-testid*="price"]']);
  const link = first(card, ['a[href]', 'a'], 'href');
  return {
    mode: sane(card, ['.transport-mode', '[class*="mode"]', '[data-testid*="mode"]']),
    operator: sane(card, ['.operator', '[class*="operator"]', '[data-testid*="operator"]']),
    departure_text: sane(card, ['.departure', '[class*="departure"]']),
    arrival_text: sane(card, ['.arrival', '[class*="arrival"]']),
    duration_text: sane(card, ['.duration', '[class*="duration"]']),
    duration_minutes: minutes(sane(card, ['.duration', '[class*="duration"]'])),
    transfers: sane(card, ['.transfers', '[class*="transfer"]']),
    price_min: amount(price),
    price_max: amount(price),
    currency: price ? (price.match(/[₹$€£]|\b[A-Z]{3}\b/) || [null])[0] : null,
    booking_url: link ? new URL(link, location.href).href : null,
    source_url: location.href,
    fetched_at: new Date().toISOString()
  };
});

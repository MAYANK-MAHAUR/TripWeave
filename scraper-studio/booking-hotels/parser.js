const text = (root, selectors) => {
  for (const selector of selectors) {
    const value = root.find(selector).text_sane();
    if (value) return value;
  }
  return null;
};

const attr = (root, selectors, name) => {
  for (const selector of selectors) {
    const value = root.find(selector).attr(name);
    if (value) return value;
  }
  return null;
};

const numberFrom = value => {
  if (!value) return null;
  const match = String(value).replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
};

const cards = $('[data-testid="property-card"], [data-testid="property-card-container"], .sr_property_block').toArray();
return cards.map(element => {
  const card = $(element);
  const propertyUrl = attr(card, ['a[data-testid="title-link"]', 'a[href*="/hotel/"]', 'a'], 'href');
  const imageUrl = attr(card, ['img[data-testid="image"]', 'img'], 'src') || attr(card, ['img'], 'data-src');
  const scoreText = text(card, ['[data-testid="review-score"]', '.bui-review-score__badge', '[aria-label*="Scored"]']);
  const priceText = text(card, ['[data-testid="price-and-discounted-price"]', '[data-testid="price-for-x-nights"]', '.bui-price-display__value']);
  return {
    name: text(card, ['[data-testid="title"]', '.sr-hotel__name', 'h3', 'h4']),
    property_url: propertyUrl ? new URL(propertyUrl, location.href).href : null,
    image_url: imageUrl ? new URL(imageUrl, location.href).href : null,
    address: text(card, ['[data-testid="address"]', '[data-testid="location"]', '.sr-card__address']),
    distance_text: text(card, ['[data-testid="distance"]', '.sr_location_block']),
    room_type: text(card, ['[data-testid="room-info"]', '.room_link']),
    meal_text: text(card, ['[data-testid="meal-plan"]', '.meal_plan']),
    cancellation_text: text(card, ['[data-testid="cancellation"]', '.free_cancellation']),
    rating_value: numberFrom(scoreText),
    rating_label: scoreText,
    review_count: numberFrom(text(card, ['[data-testid="review-score"]', '.bui-review-score__text'])),
    price_text: priceText,
    price_value: numberFrom(priceText),
    currency: priceText ? (priceText.match(/[₹$€£]|\b[A-Z]{3}\b/) || [null])[0] : null,
    source_url: location.href,
    fetched_at: new Date().toISOString()
  };
});

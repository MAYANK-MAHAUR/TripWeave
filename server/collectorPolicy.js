const radians = (value) => Number(value) * Math.PI / 180;

export function routeDistanceKm(origin, destination) {
  const earthRadiusKm = 6371;
  const latDelta = radians(destination.lat - origin.lat);
  const lngDelta = radians(destination.lng - origin.lng);
  const value = Math.sin(latDelta / 2) ** 2
    + Math.cos(radians(origin.lat)) * Math.cos(radians(destination.lat)) * Math.sin(lngDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function selectCollectorsForRoute(collectors, origin, destination, { includeReferenceSources = false, fullComparison = false } = {}) {
  const distanceKm = routeDistanceKm(origin, destination);
  const longDistance = distanceKm > 1800;
  const crossBorderLongDistance = longDistance && origin.country && destination.country && origin.country !== destination.country;
  const compatibleEntries = Object.entries(collectors).filter(([, definition]) => {
    if (!definition.enabled) return false;
    if (definition.composable === false && !includeReferenceSources) return false;
    if (crossBorderLongDistance && ['route', 'bus'].includes(definition.kind)) return false;
    return true;
  });
  const primaryEntries = fullComparison
    ? compatibleEntries
    : compatibleEntries.filter(([, definition]) => definition.collectionTier === 'primary'
      || (includeReferenceSources && definition.collectionTier === 'reference'));
  const fallbackEntries = fullComparison ? [] : compatibleEntries.filter(([, definition]) => definition.collectionTier === 'fallback');
  const skipped = Object.entries(collectors).filter(([key]) => !compatibleEntries.some(([selectedKey]) => selectedKey === key)).map(([key, definition]) => ({
    key,
    label: definition.label,
    reason: definition.composable === false && !includeReferenceSources
      ? 'Reference-only source is available on demand.'
      : crossBorderLongDistance && ['route', 'bus'].includes(definition.kind)
        ? 'Ground transport skipped for a long-distance route.'
        : 'Collector disabled.',
  }));
  return {
    entries: primaryEntries,
    primaryEntries,
    fallbackEntries,
    skipped,
    distanceKm: Math.round(distanceKm),
    longDistance,
    crossBorderLongDistance: Boolean(crossBorderLongDistance),
    fullComparison: Boolean(fullComparison),
  };
}

export function selectFallbackCollectors(fallbackEntries, normalized, { minOffers = 4 } = {}) {
  const transports = normalized?.offers?.transports || [];
  const hotels = normalized?.offers?.hotels || [];
  const flightCount = transports.filter((offer) => offer.mode === 'Flight').length;
  const groundCount = transports.filter((offer) => ['Train', 'Bus', 'Cab', 'Van'].includes(offer.mode)).length;
  return fallbackEntries.filter(([key]) => {
    if (key === 'skyscanner') return flightCount < minOffers;
    if (key === 'redBus') return groundCount < minOffers;
    if (key === 'expedia') return hotels.length < minOffers;
    return false;
  });
}

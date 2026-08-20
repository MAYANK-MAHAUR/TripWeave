const radians = (value) => Number(value) * Math.PI / 180;

export function routeDistanceKm(origin, destination) {
  const earthRadiusKm = 6371;
  const latDelta = radians(destination.lat - origin.lat);
  const lngDelta = radians(destination.lng - origin.lng);
  const value = Math.sin(latDelta / 2) ** 2
    + Math.cos(radians(origin.lat)) * Math.cos(radians(destination.lat)) * Math.sin(lngDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function selectCollectorsForRoute(collectors, origin, destination, { includeReferenceSources = false } = {}) {
  const distanceKm = routeDistanceKm(origin, destination);
  const longDistance = distanceKm > 1800;
  const crossBorderLongDistance = longDistance && origin.country && destination.country && origin.country !== destination.country;
  const entries = Object.entries(collectors).filter(([, definition]) => {
    if (!definition.enabled) return false;
    if (definition.composable === false && !includeReferenceSources) return false;
    if (crossBorderLongDistance && ['route', 'bus'].includes(definition.kind)) return false;
    return true;
  });
  const skipped = Object.entries(collectors).filter(([key]) => !entries.some(([selectedKey]) => selectedKey === key)).map(([key, definition]) => ({
    key,
    label: definition.label,
    reason: definition.composable === false && !includeReferenceSources
      ? 'Reference-only source is available on demand.'
      : crossBorderLongDistance && ['route', 'bus'].includes(definition.kind)
        ? 'Ground transport skipped for a long-distance route.'
        : 'Collector disabled.',
  }));
  return { entries, skipped, distanceKm: Math.round(distanceKm), longDistance, crossBorderLongDistance: Boolean(crossBorderLongDistance) };
}

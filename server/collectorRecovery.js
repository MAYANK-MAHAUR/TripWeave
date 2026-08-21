const nonRepairableFailure = /(?:api key|auth(?:entication|orization)?|credit|quota|budget|not configured|invalid (?:collector|url)|realtime page limit)/i;

const fieldsByKind = {
  flight: 'airline, departure and arrival airports/times, duration, stops, total price, currency, and a stable result URL',
  route: 'mode, operator, departure and arrival times, duration, transfers, price, currency, and source URL',
  bus: 'operator, bus type, departure and arrival times, duration, seats, rating, price, currency, and source URL',
  hotel: 'hotel name, location, rating, review count, room, cancellation, nightly and total price, currency, image, and stable hotel URL',
};

export const activeRecoveryStatuses = new Set(['queued', 'analyzing', 'applying', 'verifying']);

export function buildAutomaticHealPrompt({ task, source }) {
  const fields = fieldsByKind[task.definition.kind] || 'the existing output fields';
  const symptom = source?.status === 'failed'
    ? `The latest production run failed: ${String(source.error || 'the expected listing records were not returned').slice(0, 220)}.`
    : 'The latest production run completed but returned zero listing records.';
  return [
    `Repair the existing ${task.definition.sourceLabel || task.definition.label} ${task.definition.kind} scraper for the supplied live search-results URL.`,
    symptom,
    `Keep the current output schema and restore these listing-card values: ${fields}.`,
    'Update interaction and parser selectors for the current public layout. Collect only the first visible results page and at most 20 visible listings. Do not paginate, repeatedly load more, or visit detail pages. Preserve displayed values, use null for missing data, and never infer prices.',
  ].join(' ').slice(0, 1000);
}

export function findAutomaticRecoveryCandidates({ tasks, normalized, maxCandidates = 1 }) {
  const limit = Math.max(0, Number(maxCandidates) || 0);
  if (!limit) return [];
  const sourceList = normalized?.sources || [];
  const sources = new Map(sourceList.map((source) => [source.key, source]));
  const categoryFor = (kind) => ['route', 'bus'].includes(kind) ? 'ground' : kind;
  const seenCollectors = new Set();
  const candidates = [];
  for (const task of tasks) {
    const source = sources.get(task.key);
    if (!source || !task.url || task.definition.selfHealing === false || seenCollectors.has(task.collectorKey)) continue;
    const failed = source.status === 'failed';
    const peerHasRows = sourceList.some((peer) => peer.key !== source.key
      && peer.status === 'complete'
      && peer.rows > 0
      && categoryFor(peer.kind) === categoryFor(source.kind));
    const empty = source.status === 'complete' && source.rows === 0 && peerHasRows;
    if ((!failed && !empty) || (failed && nonRepairableFailure.test(source.error || ''))) continue;
    seenCollectors.add(task.collectorKey);
    candidates.push({ task, source, reason: failed ? 'collector_failed' : 'empty_output' });
    if (candidates.length >= limit) break;
  }
  return candidates;
}

export function hasActiveRecovery(recoveries) {
  return Object.values(recoveries || {}).some((recovery) => activeRecoveryStatuses.has(recovery.status));
}

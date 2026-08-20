import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { COLLECTORS, configStatus, getBrightDataKey } from './config.js';
import { runCollector } from './brightdata.js';
import { resolveLocation, findAttractions, findTripAdvisorLocationId } from './locations.js';
import { buildCollectorUrls, normalizeTripQuery } from './urls.js';
import { normalizeCollectorResults } from './normalize.js';
import { enrichWithGemini } from './gemini.js';

const app = express();
const port = Number(process.env.PORT || 8787);
const jobs = new Map();
const cache = new Map();
const pipelineVersion = 2;
const cacheTtlMs = 15 * 60 * 1000;
const tripHistoryTtlMs = 24 * 60 * 60 * 1000;
const cacheDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.cache');
fs.mkdirSync(cacheDirectory, { recursive: true });
const cachePath = (key) => path.join(cacheDirectory, `${crypto.createHash('sha256').update(key).digest('hex')}.json`);
const isCurrentCache = (cached) => cached?.schemaVersion === pipelineVersion
  || (cached?.result?.result?.sources?.length && cached.result.result.sources.every((source) => Object.hasOwn(source, 'tripLeg')));
const cachedJobById = (id) => {
  try {
    for (const file of fs.readdirSync(cacheDirectory)) {
      if (!file.endsWith('.json')) continue;
      const cached = JSON.parse(fs.readFileSync(path.join(cacheDirectory, file), 'utf8'));
      if (cached?.result?.id === id && isCurrentCache(cached) && Date.now() - cached.at < tripHistoryTtlMs) return cached.result;
    }
  } catch { /* cache is optional */ }
  return null;
};

app.use(express.json({ limit: '250kb' }));

const publicJob = (job) => ({
  id: job.id, status: job.status, stage: job.stage, progress: job.progress,
  createdAt: job.createdAt, updatedAt: job.updatedAt, error: job.error,
  query: job.query, locations: job.locations, collectors: job.collectors, result: job.result,
});

const updateJob = (job, patch) => {
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
};

const groundReturnUrlKeys = { omio: 'omioReturn', twelveGo: 'twelveGoReturn', redBus: 'redBusReturn' };

function buildCollectorTasks(enabledCollectors, urls) {
  return enabledCollectors.flatMap(([collectorKey, baseDefinition]) => {
    const createTask = (key, url, tripLeg, label = baseDefinition.label) => ({
      key,
      collectorKey,
      url,
      definition: { ...baseDefinition, collectorKey, sourceLabel: baseDefinition.label, label, tripLeg },
    });
    if (groundReturnUrlKeys[collectorKey]) {
      return [
        createTask(`${collectorKey}Outbound`, urls[collectorKey], 'outbound', `${baseDefinition.label} · outbound`),
        createTask(`${collectorKey}Return`, urls[groundReturnUrlKeys[collectorKey]], 'return', `${baseDefinition.label} · return`),
      ];
    }
    const tripLeg = baseDefinition.kind === 'hotel' ? (baseDefinition.composable === false ? 'reference' : 'stay') : 'roundtrip';
    return [createTask(collectorKey, urls[collectorKey], tripLeg)];
  });
}

async function executeTrip(job) {
  try {
    updateJob(job, { status: 'running', stage: 'Resolving cities and nearby airports', progress: 8 });
    const [origin, destination] = await Promise.all([resolveLocation(job.query.from), resolveLocation(job.query.to)]);
    job.locations = { origin, destination };
    const tripAdvisorLocationId = await findTripAdvisorLocationId(destination.name || job.query.to);
    const urls = buildCollectorUrls(job.query, origin, destination, { tripAdvisorLocationId });
    updateJob(job, { stage: 'Triggering live travel collectors', progress: 18 });

    const enabledCollectors = Object.entries(COLLECTORS).filter(([, definition]) => definition.enabled);
    const collectorTasks = buildCollectorTasks(enabledCollectors, urls);
    collectorTasks.forEach((task) => {
      job.collectors[task.key] = { key: task.key, collectorKey: task.collectorKey, label: task.definition.label, sourceLabel: task.definition.sourceLabel, tripLeg: task.definition.tripLeg, status: task.url ? 'standby' : 'skipped', url: task.url || null, error: task.url ? null : 'A compatible destination page could not be resolved.' };
    });
    const runnableTasks = collectorTasks.filter((task) => task.url);
    const onCollectorUpdate = (update) => {
      job.collectors[update.key] = { ...job.collectors[update.key], ...update };
      const finished = Object.values(job.collectors).filter((collector) => ['complete', 'failed'].includes(collector.status)).length;
      updateJob(job, { stage: 'Collecting current public offers', progress: Math.min(68, 20 + Math.round((finished / Math.max(1, collectorTasks.length)) * 48)) });
    };
    const completedResults = await Promise.all(runnableTasks.map((task) => runCollector(task.key, task.definition, task.url, onCollectorUpdate)));
    const skippedResults = collectorTasks.filter((task) => !task.url).map((task) => ({ key: task.key, collectorKey: task.collectorKey, label: task.definition.label, sourceLabel: task.definition.sourceLabel, tripLeg: task.definition.tripLeg, kind: task.definition.kind, composable: task.definition.composable !== false, status: 'skipped', url: null, error: 'A compatible destination page could not be resolved.', durationMs: 0, payload: null }));
    const results = [...completedResults, ...skippedResults];
    results.forEach((result) => { job.collectors[result.key] = { ...result, payload: undefined }; });

    updateJob(job, { stage: 'Normalizing prices and composing journeys', progress: 74 });
    const normalized = await normalizeCollectorResults(results, { query: job.query, origin, destination });
    updateJob(job, { stage: 'Finding real tour stops', progress: 84 });
    const places = await findAttractions(destination);
    updateJob(job, { stage: 'Gemini is checking the recommendation', progress: 92 });
    const ai = await enrichWithGemini({ ...normalized, places });
    const selectedTourNames = new Set(ai.tour_stop_names || []);
    const tourPlaces = selectedTourNames.size ? places.filter((place) => selectedTourNames.has(place.name)) : places.slice(0, 4);
    const result = { ...normalized, pipelineVersion, places: tourPlaces, allPlaces: places, ai };
    const partial = !normalized.journeys.length || normalized.journeys.every((journey) => !journey.coverage.complete);
    updateJob(job, { status: partial ? 'partial' : 'ready', stage: partial ? 'Ready with transparent gaps' : 'Trip ready', progress: 100, result });
    const cachedJob = { schemaVersion: pipelineVersion, at: Date.now(), result: publicJob(job) };
    cache.set(job.cacheKey, cachedJob);
    fs.writeFileSync(cachePath(job.cacheKey), JSON.stringify(cachedJob));
  } catch (error) {
    updateJob(job, { status: 'error', stage: 'Trip could not be completed', progress: 100, error: error.message });
  }
}

app.get('/api/health', (_request, response) => {
  const status = configStatus();
  response.json({ ok: Boolean(getBrightDataKey()), service: 'TripWeave API', now: new Date().toISOString(), ...status });
});

app.post('/api/trips', (request, response) => {
  try {
    const query = normalizeTripQuery(request.body);
    if (!query.from || !query.to) throw new Error('Enter both origin and destination.');
    const cacheKey = JSON.stringify(query);
    let cached = cache.get(cacheKey);
    if (!cached) {
      try { cached = JSON.parse(fs.readFileSync(cachePath(cacheKey), 'utf8')); } catch { cached = null; }
    }
    if (cached && isCurrentCache(cached) && Date.now() - cached.at < cacheTtlMs) return response.status(200).json({ ...cached.result, cached: true });
    const job = { id: crypto.randomUUID(), cacheKey, query, status: 'queued', stage: 'Queued', progress: 0, collectors: {}, locations: null, result: null, error: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    jobs.set(job.id, job);
    executeTrip(job);
    return response.status(202).json(publicJob(job));
  } catch (error) {
    return response.status(400).json({ error: error.message });
  }
});

app.get('/api/trips/:id', (request, response) => {
  const job = jobs.get(request.params.id) || cachedJobById(request.params.id);
  if (!job) return response.status(404).json({ error: 'Trip job not found.' });
  return response.json(job.result !== undefined && job.createdAt ? publicJob(job) : job);
});

app.delete('/api/trips/:id', (request, response) => {
  const removed = jobs.delete(request.params.id);
  response.status(removed ? 204 : 404).end();
});

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
app.use(express.static(dist));
app.use((_request, response, next) => response.sendFile(path.join(dist, 'index.html'), (error) => error ? next() : undefined));

app.listen(port, '127.0.0.1', () => {
  console.log(`TripWeave API listening on http://127.0.0.1:${port}`);
});

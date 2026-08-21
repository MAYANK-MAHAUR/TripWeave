import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { COLLECTORS, configStatus, getBrightDataKey } from './config.js';
import { runCollector } from './brightdata.js';
import { resolveLocation, resolveHotelLocation, findAttractions, findTripAdvisorLocationId } from './locations.js';
import { buildCollectorUrls, normalizeTripQuery } from './urls.js';
import { normalizeCollectorResults } from './normalize.js';
import { enrichWithGemini } from './gemini.js';
import { buildTourPayload } from './tour.js';
import { selectCollectorsForRoute, selectFallbackCollectors } from './collectorPolicy.js';
import { buildAutomaticHealPrompt, findAutomaticRecoveryCandidates, hasActiveRecovery } from './collectorRecovery.js';
import {
  decideCollectorSelfHealing, decideRealSelfHealing, readCollectorSelfHealingProgress,
  readDemoCollection, readRealSelfHealingProgress, selfHealingConfig,
  triggerCollectorSelfHealing, triggerDemoCollection, triggerRealSelfHealing,
} from './selfHealing.js';

const app = express();
const port = Number(process.env.PORT || 8787);
const jobs = new Map();
const cache = new Map();
const terminalStatuses = new Set(['ready', 'partial', 'error']);
const pipelineVersion = 3;
const cacheTtlMs = Number(process.env.TRIP_CACHE_TTL_MS || 24 * 60 * 60 * 1000);
const staleCacheTtlMs = Number(process.env.TRIP_STALE_CACHE_TTL_MS || 7 * 24 * 60 * 60 * 1000);
const liveSearchLimitPerDay = Math.max(1, Number(process.env.TRIP_LIVE_SEARCH_LIMIT_PER_DAY || 8));
const maxConcurrentSearches = Math.max(1, Number(process.env.TRIP_MAX_CONCURRENT_SEARCHES || 2));
const minOffersPerCategory = Math.max(1, Number(process.env.TRIP_MIN_OFFERS_PER_CATEGORY || 4));
const automaticHealingEnabled = String(process.env.TRIP_AUTO_HEAL_ENABLED || 'true').toLowerCase() !== 'false';
const maxAutomaticHealsPerTrip = Math.max(0, Number(process.env.TRIP_AUTO_HEAL_MAX_PER_TRIP || 1));
const maxAutomaticHealsPerDay = Math.max(0, Number(process.env.TRIP_AUTO_HEAL_LIMIT_PER_DAY || 2));
const automaticHealCooldownMs = Math.max(60_000, Number(process.env.TRIP_AUTO_HEAL_COOLDOWN_HOURS || 24) * 60 * 60 * 1000);
const automaticHealTimeoutMs = Math.max(60_000, Number(process.env.TRIP_AUTO_HEAL_TIMEOUT_MS || 16 * 60 * 1000));
const automaticHealPollMs = Math.max(2_000, Number(process.env.TRIP_AUTO_HEAL_POLL_MS || 5_000));
const tripHistoryTtlMs = 24 * 60 * 60 * 1000;
const configuredCacheDirectory = String(process.env.TRIP_CACHE_DIR || '').trim();
const cacheDirectory = configuredCacheDirectory
  ? path.resolve(configuredCacheDirectory)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.cache');
fs.mkdirSync(cacheDirectory, { recursive: true });
const cachePath = (key) => path.join(cacheDirectory, `${crypto.createHash('sha256').update(key).digest('hex')}.json`);
const liveSearchBudgetPath = path.join(cacheDirectory, 'live-search-budget.json');
const automaticHealBudgetPath = path.join(cacheDirectory, 'automatic-heal-budget.json');
const settleInterruptedRecoveries = (record) => {
  if (!hasActiveRecovery(record?.recoveries)) return record;
  return {
    ...record,
    recoveries: Object.fromEntries(Object.entries(record.recoveries).map(([key, recovery]) => [key, {
      ...recovery,
      status: ['queued', 'analyzing', 'applying', 'verifying'].includes(recovery.status) ? 'interrupted' : recovery.status,
      message: ['queued', 'analyzing', 'applying', 'verifying'].includes(recovery.status)
        ? 'The server restarted during this repair. Existing trip results remain available, and a future live failure can start a new repair.'
        : recovery.message,
    }])),
  };
};
const isCurrentCache = (cached) => cached?.schemaVersion === pipelineVersion
  || (cached?.result?.result?.sources?.length && cached.result.result.sources.every((source) => Object.hasOwn(source, 'tripLeg')));
const cachedJobById = (id) => {
  try {
    for (const file of fs.readdirSync(cacheDirectory)) {
      if (!file.endsWith('.json')) continue;
      const cached = JSON.parse(fs.readFileSync(path.join(cacheDirectory, file), 'utf8'));
      if (cached?.result?.id === id && isCurrentCache(cached) && Date.now() - cached.at < tripHistoryTtlMs) return settleInterruptedRecoveries(cached.result);
    }
  } catch { /* cache is optional */ }
  return null;
};

const utcBudgetDay = () => new Date().toISOString().slice(0, 10);
const readLiveSearchBudget = () => {
  try {
    const saved = JSON.parse(fs.readFileSync(liveSearchBudgetPath, 'utf8'));
    if (saved.day === utcBudgetDay()) return saved;
  } catch { /* a missing usage ledger starts a new day */ }
  return { day: utcBudgetDay(), used: 0 };
};
const liveSearchBudget = () => {
  const budget = readLiveSearchBudget();
  return {
    day: budget.day,
    limit: liveSearchLimitPerDay,
    used: budget.used,
    remaining: Math.max(0, liveSearchLimitPerDay - budget.used),
    resetsAt: `${new Date(Date.now() + 86400000).toISOString().slice(0, 10)}T00:00:00.000Z`,
  };
};
const reserveLiveSearch = () => {
  const budget = readLiveSearchBudget();
  if (budget.used >= liveSearchLimitPerDay) return { allowed: false, ...liveSearchBudget() };
  const next = { day: budget.day, used: budget.used + 1 };
  fs.writeFileSync(liveSearchBudgetPath, JSON.stringify(next));
  return { allowed: true, ...liveSearchBudget() };
};

const readAutomaticHealBudget = () => {
  try {
    const saved = JSON.parse(fs.readFileSync(automaticHealBudgetPath, 'utf8'));
    if (saved.day === utcBudgetDay()) return { day: saved.day, used: Number(saved.used) || 0, collectors: saved.collectors || {} };
  } catch { /* a missing recovery ledger starts a new day */ }
  return { day: utcBudgetDay(), used: 0, collectors: {} };
};
const automaticHealBudget = () => {
  const budget = readAutomaticHealBudget();
  return { day: budget.day, limit: maxAutomaticHealsPerDay, used: budget.used, remaining: Math.max(0, maxAutomaticHealsPerDay - budget.used) };
};
const reserveAutomaticHeal = (collectorId) => {
  const budget = readAutomaticHealBudget();
  const lastAttempt = Number(budget.collectors[collectorId]) || 0;
  if (Date.now() - lastAttempt < automaticHealCooldownMs) return { allowed: false, reason: 'cooldown', ...automaticHealBudget() };
  if (budget.used >= maxAutomaticHealsPerDay) return { allowed: false, reason: 'daily_limit', ...automaticHealBudget() };
  const next = { ...budget, used: budget.used + 1, collectors: { ...budget.collectors, [collectorId]: Date.now() } };
  fs.writeFileSync(automaticHealBudgetPath, JSON.stringify(next));
  return { allowed: true, ...automaticHealBudget() };
};

app.use(express.json({ limit: '250kb' }));

const publicJob = (job) => ({
  id: job.id, status: job.status, stage: job.stage, progress: job.progress,
  createdAt: job.createdAt, updatedAt: job.updatedAt, error: job.error,
  query: job.query, options: job.options, creditPolicy: job.creditPolicy,
  locations: job.locations, collectors: job.collectors, recoveries: job.recoveries, result: job.result,
});

const updateJob = (job, patch) => {
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
};

const groundReturnUrlKeys = { twelveGo: 'twelveGoReturn', redBus: 'redBusReturn' };
const recoveryLocks = new Map();
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

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

function persistJob(job) {
  const cachedJob = { schemaVersion: pipelineVersion, at: Date.now(), result: publicJob(job) };
  cache.set(job.cacheKey, cachedJob);
  fs.writeFileSync(cachePath(job.cacheKey), JSON.stringify(cachedJob));
}

function updateRecovery(job, collectorKey, patch) {
  job.recoveries ||= {};
  job.recoveries[collectorKey] = { ...job.recoveries[collectorKey], ...patch, updatedAt: new Date().toISOString() };
  updateJob(job, {});
}

async function rebuildTripFromRecoveredRows(job) {
  const normalized = await normalizeCollectorResults(job.rawResults, {
    query: job.query,
    origin: job.locations.origin,
    destination: job.locations.destination,
  });
  const previous = job.result || {};
  const result = {
    ...normalized,
    pipelineVersion,
    creditPolicy: job.creditPolicy,
    streaming: false,
    settledSources: job.rawResults.length,
    totalSources: previous.totalSources || job.rawResults.length,
    places: previous.places || [],
    allPlaces: previous.allPlaces || [],
    ai: previous.ai || { enabled: false, message: 'The recovered live rows were added without another AI recommendation call.' },
  };
  const partial = !normalized.journeys.length || normalized.journeys.every((journey) => !journey.coverage.complete);
  updateJob(job, { status: partial ? 'partial' : 'ready', stage: partial ? 'Ready with transparent gaps' : 'Trip ready', progress: 100, result });
}

async function healAndPublishCollector(job, candidate) {
  const { task } = candidate;
  const collectorId = task.definition.id;
  const collectorKey = task.collectorKey;
  const prompt = buildAutomaticHealPrompt(candidate);
  if (recoveryLocks.has(collectorId)) {
    updateRecovery(job, collectorKey, { status: 'cooldown', message: 'This collector is already repairing for another trip. The same Collector ID will be used next time.' });
    return;
  }
  const reservation = reserveAutomaticHeal(collectorId);
  if (!reservation.allowed) {
    updateRecovery(job, collectorKey, {
      status: reservation.reason === 'cooldown' ? 'cooldown' : 'budget_limited',
      message: reservation.reason === 'cooldown'
        ? 'A repair for this collector was already attempted recently. The trip will reuse that same Collector ID on the next search.'
        : 'Today’s automatic repair limit is complete. Existing real results remain available without another credit action.',
    });
    return;
  }

  const healing = (async () => {
    updateRecovery(job, collectorKey, { status: 'analyzing', message: 'Scraper Studio is rewriting the failed extraction logic.' });
    await triggerCollectorSelfHealing({ collectorId, targetUrl: task.url, prompt });
    const started = Date.now();
    let approved = false;
    while (Date.now() - started < automaticHealTimeoutMs) {
      const progress = await readCollectorSelfHealingProgress(collectorId);
      if (progress.awaitingApproval && !approved) {
        updateRecovery(job, collectorKey, { status: 'applying', message: 'A repair was generated. TripWeave is auto-saving it to the same Collector ID.' });
        await decideCollectorSelfHealing({ collectorId, approve: true, autoSave: true });
        approved = true;
      } else if (!progress.terminal) {
        updateRecovery(job, collectorKey, {
          status: approved ? 'applying' : 'analyzing',
          message: progress.step || (approved ? 'Saving the repaired collector.' : 'Generating a repair from the live page.'),
          completedSteps: progress.completedSteps,
        });
      }
      if (progress.terminal) {
        if (['failed', 'error', 'cancelled'].includes(progress.status)) throw new Error(`Bright Data Self-Healing ended with status ${progress.status}.`);
        return;
      }
      await wait(automaticHealPollMs);
    }
    throw new Error('Self-Healing did not finish within the configured recovery window.');
  })();

  recoveryLocks.set(collectorId, healing);
  try {
    await healing;
    updateRecovery(job, collectorKey, { status: 'verifying', message: 'The repaired collector is re-running only the failed input.' });
    const verified = await runCollector(task.key, task.definition, task.url, (update) => {
      job.collectors[task.key] = { ...job.collectors[task.key], ...update, payload: undefined };
    });
    const testResults = job.rawResults.map((result) => result.key === task.key ? verified : result);
    const testNormalized = await normalizeCollectorResults(testResults, {
      query: job.query,
      origin: job.locations.origin,
      destination: job.locations.destination,
    });
    const verifiedSource = testNormalized.sources.find((item) => item.key === task.key);
    if (verified.status !== 'complete' || !verifiedSource?.rows) {
      updateRecovery(job, collectorKey, { status: 'verification_failed', message: 'The patch was saved, but this input still returned no usable rows. Existing trip results remain unchanged.' });
      persistJob(job);
      return;
    }
    job.rawResults = testResults;
    job.collectors[task.key] = { ...verified, payload: undefined };
    updateRecovery(job, collectorKey, {
      status: 'recovered',
      message: `${verifiedSource.rows} live row${verifiedSource.rows === 1 ? '' : 's'} recovered and added to this trip.`,
      recoveredRows: verifiedSource.rows,
      completedAt: new Date().toISOString(),
    });
    await rebuildTripFromRecoveredRows(job);
    persistJob(job);
  } catch (error) {
    updateRecovery(job, collectorKey, { status: 'failed', message: error.message || 'Automatic Self-Healing could not complete.' });
    persistJob(job);
  } finally {
    if (recoveryLocks.get(collectorId) === healing) recoveryLocks.delete(collectorId);
  }
}

async function runAutomaticRecoveries(job, candidates) {
  for (const candidate of candidates) await healAndPublishCollector(job, candidate);
}

async function executeTrip(job) {
  try {
    updateJob(job, { status: 'running', stage: 'Resolving cities and nearby airports', progress: 8 });
    const [origin, destination] = await Promise.all([resolveLocation(job.query.from), resolveLocation(job.query.to)]);
    job.locations = { origin, destination };
    const placesPromise = findAttractions(destination).catch(() => []);
    const tripAdvisorLocationId = job.options?.includeReferenceSources ? await findTripAdvisorLocationId(destination.name || job.query.to) : null;
    const urls = buildCollectorUrls(job.query, origin, destination, { tripAdvisorLocationId });
    updateJob(job, { stage: job.options?.fullComparison ? 'Opening every compatible live source' : 'Triggering core live travel collectors', progress: 18 });

    const collectorSelection = selectCollectorsForRoute(COLLECTORS, origin, destination, job.options);
    job.creditPolicy = {
      mode: job.options?.fullComparison ? 'full_comparison_requested' : 'quality_first_budgeted',
      routeDistanceKm: collectorSelection.distanceKm,
      longDistance: collectorSelection.longDistance,
      crossBorderLongDistance: collectorSelection.crossBorderLongDistance,
      primaryCollectors: collectorSelection.primaryEntries.map(([key]) => key),
      fallbackCollectors: collectorSelection.fallbackEntries.map(([key]) => key),
      fallbackTriggered: [],
      triggeredCollectors: collectorSelection.primaryEntries.map(([key]) => key),
      skippedCollectors: collectorSelection.skipped,
      cacheHours: Math.round(cacheTtlMs / 3600000),
      staleCacheHours: Math.round(staleCacheTtlMs / 3600000),
      minimumOffersPerCategory: minOffersPerCategory,
      batchFallback: false,
      userRequestedFullComparison: Boolean(job.options?.fullComparison),
    };
    const collectorTasks = [];
    const settledResults = [];
    const onCollectorUpdate = (update) => {
      job.collectors[update.key] = { ...job.collectors[update.key], ...update };
      const finished = Object.values(job.collectors).filter((collector) => ['complete', 'failed', 'skipped'].includes(collector.status)).length;
      const nextProgress = Math.min(68, 20 + Math.round((finished / Math.max(1, collectorTasks.length)) * 48));
      updateJob(job, { stage: 'Collecting current public offers', progress: Math.max(job.progress, nextProgress) });
    };
    let previewQueue = Promise.resolve();
    const publishPreview = () => {
      const snapshot = [...settledResults];
      previewQueue = previewQueue.then(async () => {
        const normalized = await normalizeCollectorResults(snapshot, { query: job.query, origin, destination });
        const offerCount = normalized.offers.transports.length + normalized.offers.hotels.length;
        if (!offerCount) return;
        const result = {
          ...normalized,
          pipelineVersion,
          creditPolicy: job.creditPolicy,
          streaming: true,
          settledSources: snapshot.length,
          totalSources: collectorTasks.length,
          places: [],
          allPlaces: [],
          ai: { enabled: false, model: process.env.GEMINI_MODEL || 'gemini-3.7-flash', message: 'More live sources are still being added.' },
        };
        updateJob(job, { result, stage: `Showing ${offerCount} live offers while other sources finish` });
      }).catch(() => { /* a preview must never stop the final result */ });
      return previewQueue;
    };
    const runTaskWave = async (tasks) => {
      collectorTasks.push(...tasks);
      tasks.forEach((task) => {
        job.collectors[task.key] = { key: task.key, collectorKey: task.collectorKey, label: task.definition.label, sourceLabel: task.definition.sourceLabel, tripLeg: task.definition.tripLeg, status: task.url ? 'standby' : 'skipped', url: task.url || null, error: task.url ? null : 'A compatible destination page could not be resolved.' };
      });
      const skipped = tasks.filter((task) => !task.url).map((task) => ({ key: task.key, collectorKey: task.collectorKey, label: task.definition.label, sourceLabel: task.definition.sourceLabel, tripLeg: task.definition.tripLeg, kind: task.definition.kind, composable: task.definition.composable !== false, status: 'skipped', url: null, error: 'A compatible destination page could not be resolved.', durationMs: 0, payload: null }));
      settledResults.push(...skipped);
      const completed = await Promise.all(tasks.filter((task) => task.url).map(async (task) => {
        const result = await runCollector(task.key, task.definition, task.url, onCollectorUpdate);
        settledResults.push(result);
        await publishPreview();
        return result;
      }));
      await previewQueue;
      return [...completed, ...skipped];
    };

    const primaryTasks = buildCollectorTasks(collectorSelection.primaryEntries, urls);
    await runTaskWave(primaryTasks);
    const primaryResult = await normalizeCollectorResults(settledResults, { query: job.query, origin, destination });
    const fallbackEntries = selectFallbackCollectors(collectorSelection.fallbackEntries, primaryResult, { minOffers: minOffersPerCategory });
    job.creditPolicy.fallbackTriggered = fallbackEntries.map(([key]) => key);
    job.creditPolicy.triggeredCollectors = [...new Set([...job.creditPolicy.triggeredCollectors, ...job.creditPolicy.fallbackTriggered])];
    if (fallbackEntries.length) {
      updateJob(job, { stage: 'Filling only the missing travel categories', progress: Math.max(job.progress, 64) });
      await runTaskWave(buildCollectorTasks(fallbackEntries, urls));
    } else {
      updateJob(job, { stage: 'Core sources returned enough options', progress: Math.max(job.progress, 68) });
    }

    const results = [...settledResults];
    job.rawResults = results;
    results.forEach((result) => { job.collectors[result.key] = { ...result, payload: undefined }; });

    updateJob(job, { stage: 'Normalizing prices and composing journeys', progress: 74 });
    const normalized = await normalizeCollectorResults(results, { query: job.query, origin, destination });
    updateJob(job, { stage: 'Adding real tour stops', progress: 84 });
    const places = await placesPromise;
    updateJob(job, { stage: 'Gemini is checking the recommendation', progress: 92 });
    const ai = await enrichWithGemini({ ...normalized, places });
    const selectedTourNames = new Set(ai.tour_stop_names || []);
    const tourPlaces = selectedTourNames.size ? places.filter((place) => selectedTourNames.has(place.name)) : places.slice(0, 4);
    const result = { ...normalized, pipelineVersion, creditPolicy: job.creditPolicy, streaming: false, settledSources: results.length, totalSources: collectorTasks.length, places: tourPlaces, allPlaces: places, ai };
    const recoveryCandidates = automaticHealingEnabled ? findAutomaticRecoveryCandidates({ tasks: collectorTasks, normalized, maxCandidates: maxAutomaticHealsPerTrip }) : [];
    job.recoveries = Object.fromEntries(recoveryCandidates.map((candidate) => [candidate.task.collectorKey, {
      collectorKey: candidate.task.collectorKey,
      taskKey: candidate.task.key,
      label: candidate.task.definition.sourceLabel || candidate.task.definition.label,
      kind: candidate.task.definition.kind,
      reason: candidate.reason,
      status: 'queued',
      message: candidate.reason === 'empty_output' ? 'Empty output detected. Automatic repair is queued.' : 'Collector failure detected. Automatic repair is queued.',
      detectedAt: new Date().toISOString(),
    }]));
    const partial = !normalized.journeys.length || normalized.journeys.every((journey) => !journey.coverage.complete);
    updateJob(job, { status: partial ? 'partial' : 'ready', stage: partial ? 'Ready with transparent gaps' : 'Trip ready', progress: 100, result });
    persistJob(job);
    if (recoveryCandidates.length) void runAutomaticRecoveries(job, recoveryCandidates);
  } catch (error) {
    updateJob(job, { status: 'error', stage: 'Trip could not be completed', progress: 100, error: error.message });
  }
}

app.get('/api/health', (_request, response) => {
  const status = configStatus();
  response.json({
    ok: Boolean(getBrightDataKey()),
    service: 'TripWeave API',
    now: new Date().toISOString(),
    freshSearchBudget: liveSearchBudget(),
    automaticSelfHealing: { enabled: automaticHealingEnabled, maxPerTrip: maxAutomaticHealsPerTrip, cooldownHours: automaticHealCooldownMs / 3600000, dailyBudget: automaticHealBudget() },
    ...status,
  });
});

const creditConfirmed = (request) => request.get('x-tripweave-credit-confirm') === 'judge-approved';

app.get('/api/self-heal/config', (_request, response) => response.json(selfHealingConfig()));

app.post('/api/self-heal/run', async (request, response) => {
  if (!creditConfirmed(request)) return response.status(428).json({ error: 'Confirm the real-credit action before starting a collector.' });
  try {
    return response.status(202).json(await triggerDemoCollection(request.body?.version));
  } catch (error) {
    return response.status(502).json({ error: error.message });
  }
});

app.get('/api/self-heal/run/:collectionId', async (request, response) => {
  try {
    const result = await readDemoCollection(request.params.collectionId);
    return response.status(result.status === 'collecting' ? 202 : 200).json(result);
  } catch (error) {
    return response.status(502).json({ error: error.message });
  }
});

app.post('/api/self-heal/heal', async (request, response) => {
  if (!creditConfirmed(request)) return response.status(428).json({ error: 'Confirm the real-credit action before starting Self-Healing.' });
  try {
    return response.status(202).json(await triggerRealSelfHealing(request.body?.prompt));
  } catch (error) {
    return response.status(502).json({ error: error.message });
  }
});

app.get('/api/self-heal/heal', async (_request, response) => {
  try {
    return response.json(await readRealSelfHealingProgress());
  } catch (error) {
    return response.status(502).json({ error: error.message });
  }
});

app.post('/api/self-heal/heal/decision', async (request, response) => {
  if (!creditConfirmed(request)) return response.status(428).json({ error: 'Confirm the approval decision before resuming Self-Healing.' });
  try {
    return response.json(await decideRealSelfHealing(request.body?.approve, request.body?.autoSave !== false));
  } catch (error) {
    return response.status(502).json({ error: error.message });
  }
});

app.post('/api/trips', (request, response) => {
  try {
    const query = normalizeTripQuery(request.body);
    if (!query.from || !query.to) throw new Error('Enter both origin and destination.');
    const fullComparison = request.body?.fullComparison === true;
    const options = {
      includeReferenceSources: fullComparison || request.body?.includeReferenceSources === true,
      fullComparison,
    };
    const forceRefresh = request.body?.forceRefresh === true;
    const canonicalQuery = { ...query, from: query.from.toLowerCase(), to: query.to.toLowerCase() };
    const cacheKey = options.includeReferenceSources || options.fullComparison
      ? JSON.stringify({ query: canonicalQuery, includeReferenceSources: options.includeReferenceSources, fullComparison: options.fullComparison })
      : JSON.stringify(canonicalQuery);
    if (!forceRefresh) {
      const reusableJob = [...jobs.values()].find((candidate) => candidate.cacheKey === cacheKey
        && candidate.status !== 'error'
        && (!terminalStatuses.has(candidate.status) || Date.now() - new Date(candidate.updatedAt).getTime() < cacheTtlMs));
      if (reusableJob) return response.status(terminalStatuses.has(reusableJob.status) ? 200 : 202).json({ ...publicJob(reusableJob), reused: true, creditSaved: true });
    }
    let cached = cache.get(cacheKey);
    if (!cached) {
      try { cached = JSON.parse(fs.readFileSync(cachePath(cacheKey), 'utf8')); } catch { cached = null; }
      if (cached) cache.set(cacheKey, cached);
    }
    if (!forceRefresh && cached && isCurrentCache(cached) && Date.now() - cached.at < cacheTtlMs) return response.status(200).json({ ...settleInterruptedRecoveries(cached.result), cached: true, creditSaved: true });
    const staleCachedResult = cached && isCurrentCache(cached) && Date.now() - cached.at < staleCacheTtlMs ? settleInterruptedRecoveries(cached.result) : null;
    const activeSearches = [...jobs.values()].filter((candidate) => !terminalStatuses.has(candidate.status) && candidate.status !== 'error').length;
    if (activeSearches >= maxConcurrentSearches) {
      if (staleCachedResult) return response.status(200).json({ ...staleCachedResult, cached: true, stale: true, creditSaved: true, creditReason: 'A recent real result was reused while live collection capacity was full.' });
      return response.status(429).json({ error: 'Live collection is already busy. Try this route again after the current searches finish.', freshSearchBudget: liveSearchBudget() });
    }
    const reservation = reserveLiveSearch();
    if (!reservation.allowed) {
      if (staleCachedResult) return response.status(200).json({ ...staleCachedResult, cached: true, stale: true, creditSaved: true, creditReason: 'A recent real result was reused because today’s live-search budget is complete.' });
      return response.status(429).json({ error: 'Today’s live-search budget is complete. Cached routes still work without spending more Bright Data credits.', freshSearchBudget: reservation });
    }
    const job = { id: crypto.randomUUID(), cacheKey, query, options, creditPolicy: null, status: 'queued', stage: 'Queued', progress: 0, collectors: {}, recoveries: {}, locations: null, result: null, error: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
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

app.get('/api/trips/:id/tour/:journeyId', async (request, response) => {
  const job = jobs.get(request.params.id) || cachedJobById(request.params.id);
  const publicRecord = job?.result !== undefined && job?.createdAt ? publicJob(job) : job;
  if (!publicRecord) return response.status(404).json({ error: 'Trip job not found.' });
  if (!publicRecord.result) return response.status(409).json({ error: 'Trip options are still being collected.' });
  const journey = publicRecord.result.journeys?.find((item) => item.id === request.params.journeyId);
  if (!journey) return response.status(404).json({ error: 'Trip plan not found.' });
  try {
    const destination = publicRecord.result.destination || publicRecord.locations?.destination;
    const hotelLocation = await resolveHotelLocation(journey.hotel, destination);
    return response.json(buildTourPayload({ job: publicRecord, journey, hotelLocation }));
  } catch (error) {
    return response.status(500).json({ error: error.message || 'The guided route could not be prepared.' });
  }
});

app.delete('/api/trips/:id', (request, response) => {
  const removed = jobs.delete(request.params.id);
  response.status(removed ? 204 : 404).end();
});

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
app.use(express.static(dist));
app.use((_request, response, next) => response.sendFile(path.join(dist, 'index.html'), (error) => error ? next() : undefined));

app.listen(port, '0.0.0.0', () => {
  console.log(`TripWeave API listening on 0.0.0.0:${port}`);
});

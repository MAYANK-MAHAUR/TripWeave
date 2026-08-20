import { getBrightDataKey } from './config.js';

const API_ROOT = 'https://api.brightdata.com';
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const realtimeLimitMarker = 'realtime job limit';

const parseBody = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch {
    try { return JSON.parse(`[${text.replace(/}\s*{/g, '},{')}]`); } catch { /* try newline records below */ }
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length) {
      try { return lines.map((line) => JSON.parse(line)); } catch { return text; }
    }
    return text;
  }
};

const jobIdFrom = (body) => {
  if (typeof body === 'string') return body.match(/j_[a-z0-9]+/i)?.[0] || body.trim();
  return body?.response_id || body?.collection_id || body?.snapshot_id || body?.id || JSON.stringify(body).match(/(?:j_|d2t)[a-z0-9]+/i)?.[0];
};

const isPendingBody = (body) => body && typeof body === 'object' && !Array.isArray(body) && (body.pending === true || body.status === 'building');
const isRealtimeLimit = (body) => Array.isArray(body) && body.some((item) => typeof item?.error === 'string' && item.error.toLowerCase().includes(realtimeLimitMarker));

async function request(endpoint, { method = 'GET', body } = {}) {
  const apiKey = getBrightDataKey();
  if (!apiKey) throw new Error('Bright Data is not configured on the server.');
  const response = await fetch(`${API_ROOT}${endpoint}`, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  return { response, payload: await parseBody(response) };
}

async function triggerImmediate(collectorId, input) {
  const { response, payload } = await request(`/dca/trigger_immediate?collector=${encodeURIComponent(collectorId)}`, { method: 'POST', body: input });
  if (!response.ok) throw new Error(payload?.message || payload?.error || `Realtime collector trigger failed (${response.status}).`);
  const jobId = jobIdFrom(payload);
  if (!jobId) throw new Error('Bright Data did not return a realtime response id.');
  return jobId;
}

async function triggerBatch(collectorId, input) {
  const { response, payload } = await request(`/dca/trigger?collector=${encodeURIComponent(collectorId)}&queue_next=1`, { method: 'POST', body: [input] });
  if (!response.ok) throw new Error(payload?.message || payload?.error || `Batch collector trigger failed (${response.status}).`);
  const jobId = jobIdFrom(payload);
  if (!jobId) throw new Error('Bright Data did not return a collection id.');
  return jobId;
}

async function pollImmediate(responseId, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const { response, payload } = await request(`/dca/get_result?response_id=${encodeURIComponent(responseId)}`);
    if (response.ok && payload !== null && !isPendingBody(payload)) return { payload, batchRequired: isRealtimeLimit(payload) };
    if (!response.ok && ![202, 204, 404].includes(response.status)) throw new Error(payload?.message || payload?.error || `Collector poll failed (${response.status}).`);
    await wait(1000);
  }
  throw new Error('Realtime collector timed out before returning data.');
}

async function pollBatch(collectionId, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const { response, payload } = await request(`/dca/dataset?id=${encodeURIComponent(collectionId)}`);
    if (response.status === 200 && payload !== null && !isPendingBody(payload)) return payload;
    if (!response.ok && ![202, 204, 404].includes(response.status)) throw new Error(payload?.message || payload?.error || `Batch collector poll failed (${response.status}).`);
    await wait(5000);
  }
  throw new Error('Batch collector timed out before returning data.');
}

export async function runCollector(key, definition, url, onUpdate = () => {}) {
  const started = Date.now();
  const attempts = Math.max(1, Number(definition.retries || 0) + 1);
  let lastError;
  let lastJobId = null;
  let lastResponseId = null;
  let collectionMode = 'realtime';
  let finalAttempt = 0;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    finalAttempt = attempt;
    const metadata = {
      key,
      collectorKey: definition.collectorKey || key,
      label: definition.label,
      sourceLabel: definition.sourceLabel || definition.label,
      tripLeg: definition.tripLeg || null,
    };
    onUpdate({ ...metadata, status: attempt > 1 ? 'retrying' : 'triggering', url, attempt, attempts });
    try {
      const input = { url, ...(definition.input || {}) };
      const responseId = await triggerImmediate(definition.id, input);
      lastResponseId = responseId;
      collectionMode = 'realtime';
      onUpdate({ ...metadata, status: 'collecting', mode: collectionMode, url, responseId, attempt, attempts });
      const immediate = await pollImmediate(responseId, definition.timeoutMs || 190000);
      let payload = immediate.payload;
      if (immediate.batchRequired) {
        if (definition.allowBatch === false) throw new Error('Realtime page allowance reached; batch fallback is disabled for this reference-only source.');
        collectionMode = 'batch';
        onUpdate({ ...metadata, status: 'switching-to-batch', mode: collectionMode, url, responseId, attempt, attempts });
        lastJobId = await triggerBatch(definition.id, input);
        onUpdate({ ...metadata, status: 'collecting', mode: collectionMode, url, responseId, jobId: lastJobId, attempt, attempts });
        payload = await pollBatch(lastJobId, definition.batchTimeoutMs || definition.timeoutMs || 190000);
      }
      const complete = { ...metadata, kind: definition.kind, composable: definition.composable !== false, status: 'complete', mode: collectionMode, url, responseId, jobId: lastJobId, payload, attempt, durationMs: Date.now() - started };
      onUpdate({ ...complete, payload: undefined });
      return complete;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await wait(1200);
    }
  }
  const failed = { key, collectorKey: definition.collectorKey || key, label: definition.label, sourceLabel: definition.sourceLabel || definition.label, tripLeg: definition.tripLeg || null, kind: definition.kind, composable: definition.composable !== false, status: 'failed', mode: collectionMode, url, responseId: lastResponseId, jobId: lastJobId, attempt: finalAttempt, attempts, error: lastError?.message || 'Collector failed.', durationMs: Date.now() - started };
  onUpdate(failed);
  return failed;
}

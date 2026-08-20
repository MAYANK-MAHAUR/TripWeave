import { getBrightDataKey } from './config.js';

const API_ROOT = 'https://api.brightdata.com';
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

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
  return body?.collection_id || body?.snapshot_id || body?.id || JSON.stringify(body).match(/j_[a-z0-9]+/i)?.[0];
};

async function trigger(collectorId, url) {
  const apiKey = getBrightDataKey();
  if (!apiKey) throw new Error('Bright Data is not configured on the server.');
  const response = await fetch(`${API_ROOT}/dca/trigger?collector=${encodeURIComponent(collectorId)}&queue_next=1`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([{ url }]),
    signal: AbortSignal.timeout(20000),
  });
  const body = await parseBody(response);
  if (!response.ok) throw new Error(body?.message || body?.error || `Collector trigger failed (${response.status}).`);
  const jobId = jobIdFrom(body);
  if (!jobId) throw new Error('Bright Data did not return a collection id.');
  return jobId;
}

async function poll(jobId, timeoutMs = 190000) {
  const apiKey = getBrightDataKey();
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const response = await fetch(`${API_ROOT}/dca/dataset?id=${encodeURIComponent(jobId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(20000),
    });
    const body = await parseBody(response);
    if (response.status === 200) return body;
    if (![202, 204, 404].includes(response.status)) throw new Error(body?.message || body?.error || `Collector poll failed (${response.status}).`);
    await wait(2600);
  }
  throw new Error('Collector timed out before returning data.');
}

export async function runCollector(key, definition, url, onUpdate = () => {}) {
  const started = Date.now();
  const attempts = Math.max(1, Number(definition.retries || 0) + 1);
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    onUpdate({ key, label: definition.label, status: attempt > 1 ? 'retrying' : 'triggering', url, attempt, attempts });
    try {
      const jobId = await trigger(definition.id, url);
      onUpdate({ key, label: definition.label, status: 'collecting', url, jobId, attempt, attempts });
      const payload = await poll(jobId, definition.timeoutMs || 190000);
      const complete = { key, label: definition.label, kind: definition.kind, status: 'complete', url, jobId, payload, attempt, durationMs: Date.now() - started };
      onUpdate({ ...complete, payload: undefined });
      return complete;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await wait(1200);
    }
  }
  const failed = { key, label: definition.label, kind: definition.kind, status: 'failed', url, error: lastError?.message || 'Collector failed.', durationMs: Date.now() - started };
  onUpdate(failed);
  return failed;
}

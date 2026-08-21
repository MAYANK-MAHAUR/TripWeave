import { getBrightDataKey } from './config.js';

const API_ROOT = 'https://api.brightdata.com';
const terminalHealStatuses = new Set(['done', 'failed', 'error', 'cancelled']);

const parseBody = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
};

const errorMessage = (payload, fallback) => payload?.message || payload?.error || (typeof payload === 'string' ? payload : fallback);

async function brightDataRequest(endpoint, { method = 'GET', body, timeoutMs = 25000 } = {}) {
  const apiKey = getBrightDataKey();
  if (!apiKey) throw new Error('Bright Data is not connected on this server.');
  const response = await fetch(`${API_ROOT}${endpoint}`, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const payload = await parseBody(response);
  return { response, payload };
}

const configuredCollectorId = () => String(process.env.BRIGHT_DATA_SELF_HEAL_COLLECTOR_ID || 'c_mt30n0l416uiazn4sv').trim();
const configuredTargetUrl = () => String(process.env.SELF_HEAL_TARGET_URL || 'https://tripweave-production.up.railway.app/self-heal-target').trim();

const validateCollectorId = (collectorId) => {
  const value = String(collectorId || '').trim();
  if (!/^c_[a-z0-9]+$/i.test(value)) throw new Error('Invalid Bright Data collector ID.');
  return value;
};

const validateTargetUrl = (targetUrl) => {
  const value = String(targetUrl || '').trim();
  const parsed = new URL(value);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Self-Healing requires a public HTTP target URL.');
  return parsed.toString();
};

const validatePrompt = (prompt) => {
  const value = String(prompt || '').trim();
  if (!value) throw new Error('Describe what the Self-Healing job should repair.');
  if (value.length > 1000) throw new Error('The Self-Healing prompt must be 1,000 characters or fewer.');
  return value;
};

export function targetUrlFor(version = 'healthy') {
  const base = configuredTargetUrl();
  if (!base) return null;
  const url = new URL(base);
  url.searchParams.set('version', version === 'broken' ? 'broken' : 'healthy');
  return url.toString();
}

export function selfHealingConfig() {
  const collectorId = configuredCollectorId();
  const targetUrl = configuredTargetUrl();
  return {
    connected: Boolean(getBrightDataKey()),
    configured: Boolean(getBrightDataKey() && collectorId && targetUrl),
    collectorId: collectorId || null,
    targetUrl: targetUrl || null,
    targetHealthyUrl: targetUrlFor('healthy'),
    targetBrokenUrl: targetUrlFor('broken'),
    approvalMode: 'human_in_the_loop',
    creditPolicy: 'Only POST actions marked in the interface call Bright Data. Status polling does not trigger new collections.',
  };
}

function requireConfiguration() {
  const collectorId = configuredCollectorId();
  if (!getBrightDataKey()) throw new Error('Bright Data is not connected on this server.');
  if (!collectorId) throw new Error('BRIGHT_DATA_SELF_HEAL_COLLECTOR_ID is not configured.');
  if (!configuredTargetUrl()) throw new Error('SELF_HEAL_TARGET_URL is not configured.');
  return collectorId;
}

export async function triggerDemoCollection(version) {
  const collectorId = requireConfiguration();
  const targetUrl = targetUrlFor(version);
  const { response, payload } = await brightDataRequest(`/dca/trigger?collector=${encodeURIComponent(collectorId)}&queue_next=1`, {
    method: 'POST',
    body: [{ url: targetUrl }],
  });
  if (!response.ok) throw new Error(errorMessage(payload, `Collector trigger failed (${response.status}).`));
  const collectionId = payload?.collection_id || payload?.snapshot_id || payload?.id;
  if (!collectionId) throw new Error('Bright Data did not return a collection ID.');
  return { collectionId, collectorId, targetUrl, version: version === 'broken' ? 'broken' : 'healthy' };
}

export async function readDemoCollection(collectionId) {
  if (!/^j_[a-z0-9]+$/i.test(collectionId || '')) throw new Error('Invalid Bright Data collection ID.');
  const { response, payload } = await brightDataRequest(`/dca/dataset?id=${encodeURIComponent(collectionId)}`);
  if (response.status === 202 || payload?.status === 'building' || payload?.pending === true) {
    return { status: 'collecting', collectionId, payload };
  }
  if (!response.ok) throw new Error(errorMessage(payload, `Collection read failed (${response.status}).`));
  return { status: 'ready', collectionId, records: Array.isArray(payload) ? payload : payload ? [payload] : [], payload };
}

export async function triggerRealSelfHealing(prompt) {
  const collectorId = requireConfiguration();
  const targetUrl = targetUrlFor('broken');
  return triggerCollectorSelfHealing({ collectorId, targetUrl, prompt });
}

export async function triggerCollectorSelfHealing({ collectorId, targetUrl, prompt }) {
  if (!getBrightDataKey()) throw new Error('Bright Data is not connected on this server.');
  const validCollectorId = validateCollectorId(collectorId);
  const validTargetUrl = validateTargetUrl(targetUrl);
  const trimmedPrompt = validatePrompt(prompt);
  const { response, payload } = await brightDataRequest(`/dca/collectors/${encodeURIComponent(validCollectorId)}/refactor_template`, {
    method: 'POST',
    body: { prompt: trimmedPrompt, custom_input: [{ url: validTargetUrl }] },
  });
  if (!response.ok) throw new Error(errorMessage(payload, `Self-Healing trigger failed (${response.status}).`));
  return { collectorId: validCollectorId, targetUrl: validTargetUrl, prompt: trimmedPrompt, payload };
}

export async function readRealSelfHealingProgress() {
  const collectorId = requireConfiguration();
  return readCollectorSelfHealingProgress(collectorId);
}

export async function readCollectorSelfHealingProgress(collectorId) {
  if (!getBrightDataKey()) throw new Error('Bright Data is not connected on this server.');
  const validCollectorId = validateCollectorId(collectorId);
  const { response, payload } = await brightDataRequest(`/dca/collectors/${encodeURIComponent(validCollectorId)}/refactor_template/progress`);
  if (!response.ok) throw new Error(errorMessage(payload, `Self-Healing progress failed (${response.status}).`));
  const status = String(payload?.status || 'running').toLowerCase();
  return {
    collectorId: validCollectorId,
    status,
    terminal: terminalHealStatuses.has(status) || ['completed', 'success', 'succeeded'].includes(status),
    awaitingApproval: status === 'pending_answer',
    step: payload?.step || null,
    completedSteps: payload?.completed_steps || [],
    previewResult: payload?.preview_result ?? null,
    diff: payload?.diff ?? null,
    payload,
  };
}

export async function decideRealSelfHealing(approve, autoSave = true) {
  const collectorId = requireConfiguration();
  return decideCollectorSelfHealing({ collectorId, approve, autoSave });
}

export async function decideCollectorSelfHealing({ collectorId, approve, autoSave = true }) {
  if (!getBrightDataKey()) throw new Error('Bright Data is not connected on this server.');
  const validCollectorId = validateCollectorId(collectorId);
  const { response, payload } = await brightDataRequest(`/dca/collectors/${encodeURIComponent(validCollectorId)}/resume_automation_job`, {
    method: 'POST',
    body: { message: Boolean(approve), auto_save: Boolean(approve && autoSave) },
  });
  if (!response.ok) throw new Error(errorMessage(payload, `Self-Healing decision failed (${response.status}).`));
  return { collectorId: validCollectorId, approved: Boolean(approve), autoSave: Boolean(approve && autoSave) };
}

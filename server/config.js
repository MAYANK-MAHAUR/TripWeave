import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_COLLECTOR_IDS = {
  kayak: 'c_mt34f4nd154yqg3cmu',
  skyscanner: 'c_mt33xxeo1713z4li9p',
  omio: 'c_mt337hga2lec1lla6q',
  twelveGo: 'c_mt33etd41dqlhth1m7',
  redBus: 'c_mt33jayw26hs1jhoie',
  booking: 'c_mt3447092rktiat9du',
  expedia: 'c_mt33v27020zig1s19b',
  tripAdvisor: 'c_mt33qv8j48f0fd34q',
};

const configuredCollector = (environmentName, fallbackId, definition) => {
  const id = String(process.env[environmentName] || fallbackId || '').trim();
  const explicitEnabled = process.env[`${environmentName}_ENABLED`];
  const enabledByPolicy = explicitEnabled === undefined
    ? definition.enabled !== false
    : String(explicitEnabled).toLowerCase() === 'true';
  return { ...definition, id, configured: Boolean(id), enabled: Boolean(id) && enabledByPolicy };
};

export const COLLECTORS = {
  kayak: configuredCollector('BRIGHT_DATA_COLLECTOR_KAYAK', DEFAULT_COLLECTOR_IDS.kayak, { kind: 'flight', label: 'KAYAK', allowBatch: false, selfHealing: true }),
  skyscanner: configuredCollector('BRIGHT_DATA_COLLECTOR_SKYSCANNER', DEFAULT_COLLECTOR_IDS.skyscanner, { kind: 'flight', label: 'Skyscanner', allowBatch: false, selfHealing: true }),
  omio: configuredCollector('BRIGHT_DATA_COLLECTOR_OMIO', DEFAULT_COLLECTOR_IDS.omio, { kind: 'flight', label: 'Omio', allowBatch: false, selfHealing: true }),
  twelveGo: configuredCollector('BRIGHT_DATA_COLLECTOR_TWELVE_GO', DEFAULT_COLLECTOR_IDS.twelveGo, { kind: 'route', label: '12Go', allowBatch: false, selfHealing: true }),
  redBus: configuredCollector('BRIGHT_DATA_COLLECTOR_REDBUS', DEFAULT_COLLECTOR_IDS.redBus, { kind: 'bus', label: 'redBus', allowBatch: false, selfHealing: true }),
  booking: configuredCollector('BRIGHT_DATA_COLLECTOR_BOOKING', DEFAULT_COLLECTOR_IDS.booking, { kind: 'hotel', label: 'Booking.com', timeoutMs: 180000, allowBatch: false, selfHealing: false }),
  expedia: configuredCollector('BRIGHT_DATA_COLLECTOR_EXPEDIA', DEFAULT_COLLECTOR_IDS.expedia, { kind: 'hotel', label: 'Expedia', timeoutMs: 180000, allowBatch: false, selfHealing: true }),
  tripAdvisor: configuredCollector('BRIGHT_DATA_COLLECTOR_TRIPADVISOR', DEFAULT_COLLECTOR_IDS.tripAdvisor, { kind: 'hotel', label: 'TripAdvisor', composable: false, onDemand: true, input: { max_pages: 1 }, timeoutMs: 60000, allowBatch: false, selfHealing: true }),
};

const credentialPath = () => process.env.BRIGHT_DATA_CREDENTIALS_PATH
  || path.join(process.env.APPDATA || '', 'brightdata-cli', 'credentials.json');

export function getBrightDataKey() {
  const fromEnvironment = process.env.BRIGHT_DATA_API_TOKEN || process.env.BRIGHTDATA_API_KEY;
  if (fromEnvironment) return fromEnvironment;
  try {
    const parsed = JSON.parse(fs.readFileSync(credentialPath(), 'utf8'));
    return parsed.api_key || null;
  } catch {
    return null;
  }
}

export const configStatus = () => ({
  brightData: Boolean(getBrightDataKey()),
  gemini: Boolean(process.env.GEMINI_API_KEY),
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.7-flash',
  geminiFallbackModels: (process.env.GEMINI_FALLBACK_MODELS || 'gemini-3.6-flash,gemini-3.5-flash').split(',').map((model) => model.trim()).filter(Boolean),
  collectors: Object.fromEntries(Object.entries(COLLECTORS).filter(([, value]) => value.enabled).map(([key, value]) => [key, { ...value, id: undefined }])),
});

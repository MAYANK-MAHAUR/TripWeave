import fs from 'node:fs';
import path from 'node:path';

export const COLLECTORS = {
  kayak: { id: 'c_mt1kuf7t24xwbky91k', kind: 'flight', label: 'KAYAK', enabled: true, collectionTier: 'primary', allowBatch: false, selfHealing: true },
  skyscanner: { id: 'c_mt1gvyy0zo7nkno1q', kind: 'flight', label: 'Skyscanner', enabled: true, collectionTier: 'fallback', allowBatch: false, selfHealing: true },
  twelveGo: { id: 'c_mt1kwgiug9ovbtk0m', kind: 'route', label: '12Go', enabled: true, collectionTier: 'primary', allowBatch: false, selfHealing: true },
  redBus: { id: 'c_mt1kvbvy1jp1i1waqf', kind: 'bus', label: 'redBus', enabled: true, collectionTier: 'fallback', allowBatch: false, selfHealing: true },
  booking: { id: 'c_mt1gsvms2n4aypgvl9', kind: 'hotel', label: 'Booking.com', enabled: true, collectionTier: 'primary', timeoutMs: 180000, allowBatch: false, selfHealing: false },
  expedia: { id: 'c_mt1han2523l6qju6c4', kind: 'hotel', label: 'Expedia', enabled: true, collectionTier: 'fallback', timeoutMs: 180000, allowBatch: false, selfHealing: true },
  tripAdvisor: { id: 'c_mt1hc6x0rqqlh3jzi', kind: 'hotel', label: 'TripAdvisor', enabled: true, collectionTier: 'reference', composable: false, onDemand: true, input: { max_pages: 1 }, timeoutMs: 60000, allowBatch: false, selfHealing: true },
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
  collectors: Object.fromEntries(Object.entries(COLLECTORS).map(([key, value]) => [key, { ...value, id: undefined }])),
});

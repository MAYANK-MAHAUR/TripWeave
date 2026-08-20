import fs from 'node:fs';
import path from 'node:path';

export const COLLECTORS = {
  kayak: { id: 'c_mt1kuf7t24xwbky91k', kind: 'flight', label: 'KAYAK', enabled: true },
  omio: { id: 'c_mt1l31is2bxc0ik7xc', kind: 'route', label: 'Omio', enabled: true },
  twelveGo: { id: 'c_mt1kwgiug9ovbtk0m', kind: 'route', label: '12Go', enabled: true },
  redBus: { id: 'c_mt1kvbvy1jp1i1waqf', kind: 'bus', label: 'redBus', enabled: true },
  expedia: { id: 'c_mt1han2523l6qju6c4', kind: 'hotel', label: 'Expedia', enabled: true, retries: 1, timeoutMs: 150000 },
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
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
  collectors: Object.fromEntries(Object.entries(COLLECTORS).map(([key, value]) => [key, { ...value, id: undefined }])),
});

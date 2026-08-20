let cached = null;
let cachedAt = 0;

export async function getInrRates() {
  if (cached && Date.now() - cachedAt < 6 * 60 * 60 * 1000) return cached;
  try {
    const response = await fetch('https://api.frankfurter.app/latest?from=INR', { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('rate request failed');
    const data = await response.json();
    cached = { INR: 1, ...data.rates };
    cachedAt = Date.now();
    return cached;
  } catch {
    return { INR: 1 };
  }
}

export const toInr = (amount, currency, rates) => {
  if (!Number.isFinite(amount)) return null;
  const code = String(currency || 'INR').toUpperCase();
  if (code === 'INR') return Math.round(amount);
  const rate = rates[code];
  return rate ? Math.round(amount / rate) : null;
};

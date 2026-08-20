// Browser worker. Required input: { url: "https://www.booking.com/flights/..." }
if (!input?.url) bad_input('Missing required input parameter: url');
navigate(input.url, {wait_until: 'domcontentloaded', timeout: 45000});
wait('[data-testid="flight-card"], [data-testid*="flight"], .flight-card, [class*="flight-card"]', {timeout: 30000});
const rows = parse();
for (const row of (Array.isArray(rows) ? rows : [rows]).slice(0, 100))
  collect(row);

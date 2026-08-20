// Browser worker. Required input: { url: "https://www.rome2rio.com/map/<from>/<to>" }
if (!input?.url) bad_input('Missing required input parameter: url');
navigate(input.url, {wait_until: 'domcontentloaded', timeout: 45000});
wait('.route, .transport-card, [data-testid*="route"], [class*="route-card"]', {timeout: 30000});
const rows = parse();
for (const row of (Array.isArray(rows) ? rows : [rows]).slice(0, 100))
  collect(row);

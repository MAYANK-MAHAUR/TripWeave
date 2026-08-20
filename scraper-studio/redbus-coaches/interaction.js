// Browser worker. Required input: { url: "https://www.redbus.in/bus-tickets/<from>-to-<to>" }
if (!input?.url) bad_input('Missing required input parameter: url');
navigate(input.url, {wait_until: 'domcontentloaded', timeout: 45000});
wait('.bus-item, .bus-item-details, [class*="bus-item"]', {timeout: 30000});
const rows = parse();
for (const row of (Array.isArray(rows) ? rows : [rows]).slice(0, 100))
  collect(row);

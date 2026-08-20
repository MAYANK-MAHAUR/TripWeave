// Browser worker. Required input: { url: "https://www.booking.com/searchresults.html?..." }
// This is the Booking.com collector. Do not use the .bus-item selector here
// (that selector belongs to the RedBus collector).
if (!input?.url) bad_input('Missing required input parameter: url');

// Booking's generic /searchresults.html endpoint can return an AWS-WAF
// challenge. The locale endpoint serves the same results without that
// challenge. Also remove challenge parameters copied from a prior redirect.
const target = new URL(input.url);
if (target.hostname.endsWith('booking.com') && target.pathname === '/searchresults.html')
  target.pathname = '/searchresults.en-gb.html';
target.searchParams.delete('chal_t');
target.searchParams.delete('force_referer');

navigate(target.href, {wait_until: 'domcontentloaded', timeout: 45000});
wait('[data-testid="property-card"], [data-testid="property-card-container"], .sr_property_block', {timeout: 60000});

const rows = parse();
for (const row of (Array.isArray(rows) ? rows : [rows]).slice(0, 100))
  collect(row);

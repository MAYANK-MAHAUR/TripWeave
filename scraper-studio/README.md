# TripWeave manual Scraper Studio collectors

These collectors are written for Bright Data Scraper Studio's IDE and do not use the AI Agent. Each folder contains an interaction script, parser script, and reference schemas. The IDE itself only shows Interaction and Parser editors; define the `url` input in the separate Input panel and define output fields in Output schema.

The input for every collector is one object with a public `url` field. The application should build that URL from the user's origin, destination, dates, and filters; the sample routes are only preview inputs.

For Booking hotels, use a clean URL without `chal_t` or `force_referer`. The interaction script automatically changes `/searchresults.html` to Booking's `/searchresults.en-gb.html` endpoint because the generic endpoint may return an AWS-WAF challenge instead of hotel cards.

Use the interaction code in the IDE's Interaction editor and the parser code in the Parser editor. In Input, choose Add input parameter → name `url` → type URL, then New input and enter a complete public results URL. Select that input set before Preview. Inspect the output, then save to production. Keep the first-page limit until the preview is stable.

Bright Data IDE references:
- https://docs.brightdata.com/datasets/scraper-studio/develop-a-scraper
- https://docs.brightdata.com/datasets/scraper-studio/functions

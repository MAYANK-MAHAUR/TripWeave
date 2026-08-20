# TripWeave Bright Data collector audit

Tested 2026-08-20 through the Bright Data CLI with the current collector IDs and the configured sample URLs.

| Collector | Result | Use-case verdict |
|---|---|---|
| Booking hotels (`c_mt1gsvms2n4aypgvl9`) | Completed, but returned `hotels: []` plus many `product_page_url` records | **Fail for listing comparison**. It is behaving like a discovery/PDP stage and is not returning hotel rows. Replace or self-heal it to emit one hotel record per visible card. |
| Omio (`c_mt1l31is2bxc0ik7xc`) | Returned many flight route rows with operator, flight number, times, duration, transfers, price and currency | **Pass for flight comparison**. The tested URL is flight-focused, not a full bus/train dataset. |
| KAYAK (`c_mt1kuf7t24xwbky91k`) | Returned many round-trip flight rows with outbound/return legs, prices and booking URLs | **Pass for flight comparison**. |
| 12Go (`c_mt1kwgiug9ovbtk0m`) | Returned route rows including taxi and many flights with numeric prices/currency | **Pass for multimodal seed data**. Validate mode coverage per route; Delhi–Mumbai returned flights/taxi, not every possible mode. |
| redBus (`c_mt1kvbvy1jp1i1waqf`) | Returned bus rows with operator, type, times, duration, seats, rating and INR prices | **Pass for bus comparison**. Some optional fields such as booking URL/boarding points were absent. |
| Expedia (`c_mt1han2523l6qju6c4`) | Returned multiple hotel rows with URLs, images, ratings, reviews, cancellation and USD prices | **Pass for hotel comparison**. Supply check-in/check-out in production inputs; the sample URL defaulted to a one-night date range. |
| Skyscanner (`c_mt1gvyy0zo7nkno1q`) | Failed with `wait_element_timeout` on `.ItineraryInlinePlusWrapper_wrapper__NmY3Z` | **Fail for now**. Do not wire into the app until healed or replaced. |
| TripAdvisor (`c_mt1hc6x0rqqlh3jzi`) | One-page smoke test completed, but returned 20 `product_page_url` records with `hotels: []` | **Fail for listing comparison**. It is behaving like a discovery/PDP stage and is not returning hotel rows. Replace or self-heal it to emit listing-card records. |

## Recommended demo set

Use KAYAK + Omio for flights, Expedia for hotels, redBus for buses, and 12Go for additional route options. Keep TripAdvisor optional. Do not use the current Booking or Skyscanner collectors until they produce non-empty rows within a reasonable run time.

## Important input caveat

The smoke tests used the supplied URLs. RedBus defaulted to its current/tomorrow date because the URL had no journey date, and Expedia defaulted to a one-night date range because the URL had no check-in/check-out. TripWeave must generate date-specific URLs before triggering these collectors. Prices also arrived in mixed currencies (INR, USD, and EUR), so normalize currency before comparing cheapest/most-expensive options.

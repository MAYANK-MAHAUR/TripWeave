# TripWeave Bright Data AI prompts

Use a clean public results URL for each site. Paste one prompt at a time into `bdata scraper create`. Every prompt is below 1,000 characters. Keep only collectors whose preview returns rows.

## 1. Booking.com hotels (recommended first)
URL: https://www.booking.com/searchresults.en-gb.html?ss=Jaipur&checkin=2026-10-12&checkout=2026-10-14&group_adults=2&no_rooms=1

Prompt: Extract every hotel result visible on this public search-results page. Return an array `hotels`. For each item extract: name, hotel_url, image_url, address, distance_from_center, rating, review_count, room_type, meal_plan, cancellation_policy, total_price, nightly_price, currency, availability, source_url. Follow visible pagination/load-more when available. Preserve displayed text, use null when missing, never infer values.

## 2. Tripadvisor hotels
URL: https://www.tripadvisor.com/Hotels-g304555-Jaipur_Jaipur_District_Rajasthan-Hotels.html

Prompt: Extract all hotel cards visible on this public results page. Return `hotels` with name, hotel_url, image_url, area, rating, review_count, price_text, price_value, currency, amenities, ranking, source_url. Include all visible cards and pagination if available. Preserve original text; use null for missing fields; never invent data.

## 3. Agoda hotels
URL: https://www.agoda.com/search?text=Jaipur

Prompt: Extract all publicly visible hotel results. Return `hotels` with name, hotel_url, image_url, location, rating, review_count, room_type, cancellation_policy, price_text, price_value, currency, taxes_text, source_url. Include every result card currently rendered; use null when unavailable and never infer values.

## 4. Expedia hotels
URL: https://www.expedia.com/Hotel-Search?destination=Jaipur

Prompt: Extract every visible hotel result card. Return `hotels` with name, hotel_url, image_url, location, rating, review_count, room_type, amenities, cancellation_policy, total_price, nightly_price, currency, taxes_text, source_url. Preserve displayed values, include pagination when available, use null for missing data, never infer.

## 5. Skyscanner flights
URL: https://www.skyscanner.net/transport/flights/del/bom/261012/261014/?adultsv2=2&cabinclass=economy&rtn=1

Prompt: Extract every flight option visible on this public results page. Return `flights` with airline, flight_number, origin, destination, departure_datetime, arrival_datetime, duration, stops, cabin_class, baggage_text, total_price, currency, booking_url, source_url. Preserve displayed text; include all visible options; use null when missing and never infer.

## 6. KAYAK flights
URL: https://www.kayak.com/flights/DEL-BOM/2026-10-12/2026-10-14?sort=bestflight_a

Prompt: Extract all visible flight cards from this public results page. Return `flights` with airline, flight_number, departure_airport, arrival_airport, departure_datetime, arrival_datetime, duration, stops, cabin_class, baggage, price_text, price_value, currency, booking_url, source_url. Include every card; preserve original text; null if unavailable; never infer.

## 7. redBus coaches
URL: https://www.redbus.in/bus-tickets/delhi-to-mumbai

Prompt: Extract all bus services visible on this public route-results page. Return `buses` with operator, bus_name, bus_type, departure_time, arrival_time, duration, boarding_points, dropping_points, seats_available, rating, price_text, price_value, currency, booking_url, source_url. Include all visible services and load-more results; preserve text; use null when missing; never infer.

## 8. 12Go transport
URL: https://12go.asia/en/travel/delhi/mumbai

Prompt: Extract every visible transport option from this public route page. Return `routes` with mode, operator, departure_station, arrival_station, departure_datetime, arrival_datetime, duration, changes, class, price_text, price_value, currency, booking_url, source_url. Include trains, buses, flights, ferries, and vans when shown. Preserve text; null when missing; never infer.

## 9. Rome2Rio routes
URL: https://www.rome2rio.com/map/Delhi/Mumbai

Prompt: Extract every public route option shown for this origin and destination. Return `routes` with mode, operator, departure, arrival, duration, frequency, transfers, estimated_price_text, estimated_price_value, currency, booking_url, source_url. Include train, bus, flight, car, taxi and rideshare options when displayed. Use null for unavailable values; never infer.

## 10. Omio transport
URL: https://www.omio.com/flights/delhi/mumbai-y6hbd

Prompt: Extract every visible live departure option from this public Omio Delhi-to-Mumbai route page. Return `routes` with mode, operator, service_or_flight_number, departure, arrival, departure_datetime, arrival_datetime, duration, transfers, price_text, price_value, currency, booking_url, source_url. Include train comparison rows when displayed. Do not invent bus or ferry data that is not visible; use null when missing.

<div align="center">

# TripWeave: Plan the whole trip across the globe

### Transport, stays, nearby attractions and the verified travel-and-stay cost range for up to four people in one search.

Trip planning is fragmented across flight, train, bus and hotel websites, while attractions are researched separately. **TripWeave brings them together as complete, budget-ranked trip plans before you book anything.**

<p>
  <a href="https://tripweave-alpha.vercel.app/"><img alt="Open TripWeave" src="https://img.shields.io/badge/OPEN_LIVE_APP-0B2B35?style=for-the-badge&logo=vercel&logoColor=A7F3D0" /></a>
</p>

![TripWeave live Delhi to New York comparison](docs/images/trip-results.png)

**[Try the live app](https://tripweave-alpha.vercel.app/)** · **[Scrape-Verse 2026](https://www.wemakedevs.org/hackathons/scrape-verse)**

</div>

## The problem

There is no simple way to plan a complete trip. Travellers open separate tabs for flights, trains, buses, hotels and things to do. They compare every price manually and often discover too late that the full trip is outside their budget.

## Our solution

Give TripWeave an origin, destination, dates and group size. It searches live public travel listings, starts showing usable results as soon as they arrive, and combines transport with stays into complete plans from the lowest verified total to premium choices.

Each plan includes:

- Travel for up to four people
- A stay for the selected dates
- The combined trip cost
- Timings, stops, hotel rating and location
- Nearby attractions on an interactive route tour
- Direct links back to the websites where each option was found
- A clear warning when a cost, such as a local transfer, is still missing

## See the complete plan

<table>
  <tr>
    <td width="50%"><img src="docs/images/plan-details.png" alt="TripWeave complete plan and cost breakdown" /></td>
    <td width="50%"><img src="docs/images/guided-hotel.png" alt="TripWeave guided city map and selected hotel" /></td>
  </tr>
  <tr>
    <td><strong>One combined total</strong><br />Transport and stay prices are shown together, with every source and missing cost visible.</td>
    <td><strong>From route to destination</strong><br />The guided map reveals the selected hotel and nearby places instead of ending at an airport.</td>
  </tr>
</table>

## How TripWeave works

```mermaid
flowchart LR
    A[Enter your trip] --> B[Choose relevant verified sources]
    B --> C[Collect live transport and stays]
    C --> D[Build complete trip plans]
    D --> E[Compare total costs]
    E --> F[Explore the route, hotel and attractions]
```

1. **You describe the trip.** Choose where you are travelling from and to, the dates and one to four travellers.
2. **TripWeave compares across verified travel sources.** Bright Data starts with the transport and hotel collectors that make sense for that route; the traveller can explicitly check every other compatible source that has passed the live contract.
3. **Results appear progressively.** TripWeave does not make the traveller wait for every website before showing the first useful plans. If a custom collector breaks, Scraper Studio repairs it in the background and recovered rows appear in the same trip.
4. **The pieces become complete trips.** Prices from different websites are converted, cleaned and combined into transport-and-stay plans.
5. **You compare the real total.** Plans are ordered from budget to premium, while missing costs remain clearly labelled.
6. **You explore the journey.** The guided experience follows the route across the globe, moves into the destination city, reveals the selected hotel and visits nearby attractions.

### Real-time scraping when the route is new, cached when it saves time

A new route uses Bright Data Scraper Studio to scrape current public listings in real time, so results reflect the latest prices the travel websites return. The first useful options appear as soon as a source responds, while the remaining sources continue in the background. A completely new or custom destination can take roughly **one to two minutes** to finish because the travel websites are being checked live.

Some recent identical searches reuse a clearly timestamped real result instead of paying to scrape the same pages again. The results page also includes **Check more websites**: normal searches use the most relevant sources for the route, while this optional action runs every remaining compatible source when a traveller or judge wants the widest comparison.

## A trip becomes a story

![TripWeave cinematic globe starting the route in Delhi](docs/images/guided-globe.png)

Opening a guided trip starts at the origin, animates the selected transport route, zooms into the destination and reveals the real selected stay and nearby attractions. Travellers can pause, replay, move between stages or explore manually.

## Bright Data is the data layer

Bright Data Scraper Studio powers the live comparison. Booking.com uses Bright Data's prebuilt scraper, while TripWeave's other sources use custom Scraper Studio collectors. Only collectors that pass a real route, output-shape and page-load check are allowed into a trip.

| Website | What TripWeave collects | Current use |
|---|---|---|
| [12Go](https://12go.asia/en) | Regional trains, buses and route options | Live custom collector |
| [redBus](https://www.redbus.in/) | Bus operators, timings, availability and prices | Live custom collector |
| [Booking.com](https://www.booking.com/) | Hotels, rooms, ratings and stay prices | Live Bright Data prebuilt scraper |
| [Expedia](https://www.expedia.com/) | Hotel alternatives, amenities and prices | Live custom collector |

KAYAK, Skyscanner, Omio and Tripadvisor integrations remain configurable, but they are quarantined from live searches when generation fails, a route cannot be built safely, or one input expands into excessive page loads. This protects both result quality and Bright Data credits.

TripWeave does not blindly run every source for every route. Long international searches skip regional ground transport, unsafe collectors stay quarantined, and recent identical searches are reused to save Bright Data credits.

## The live collectors repair themselves

Websites change, so a scraper that works today can fail tomorrow. TripWeave watches the real custom collectors used by the trip planner. A failed extraction, or an empty source when a peer source proves listings exist, starts this recovery flow:

```text
Detect failed or unexpectedly empty output
        ↓
Ask Bright Data Self-Healing to repair the current scraper
        ↓
Apply the successful patch to the same Collector ID
        ↓
Re-run only the failed input
        ↓
Add verified recovered rows to the open trip
```

The traveller does not approve a patch or restart the search. Recovery status is visible directly on the trip page while existing real results remain usable. To protect credits, TripWeave attempts at most one repair per trip, two per day, and does not repeat a repair for the same collector within 24 hours. The separate recovery lab remains available for a repeatable before-and-after demo.

## Example result

This compact **[Delhi to New York example](examples/delhi-new-york.sample.json)** came from a real cached collection:

```json
{
  "route": "Delhi to New York",
  "travellers": 2,
  "plans": 4,
  "liveOptions": 35,
  "totalRange": "₹1,60,192 to ₹1,63,732",
  "selectedPlan": {
    "transport": "KLM round-trip flight",
    "stay": "Pod 51",
    "total": "₹1,60,192",
    "sources": ["KAYAK", "Booking.com"],
    "missing": ["local transfer"]
  }
}
```

Prices are time-sensitive. TripWeave keeps the collection time visible and never invents a value that a source did not return.

## Run locally

### Requirements

- Node.js `22.12.0` or newer
- Bright Data API access
- A Gemini API key for the trip recommendation

```bash
git clone https://github.com/MAYANK-MAHAUR/TripWeave.git
cd TripWeave
npm install
```

Copy `.env.example` to `.env` and add your Bright Data and Gemini credentials. The self-healing variables are only required when running the recovery lab.

```bash
npm run dev
```

Open `http://127.0.0.1:5173`.

### Verify the project

```bash
npm test
npm run build
npm run test:e2e:auto-heal
npm run test:e2e:self-heal
```

The self-healing browser tests use intercepted responses and do not spend Bright Data credits.

## AI-assisted development disclosure

TripWeave was developed with Codex as a coding assistant. Gemini is used at runtime to organize recommendations from the real options returned by the collectors. All generated code, scraper outputs and technical decisions were reviewed and tested by the project author.

## Built with

[Bright Data Scraper Studio](https://brightdata.com/products/web-scraper) · [React](https://react.dev/) · [Vite](https://vite.dev/) · [Express](https://expressjs.com/) · [Gemini](https://ai.google.dev/) · [MapLibre](https://maplibre.org/) · [OpenFreeMap](https://openfreemap.org/) · [OpenStreetMap](https://www.openstreetmap.org/)

Built by **[Mayank Mahaur](https://github.com/MAYANK-MAHAUR)** for **[Into the Scrape-Verse](https://www.wemakedevs.org/hackathons/scrape-verse)**.

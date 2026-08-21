# TripWeave real Self-Healing judge runbook

## What is real

- `Run healthy collector` calls the configured Scraper Studio collector through `POST /dca/trigger`.
- `Break target website` switches the controlled public hotel page from DOM V1 to DOM V2. The visible hotel data stays the same, while its usable extraction fields move from `data-field` to `data-value`.
- `Run same collector again` calls the unchanged collector against DOM V2.
- `Start real self-heal` calls `POST /dca/collectors/{collector_id}/refactor_template` with the broken URL.
- The interface polls Bright Data's progress endpoint without starting extra collections.
- Bright Data's `pending_answer` state reveals the real preview and proposed diff. The repair remains unapplied until a person approves it.
- `Approve and save repair` resumes the job with `message: true` and `auto_save: true`.
- `Verify repaired collector` runs the repaired production collector against DOM V2 and displays its returned dataset.

## Recommended presentation

Bright Data documents that AI refactoring can take up to 15 minutes. Prepare the slow AI stage before the judge arrives:

1. Open `/self-heal` and confirm `BRIGHT DATA API CONNECTED` and `LIVE API` are visible.
2. Run the healthy collector and wait for three hotels.
3. Break the target and run the same collector again.
4. Start the real Self-Healing job.
5. Wait until the interface displays `HUMAN-IN-THE-LOOP CHECKPOINT` and `pending_answer`.
6. Do not approve yet.

With the judge present:

1. Show the target website and explain that its visible content did not change, but DOM V1 fields moved to DOM V2.
2. Show the event log: the healthy run returned three hotels and the unchanged collector produced zero usable hotels.
3. Open the real Bright Data preview and raw proposed diff.
4. Let the judge click `Approve and save repair`.
5. Click `Verify repaired collector` and show the recovered hotel dataset.

## Credit behavior

Only labelled buttons that send POST requests spend Bright Data credits. Status polling, opening the target, changing the local DOM version, inspecting the diff, and navigating the page do not trigger collections.

## Reset after a completed presentation

Approval updates the collector to DOM V2. To repeat the full V1 to V2 demonstration, restore the collector's earlier production version in Scraper Studio or create a fresh copy from DOM V1. Do not approve during rehearsal unless you intend to reset it afterward.

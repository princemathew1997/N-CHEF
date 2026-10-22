# Extended local validation — 22 October 2026

Result: passed for the current local candidate. This is not a production deployment or a guarantee against every possible defect.

## Environment and isolation

- Desktop and mobile browser checks used headless Microsoft Edge.
- Browser writes used local port 8891 and `.wrangler/extended-qa-20261022` only.
- API, migration and scale tests used separate local SQLite/Miniflare databases.
- Shared preview data on port 8889 and production were not modified.

## Results

| Area | Result |
| --- | --- |
| JavaScript, API and regression suite | 92 passed, zero failures |
| Python database and migration suite | 7 passed, zero failures |
| Role screen sweep | 49 destinations across Admin, Purchaser, Executive Chef and Cuisine Head; no runtime errors or failed authenticated screen APIs |
| Request workflow | Creation, existing requests, quantity editing, duplicate selection prevention, executive acceptance, required change notes, consolidation and recall passed |
| Approval and purchasing | Approval, vendor order creation, supplier cards/documents, open/received sections and date filters passed |
| Receiving | Manual receiving, costs, vendor shortcut, partial receiving, quality rejection, replacement completion and invoice comparison passed |
| Distribution and deliveries | Request linkage, two dispatches from one order, per-item issue reporting, resolution and accepting only the remaining items of one card passed |
| Notifications and refresh | Role targeting, list/count consistency, login baseline, new alerts, read-all, live picker refresh and preserved unsaved input passed |
| Stock and import | Stock balances, receipt history/report totals, legacy CSV validation, error downloads, preview and atomic import passed |
| Navigation and layout | Role restrictions, one-level groups, independent keyboard toggles, restored icons, notification bell preservation and desktop/mobile bounds passed |
| Persistence | After an isolated server restart, canonical full-state responses for all four roles matched the baseline exactly, including balances, records, histories and revision |
| Scale | 100,000 delivery records plus 100,000 stock movements: bounded pages, indexed history, compact state and accurate aggregate totals passed |
| Build and source checks | Static build, browser syntax and `git diff --check` passed |

Negative checks include unauthenticated and unauthorized actions, wrong outlet/cuisine/owner, invalid dates and reversed date ranges, invalid quantities/costs, missing reasons/notes, duplicate items, excess receiving/distribution, stale revisions, retry/idempotency, cross-dispatch acceptance, invalid CSV data, release maintenance and stale-browser write guards. Logout was followed by a confirmed 401 on protected state access.

## Test maintenance during this cycle

- Updated the notification test mock to use the restored icon's separate label element.
- Updated the old purchase-date browser check to assert reversed-range validation before testing an empty future range.
- Ran the completed-changes checks with `NCHEF_SKIP_REVIEW_FLOW=1` after the main operations suite had already completed the single-use review fixture. Repeating that fixture correctly encountered the existing-order duplicate guard.
- Added icon assertions, the full role screen sweep, and before/after restart persistence verification.
- No application defect requiring a product-code change was found during this cycle.

## Reproduction

Build with `node scripts/build.mjs`, then run `node --test tests/*.test.mjs` and `python -m unittest discover -s tests -v`.

Start `scripts/qa-server.mjs` on port 8891 with a new isolated `NCHEF_QA_STATE_DIR`. Set `NCHEF_QA_URL=http://127.0.0.1:8891` and `NCHEF_PLAYWRIGHT_ROOT` to the available Playwright runtime. Run these browser scripts in order:

1. `qa-operations.cjs` (creates fixtures and includes review UI/request flow).
2. `qa-completed-changes.cjs` with `NCHEF_SKIP_REVIEW_FLOW=1`.
3. `qa-dispatch-queues.cjs`.
4. `qa-vendor-receiving.cjs`.
5. `qa-vendor-cards.cjs`.
6. `qa-purchase-sections.cjs`.
7. `qa-notifications.cjs`.
8. `qa-navigation.cjs`.
9. `qa-screen-sweep.cjs`.

Run `qa-persistence.mjs snapshot`, restart only the isolated server with the same state directory, then run `qa-persistence.mjs verify`. Keep baseline data local; it contains test-account state.

Cloud provider availability, production connectivity, real printing and actual concurrent production traffic were not exercised. Migration 0009 and the coordinated frontend/API release remain deployment steps.

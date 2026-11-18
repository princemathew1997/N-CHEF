# Major release QA

Run this review for each major release candidate on an isolated N-CHEF instance
with a disposable database. Record the candidate commit, browser versions,
fixture, and results. Ordinary PR validation runs JavaScript and API tests,
database and migration tests, build, and a packaging dry run. The checks below
add browser workflows, role coverage, and persistence.

1. Run `npm ci`, `npm test`, `npm run test:database`, `npm run build`, and
   `npx --no-install wrangler deploy --dry-run --outdir dist/worker`.
2. Start `node scripts/qa-server.mjs` with `NCHEF_QA_PORT=8891` and a new
   `NCHEF_QA_STATE_DIR`. Set `NCHEF_QA_URL=http://127.0.0.1:8891` and
   `NCHEF_PLAYWRIGHT_ROOT` to a local Playwright installation. The existing
   browser scripts use Microsoft Edge. Prepare Admin, Purchaser, Executive Chef,
   and Cuisine Head accounts with overlapping and disjoint assignments.
3. Start with the fixture setup and browser run order in
   [Extended QA](EXTENDED_QA_2026-10-22.md#reproduction). Run additional
   `scripts/qa-*.cjs` cases for the candidate, including
   `node scripts/qa-quick-stock-edit.cjs`. Check the scripts against current
   workflows and update outdated fixtures, selectors, and expectations.
4. Walk the matrix on desktop and mobile. Exercise each available action, tab,
   filter and relevant feature flag, including actions reached from dialogs and
   menus. Verify that restricted actions are rejected by the API. Add new
   options to the matrix when they are introduced.
5. Run `node scripts/qa-persistence.mjs snapshot`, restart the isolated instance
   with the same database, and run `node scripts/qa-persistence.mjs verify`.
   Rehearse applicable upgrades and rollback compatibility using the
   [release guide](RELEASING.md).

| Area | Scenarios to verify |
| --- | --- |
| Setup, sign-in, roles, navigation | Fresh setup, invalid login, expiry, logout, direct links, refresh, keyboard and mobile navigation, and correct screens and outlet/cuisine scope for all four roles. |
| Master Orders, Stock Overview | All and single outlets, category/item filters, low stock, date boundaries in IST, empty and large lists, report totals, history links, and persistence after reload. |
| Quick Edit Stock and Stock Adjustments | Save 100 → 110 with an audit reason. Check the row immediately, after reload, and in Stock History. Exercise zero, decimals, invalid input, missing reason, price alone, quantity and price together, reserved stock, unchanged quantities, unit changes, wrong outlets, and live refresh during editing and saving. Force a save failure, then check the preserved draft, visible error, successful retry and single audited movement. |
| Receive Stock and Receive Bulk Stock | Single and bulk, Cash and Credit, vendor and invoice totals, approval/rejection, malformed files, unknown/inactive items, duplicate rows and batches, invalid quantities and costs, and partial failures. Verify totals, stock history and valuation. |
| Requests and My Requests | Single and multiple lines, date and quantity limits, backdated requests, duplicate selection, edit before and after acceptance, rejection and resubmission, and role-scoped notifications. |
| Consolidate Requests and Approvals | Review, reject, revise with reasons, consolidate, recall, approve one or many, empty selection, duplicate and concurrent approval. Check parent and child statuses. |
| Vendor Orders, Purchase Orders | Supplier split, linked references and PDF/print, duplicate submission, date filters, raised/received/cancelled views, optional cancelled history, batch eligibility and blocked receiving on cancelled POs. |
| Vendor receiving | Full, partial and rejected-only receipts, replacement, required reasons, Cash/Credit, invoice difference, over-receipt, concurrent receipt, and stock increases only for accepted quantities. |
| Distribute to Cuisine, Cuisine Deliveries, Receive Order | Request-linked and bulk distribution, insufficient or reserved stock, per-outlet/cuisine scope, full and partial confirmation, issue reporting, resolution and replacement, dispatch grouping, history and pagination. |
| Price History, Edit Stock Prices, Stock History | Filters, pagination, totals, weighted costs, prices without stock movements, audited corrections, missing cost, stale balances, feature flag off and unauthorized edits. |
| Add Legacy Stock, Bulk Legacy Stock, Wastage | Add/assign balance, reconcile inconsistent balances, import preview and invalid data, duplicate imports, wastage, failed retry, and balance/history verification. |
| Item Catalog, Categories, Units, Cuisine Sections, Vendors, Locations | Create, edit, search and deactivate where supported. Check duplicates, whitespace and case, invalid references, existing transaction links, and picker and dashboard refresh. |
| Users, Add Cuisine Head, Account Requests, Notifications | Create and update access, credential changes, duplicate/invalid accounts, assignment changes in active sessions, account approvals and rejections, unread counts, read-all and cross-user isolation. |
| Cross-cutting | Empty, populated and upgraded fixtures, large history, concurrent/stale sessions, slow or failed requests, retries, duplicate writes, and browser/API errors. Verify integrity of balances, stock movements, links and audit records. |

For writes, record the API outcome, immediate UI state, and persisted state
after reload. Mark each case as passed, failed, or skipped with a reason.
Retest fixes before publishing and add recurring regressions to the PR suite.

The Quick Edit tests in `tests/quick-stock-edit.test.mjs` run in ordinary PR
validation. They exercise the actual form handlers with simulated API and
DOM state. The browser walkthrough checks real focus, native form validation,
network behavior, and persistence on top of that regression coverage.

## Visual and keyboard walkthrough

Use computer use on the isolated instance and inspect the rendered UI at a
normal desktop size and a narrow mobile width. Open and close forms with the
keyboard. Check where focus lands, where Tab goes next, and whether cancel
returns focus to the action that opened the form. Inspect the visibility and
placement of save errors, validation hints and success messages. Scroll
populated tables and dialogs to verify the row identity, important fields,
and primary actions are readable and reachable. Check narrow layouts with
long item names, long error messages, and populated history tables.

### Additional release checks

| Check | Procedure and evidence |
| --- | --- |
| Accessibility | Run the Quick Edit script with `NCHEF_QA_AXE=1` and `axe-core` installed next to Playwright. Record the automated findings. Use a screen reader and keyboard for Stock Overview, request approval, receiving dialogs, filter controls, tables, and live validation and save messages. |
| Visual regression | Set `NCHEF_QA_SCREENSHOTS` to capture desktop/mobile Quick Edit screenshots. Review and retain approved images by browser, OS and viewport. Install `pngjs` next to Playwright for comparison. On subsequent runs set `NCHEF_QA_VISUAL_BASELINE` to the approved folder and direct new images to a different folder. Use the same browser version and fonts. The comparator tolerates one pixel of height rounding and at most 0.1% differing pixels. Also review Stock Overview, Purchase Orders and receipt dialogs at each viewport. |
| Browser and device coverage | Run the Quick Edit script with `NCHEF_QA_BROWSER=edge` and `firefox` (install the matching Playwright Firefox build). The script also accepts `chromium` and `webkit` with their Playwright browsers installed. On a phone used by staff, check touch targets, mobile navigation, quantity and date input, CSV upload, and PDF/print. |
| Network and concurrency | Run the API suite for competing stock writes and idempotent replay. The browser test covers a rejected save and a committed save whose response is lost. For receipts, distribution, and approvals, repeat those cases in two sessions. Verify the winner and the conflict in the UI and count the resulting stock movements and audit entries. |
| Upgrade and recovery | Use an isolated sanitized copy with older stock history and open orders. Compare counts, balances, pending orders and audit history before and after upgrading. Run foreign key checks and rehearse the documented recovery procedure, including compatibility with data written by the new version. Record the recovery result. |
| Staff acceptance | Give a purchaser the tasks of correcting stock and recording a Cash/Credit receipt. Give a cuisine head the tasks of creating a request, confirming a delivery and reporting a shortage. Record whether each can finish independently, any confusing steps, and whether displayed quantities and history match expectations. |

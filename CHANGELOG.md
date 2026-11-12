# Changelog

Use semantic versions: PATCH for fixes, MINOR for compatible features, MAJOR for
breaking changes. A Git tag identifies a shipped source revision; the GitHub
Release's deployment records identify the actual Cloudflare rollback targets.

## 2.11.0 - 2026-11-12

- Deduct outstanding allocated cuisine quantities from Available stock in Stock Overview so kitchen allocations accurately reflect remaining stock.
- Group and display items by Cuisine Section in consolidated request cards within the Approval Queue and Generate Vendor Orders screens.
- Format distribution quantities to a maximum of 3 decimal places without floating-point artifacts.
- Support live overview synchronization upon order and stock updates.
- No database migrations required.

## 2.10.0 - 2026-11-10

- Add inline Stock Overview quick editing for Admins and Supervisors (Purchaser):
  - Directly adjust Available quantity (with audit reason via `stock/adjust`).
  - Set/update Current Unit Cost (with audit reason via `stock/current-price`).
  - Update catalog Item Unit (with automatic propagation across master items and outlet views).
- Allow setting and updating unit prices for 0-quantity stock items in Edit Stock Prices, establishing baseline outlet costs prior to receiving inventory.
- Permit Supervisors (Purchaser) to update catalog items and correct units on items with prior transaction history.
- No database migrations required.

## 2.9.0 - 2026-11-07

- Add Bulk Order / Request Mode toggle to Distribute to Cuisine, allowing Supervisors (purchaser) and Admins to request bulk ingredients across categories and cuisines.
- Group supervisor bulk requests into consolidated indents for Admin review in Approvals.
- Support Admin quantity editing, approval for order, and rejection with reason prompting.
- Display Bulk Cuisine Request History & Status table for supervisors to track order status and rejection notes.
- No database migrations required.

## 2.8.0 - 2026-11-07

- Consolidate bulk stock operations into Receive Stock with toggle switch, batch queue, manual entry, and CSV upload.
- Enforce distinct delivery preservation, in-flight submission locking, vendor/note tracking, and admin-only direct receiving.

## 2.7.2 - 2026-11-07

- Restore inactive entries to Item Catalog so admins can find and reactivate them. Keep the saved catalog status consistent with the database status.

## 2.7.1 - 2026-11-07

- Exclude inactive items from item search when receiving or adding legacy stock, including after a live catalog refresh.

## 2.7.0 - 2026-11-07

- Add Receive Bulk Stock spreadsheet import feature with master catalog validation,
  Indian date formatting (`DD-MM-YYYY`), 1-week backdated policy check, and tracking
  batch ID (`BR-XXXXX`) ledger tags.
- Add Supervisor bulk receipt submission workflow for Admin approval with real-time
  notifications, pending attention badges, distinct yellow-bordered review cards,
  and automatic duplicate order detection.
- No database migrations required.

## 2.6.2 - 2026-11-06

- Replace the native Approved consolidated order dropdown with an in-page,
  searchable picker so order labels and selection highlights stay readable in
  Windows browsers. Show order numbers and outlets, with mouse and keyboard
  selection. No database changes.

## 2.6.1 - 2026-11-06

- Keep native dropdown menus in the app's dark color scheme, including Approved
  consolidated order. Use paired system highlight/text colors so selected options
  remain readable in Windows browsers. No database changes.

## 2.6.0 - 2026-11-06

- Allow Purchasers (Supervisors) to add catalog items using existing categories,
  units, vendors and cuisines. Keep existing item edits and deactivation admin-only.
- Show Item Catalog and its add form to supervisors. Continue rejecting duplicate
  names and stock changes through catalog metadata. No database migrations.
- Verify all 106 application/API tests, seven database tests, build and the local
  supervisor browser flow for creating a catalog item.

## 2.5.1 - 2026-11-04

- Add a visible ingredient search field to the purchase request form for
  Cuisine Heads and Executive Chefs. Search item names across all categories,
  retain selected items, and preserve existing-order duplicate protection.
- Verify desktop and phone layouts, selection review, and search reset when
  reopening the form. No database migrations.

## 2.5.0 - 2026-11-04

- Move price editing to Stock → Edit Stock Prices for Admins and Purchasers
  (Supervisors). Show positive available balances, including imported and
  adjusted stock, with outlet/category/item filters and current stock values.
- Save current unit prices with a reason and stale-stock checks, preserving
  quantities and existing receipt prices. Record each change as a zero-quantity
  Price update in Stock History plus an audit of old/new prices and stock value.
- Allow the utility to be removed later with the Worker variable
  NCHEF_STOCK_PRICE_EDITING=disabled. Hide the menu and disable price mutations
  while retaining saved prices, balances and audit history.
- Preserve manually set prices when correcting older receipts; subsequent new
  receipts continue to set the current unit cost. No new database migrations.
- Validate 103 app/API tests, seven database tests, build, and the local browser
  flow for editing prices on adjustment-only stock.

## 2.4.0 - 2026-11-04

- Let Admins and Purchasers (Supervisors) correct received and opening stock
  prices from Stock History, and receipt prices from Price History. Require a
  reason, restrict supervisors to assigned outlets, and retain audited old/new
  costs without changing quantities or original movement details.
- Recalculate corrected line totals and price reports. Update remaining stock
  valuation only when the corrected entry determines the current unit cost.
- Add filtered purchase price history, daily quantity-weighted charts, paginated
  receipts and INR price comparisons for Admins and Purchasers.
- Apply migrations 0010 and 0011 under maintenance before publishing the matching
  API/frontend pair. Keep history facts protected and require an audited command
  for price corrections. No stock reset or demo data is part of this release.

## 2.3.1 - 2026-10-28

- Fix admin sidebar scrolling on short screens; keep menu items reachable and account controls visible.

## 2.3.0 - 2026-10-22

- Group cuisine deliveries by dispatch, with Needs attention, Today and History,
  filters, item details and paging. Accept remaining items within one delivery
  while preserving reported issues and completed outcomes.
- Paginate stock history and calculate report totals on the server. Keep daily
  refresh responses compact while retaining notification counts and issued totals.
- Shorten Admin/Purchaser navigation with one-level groups, working primary links,
  independent expand arrows, restored icons and aggregated attention badges.
  Keep Cuisine Head and Executive Chef menus direct.
- Refresh all four role guides and PDFs, including a new Purchaser guide.
- Add migration 0009 for dispatch grouping and indexed history without resetting
  stock, credentials or delivery outcomes. Apply it under maintenance before the
  matching API/frontend release. Older migration sets are not normal rollback targets.
- Validate 92 JavaScript/API checks, seven database/migration checks, 49 role-visible
  browser destinations, end-to-end workflows, negative cases, restart persistence,
  mobile layouts and 100,000-record delivery/history queries.

## 2.2.0 - 2026-10-21

- Let Executive Chefs review and revise quantities before approving requests in
  bulk, including rejected requests resubmitted for consolidation. Replace request
  deletion with rejection reasons delivered to the requesting Cuisine Head.
- Notify Cuisine Heads when stock is issued and let them accept all remaining
  deliveries after reporting individual issues. Provide a direct Receive Order menu.
- Add optional vendor invoice totals and saved per-receipt comparisons to purchase
  order receiving. Default received-order history to today in IST and link Receive
  Stock directly to outstanding vendor orders.
- Let existing ingredient requests grow with their content, block duplicate items
  for the same requester/date/outlet, and refresh outlet filters from assignments.
- Validate 86 JavaScript/API tests, six database/migration tests, browser workflows,
  desktop/mobile receiving layouts, build and deployment packaging.
- Preserve the existing operations-v2 schema; no database migrations or reset.

## 2.1.0 - 2026-10-20

- Integrate role-aware navigation, nested Stock menus and action badges; open each
  role's working page on login and logo clicks. Improve user assignment forms and
  directory filters, with a four-character minimum in user creation forms.
- Lock Cuisine Head edits after Executive Chef acceptance. Add saved consolidation
  edits, mandatory revision notes, immediate recall before purchase approval and
  one pending consolidated order per outlet.
- Separate approval, vendor-order generation, outstanding purchase orders and
  received history. Receive quantities, prices and quality rejections together,
  with correct partial-receipt totals and mobile dialogs.
- Distribute against approved consolidated orders, defaulting editable quantities
  to remaining demand or available stock, and require comments for changes.
- Treat new legacy entries as normal outlet stock labelled Legacy Stock. Add
  item threshold toggles, clear handled action alerts and mark-all-read controls.
- Preserve existing stock, receipt history and credentials. No new D1 migrations
  or database reset are required beyond the v2.0.0 schema (0001–0008).
- Validate 81 JavaScript/API tests, six database/migration tests, browser workflow
  regressions, build and deployment packaging.

## 2.0.0 - 2026-10-20

- Introduce Executive Chef review, Purchaser (Supervisor) approval and purchasing,
  and Cuisine Head requests and delivery confirmation. Existing Supervisors become
  Executive Chefs; existing Chef accounts become Cuisine Heads.
- Separate approval from physical distribution, with linked receipt issues,
  replacement/return resolution, wastage reporting and persistent notifications.
- Add unit prices, latest-cost stock valuation, vendor invoice comparison,
  per-outlet threshold alerts and managed category/unit choices.
- Add Admin-managed vendor details and account-request approval, dashboard login
  and logo navigation, and shared catalog refresh without losing form input.
- Add Excel-saved CSV opening-stock imports with templates, complete row errors,
  preview, atomic import and duplicate/retry protection.
- Require D1 migrations 0006–0008 and database epoch `operations-v2` before
  deploying the matching API/frontend pair. No data reset is required. Older
  approved requests are fenced against a second stock issue. Version 1.x is not
  a compatible code-only rollback target after this migration.

## 1.1.1 - 2026-10-19

- Show only the expand button in the collapsed desktop sidebar and preserve
  the full mobile navigation drawer.
- Keep the Stock menu open when selecting Stock Overview or Assign Legacy Stock.
- Apply shared phone layouts across screens and dialogs, with vertical page
  scrolling, horizontally scrollable tables, responsive forms and wrapping actions.
- Remove frozen first columns on mobile and add a repeatable layout audit for
  320, 390 and 768 pixel widths.

## 1.1.0 - 2026-10-19

- Add optional desktop display scales of 85% and 75%, keeping 100% as the default
  and remembering the selected scale across visits.
- Improve navigation and main-content scrolling, compact form spacing, and
  responsive desktop, tablet and mobile layouts.
- Preserve two-column desktop forms and fill the viewport at compact scales.
- Retry build output cleanup and fail with context if cleanup still fails.

## 1.0.0 - First managed release

- Outlet stock ledger, cuisine requests and supervisor consolidation.
- Separate vendor purchase orders, preferred-vendor overrides and private PDFs.
- Illustrated role guides and downloadable user manuals.
- Manual production release and rollback workflows, version metadata, migration
  compatibility checks and protection against saves from stale browser tabs.

This entry describes the first managed release candidate. It is not evidence
that v1.0.0 is already deployed; check the published release.json record.

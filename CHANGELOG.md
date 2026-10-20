# Changelog

Use semantic versions: PATCH for fixes, MINOR for compatible features, MAJOR for
breaking changes. A Git tag identifies a shipped source revision; the GitHub
Release's deployment records identify the actual Cloudflare rollback targets.

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

# Dispatch queues and stock history

Cuisine Heads use **Receive Order**; other roles use **Cuisine Deliveries**.
Both open Needs attention, including unfinished deliveries from earlier days.
Purchasers see issue dispatches before other awaiting deliveries. Today includes
all statuses; History contains fully handled dispatches. Counts are item counts
within the signed-in user's assignments, not sums of incompatible quantities.

Each distribution command creates a dispatch per outlet, cuisine, recipient and
replacement source. Separate commands remain separate even for the same order.
View items to confirm or report an issue. Accept all remaining acts on that card
only; the server checks the complete pending set and commits it atomically.
Stock movements and original requests remain linked and permission scoped.

## Paged interfaces

- `GET /api/dispatches`: `view=attention|today|history`, optional outlet, cuisine,
  status, item ID, order reference, from/to IST dates, limit and cursor.
- `GET /api/dispatches/items`: dispatch ID, limit and cursor.
- `GET /api/stock/history`: optional outlet, item ID, vendor name, movement type,
  person ID, delivery ID, from/to IST dates, limit and cursor. Defaults to today;
  `allDates=1` permits an explicit all-dates search.
- `GET /api/stock/report`: assigned outlet and date range, optional item/category.
  Returns aggregated opening, receipts, cuisine usage, adjustments and closing.

Pages default to 25 rows, maximum 100. Cursors are opaque and belong to the same
endpoint and filters. Dispatch item filters match cards without hiding other items
in a matched dispatch. Cursor order is priority/time/ID for cards and time/ID for
movements and lines. Live refresh retains filters and expanded cards and defers
updates while a filter or confirmation dialog is being edited.

Browser requests send `X-NCHEF-Workspace: paged`. State/session/write responses
then omit raw movement and delivery history. They contain scoped queue counts,
per-request issued totals, catalog history flags and the latest 200 notifications.
Unread counts and mark-all-read cover all notifications, not only those 200.
Legacy API consumers without this header retain their existing response shape.
Historical records are never deleted or automatically accepted.

## Migration and release

Apply `0009_dispatch_queues.sql` before publishing this frontend and API pair.
It adds generated lookup columns and indexes, without changing stock balances,
credentials or delivery outcomes. Historical records share a dispatch only when
their creation audit establishes the same command, cuisine and recipient; otherwise
they remain individual Earlier delivery cards. Keep migrations 0001–0008 unchanged.

The local QA server applies the additive dispatch migration when opening an older
preview database. Back up that database before its first restart. Production uses
the documented maintenance fence, remote migration preflight, and coordinated
release workflow; QA startup migration logic does not run in production.

Validation includes permission, grouping, mixed-outcome acceptance, retry,
concurrent-page, IST, migration-preservation and 100,000-record load checks.
Browser scenarios are `qa-operations.cjs` followed by `qa-dispatch-queues.cjs` on
disposable port 8891. Do not use production or shared preview data for those seeds.

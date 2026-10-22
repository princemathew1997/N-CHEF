# Current scope and limitations

Reviewed 22 October 2026 for N-CHEF 2.3.0. This page replaces the older pre-operations comparison, which contained resolved findings.

## Roles and access

Supported roles are Admin, Executive Chef, Purchaser (Supervisor) and Cuisine Head. There is no separate Area Manager role or configurable approval-routing hierarchy. Admin manages user setup and assignments; Purchasers request accounts for Admin approval. Access follows assigned outlets/cuisines. Cuisine Heads use their request and receipt-confirmation screens rather than store history/reporting.

## Stock and accounting

Distribution requires sufficient recorded stock and approved remaining demand. A shortage or issue is recorded through the delivery resolution workflow; it is not permission to drive store stock below zero.

Available stock value uses the latest receipt price at that outlet, not weighted-average costing. Historical unpriced stock/wastage remains unpriced. Vendor invoice comparison uses accepted-stock line totals and an optional invoice total; it does not separately calculate tax or freight. Rejected goods do not increase usable stock.

Bulk opening stock accepts CSV, not native XLSX/XLS. Save Excel files as CSV UTF-8 first. Imports require managed matching categories and units, existing items/outlets, positive quantities, at most 150 entries and a 100 KB file. Unit changes are blocked once stock history exists.

## Requests and deliveries

Cuisine Heads submit today's IST requests. Executive Chef may use the preceding three days with justification. An initial-order item cannot be selected again through Place new order; edit its initial quantity while permitted or coordinate with Executive Chef once locked.

Only one pending consolidation is allowed per outlet. Recall is limited to the owning Executive Chef before approval or downstream purchasing. Rejected requests remain recorded with their reasons.

Accept all remaining applies to one dispatch card only, not every filtered delivery. Report problem lines first. History shows fully handled dispatches; unresolved cards remain in Needs attention even when old. Earlier deliveries are grouped only when an audit reliably identifies their shared dispatch; others remain separate Earlier delivery cards.

## Notifications, updates and deployment

Notifications are in-app, with menu/tab attention and periodic refresh while visible. WhatsApp, email and operating-system push delivery are not implemented by this workflow. It does not guarantee notifications while the browser is closed.

Concurrent writes can be rejected by revision checks. Refresh and review the saved state before retrying; do not treat a failed save as a successful update. History and delivery screens load pages; current results may change as other users act.

Version 2.3.0 requires migration 0009 for dispatch lookup and history indexes, applied through the coordinated migration/frontend/API release process. The extended local test report does not establish behavior under actual production traffic.

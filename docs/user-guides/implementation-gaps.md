# Older requirements compared with the current app

Reviewed 16 October 2026 against the 8 October requirements document. This is an implementation comparison, not a change request or authorization to add features.

| Requirement | Current gap or difference | Evidence |
| --- | --- | --- |
| ORG-04: optional Area Manager | No Area Manager account type; supported roles are Admin, Supervisor and Chef. | `worker/model.mjs`, user role validation; `migrations/0001_inventory_schema.sql`, users role constraint |
| APR-04: routing to Owner/Admin or Area Manager | Approvals are Admin-only. No assignment, routing precedence or fallback through an Area Manager. | `worker/index.mjs`, indent approval endpoints |
| ISS-02: issue despite insufficient recorded stock | Distribution is rejected if it would make an outlet balance negative. There is no shortage-recording alternative. | `worker/stock.mjs`, stockCommand balance validation |
| NOT-03: escalate insufficient-stock issues | No next-authority escalation or recipient notification workflow. | Stock commands and API routes; no notification storage or delivery service |
| NOT-01 / NOT-02: request and approval notifications | On-screen toasts, badges and polling exist, but no event messages delivered to designated supervisors/managers. | `js/api-data.js` success toasts; `worker/index.mjs` routes |
| NOT-04: WhatsApp integration | No provider integration or WhatsApp delivery implementation. Provider and recipients remain unspecified. | No WhatsApp configuration or sending code in current app |
| ORG-01: single-outlet Supervisor, no outlet switching | Single-outlet accounts get fixed controls, but Admin can assign multiple locations or all locations to a Supervisor. Such accounts can switch among permitted outlets. | `js/app.js`, supervisor assignments; `js/inventory-ui.js`, OutletSelection |
| ORG-01 / DASH-03: Chef inventory restriction at the underlying access level | The Chef workspace hides stock screens, but the state API still includes permitted-outlet stock balances and stock history. The restriction is not complete at the data/API layer. | `worker/model.mjs`, project filters outletStock and stockHistory by outlet without removing them for Chef |
| ORG-02: manager staff transfers | Admin can change a Chef outlet or Supervisor assignments in Users. There is no separate manager role or dedicated transfer workflow. Treat this as partial coverage, rather than an entirely missing ability to reassign staff. | `js/app.js`, saveAdminChefUser and saveSupervisorUser |

Approval routing precedence, notification recipients/provider and the shortage accounting mechanism were open decisions in the older document. Those choices need confirmation before implementing the affected features.

## Additional display issues found while documenting

- Resolved in local code on 16 October: Raise to Vendor now preselects catalog preferred vendors per ingredient, allows order-only overrides, saves one order per vendor atomically, and offers isolated vendor PDFs. The former `Record references cannot change.` failure is fixed. Deployment is separate.
- The sidebar Purchase Orders link opens Consolidated Requests. The actual Purchase Orders Raised to Vendors table and Receive button are in the Admin Vendors view. Supervisors have backend permission to receive an order for a permitted outlet, but no normal navigation to that order table.

- The Chef Portal counts Consolidated requests in its Approved summary card. The row correctly labels Consolidated, so use row status when distinguishing consolidation from approval.
- The Chef Portal has no explicit PO Raised label branch, so those rows fall back to Rejected. Confirm purchase-order outcomes with the Supervisor in Purchase Orders.
- The Chef table shows original requested quantities rather than supervisor-revised quantities. A Chef should confirm the approved quantity with the Supervisor.

Unresolved findings remain documented for follow-up. Raising a vendor order does not receive or issue stock. This update has not been deployed.

# Restaurant Inventory — Change Requirements

Version 1.0 · 8 October 2026 · Consolidated for review

## 1. Purpose and scope

Changes and enhancements to an existing restaurant inventory system that tracks incoming food items/ingredients and stock issued for use. This document captures the requirements shared so far; it does not establish which features already exist or require redevelopment. That mapping requires a review of the existing application.

Inventory is maintained independently for each outlet. Centralized/shared inventory is outside the current scope. Cross-outlet summaries provide visibility, not a shared stock pool.

## 2. Requirement groups

| Group | Coverage | Scope |
|---|---|---|
| Access and organization | Outlets, roles, staff assignment and cuisines | Current changes |
| Ingredient selection | Categories, item selection and quantity review | Current changes |
| Requests and approvals | Chef requests, supervisor consolidation and approval | Current changes |
| Stock receipts | Outlet inventory and multiple vendor entries | Current changes |
| Daily stock issue | Cuisine checkout and insufficient-stock exceptions | Current changes |
| Dashboard | Outlet summaries, daily availability and usage | Current changes |
| Notifications | Request, approval and exception alerts; WhatsApp integration evaluation | Current changes |
| Optional management layer | Owner-configurable area manager for multiple outlets | Future-use capability; not mandatory in daily operation |

## 3. Roles and access

| Role | Outlet scope | Confirmed responsibilities and access |
|---|---|---|
| Owner / Admin | All outlets | View outlet-wise summaries and approve indents. Owner adds supervisors, chefs and optional area managers. Admin can add cuisines. |
| Area Manager | Multiple assigned outlets | Manage outlets and approve indents when the role is used. |
| Supervisor | One assigned outlet | Add stock, raise replenishment requests, add chefs, change chef cuisine, review and consolidate chef requests, revise quantities with comments, submit indents, and issue stock to cuisines. |
| Chef | Assigned outlet and cuisine | Request ingredients and view own requested items. Available inventory must not be visible to the chef. |

**ORG-01 — Outlet restrictions:** Supervisors and chefs must operate only within their assigned outlet and must not have an outlet-switch option. Restrictions must apply to the underlying access as well as the screen controls.

**ORG-02 — Staff transfers:** A manager must be able to move people from one outlet to another. The precise manager role and transfer scope remain to be confirmed; the user did not explicitly limit this action to an area manager.

**ORG-03 — Cuisine assignment:** Select a cuisine when adding a chef. Examples include Kerala, Tandoor, Arabic and Chinese. Admin can add cuisines, and a supervisor can reassign a chef to another cuisine.

**ORG-04 — Optional area manager:** The owner can add an area manager responsible for multiple outlets. The approval workflow must also operate when no area manager is configured.

## 4. Category-based ingredient request

**REQ-01 — Category selection:** Group items into categories. During a request, show the items within the selected category and allow multiple items to be selected.

**REQ-02 — Category navigation:** Allow the user to move to the next category, skip an unwanted category, or proceed directly to quantity review without visiting all categories. Retain selections made across categories.

**REQ-03 — Quantity review:** On the next screen, show selected items and allow quantities to be entered or changed before submitting the request to the supervisor.

**REQ-04 — Request overview:** Chefs and supervisors must have an overview of the items they are requesting. A chef can view their own requested items without seeing available stock.

## 5. Consolidation and approval

**APR-01 — Request attribution:** The supervisor must see which chef and cuisine requested each item.

**APR-02 — Consolidation:** The supervisor consolidates ingredient requirements from multiple chefs into an indent for approval. The supervisor can also raise requests for new stock.

**APR-03 — Quantity changes:** The supervisor can change a requested quantity and attach a comment explaining the alteration. For example, reduce a chef's chicken request from 10 kg where the full amount is not needed.

**APR-04 — Submission and routing:** Show the supervisor a summary before submitting the consolidated indent. Route it for approval to the Owner/Admin or Area Manager based on the available management arrangement. Exact routing precedence is an open decision.

**APR-05 — Cuisine breakdown:** For every ingredient on the approval view, show the total requested quantity and each cuisine's share as a percentage of that ingredient's total. Do not calculate one percentage across unlike ingredients.

Example: a consolidated chicken request of 10 kg.

| Cuisine | Quantity | Share of chicken request |
|---|---:|---:|
| Tandoor | 5 kg | 50% |
| Chinese | 2.5 kg | 25% |
| Other cuisine(s), illustrative remainder | 2.5 kg | 25% |
| Total | 10 kg | 100% |

Calculation: cuisine quantity ÷ total quantity for the same ingredient × 100. Quantities must use comparable units. Whether the breakdown represents original requests or supervisor-revised quantities needs a decision before implementation.

## 6. Outlet inventory and stock receipts

**INV-01 — Independent balances:** Maintain item balances separately for each outlet. Receiving or issuing stock in one outlet must affect that outlet only.

**INV-02 — Stock entry:** The assigned supervisor adds incoming items to the outlet's stock.

**INV-03 — Multiple vendors:** Permit multiple receipt entries for the same ingredient from different vendors. Preserve the individual entries while reflecting their combined quantity in the outlet's item balance.

Example: chicken received as 10 kg from Vendor A and 15 kg from Vendor B results in 25 kg received at that outlet, with two separate vendor entries.

## 7. Daily checkout and stock exceptions

**ISS-01 — Issue to cuisine:** The supervisor checks out daily-use items to individual cuisines. Record the issue against the relevant outlet, item, quantity and cuisine and reflect it in available stock.

**ISS-02 — Allow insufficient-stock checkout:** Do not block checkout solely because recorded stock is zero or insufficient. Record the transaction and notify the next-level authority about the discrepancy/change.

Example: recorded stock is 5 kg; the supervisor issues 8 kg. The checkout succeeds and the 3 kg shortage is identified for escalation. Whether the balance displays as −3 kg or uses a separate discrepancy mechanism is undecided.

**ISS-03 — Usage meaning:** Daily checkout is the amount issued to a cuisine. Actual consumption, unused returns and wastage were not separately specified. Dashboard labels should avoid implying that issued stock is independently measured consumption.

## 8. Dashboard and visibility

**DASH-01 — Outlet summaries:** Owner/Admin can view summaries across all outlets, with each outlet shown separately.

**DASH-02 — Daily availability and usage:** Show daily stock availability and quantities checked out for use, including the cuisine receiving the items.

**DASH-03 — Role restrictions:** Preserve the chef restriction on viewing available stock. A supervisor's inventory view is confined to their assigned outlet; the optional area manager's outlet scope must follow assignments.

Suggested dashboard fields, subject to review: opening balance, receipts, quantities issued, closing balance, cuisine-wise issues and insufficient-stock exceptions. The explicit requirement is daily availability and usage; this field layout is a proposal.

## 9. Notifications and WhatsApp

**NOT-01 — New request/order:** Notify the supervisor and manager when an order/request is made. The exact event meant by “order” and the manager recipient need to be mapped to the final workflow.

**NOT-02 — Approval:** Notify the manager when approvals occur.

**NOT-03 — Stock exception:** Notify the next-level authority when the supervisor checks out an item despite unavailable or insufficient recorded stock.

**NOT-04 — WhatsApp integration:** Evaluate and provide for a WhatsApp service integration to send these operational updates. No provider, delivery mechanism or commercial plan has been selected.

| Event | Explicitly requested recipient | Detail to settle |
|---|---|---|
| Order/request created | Supervisor and manager | Chef submission, consolidated indent, purchase order, or multiple events |
| Approval occurs | Manager | Which manager, and whether other users also receive it |
| Insufficient-stock checkout | Next-level authority | Area manager when assigned; fallback recipient otherwise |

## 10. Proposed safeguards — not yet confirmed requirements

The following were suggested during collection and should not be mistaken for additional user-approved scope:

- Retain original chef quantities alongside supervisor revisions, comments, editor and timestamp.
- Preserve the outlet and cuisine associated with historical transactions when staff are reassigned.
- Record receipt date and purchase price alongside vendor and quantity; exact mandatory fields remain to be agreed.
- Allow item removal on the quantity review screen.
- Provide request status/history, with the lifecycle and visibility rules defined explicitly.
- Add in-app notifications, delivery history and duplicate prevention.
- Notify supervisors of approval outcomes and requesters of rejection or modification.

## 11. Open decisions

| ID | Decision required | Why it matters |
|---|---|---|
| D-01 | Does “manager” mean Area Manager, Owner/Admin, or a separate role? Who may transfer which staff? | Permissions and notification recipients |
| D-02 | Does “availability” mean a configured/assigned approver or a temporarily available person? Who is the fallback? | Approval routing |
| D-03 | Which quantities drive cuisine percentages after supervisor changes? If a consolidated total changes, how is it allocated across cuisines? | Accurate approval breakdown |
| D-04 | Use negative stock balances or a separately tracked shortage? How are discrepancies reconciled? | Inventory arithmetic and follow-up |
| D-05 | Which event is an “order” for notifications, and which channels and recipients apply at each stage? | Avoid missing or excessive alerts |
| D-06 | What approval outcomes are supported: approve, reject, return for revision, or partial approval? | Complete request lifecycle |
| D-07 | Who maintains item categories, item records and vendors? Are these lists shared across outlets? | Master-data permissions; inventory stays outlet-specific regardless |
| D-08 | Is daily “usage” limited to issued quantities, or will actual consumption, returns and wastage also be recorded? | Dashboard interpretation and scope |
| D-09 | Which receipt fields and item units are mandatory? Are unit conversions needed? | Reliable stock totals and percentages |

These decisions do not prevent requirements collection from being complete for now, but the relevant ones should be resolved before implementing affected features.

## 12. Dependencies and implementation review

Suggested sequence, not a delivery commitment:

1. Review the existing application and map each requirement to existing functionality, modification, new feature or removal. No defect has been demonstrated in the material provided.
2. Establish outlet access, user roles, cuisine assignments and master data.
3. Implement category selection, quantity review and attributed chef requests.
4. Implement supervisor consolidation, revision comments, cuisine percentages and approval routing.
5. Update vendor receipts, daily cuisine checkout and stock discrepancy handling.
6. Build role-appropriate dashboard summaries and notification events; evaluate WhatsApp integration.

Key dependencies: role/outlet assignments govern access throughout; request attribution is needed for cuisine percentages; receipt and issue records support dashboard balances; final approval routing determines notification recipients.

## 13. Acceptance scenarios derived from confirmed requirements

| Scenario | Expected result |
|---|---|
| Owner opens the overview | Summaries are available outlet by outlet. |
| Supervisor or chef attempts to switch outlet | No self-service outlet switch or access to another outlet is available. |
| Owner adds an optional area manager | Multiple outlets can be assigned; the system also works without this role. |
| Supervisor adds or reassigns a chef | A cuisine can be selected or changed. |
| Authorized manager transfers staff | The staff member's assigned outlet changes within the agreed permission scope. |
| Chef selects items from two categories and skips a third | Selected items remain available on the quantity review screen. |
| Chef submits a request | Supervisor can identify the requesting chef and cuisine; chef sees own requested items without stock availability. |
| Supervisor revises a quantity | A comment accompanies the change and the revised indent can be submitted for approval. |
| Approver reviews the chicken example | The ingredient shows a 10 kg total with Tandoor 50%, Chinese 25%, and the remaining share. |
| Same item is received from two vendors | Separate entries remain and the outlet balance reflects both receipts. |
| Supervisor issues stock to a cuisine | Outlet availability and daily issued quantities update. |
| Supervisor issues more than recorded stock | Checkout succeeds and a shortage notification is triggered to the next level. |
| Request/order and approval events occur | Supervisor/manager notifications follow the agreed mapping of the requested events. |

## 14. Scope boundaries

- No centralized inventory in the current scope.
- Area Manager is optional and intended to support future operational use.
- Supplier order placement, payments, invoicing, inter-outlet stock transfers, recipe-based consumption and wastage workflows have not been requested.
- No technology stack, WhatsApp provider, delivery schedule or implementation estimate has been agreed.
- This is a change requirements document, not authorization to modify or deploy the existing application.

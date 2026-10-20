# UI review validation

Testing authorized on 20 October 2026. Automated regression, database and browser suites have now been executed against disposable local databases. Production was not modified.

Release validation on 20 October 2026 passed: 81 JavaScript/API cases, 6 Python database/migration cases, and the operations browser suite with `qa-review-ui.cjs` and `qa-review-flow.cjs`. Separate browser regressions passed for saved consolidation edits, vendor receiving, purchase-order sections/date filters and notifications/mark-all-read. Build, Worker dry-run packaging and whitespace checks also passed. Browser mutations used a disposable database on port 8891; review data on port 8889 and production were untouched. Windows sandbox restrictions required rerunning Workers tests and Wrangler logging outside the sandbox; those reruns passed.

No new migration files are introduced by this review series (schema remains through 0008). These results validate the local candidate; committing, versioning and the release workflow's production provenance and health gates remain release steps. The acceptance scenarios below describe the intended workflow; later rules supersede earlier review iterations.

Additional acceptance cases for the final integrated run:

- Consolidate different units: no section-unit footer or combined quantity summary; per-item totals retain units.
- Edit a cuisine quantity, send with blank or whitespace note: highlight every missing note red, focus the first, show no confirmation dialog, and make no write.
- Offset two cuisine edits so the item total is unchanged: a note remains required.
- Enter notes for all edited rows: send succeeds; notes persist on the consolidated order and request history.
- Direct API submission with edited cuisine quantities and no note: reject atomically; no indent, request update, or revision increment.
- Unchanged quantities: no note required. Historical consolidated records remain readable and editable under existing permissions.
- Create a user with a four-character password and log in; three characters fail in the form. Editing an existing user with no new password preserves credentials.
- Save an item with low-stock toggle off, reopen: off remains saved. Enable a threshold, save, reopen: enabled quantity persists. New items remain off.
- Two browser accounts: new cuisine request highlights Executive Chef Requests, updates tab count, and shows a dismissible top-right overlay within one sync interval.
- Forward a consolidated order: Admin and assigned Purchaser receive pending-request indicators; other outlets receive none.
- Repeat unchanged sync: no repeated overlay. New request triggers another overlay. Clearing pending work removes its highlight and tab contribution.
- Unread in-app notifications contribute to tab attention; reading them clears their contribution. Notification content displays as text.
- Desktop and mobile: all nested menus, filters, toggle controls and overlays fit the screen and work with keyboard focus.
- Logout/login across all roles: no previous account directory, role filters, notification content or assignment visibility leaks.

## Request date and repeated requests

- Opening Raise Request defaults to today's IST date. Calendar allows today and the preceding three days; older and future dates fail.
- Backdating shows a required justification; blank/whitespace fails before saving. Switching back to today hides it and submits no backdate reason.
- Direct API attempts with invalid dates or missing justification fail atomically. Editing an existing request cannot rewrite its original date/justification.
- Backdated requests notify every assigned higher role, excluding peers, lower roles and unrelated outlets. Retrying the same operation ID creates no duplicate alerts.
- Opening Raise Request again shows the signed-in user's existing requests for the selected date and outlet, including quantities and statuses. Changing date/outlet updates this list without modifying prior orders.
- Additional same-day requirements create new lines without resubmitting existing ones.
- Existing requests without a date use their actual submission timestamp for display. Historical dates remain intact during consolidation.

- When the selected date/outlet already has requests, show the informational Item name / Quantity table first, with item selection hidden. Place new order opens a fresh selection flow and does not edit or resubmit existing lines.
- A date/outlet with no existing requests opens item selection directly. Backdate justification remains available on either screen.

## Same-day Cuisine Head requests (supersedes Cuisine Head backdating cases above)

- Cuisine Head sees today's IST date as text, without a date picker or backdate justification.
- New Cuisine Head submissions use today's IST date, including when a wizard remains open across midnight.
- Backend rejects backdated Cuisine Head requests even with justification; existing historical requests retain their dates.
- Existing-request table and Place new order remain available for today's requests.
- Executive Chef date selection retains its previous three-day limit and justification rules.

- Executive Chef: accept two pending requests one by one; Requests badge and tab count change 2 → 1 → hidden. Accepted rows remain ready to consolidate and do not count as pending acceptance. Undoing acceptance restores the count.

## One pending consolidation per outlet

- Submit a consolidated request, then receive new cuisine requests: another submission for the same outlet is blocked in the UI and API.
- Owning Executive Chef recalls the unapproved request immediately, without Admin approval. Existing request IDs, quantities, owners and notes remain; old indent snapshot is auditable.
- Recalled items and new accepted/pending requests appear together for a fresh consolidated submission.
- Other outlets remain independent. Approved orders allow a fresh consolidation but cannot be recalled. Wrong owners and outlets cannot recall.
- Concurrent recall/approval uses the revision guard: only one succeeds. Duplicate recall retries do not duplicate records or notifications.

## Cuisine Head editing cutoff (supersedes forwarded-edit cases)

- Edit quantity appears only for Pending/Accepted requests without an indent link, in both My Requests and the existing-order table.
- Consolidated, Sent to Admin, Approved, PO Raised and Rejected requests have no edit action; direct API edit attempts return a conflict without changes.
- Additional quantities use Place new order and preserve all previous quantities and approval records.
- Recall restores existing lines to Accepted without an indent link, making them editable again before resubmission.

## Final editing rule: Pending only

- Cuisine Heads can edit only their own Pending requests without an indent link.
- Executive Chef acceptance immediately removes Edit quantity in both My Requests and the existing-order table.
- Accepted/Consolidated/Approved requests reject direct edits through both the explicit edit action and generic changes API; no quantity changes persist.
- Recalled requests return to Accepted and remain locked for Cuisine Heads. Additional quantities require a fresh request.

## Approval queue visual sections

- Multiple consolidated requests render as separate bordered cards with visible gaps, request number, outlet, Executive Chef, item count and status.
- Each card keeps its own actions directly below the item table without a large blank area; buttons target that card's request ID.
- Pending cards show Awaiting approval; approved cards show Approved and no Approve for order button.
- Individual cuisine requests have a separate labelled section only when present. No empty No records table appears below consolidated cards.
- Mobile headers wrap without clipping; wide tables scroll within each card.

## Separate vendor order queue

- Requests → Approvals shows only Pending Approval consolidated orders and direct requests requiring approval, with no Generate vendor orders button.
- After Approve for order succeeds, the card leaves Approvals and appears under Requests → Generate Vendor Orders.
- Generate Vendor Orders is available only to Admin/Purchaser and lists Approved indents without existing purchase orders.
- Creating vendor orders removes the indent from this queue; generated orders remain under Purchase Orders for receiving and PDFs.
- Empty queues have distinct messages. Executive Chef and Cuisine Head cannot open the vendor-generation view through saved routes.

## Legacy stock is ordinary outlet inventory

- Stock → Legacy Stock → Add Legacy Stock adds directly to a selected outlet, with vendor label Legacy Stock; Bulk Legacy Stock does the same.
- Both entries appear in normal available quantity and stock history. Distribution consumes the combined outlet balance normally.
- No central-stock column or separate central-stock table is displayed. No new unassigned balance is created.
- Existing historical unassigned records are retained internally for compatibility, never silently allocated to an arbitrary outlet or deleted. Any residual balance needs an explicitly confirmed outlet during rollout.
- Historical receipt/vendor records are unchanged. New legacy entries use Legacy Stock as their origin label, without requiring a maintained vendor record.
- Duplicate retries add stock once; disallowed roles/outlets cannot add stock. Blank optional cost remains unavailable rather than becoming a zero-price receipt.

## Vendor receiving dialog

- Receive order opens a dedicated dialog; cards no longer contain separate price forms.
- Enter quantities physically delivered now, rejected quantities, unit costs and reasons in one table. Accepted quantity is received minus rejected; only accepted goods affect stock and cost.
- Reasons include Quality issues, Damaged goods, Wrong item and Other. Other requires a note. Rejected goods remain outstanding for replacement and are not automatically wastage.
- Partial receipts retain the order as Partially Received. Later receipts default to the outstanding accepted quantity; completion sets Received.
- Receipt events preserve quantities, rejection reasons, actor, time and cost. Higher outlet roles receive rejection notifications.
- Excess quantities, negative quantities, invalid prices, duplicate items, invalid outlet/role and duplicate retries are checked in unit/API tests; atomic rejection changes nothing.
- Desktop/mobile receiving dialog supports scrolling for large orders and updates accepted line totals and grand total immediately.

## Final vendor receiving quantity meaning

- Received is the accepted quantity. Rejected is entered separately and is never subtracted from Received again.
- Received 1 + Rejected 1 at INR 100/unit adds 1 unit and INR 100 to stock; the rejected unit remains outstanding.
- Received + Rejected must not exceed outstanding quantity. A fully rejected delivery uses Received 0, Rejected outstanding, with no cost required.
- Replacing rejected goods later increases accepted stock only once; completed receipt and historical cost snapshots remain accurate.

## Purchase order sections

- PO Raised lists outstanding orders, including Partially Received, with receiving controls.
- Completion removes an order from PO Raised and places it in the compact Received list.
- Received lists completion date/time, PO number, vendor, outlet, item count, details and PDF download without receiving forms.
- Date ranges use order date for PO Raised and completion date for Received in IST; clear restores all dates. Invalid ranges fail visibly.
- Section counts remain accurate after receiving and live updates. Tables fit the page and scroll internally on mobile.

## Consolidated-order distribution

- Select an approved consolidated order, then allocate each outstanding cuisine request. Available outlet stock includes normal and legacy-origin entries.
- Approved remaining quantities are prefilled within available stock; combined allocations of the same item cannot exceed its outlet balance.
- Any change from remaining approved quantity, including zero allocation, requires a comment. Unissued quantities remain outstanding.
- The server validates every request/order link, outlet, role, remaining approval and aggregate stock before committing one atomic operation.
- Deliveries retain request links and issue comments; Cuisine Deliveries displays those comments. Receipt confirmation does not deduct again.
- Duplicate operation retries do not duplicate movements or deliveries. Fully issued orders disappear from the distribution selector.

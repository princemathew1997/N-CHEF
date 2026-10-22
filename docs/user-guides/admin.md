# N-CHEF | Admin guide

Revision: 22 October 2026 | N-CHEF 2.3.0

Admin manages setup and users, approves consolidated requests, purchases and receives stock, and oversees distribution and delivery resolution. This guide describes N-CHEF 2.3.0.

## Home and compact navigation

Sign-in opens Master Orders. Select the N-CHEF logo to return there. Main sidebar labels open pages; separate arrows reveal related actions one level below. Icons and pending badges help identify work. On mobile, open the menu button.

Stock Overview contains Receive Stock, Stock Adjustments and Stock History. Distribute to Cuisine contains Cuisine Deliveries. Add Legacy Stock contains Bulk Legacy Stock. Approvals contains Generate Vendor Orders and Manage Request. Item Catalog contains Categories, Units and Cuisine Sections. Users contains Account Requests. Wastage, Purchase Orders, Vendors, Locations and Notifications remain direct destinations.

## Setup and people

Admin maintains locations, vendors, catalog items, categories, units, cuisines and users. Supported roles are Admin, Executive Chef, Purchaser (Supervisor) and Cuisine Head. Existing Supervisor accounts became Executive Chef and Chef accounts became Cuisine Head without changing credentials or assignments.

Assign outlets and, for Cuisine Heads, cuisines. Single-outlet accounts use fixed outlet controls; multiple-outlet accounts can select only permitted outlets. Cuisine Heads have direct My Requests and Receive Order links instead of the store's Stock hierarchy.

Account Requests contains Purchaser requests for Cuisine Head or Executive Chef accounts. Approve with confirmed role, username, password and outlet/cuisine assignments, or reject. A requested account has no access before approval. Editing an existing user without a new password preserves their credentials.

Vendors supports name, phone, GSTIN and vendor-from date, initially today. Categories and Units supply managed choices for catalog items. An item's unit cannot change after stock history exists. Enable the low-stock threshold only when monitoring is wanted; set the threshold quantity and save.

## Requests, approvals and procurement

Cuisine Heads create today's ingredient requests and edit initial quantities while permitted. Existing items cannot be selected again through Place new order. Executive Chef acceptance locks Cuisine Head editing. Executive Chef can review quantities together, use Approve all reviewed items, or reject with a reason that reaches the requesting head. Rejected requests remain recorded and can be reviewed again.

Executive Chef consolidates accepted requests. Changed cuisine quantities require notes, even when the item total is unchanged. Save edits preserves draft changes. Only one pending consolidation is allowed per outlet; its owner can recall it before approval/downstream purchasing to combine newly arrived requests.

Use Approvals to review requested/revised quantities, stock and shortages. Approve for order does not move stock. Generate Vendor Orders creates one purchase order per selected vendor; preferred vendors are preselected where available, missing choices must be supplied and zero lines are excluded. Download vendor-specific PDFs from the order.

## Receive and compare vendor invoices

Receive Stock retains manual entry with item, outlet, vendor, positive quantity and unit price. Review the calculated line total before saving. The Receive stock from Vendor Order button opens Purchase Orders in PO Raised and clears destination date filters to show outstanding orders without submitting the manual form.

For a purchase order, choose Receive, enter usable quantities, rejected quantities and required reasons, and enter usable-stock unit prices. Optionally fill Vendor invoice total at the end. The displayed difference is vendor invoice total minus accepted-stock total. For 8 usable units at INR 12.50, stock total is INR 100; an invoice of INR 105 differs by INR 5. Taxes/freight are not separately itemized by this comparison.

Save and verify the status and remaining quantities. Rejected goods do not increase stock; partially received orders remain available for later receiving. Received defaults to today's IST dates. Adjust or clear the range for older receipts. From must not be after To. The old View today's receipts and invoice-comparison links are no longer above manual receiving.

Stock value uses the latest receipt price for that outlet, not an average. Older unpriced balances remain visibly unpriced.

## Dispatches, receipt issues and wastage

Distribute to Cuisine issues approved demand from available stock and creates a delivery. Quantity changes require comments where indicated. Stock is deducted once at issue, not when Cuisine Head confirms receipt.

Cuisine Deliveries groups items by dispatch to a cuisine. Separate dispatches of the same order remain separate cards. Needs attention includes older unfinished dispatches and prioritizes reported issues; Today shows today's dispatches; History shows fully handled cards. Expand items and use View request or Stock movement to trace records. Filters cover outlet, cuisine, status, item, order reference and IST dates. Use paging for older results. Counts are item counts, not totals of mixed units.

Cuisine Heads report discrepancies item by item using Confirm / report issue, then Accept all remaining for the correct pending items in that one card. This preserves reported issues and completed outcomes. Delivery problems notify Admin, Executive Chef and Purchaser.

Purchaser or Admin investigates and resolves issues with a note: replacement, confirmed shortage, usable return or confirmed wastage. Missing stock is not automatically wastage. Usable returned goods increase the outlet balance; recording spoiled issued goods does not deduct them a second time. Replacement needs available stock and creates a separate delivery for confirmation. Physically rejected goods require an explicit usable-return or wastage disposition.

Wastage supports daily, last-seven-day and custom-date reporting with quantities, reasons, people and saved values. Unpriced wastage is identified as such.

## History, opening stock and notifications

Stock History starts with today and supports outlet, item, vendor, movement, person and date filters. Apply filters and use page controls. Master Orders reports opening, received, adjustments and remaining stock by item/unit. Delivery/history pages load matching pages rather than one growing daily log.

For opening stock, use Add Legacy Stock or Bulk Legacy Stock. The bulk CSV template accepts existing item/outlet names and matching categories/units, positive quantities and optional INR prices. Save Excel data as CSV UTF-8. Limit imports to 150 rows and 100 KB; combine duplicate item/outlet pairs. Validate entire file, fix all row/column errors, review resulting balances, then Import all validated rows. Any invalid row blocks the batch. The import adds to outlet balances without consuming central stock; it preserves existing latest costs and blocks repeated imports of the same entries.

Low-stock thresholds generate in-app notifications at or below the limit. Replenishment above the threshold allows a later new episode; disabling the toggle stops monitoring. Notifications supports individual read and mark-all-read, including older unread records. Existing alerts do not repeatedly announce themselves on login.

Visible sessions refresh about every three seconds and on focus. Open item choices refresh while retaining unfinished text where supported. Revision checks prevent conflicting saves from overwriting each other. If a save fails or reports a conflict, inspect the current saved record before retrying. All report day boundaries use IST.

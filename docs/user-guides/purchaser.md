# N-CHEF | Purchaser (Supervisor) guide

Revision: 22 October 2026 | N-CHEF 2.3.0

Admin creates Purchaser accounts and assigns their outlets. Existing accounts formerly called Supervisor now use Executive Chef; they do not automatically become Purchasers.

## Home and compact menus

Sign-in opens Approvals. Select the N-CHEF logo to return there. Main sidebar labels open their pages; the separate arrow reveals related actions one level below. Icons identify each action and badges remain visible on collapsed groups. On mobile, use the menu button.

Stock Overview contains Receive Stock, Stock Adjustments and Stock History. Distribute to Cuisine contains Cuisine Deliveries. Add Legacy Stock contains Bulk Legacy Stock. Approvals contains Generate Vendor Orders and Manage Request. Users provides the permitted staff directory and related Account Requests. You cannot maintain catalog, locations, cuisines, units, categories or vendors.

## Approve and generate vendor orders

Review consolidated requests in Approvals, including requested/revised quantities and available stock. Review and edit quantities, then Approve for order. Approval alone does not receive or deduct stock.

Open Generate Vendor Orders for an approved request. Preferred vendors are preselected where configured; choose a vendor for every included item. Confirm quantities and send to create separate purchase orders per vendor. Zero-quantity lines are excluded. Download the relevant vendor's PDF; a supplier document contains that supplier's order only.

## Receive stock and compare an invoice

1. Open Receive Stock, then select Receive stock from Vendor Order. This opens Purchase Orders in PO Raised with date filters cleared so outstanding orders remain visible. It does not submit the manual form.
2. Choose the order's Receive action. Review the remaining quantities.
3. Enter quantities received, rejected quantities and the required rejection reason. Enter unit prices for usable stock. Rejected goods are not added to available stock.
4. At the end of the form, optionally enter Vendor invoice total. Compare it with the calculated accepted-stock total. Difference equals vendor invoice total minus stock total; a positive difference means the invoice is higher.
5. Save and check the order status. Partial receiving keeps the outstanding quantity available for a later delivery. A fully received order appears under Received.

For example, 8 usable units at INR 12.50 produce a stock total of INR 100. An invoice total of INR 105 shows a difference of INR 5. The comparison does not split tax or freight into separate components.

Manual Receive Stock remains available: select outlet, item and vendor, enter quantity and unit price, review the line total and save. The previous receipt/comparison shortcuts are no longer above this form; use the vendor-order receiving form for order invoice comparison.

Purchase Orders separates PO Raised and Received. Received defaults to today's IST date range. Change or clear dates to find older receipts; From must not be later than To. Stock Overview values balances using the latest receipt price at the outlet; older unpriced stock is shown as unavailable cost.

## Distribute and resolve delivery issues

Open Distribute to Cuisine, select an approved request and enter actual issued quantities. Explain changes from approved quantities where required. Distribution deducts store stock once and creates a delivery card for each dispatch to a cuisine. It cannot exceed the approved remaining demand or available stock.

Open Cuisine Deliveries to follow confirmations and problems. Needs attention includes older unfinished work and prioritizes reported issues. Today shows today's dispatches. History shows fully handled dispatches. Expand a card for item details; use View request and Stock movement to trace its origin. Filters include outlet, cuisine, status, item, order reference and IST dates, with page controls for older results.

Cuisine Heads report problem lines individually, then use Accept all remaining for the correct lines in one delivery card. Reported issues retain their status. Investigate each issue, use Resolve issue and record a resolution note. Choose replacement, confirmed shortage, usable return or confirmed wastage as appropriate.

Missing goods are not automatically wastage. Issued goods already left store stock, so confirmed wastage does not deduct them again. Usable returns increase the balance. Replacement issues need available stock and create a new delivery requiring confirmation. For physically rejected goods, explicitly identify usable return versus confirmed wastage.

## History, opening stock and account requests

Stock History starts with today and supports item, vendor, movement, person and date filters. Apply filters and use page controls. Master Orders/stock reports keep quantities by item and unit; do not add unlike units together.

Use Add Legacy Stock for individual opening stock, or Bulk Legacy Stock for a CSV import. Download the template and allowed-values reference. Save Excel files as CSV UTF-8; XLSX/XLS are not accepted. Use existing outlet/item names with matching managed category/unit. Quantity must be positive; unit price is optional. Limit files to 150 entries and 100 KB, with each item/outlet pair appearing once.

Validate entire file, correct all reported row/column errors and review current/resulting balances. Import all validated rows adds quantities rather than replacing balances. Any invalid row blocks the whole import. It does not consume a central stock pool. Existing latest costs are preserved; a supplied opening price fills missing valuation only. Reimporting the same entries is blocked to prevent double counting.

Use Account Requests to ask Admin for a Cuisine Head or Executive Chef account. Admin confirms credentials and assignments before access exists. Notifications tracks requests, delivery issues and other updates. Mark reviewed notices read. If a save conflicts with another update, refresh and review before retrying.

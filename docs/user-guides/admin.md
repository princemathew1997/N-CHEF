# N-CHEF | Admin guide

Revision: 20 October 2026 | Operations workflow

Every sign-in opens Dashboard. Select the N-CHEF logo to return there.

## People and setup

Only Admin creates or changes users, locations, cuisines, vendors and catalog records. Users supports Administrator, Executive Chef, Purchaser (Supervisor) and Cuisine Head. Existing Supervisors migrate to Executive Chef; existing Chefs become Cuisine Heads without changing login credentials or assignments.

Use Account Requests to approve or reject purchaser requests for Cuisine Head or Executive Chef accounts. Approval requires username, password, role and confirmed outlet/cuisine assignments. No access exists until approval.

In Vendors, enter name, phone, GSTIN and vendor-from date. The date starts at today. Catalog categories and units are selected from managed lists; create new choices through Categories and Units. Units cannot change after stock history exists.

## Approval and stock

Executive Chefs review and consolidate cuisine requests. In Approval Queue review requested, revised, available and shortage quantities. Edit quantities, approve for distribution, or generate separate vendor orders. Approval does not move stock. Purchase orders can also be generated after approval; PDF downloads contain only that vendor's order.

In Receive Stock enter quantity and unit price. The line total is calculated before saving. Vendor Purchase Orders also requires unit prices before receiving. Available stock value uses the latest receipt unit price at that outlet, not an average. Older unpriced balances show Cost unavailable.

Receipt Totals groups entries by IST date, outlet and vendor. Enter the vendor invoice goods total to save a comparison; the difference is vendor total minus stock total. Taxes and freight are not broken out separately.

Distribute to Cuisine records an actual stock issue and creates a delivery. Select the linked approved request where applicable. Cuisine Heads then confirm receipt or report a problem. Stock is deducted once at issue, not again at confirmation.

## Alerts and wastage

Enable an item's threshold and set its quantity in Item Catalog. Each outlet triggers an in-app notification at or below that threshold. A new episode can notify again after replenishment above the limit. Disabling the toggle stops threshold monitoring.

Delivery problems notify Admin, Executive Chef and Purchaser. Purchaser investigates and resolves them. Missing stock is a shortage, not automatic wastage. Physically spoiled issued stock is recorded as wastage without a second stock deduction. Usable returned stock increases the outlet balance.

Wastage provides daily, last-seven-day and custom-date reports including quantities, reasons, people and saved values. Unpriced wastage remains visibly unpriced. Notifications can be marked read.

## Shared catalog and dates

Visible sessions check for changes every three seconds and on focus. Open item pickers refresh without discarding unfinished form text. Concurrent business edits remain subject to revision checks; refresh and review if a save conflicts. All report day boundaries use IST.

When issuing a replacement for physically rejected goods, explicitly choose whether those goods are usable returns or confirmed wastage. Replacement stock is issued immediately, so receive or arrange available stock first.

## Bulk legacy opening stock

Open Stock → Bulk Legacy Stock. Download the CSV template and allowed-values reference. Enter existing outlet/item names and matching category/unit in Excel, then Save As CSV UTF-8 (.csv). The first row is the column header. Quantity must be positive; unit price in INR is optional. Use up to 150 entries / 100 KB per file. Native XLSX/XLS files must first be saved as CSV.

Choose the file and select Validate entire file. All errors appear together with their Excel row number, column, entered value and explanation. Download the error report if needed, correct every error and upload again. Category and unit must exist in the admin-managed lists and match that catalog item; imports never create items or new list values. Repeated item/outlet pairs must be combined into one row.

Review the preview, including current and resulting stock, then Import all validated rows. Any invalid row blocks the whole import. Quantities are added to outlet stock, not substituted for existing balances, and no unassigned central stock is consumed. Opening movements and the batch audit identify who imported the data. Existing latest purchase costs are preserved; a supplied price fills a missing valuation only. Re-uploading the same entries is blocked to prevent double counting.

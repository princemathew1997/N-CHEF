# N-CHEF | Purchaser (Supervisor) guide

Revision: 20 October 2026

Supervisor and Purchaser mean the same role. Existing Supervisor accounts have become Executive Chefs; Admin creates the new Purchaser accounts and assigns outlets.

## Approve and purchase

Sign-in opens Dashboard. Approval Queue contains requests forwarded or consolidated by Executive Chef. Review requested, revised, available and shortage quantities, edit quantities, approve for distribution and generate vendor-wise purchase orders. Approval does not deduct stock. Download each vendor's separate PDF from Vendor Purchase Orders.

## Receive and distribute

Receive Stock requires outlet, item, vendor, quantity and unit price. Confirm the calculated line total before saving. Vendor Purchase Orders also supports priced receiving. Stock Overview shows latest purchase unit price and remaining value for assigned outlets; historical unpriced stock is clearly marked.

Receipt Totals consolidates today's receipts by vendor and outlet. Enter the vendor invoice goods total; difference equals vendor total minus stock total. Date filters use IST.

Distribute to Cuisine records the quantity actually issued. Link an approved cuisine request where applicable. Issued stock is deducted once and appears in Cuisine Deliveries for confirmation by the Cuisine Head.

## Resolve delivery problems

Less quantity, Not available, Quality issues and Other notify Purchaser, Executive Chef and Admin. Investigate the problem, record a resolution note, then arrange replacement, confirm shortage, return usable stock or record confirmed wastage. Missing goods never automatically become wastage. Issued bad goods already left store stock, so recording their wastage does not deduct them twice. Wastage notifies Admin.

## Request accounts

Use Account Requests to ask Admin to add a Cuisine Head or Executive Chef. Provide the person's name, requested role and outlet/cuisine. Admin must approve and configure credentials and assignments. Purchaser cannot create users or maintain items, units, categories, cuisines, locations or vendors.

Use Notifications for updates and the N-CHEF logo to return to Dashboard.

When issuing a replacement for physically rejected goods, explicitly choose whether those goods are usable returns or confirmed wastage. Replacement stock is issued immediately, so receive or arrange available stock first.

## Bulk legacy opening stock

Open Stock → Bulk Legacy Stock. Download the CSV template and allowed-values reference. Enter existing outlet/item names and matching category/unit in Excel, then Save As CSV UTF-8 (.csv). The first row is the column header. Quantity must be positive; unit price in INR is optional. Use up to 150 entries / 100 KB per file. Native XLSX/XLS files must first be saved as CSV.

Choose the file and select Validate entire file. All errors appear together with their Excel row number, column, entered value and explanation. Download the error report if needed, correct every error and upload again. Category and unit must exist in the admin-managed lists and match that catalog item; imports never create items or new list values. Repeated item/outlet pairs must be combined into one row.

Review the preview, including current and resulting stock, then Import all validated rows. Any invalid row blocks the whole import. Quantities are added to outlet stock, not substituted for existing balances, and no unassigned central stock is consumed. Opening movements and the batch audit identify who imported the data. Existing latest purchase costs are preserved; a supplied price fills a missing valuation only. Re-uploading the same entries is blocked to prevent double counting.

import { parseCSV, encodeCSV, csvCell } from './legacy-import.mjs';
import { dayIST } from '../worker/operations.mjs';

export const bulkReceiptHeaders = ['Outlet Name', 'Date', 'Item', 'Unit', 'Quantity', 'Unit Price', 'Notes'];
export const maxReceiptRows = 200;
export const maxReceiptBytes = 150000;
const key = value => String(value ?? '').trim().normalize('NFKC').toLowerCase();

export function validateBulkReceiptCSV(csv, state, actor) {
  const errors = [];
  const rows = [];
  const unrecognizedItems = [];
  const dateAuditFlags = [];
  const add = (row, column, message, value = '') => errors.push({ row, column, message, value: String(value) });

  if (typeof csv !== 'string' || new TextEncoder().encode(csv).length > maxReceiptBytes) {
    return { rows, errors: [{ row: 1, column: 'File', message: 'Choose a CSV file of at most 150 KB.' }], unrecognizedItems, dateAuditFlags };
  }
  if (csv.includes('\0')) {
    return { rows, errors: [{ row: 1, column: 'File', message: 'Use Excel’s CSV UTF-8 format; this file contains unsupported encoding.' }], unrecognizedItems, dateAuditFlags };
  }

  const parsed = parseCSV(csv);
  errors.push(...parsed.errors);
  const header = parsed.rows[0];
  if (!header) {
    return { rows, errors: [{ row: 1, column: 'Header', message: 'The file is empty. Download the CSV template first.' }], unrecognizedItems, dateAuditFlags };
  }

  const headers = header.cells.map(key);
  const required = ['outlet name', 'item', 'quantity', 'unit price'];
  for (const name of required) {
    if (!headers.includes(name)) add(1, name, 'Required column is missing. Use the downloaded template.');
  }

  const data = parsed.rows.slice(1).filter(r => r.cells.some(c => c.trim()));
  if (!data.length) add(2, 'File', 'Enter at least one stock receipt row below the header.');
  if (data.length > maxReceiptRows) add(1, 'File', `The sheet has ${data.length} entries. Maximum ${maxReceiptRows} entries per upload.`);

  const seenPairs = new Map();

  // Date boundary calculation in IST (today and up to 7 days in the past)
  const todayIST = dayIST();
  const pastLimitDate = new Date();
  pastLimitDate.setDate(pastLimitDate.getDate() - 7);
  const minAllowedDate = dayIST(pastLimitDate);

  for (const record of data) {
    const { row, cells } = record;
    const get = name => {
      const idx = headers.indexOf(key(name));
      return idx >= 0 ? String(cells[idx] ?? '').trim() : '';
    };

    const outletText = get('Outlet Name');
    let dateText = get('Date');
    const itemText = get('Item');
    const unitText = get('Unit');
    const quantityText = get('Quantity');
    const priceText = get('Unit Price');
    const notesText = get('Notes');

    // Parse date supporting both DD-MM-YYYY (common in Excel/India) and YYYY-MM-DD
    let normalizedDate = null;
    if (dateText) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
        normalizedDate = dateText;
      } else if (/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.test(dateText)) {
        const [, d, m, y] = dateText.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
        normalizedDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
    }

    if (!normalizedDate) {
      normalizedDate = todayIST;
    }

    // Security & Malpractice validation for Dates
    let isDateSuspicious = false;
    let auditReason = '';
    if (normalizedDate > todayIST) {
      isDateSuspicious = true;
      auditReason = `Future date entered (${dateText || normalizedDate}); exceeds today (${todayIST})`;
      add(row, 'Date', `Future dates are not allowed. Date cannot be after today (${todayIST}).`, dateText || normalizedDate);
    } else if (normalizedDate < minAllowedDate) {
      isDateSuspicious = true;
      auditReason = `Old date entered (${dateText || normalizedDate}); exceeds 1-week backdated cutoff (${minAllowedDate})`;
      add(row, 'Date', `Date cannot be older than 1 week (cutoff is ${minAllowedDate}).`, dateText || normalizedDate);
    }

    if (isDateSuspicious) {
      dateAuditFlags.push({
        row,
        outletName: outletText || 'Unknown',
        item: itemText || 'Unknown',
        enteredDate: dateText || 'Empty',
        normalizedDate,
        reason: auditReason
      });
    }

    dateText = normalizedDate;

    // Outlet validation
    const outlets = (state.outlets || []).filter(o => key(o.id) === key(outletText) || key(o.name) === key(outletText));
    const outlet = outlets.length === 1 ? outlets[0] : null;
    if (!outlet) {
      add(row, 'Outlet Name', outletText ? 'Choose one existing, valid outlet name or ID.' : 'Outlet Name is required.', outletText);
    } else if (actor.role !== 'admin' && !actor.assignedLocations?.includes('all') && !actor.assignedLocations?.includes(outlet.id)) {
      add(row, 'Outlet Name', 'You do not have permission for this outlet.', outletText);
    }

    // Item validation
    const items = (state.items || []).filter(i => key(i.name) === key(itemText) || key(i.id) === key(itemText));
    const item = items.length === 1 ? items[0] : null;

    if (!item) {
      if (itemText) {
        unrecognizedItems.push({
          row,
          outletName: outletText || 'Not specified',
          date: dateText || todayIST,
          itemText,
          unit: unitText || 'Not specified',
          quantity: quantityText || '-',
          unitPrice: priceText || '-',
          notes: notesText || ''
        });
        add(row, 'Item', `"${itemText}" is not in catalog. Get in touch with Admin to add it to catalog first.`, itemText);
      } else {
        add(row, 'Item', 'Item name or code is required.', itemText);
      }
    } else if (item.active === false) {
      add(row, 'Item', `"${item.name}" is marked inactive in catalog.`, itemText);
    } else if (unitText && key(item.unit) !== key(unitText)) {
      add(row, 'Unit', `Unit "${unitText}" does not match catalog unit for this item (${item.unit}).`, unitText);
    }

    // Quantity validation
    const quantity = Number(quantityText);
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(quantityText) || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1e9) {
      add(row, 'Quantity', 'Enter a positive quantity up to 1,000,000,000 without symbols or formulas.', quantityText);
    }

    // Unit price validation
    let unitCostMinor = null;
    if (!priceText && priceText !== '0') {
      add(row, 'Unit Price', 'Unit Price is required.', priceText);
    } else {
      const price = Number(priceText);
      if (!/^\d+(?:\.\d{1,2})?$/.test(priceText) || !Number.isFinite(price) || price < 0 || price > 1e9) {
        add(row, 'Unit Price', 'Enter a valid non-negative unit price (up to 2 decimals) in INR.', priceText);
      } else {
        unitCostMinor = Math.round(price * 100);
      }
    }

    if (notesText.length > 500) {
      add(row, 'Notes', 'Notes must be 500 characters or less.', notesText);
    }

    // Extract vendor if formatted as "[Vendor: <name>] <note>"
    let parsedVendor = '';
    let parsedNoteOnly = notesText;
    const vendorMatch = notesText.match(/^\[Vendor:\s*([^\]]+)\]\s*(.*)$/i);
    if (vendorMatch) {
      parsedVendor = vendorMatch[1].trim();
      parsedNoteOnly = vendorMatch[2].trim();
    }

    if (item && outlet && Number.isFinite(quantity) && quantity > 0 && unitCostMinor !== null) {
      const balance = (state.outletStock || []).find(b => b.item_id === item.id && b.outlet_id === outlet.id)?.quantity || 0;
      if (balance + quantity > 1e9) {
        add(row, 'Quantity', 'Resulting outlet stock would exceed 1,000,000,000.', quantityText);
      }
      const pair = item.id + '\0' + outlet.id;
      if (seenPairs.has(pair)) {
        const prior = seenPairs.get(pair);
        if (!errors.some(e => e.row === prior && e.column === 'Duplicate')) {
          add(prior, 'Duplicate', `The same item and outlet also appears on row ${row}. Combine into one row.`);
        }
        add(row, 'Duplicate', `The same item and outlet already appears on row ${prior}. Combine into one row.`);
      } else {
        seenPairs.set(pair, row);
      }

      rows.push({
        row,
        outletId: outlet.id,
        outletName: outlet.name,
        date: dateText,
        itemId: item.id,
        itemName: item.name,
        category: item.category,
        unit: item.unit,
        quantity,
        unitCostMinor,
        currentQuantity: balance,
        resultingQuantity: balance + quantity,
        notes: notesText || 'Bulk Stock Receipt',
        vendor: parsedVendor || '',
        noteOnly: parsedNoteOnly || ''
      });
    }
  }

  return { rows, errors: errors.sort((a, b) => a.row - b.row), unrecognizedItems, dateAuditFlags };
}

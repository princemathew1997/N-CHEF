import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBulkReceiptCSV, bulkReceiptHeaders } from '../shared/bulk-receipt.mjs';
import { encodeCSV } from '../shared/legacy-import.mjs';

const state = {
  outlets: [
    { id: 'brigade', name: 'BRIGADE' },
    { id: 'vidyaranyapura', name: 'VIDYARANYAPURA' }
  ],
  items: [
    { id: 'item_01', name: 'Tuna', category: 'Dry', unit: 'pcs', active: true },
    { id: 'item_02', name: 'Pasta', category: 'Dry', unit: 'kg', active: true },
    { id: 'item_inactive', name: 'Old Sauce', category: 'Sauce', unit: 'can', active: false }
  ],
  outletStock: [
    { item_id: 'item_01', outlet_id: 'brigade', quantity: 10, unit_cost_minor: 5000 }
  ]
};

const admin = { id: 'admin_1', role: 'admin', assignedLocations: ['all'] };
const supervisor = { id: 'sup_1', role: 'supervisor', assignedLocations: ['brigade'] };

test('validateBulkReceiptCSV validates normal receipt row with Date', () => {
  const csv = encodeCSV([
    bulkReceiptHeaders,
    ['BRIGADE', '2026-11-06', 'Tuna', 'pcs', '5', '55.50', 'Fresh delivery']
  ]);
  const result = validateBulkReceiptCSV(csv, state, supervisor);
  assert.equal(result.errors.length, 0);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].itemName, 'Tuna');
  assert.equal(result.rows[0].date, '2026-11-06');
  assert.equal(result.rows[0].quantity, 5);
  assert.equal(result.rows[0].unitCostMinor, 5550);
  assert.equal(result.rows[0].resultingQuantity, 15);
  assert.equal(result.unrecognizedItems.length, 0);
});

test('validateBulkReceiptCSV rejects date older than 1 week (7 days)', () => {
  const oldDate = new Date();
  oldDate.setDate(oldDate.getDate() - 10);
  const oldDateStr = oldDate.toISOString().slice(0, 10);
  const csv = encodeCSV([
    bulkReceiptHeaders,
    ['BRIGADE', oldDateStr, 'Tuna', 'pcs', '5', '55.50', 'Too old']
  ]);
  const result = validateBulkReceiptCSV(csv, state, supervisor);
  assert.ok(result.errors.some(e => e.column === 'Date' && e.message.includes('older than 1 week')));
});

test('validateBulkReceiptCSV flags unrecognized items with item details', () => {
  const csv = encodeCSV([
    bulkReceiptHeaders,
    ['BRIGADE', '2026-11-06', 'Brand New Spice', 'g', '10', '15.00', 'Trial sample']
  ]);
  const result = validateBulkReceiptCSV(csv, state, admin);
  assert.equal(result.unrecognizedItems.length, 1);
  assert.equal(result.unrecognizedItems[0].itemText, 'Brand New Spice');
  assert.equal(result.unrecognizedItems[0].quantity, '10');
  assert.equal(result.unrecognizedItems[0].unitPrice, '15.00');
});

test('validateBulkReceiptCSV rejects invalid outlet or unauthorized outlet', () => {
  const csv = encodeCSV([
    bulkReceiptHeaders,
    ['vidyaranyapura', '2026-11-06', 'Pasta', 'kg', '10', '40.00', '']
  ]);
  const result = validateBulkReceiptCSV(csv, state, supervisor);
  assert.ok(result.errors.some(e => e.column === 'Outlet Name' && e.message.includes('do not have permission')));
});

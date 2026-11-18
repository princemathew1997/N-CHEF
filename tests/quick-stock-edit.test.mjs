import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const script = readFileSync('js/stock-actions.js', 'utf8');

function stockOverview({ onHand, reserved, unitCost = null }) {
    const callbacks = {};
    let focused;
    const field = value => ({ value, focus() { focused = this; } });
    const fields = {
        quickQty: field(''), quickUnit: field('KG'), quickCost: field(''),
        quickReason: field('Verified physical count'),
    };
    const alert = { textContent: '' };
    const cancel = field('');
    const form = {
        elements: fields, reportValidity: () => true,
        querySelector: () => alert, querySelectorAll: selector => selector === '[data-quick-cancel]' ? [cancel] : [],
    };
    const edit = { ...field(''), dataset: { quickEdit: '0' } };
    const editor = { innerHTML: '', querySelector: () => form, scrollIntoView() {} };
    const rows = { innerHTML: '' };
    const overview = {
        querySelector: selector => ({
            '[name=category]': field(''), '[name=overviewOutlet]': { tagName: 'SELECT' },
            '#overviewQuickEditor': editor, '#overviewRows': rows,
        })[selector],
        querySelectorAll: () => [edit],
    };
    const panel = {
        classList: { remove() {} }, contains: () => false,
        querySelector: selector => selector === 'form' ? (editor.innerHTML ? form : null) : overview,
        set innerHTML(value) {
            editor.innerHTML = '';
            rows.innerHTML = '';
        },
    };
    const balance = { item_id: 'plate', outlet_id: 'kalpetta', quantity: onHand, unit_cost_minor: unitCost };
    const calls = [];
    const window = {};
    const document = {
        addEventListener(event, fn) { callbacks[event] = fn; },
        createElement: () => panel, querySelectorAll: () => [],
        getElementById: id => id === 'inventoryTableBody' ? null : { parentElement: { append() {} } },
    };
    let failure;
    runInNewContext(script, {
        document, window, currentView: 'inventory:overview', currentUser: { role: 'admin' },
        InventoryTools: { day: () => '2026-11-18' },
        OutletSelection: { markup: () => '', restore() {}, allowed: () => [{ id: 'kalpetta', name: 'Kalpetta' }] },
        masterItemsData: [{ id: 'plate', name: 'Plate', category: 'Packing', unit: 'KG' }],
        requestsData: [{ outletId: 'kalpetta', itemId: 'plate', status: 'Pending', qty: reserved }],
        committedState: { outletStock: [balance] },
        createItemPicker() {},
        async runDatabaseAction(path, payload) {
            calls.push({ path, ...payload });
            if (failure) {
                const message = failure;
                failure = null;
                window.onLiveSyncReceived();
                throw new Error(message);
            }
            if (path === 'stock/adjust') balance.quantity = payload.quantity;
            if (path === 'stock/current-price') balance.unit_cost_minor = Math.round(payload.unitPrice * 100);
            window.onLiveSyncReceived();
        },
    });
    callbacks.DOMContentLoaded();
    window.showInventoryView('inventory:overview');
    return {
        alert, calls, editor, fields, rows, edit, open: () => edit.onclick(),
        cancel: () => cancel.onclick(), focused: () => focused,
        refresh: () => window.onLiveSyncReceived(),
        failNextSave: message => { failure = message; },
        save: () => form.onsubmit({ preventDefault() {} }),
    };
}

test('Quick Edit focuses the quantity on open and restores the row action on cancel', () => {
    const qa = stockOverview({ onHand: 100, reserved: 0 });
    qa.open();
    assert.equal(qa.focused(), qa.fields.quickQty);
    qa.cancel();
    assert.equal(qa.focused(), qa.edit);
    assert.equal(qa.editor.innerHTML, '');
});

test('Quick Edit keeps a failed draft through live refresh and redraws the saved available quantity on retry', async () => {
    const qa = stockOverview({ onHand: 110, reserved: 10 });
    assert.match(qa.rows.innerHTML, /<td>100<\/td>/);
    qa.open();
    qa.fields.quickQty.value = '110';
    qa.refresh();
    assert.match(qa.editor.innerHTML, /Quick Edit Stock/);

    qa.failNextSave('Stock changed. Try again.');
    await qa.save();
    assert.match(qa.editor.innerHTML, /Quick Edit Stock/);
    assert.equal(qa.alert.textContent, 'Stock changed. Try again.');
    assert.equal(qa.fields.quickQty.value, '110');
    assert.match(qa.rows.innerHTML, /<td>100<\/td>/);

    await qa.save();
    assert.deepEqual(qa.calls.map(({ path, quantity }) => [path, quantity]), [
        ['stock/adjust', 120], ['stock/adjust', 120],
    ]);
    assert.equal(qa.editor.innerHTML, '');
    assert.equal(qa.focused(), qa.edit);
    assert.match(qa.rows.innerHTML, /<td>110<\/td>/);
});

test('Quick Edit can set available stock to zero and price it using the confirmed on-hand balance', async () => {
    const qa = stockOverview({ onHand: 110, reserved: 10 });
    qa.open();
    qa.fields.quickQty.value = '0';
    qa.fields.quickCost.value = '12.50';
    await qa.save();

    assert.equal(qa.calls.length, 2);
    assert.equal(qa.calls[0].quantity, 10);
    assert.equal(qa.calls[1].path, 'stock/current-price');
    assert.equal(qa.calls[1].expectedQuantity, 10);
    assert.equal(qa.calls[1].expectedUnitCostMinor, null);
    assert.equal(qa.calls[1].unitPrice, 12.5);
    assert.match(qa.rows.innerHTML, /<td>0<\/td>/);
});

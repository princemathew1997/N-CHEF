document.addEventListener('DOMContentLoaded', () => {
    const toolbar = document.createElement('div');
    toolbar.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;margin:12px 0';
    const view = document.getElementById('viewMasterOrders');
    if (!view) return;
    view.prepend(toolbar);
    const createButton = (label, action, adminOnly = false) => {
        const button = document.createElement('button');
        button.type = 'button'; button.textContent = label;
        button.className = 'btn btn-outline' + (adminOnly ? ' admin-only hidden' : '');
        button.addEventListener('click', action); toolbar.append(button); return button;
    };
    const modal = document.createElement('div');
    modal.className = 'modal hidden';
    modal.innerHTML = '<div class="panel" style="width:90%;max-width:480px;padding:24px"><h2 id="stockActionTitle"></h2><form id="stockActionForm"><label id="stockItemLabel">Item<select id="stockActionItem" required></select></label><label id="stockOutletLabel">Outlet<select id="stockActionOutlet" required></select></label><label id="stockQtyLabel">Quantity<input id="stockActionQty" type="number" min="0.001" step="any" required></label><label id="stockPoLabel">Purchase order<select id="stockActionPO" required></select></label><p id="stockActionHint"></p><div style="display:flex;gap:12px"><button class="btn btn-primary" type="submit">Save</button><button class="btn btn-outline" id="stockActionCancel" type="button">Cancel</button></div></form></div>';
    document.body.append(modal);
    let mode = '';
    const fill = (selectId, values, label) => {
        const select = document.getElementById(selectId); select.replaceChildren();
        for (const value of values) { const option = document.createElement('option'); option.value = value.id; option.textContent = label(value); select.append(option); }
    };
    const open = selected => {
        mode = selected;
        const poMode = mode === 'purchase-orders/receive';
        document.getElementById('stockActionTitle').textContent = poMode ? 'Receive purchase order' : mode === 'stock/receipt' ? 'Receive central stock' : 'Record outlet consumption';
        for (const [element, show] of [['stockItemLabel', !poMode], ['stockQtyLabel', !poMode], ['stockOutletLabel', mode === 'stock/consume'], ['stockPoLabel', poMode]]) {
            document.getElementById(element).hidden = !show;
            document.getElementById(element).querySelector('input,select').disabled = !show;
        }
        fill('stockActionItem', masterItemsData, item => `${item.name} (${item.unit})`);
        fill('stockActionOutlet', getVisibleOutlets(), item => item.name);
        fill('stockActionPO', purchaseOrdersData.filter(po => po.status !== 'Received'), po => `${po.poNumber} — ${po.outletName}`);
        document.getElementById('stockActionQty').value = '';
        document.getElementById('stockActionHint').textContent = poMode ? 'Receive all remaining quantities into this order’s outlet. Confirm physical delivery before saving.' : 'Changes are validated and recorded in the shared stock ledger.';
        modal.classList.remove('hidden');
    };
    createButton('Receive central stock', () => open('stock/receipt'), true);
    createButton('Record consumption', () => open('stock/consume'));
    const receivePO = createButton('Receive purchase order', () => open('purchase-orders/receive'));
    receivePO.classList.add('no-chef');
    document.getElementById('stockActionCancel').onclick = () => modal.classList.add('hidden');
    document.getElementById('stockActionForm').addEventListener('submit', async event => {
        event.preventDefault();
        await runDatabaseAction(mode, { itemId: document.getElementById('stockActionItem').value, outletId: document.getElementById('stockActionOutlet').value, quantity: Number(document.getElementById('stockActionQty').value), poId: document.getElementById('stockActionPO').value });
        modal.classList.add('hidden');
        loadDashboardData();
        window.showToast('Stock update saved.', 'success');
    });
});

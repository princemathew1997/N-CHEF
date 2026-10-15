document.addEventListener('DOMContentLoaded', () => {
    const view = document.getElementById('viewMasterOrders');
    if (!view) return;

    // Create Quick Stock Actions toolbar
    const toolbar = document.createElement('div');
    toolbar.id = 'stockActionsToolbar';
    toolbar.style.cssText = 'display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:12px 0 16px 0;';
    view.prepend(toolbar);

    const createButton = (label, iconName, action, adminOnly = false) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-outline' + (adminOnly ? ' admin-only' : '');
        button.style.cssText = 'display:inline-flex;align-items:center;gap:7px;padding:7px 14px;font-size:0.8rem;font-weight:600;border-radius:20px;cursor:pointer;transition:all 0.2s cubic-bezier(0.16,1,0.3,1);';
        button.innerHTML = `<i data-lucide="${iconName}" style="width:14px;height:14px;color:var(--primary);"></i> <span>${label}</span>`;
        button.addEventListener('click', action);
        toolbar.append(button);
        return button;
    };

    // Modal creation with proper fixed overlay and n.chef theme styling
    const modal = document.createElement('div');
    modal.id = 'stockActionModal';
    modal.className = 'modal hidden';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;';
    modal.innerHTML = `
        <div class="panel" style="width:100%;max-width:480px;padding:26px;border:1px solid var(--border-gold);box-shadow:0 20px 50px rgba(0,0,0,0.85);border-radius:12px;position:relative;animation:modalSlideUp 0.25s cubic-bezier(0.16,1,0.3,1);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid var(--border);">
                <div style="display:flex;align-items:center;gap:10px;">
                    <div id="stockActionIconBox" style="width:36px;height:36px;border-radius:8px;background:rgba(255,190,11,0.12);display:flex;align-items:center;justify-content:center;color:var(--primary);">
                        <i data-lucide="package-plus" style="width:20px;height:20px;"></i>
                    </div>
                    <div>
                        <h3 id="stockActionTitle" style="margin:0;font-size:1.05rem;font-weight:700;color:#fff;"></h3>
                        <p id="stockActionSubtitle" style="margin:2px 0 0 0;font-size:0.76rem;color:var(--text-muted);"></p>
                    </div>
                </div>
                <button type="button" class="icon-btn" id="stockActionCloseBtn" style="color:var(--text-muted);cursor:pointer;padding:4px;border-radius:6px;" title="Close">
                    <i data-lucide="x" style="width:18px;height:18px;"></i>
                </button>
            </div>
            <form id="stockActionForm" style="display:flex;flex-direction:column;gap:14px;">
                <div id="stockItemLabel" class="input-group" style="margin:0;">
                    <label for="stockActionItem" style="font-size:0.8rem;font-weight:600;color:var(--text-muted);margin-bottom:6px;display:block;">Item *</label>
                    <select id="stockActionItem" style="width:100%;background:var(--dark);color:#fff;padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-size:0.88rem;outline:none;" required></select>
                </div>
                <div id="stockOutletLabel" class="input-group" style="margin:0;">
                    <label for="stockActionOutlet" style="font-size:0.8rem;font-weight:600;color:var(--text-muted);margin-bottom:6px;display:block;">Outlet *</label>
                    <select id="stockActionOutlet" style="width:100%;background:var(--dark);color:#fff;padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-size:0.88rem;outline:none;" required></select>
                </div>
                <div id="stockQtyLabel" class="input-group" style="margin:0;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                        <label for="stockActionQty" style="font-size:0.8rem;font-weight:600;color:var(--text-muted);">Quantity *</label>
                        <span id="stockActionUnitBadge" style="font-size:0.75rem;color:var(--primary);font-weight:600;"></span>
                    </div>
                    <input id="stockActionQty" type="number" min="0.001" step="any" placeholder="Enter quantity" style="width:100%;background:var(--dark);color:#fff;padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-size:0.88rem;outline:none;" required>
                </div>
                <div id="stockPoLabel" class="input-group" style="margin:0;">
                    <label for="stockActionPO" style="font-size:0.8rem;font-weight:600;color:var(--text-muted);margin-bottom:6px;display:block;">Purchase Order *</label>
                    <select id="stockActionPO" style="width:100%;background:var(--dark);color:#fff;padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-size:0.88rem;outline:none;" required></select>
                </div>
                <div id="stockActionHintBox" style="background:rgba(255,190,11,0.08);border:1px solid rgba(255,190,11,0.25);border-radius:8px;padding:10px 12px;display:flex;align-items:flex-start;gap:8px;">
                    <i data-lucide="info" style="width:16px;height:16px;color:var(--primary);flex-shrink:0;margin-top:2px;"></i>
                    <p id="stockActionHint" style="margin:0;font-size:0.78rem;color:var(--text-muted);line-height:1.4;"></p>
                </div>
                <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:8px;padding-top:14px;border-top:1px solid var(--border);">
                    <button type="button" class="btn btn-outline" id="stockActionCancel" style="padding:9px 18px;font-size:0.88rem;cursor:pointer;">Cancel</button>
                    <button type="submit" class="btn btn-primary" id="stockActionSubmitBtn" style="padding:9px 20px;font-size:0.88rem;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;">
                        <i data-lucide="check" style="width:15px;height:15px;"></i> Save Update
                    </button>
                </div>
            </form>
        </div>
    `;
    document.body.append(modal);

    let mode = '';

    const updateUnitBadge = () => {
        const itemSel = document.getElementById('stockActionItem');
        const badge = document.getElementById('stockActionUnitBadge');
        if (!itemSel || !badge) return;
        const selectedItem = (typeof masterItemsData !== 'undefined' ? masterItemsData : []).find(i => i.id === itemSel.value);
        badge.textContent = selectedItem ? `Unit: ${selectedItem.unit}` : '';
    };

    const fill = (selectId, values, label) => {
        const select = document.getElementById(selectId);
        if (!select) return;
        select.replaceChildren();
        if (!values || values.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'None available';
            select.append(opt);
            return;
        }
        for (const value of values) {
            const option = document.createElement('option');
            option.value = value.id;
            option.textContent = label(value);
            select.append(option);
        }
    };

    const closeModal = () => {
        modal.classList.add('hidden');
    };

    const open = selected => {
        mode = selected;
        const poMode = mode === 'purchase-orders/receive';
        const isReceipt = mode === 'stock/receipt';
        
        const titleEl = document.getElementById('stockActionTitle');
        const subtitleEl = document.getElementById('stockActionSubtitle');
        const iconBox = document.getElementById('stockActionIconBox');

        if (poMode) {
            if (titleEl) titleEl.textContent = 'Receive Purchase Order';
            if (subtitleEl) subtitleEl.textContent = 'Acknowledge physical delivery into the store outlet.';
            if (iconBox) iconBox.innerHTML = '<i data-lucide="truck" style="width:20px;height:20px;"></i>';
        } else if (isReceipt) {
            if (titleEl) titleEl.textContent = 'Receive Central Stock';
            if (subtitleEl) subtitleEl.textContent = 'Add incoming stock delivery into the central warehouse.';
            if (iconBox) iconBox.innerHTML = '<i data-lucide="package-plus" style="width:20px;height:20px;"></i>';
        } else {
            if (titleEl) titleEl.textContent = 'Record Outlet Consumption';
            if (subtitleEl) subtitleEl.textContent = 'Log consumed ingredients used by this store kitchen.';
            if (iconBox) iconBox.innerHTML = '<i data-lucide="utensils" style="width:20px;height:20px;"></i>';
        }

        for (const [element, show] of [
            ['stockItemLabel', !poMode],
            ['stockQtyLabel', !poMode],
            ['stockOutletLabel', mode === 'stock/consume'],
            ['stockPoLabel', poMode]
        ]) {
            const el = document.getElementById(element);
            if (el) {
                el.style.display = show ? 'block' : 'none';
                const inputOrSelect = el.querySelector('input,select');
                if (inputOrSelect) {
                    inputOrSelect.disabled = !show;
                    inputOrSelect.required = show;
                }
            }
        }

        fill('stockActionItem', typeof masterItemsData !== 'undefined' ? masterItemsData : [], item => `${item.name} (${item.category} • ${item.unit})`);
        
        const outlets = (typeof getVisibleOutlets === 'function') ? getVisibleOutlets() : (typeof outletsData !== 'undefined' ? outletsData : []);
        fill('stockActionOutlet', outlets, item => item.name);
        
        // If a specific store is currently filtered, pre-select it
        if (typeof currentStoreView !== 'undefined' && currentStoreView !== 'all') {
            const outletSel = document.getElementById('stockActionOutlet');
            if (outletSel && outlets.some(o => o.id === currentStoreView)) {
                outletSel.value = currentStoreView;
            }
        }

        const pendingPOs = (typeof purchaseOrdersData !== 'undefined' ? purchaseOrdersData : []).filter(po => po.status !== 'Received');
        fill('stockActionPO', pendingPOs, po => `${po.poNumber} — ${po.outletName || po.outletId}`);

        const submitBtn = document.getElementById('stockActionSubmitBtn');
        if (poMode && pendingPOs.length === 0) {
            if (submitBtn) submitBtn.disabled = true;
            document.getElementById('stockActionHint').textContent = 'There are no pending purchase orders awaiting delivery reception.';
        } else {
            if (submitBtn) submitBtn.disabled = false;
            document.getElementById('stockActionHint').textContent = poMode 
                ? 'Receives all remaining quantities from this purchase order into its assigned outlet stock.'
                : isReceipt
                    ? 'Increases central warehouse stock for this item. Stock becomes available for store distribution.'
                    : 'Records ingredient consumption for the selected store. Storage balance will update immediately.';
        }

        document.getElementById('stockActionQty').value = '';
        updateUnitBadge();

        modal.classList.remove('hidden');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    };

    document.getElementById('stockActionItem')?.addEventListener('change', updateUnitBadge);

    // Create buttons with icons
    createButton('Receive central stock', 'package-plus', () => open('stock/receipt'), true);
    createButton('Record consumption', 'utensils', () => open('stock/consume'));
    const receivePO = createButton('Receive purchase order', 'truck', () => open('purchase-orders/receive'));
    receivePO.classList.add('no-chef');

    // Close handlers
    document.getElementById('stockActionCancel')?.addEventListener('click', closeModal);
    document.getElementById('stockActionCloseBtn')?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
    });

    // Form submit
    document.getElementById('stockActionForm').addEventListener('submit', async event => {
        event.preventDefault();
        const submitBtn = document.getElementById('stockActionSubmitBtn');
        const origBtnHtml = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner" style="display:inline-block;width:14px;height:14px;border:2px solid #000;border-top-color:transparent;border-radius:50%;animation:spin 0.6s linear infinite;margin-right:6px;"></span> Saving...';
        }

        try {
            const itemId = document.getElementById('stockActionItem')?.value;
            const outletId = document.getElementById('stockActionOutlet')?.value;
            const quantity = Number(document.getElementById('stockActionQty')?.value);
            const poId = document.getElementById('stockActionPO')?.value;

            await runDatabaseAction(mode, { itemId, outletId, quantity, poId });
            closeModal();
            if (typeof loadDashboardData === 'function') loadDashboardData();
            if (typeof window.showToast === 'function') {
                window.showToast('Stock update saved successfully.', 'success');
            }
        } catch (error) {
            if (typeof window.showUiModal === 'function') {
                window.showUiModal({
                    title: 'Stock Update Failed',
                    message: error.message || 'Could not save stock action. Please try again.',
                    type: 'warning'
                });
            } else if (typeof window.showToast === 'function') {
                window.showToast(error.message || 'Error saving stock action.', 'danger');
            } else {
                alert(error.message || 'Error saving stock action.');
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = origBtnHtml;
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
        }
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
});

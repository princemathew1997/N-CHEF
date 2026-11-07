// Bulk Receipt CSV Validation, Approval & History Component (attached to Receive Stock)
import { encodeCSV } from '../shared/legacy-import.mjs';
import { bulkReceiptHeaders, maxReceiptRows, maxReceiptBytes } from '../shared/bulk-receipt.mjs';

const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Format helpers
const formatCost = minor => (minor / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
const formatIST = iso => iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : '—';

const tableMarkup = (headers, rows, isRaw = false) => `
  <div class="table-container">
    <table>
      <thead><tr>${headers.map(h => `<th>${escapeHTML(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows.length ? rows.map(row => `<tr>${row.map(cell => `<td>${isRaw ? cell : escapeHTML(cell)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}">No records yet.</td></tr>`}</tbody>
    </table>
  </div>`;

const download = (name, rows) => {
  const url = URL.createObjectURL(new Blob([encodeCSV(rows)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// Exported helper to build CSV string from batch items
window.buildBulkReceiptCSV = (itemsList) => {
  const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const rows = [
    bulkReceiptHeaders,
    ...itemsList.map(item => [
      item.outletName,
      item.date || todayIST,
      item.itemName,
      item.unit,
      String(item.quantity),
      Number(item.unitPrice).toFixed(2),
      item.notes || 'Bulk Stock Receipt'
    ])
  ];
  return encodeCSV(rows);
};

// Render CSV Upload Section into container
window.renderBulkReceiptCSVUpload = (container, onParsedBatch) => {
  if (!container || !currentUser) return;
  const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

  container.innerHTML = `
    <div style="margin-bottom: 14px; display: flex; gap: 10px; flex-wrap: wrap;">
      <button type="button" class="btn btn-outline" id="bulkReceiptTemplate">
        <i data-lucide="download" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 4px;"></i>Download CSV template
      </button>
      <button type="button" class="btn btn-outline" id="bulkReceiptAllowed">
        <i data-lucide="list" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 4px;"></i>Download allowed catalog items & outlets
      </button>
    </div>

    <form class="inventory-form" id="bulkReceiptUploadForm" style="margin: 0;">
      <label style="margin-bottom: 12px;">Excel-saved CSV (.csv)
        <input id="bulkReceiptFile" type="file" accept=".csv,text/csv" required>
      </label>
      <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
        <button class="btn btn-primary" id="bulkReceiptValidate" type="submit">
          <i data-lucide="upload-cloud" style="width: 15px; height: 15px; vertical-align: middle; margin-right: 4px;"></i>Upload and Add Rows to Batch List
        </button>
      </div>
    </form>

    <div id="unrecognizedAlert" class="hidden" style="margin-top: 16px; padding: 16px; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 8px;">
      <h3 style="margin: 0 0 8px 0; color: #f87171; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
        <i data-lucide="alert-triangle" style="width: 18px; height: 18px;"></i> Items Not in Catalog
      </h3>
      <p style="margin: 0 0 12px 0; color: var(--text-muted); font-size: 0.95rem;">The following items do not exist in the master catalog. Please contact Admin before receiving:</p>
      <div id="unrecognizedTableContainer"></div>
    </div>

    <div id="dateMalpracticeAlert" class="hidden" style="margin-top: 16px; padding: 16px; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 8px;">
      <h3 style="margin: 0 0 8px 0; color: #fbbf24; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
        <i data-lucide="shield-alert" style="width: 18px; height: 18px;"></i> Date Validation Notice
      </h3>
      <p style="margin: 0 0 12px 0; color: var(--text-muted); font-size: 0.95rem;">Entries must be within 1 week of today. The following entries violate date policy:</p>
      <div id="dateMalpracticeTableContainer"></div>
    </div>

    <p id="bulkReceiptStatus" role="status" aria-live="polite" style="margin: 14px 0; font-weight: 500;"></p>
    <div id="bulkReceiptResults"></div>
    <button type="button" class="btn btn-outline hidden" id="bulkReceiptErrors" style="margin-top: 10px;">Download error report</button>
  `;

  if (window.lucide) window.lucide.createIcons();

  const fileInput = container.querySelector('#bulkReceiptFile');
  const status = container.querySelector('#bulkReceiptStatus');
  const results = container.querySelector('#bulkReceiptResults');
  const unrecAlert = container.querySelector('#unrecognizedAlert');
  const unrecContainer = container.querySelector('#unrecognizedTableContainer');
  const dateAlert = container.querySelector('#dateMalpracticeAlert');
  const dateContainer = container.querySelector('#dateMalpracticeTableContainer');
  const errorReportBtn = container.querySelector('#bulkReceiptErrors');

  let fileErrors = [];

  container.querySelector('#bulkReceiptTemplate').onclick = () => {
    const sampleRows = [
      bulkReceiptHeaders,
      [outletsData[0]?.name || 'BRIGADE', todayIST, masterItemsData[0]?.name || 'COCONUT OIL', masterItemsData[0]?.unit || 'L', '10', '150.00', 'Invoice #1042'],
      [outletsData[0]?.name || 'BRIGADE', todayIST, masterItemsData[1]?.name || 'GLOVES (BOX)', masterItemsData[1]?.unit || 'BOX', '5', '80.00', 'Direct delivery']
    ];
    download('nchef-bulk-receipt-template.csv', sampleRows);
  };

  container.querySelector('#bulkReceiptAllowed').onclick = () => {
    download('nchef-catalog-items-outlets.csv', [
      ['Type', 'Name / ID', 'Category', 'Unit', 'Active Status'],
      ...masterItemsData.map(i => ['Catalog Item', i.name, i.category, i.unit, i.active !== false ? 'Active' : 'Inactive']),
      ...outletsData.map(o => ['Outlet', o.name, 'ID: ' + o.id, '', 'Active'])
    ]);
  };

  errorReportBtn.onclick = () => {
    download('nchef-bulk-receipt-errors.csv', [
      ['Excel row', 'Column', 'Entered value', 'Problem'],
      ...fileErrors.map(e => [e.row, e.column, e.value || '', e.message])
    ]);
  };

  container.querySelector('#bulkReceiptUploadForm').onsubmit = async event => {
    event.preventDefault();
    unrecAlert.classList.add('hidden');
    dateAlert.classList.add('hidden');
    results.replaceChildren();
    errorReportBtn.classList.add('hidden');

    const file = fileInput.files[0];
    if (!file) return;

    if (!/\.csv$/i.test(file.name)) {
      status.textContent = 'Save your Excel sheet as CSV UTF-8 (.csv) before uploading.';
      status.style.color = '#ef4444';
      return;
    }
    if (file.size > maxReceiptBytes) {
      status.textContent = `File exceeds limit of ${maxReceiptBytes / 1000} KB.`;
      status.style.color = '#ef4444';
      return;
    }

    status.textContent = 'Checking every row against catalog and permissions…';
    status.style.color = 'var(--text-muted)';

    try {
      const csv = await file.text();
      const val = await apiRequest('stock/bulk-receipt/validate', 'POST', { csv });
      fileErrors = [];
      status.textContent = `Successfully validated ${val.rows.length} row(s) from "${file.name}". Appending to batch list below!`;
      status.style.color = '#34d399';
      fileInput.value = '';

      if (typeof onParsedBatch === 'function') {
        onParsedBatch(val.rows.map(r => ({
          outletId: r.outletId,
          outletName: r.outletName,
          date: r.date,
          itemId: r.itemId,
          itemName: r.itemName,
          unit: r.unit,
          vendor: 'Direct Delivery',
          quantity: r.quantity,
          unitPrice: r.unitCostMinor ? r.unitCostMinor / 100 : 0,
          note: r.notes || ''
        })));
      }
    } catch (error) {
      const errList = Array.isArray(error.details) ? error.details : (error.data?.errors || [{ row: 1, column: 'File', message: error.message }]);
      const unrec = error.unrecognizedItems || error.data?.unrecognizedItems || [];
      const dateFlags = error.dateAuditFlags || error.data?.dateAuditFlags || [];
      fileErrors = errList;
      errorReportBtn.classList.toggle('hidden', !fileErrors.length);

      if (unrec.length > 0) {
        unrecAlert.classList.remove('hidden');
        unrecContainer.innerHTML = tableMarkup(
          ['Row', 'Outlet', 'Date', 'Item Entered', 'Unit', 'Quantity', 'Unit Price', 'Catalog Status'],
          unrec.map(u => [u.row, u.outletName, u.date, u.itemText, u.unit || '-', u.quantity || '-', u.unitPrice || '-', 'Not in Catalog — Contact Admin'])
        );
      }
      if (dateFlags.length > 0) {
        dateAlert.classList.remove('hidden');
        dateContainer.innerHTML = tableMarkup(
          ['Row', 'Outlet', 'Item', 'Entered Date', 'Audit / Policy Issue'],
          dateFlags.map(d => [d.row, d.outletName, d.item, d.enteredDate, d.reason])
        );
      }
      status.textContent = `Validation failed with ${errList.length} issue(s). No rows added.`;
      status.style.color = '#ef4444';
      results.innerHTML = tableMarkup(['Excel row', 'Column', 'Entered value', 'Problem'], errList.map(e => [e.row, e.column, e.value || '', e.message]));
      if (window.lucide) window.lucide.createIcons();
    }
  };
};

// Render Admin Incoming Requests (Approvals) into a container
window.renderBulkReceiptApprovalAndHistory = (container) => {
  if (!container || !currentUser) return;
  const isAdmin = currentUser.role === 'admin';
  const allRecords = committedState?.operationRecords || [];
  const bulkRequests = allRecords.filter(r => (r.kind === 'notification' && r.eventType === 'bulk_receipt_request') || r.kind === 'bulk_receipt_request');

  // Only render if admin has incoming requests awaiting review
  if (!isAdmin) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <!-- Admin: Incoming Requests Awaiting Approval -->
    <div id="adminBulkRequestsSection" style="margin: 28px 0 24px 0; padding: 20px; border: 1.5px solid var(--primary, #FFBE0B); border-radius: 12px; background: rgba(255, 190, 11, 0.04); box-shadow: 0 4px 18px rgba(0,0,0,0.35);">
      <h3 style="margin: 0 0 14px 0; color: var(--primary, #FFBE0B); font-size: 1.15rem; display: flex; align-items: center; justify-content: space-between;">
        <span><i data-lucide="inbox" style="width: 18px; height: 18px; vertical-align: middle; margin-right: 6px;"></i>Incoming Supervisor Bulk Stock Requests</span>
        <span id="adminPendingBadge" class="approval-request-status awaiting" style="font-size: 0.8rem; font-weight: 500;">0 Pending</span>
      </h3>
      <div id="adminPendingRequestsList"></div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  // Populate Admin pending list
  const pending = bulkRequests.filter(r => r.status === 'Pending');
  const badge = container.querySelector('#adminPendingBadge');
  if (badge) {
    badge.textContent = `${pending.length} Pending`;
    badge.className = `approval-request-status ${pending.length ? 'awaiting' : 'approved'}`;
  }
  const adminList = container.querySelector('#adminPendingRequestsList');
  if (adminList) {
    if (!pending.length) {
      adminList.innerHTML = '<p style="color: var(--text-muted); margin: 6px 0;">No incoming bulk stock requests awaiting approval.</p>';
    } else {
      const fingerprintCounts = {};
      bulkRequests.forEach(r => {
        if (r.fingerprint) {
          fingerprintCounts[r.fingerprint] = (fingerprintCounts[r.fingerprint] || 0) + 1;
        }
      });

      adminList.innerHTML = pending.map(req => {
        const isDuplicate = req.fingerprint && fingerprintCounts[req.fingerprint] > 1;
        return `
          <div class="operations-card" style="margin-bottom: 14px; padding: 14px; border: 1px solid var(--border); border-radius: 8px; background: #141416;" data-request-id="${escapeHTML(req.id)}">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap;">
              <div>
                <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; align-items: center; gap: 8px;">
                  <span>Batch ID: <strong style="color: var(--primary, #FFBE0B);">${escapeHTML(req.batchId)}</strong></span>
                  ${isDuplicate ? '<span style="background: rgba(239, 68, 68, 0.18); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.5); padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">⚠️ Duplicate Order</span>' : ''}
                </div>
                <h4 style="margin: 4px 0 6px 0; font-size: 1.05rem; color: #fff;">
                  Supervisor: <span style="color: #60a5fa;">${escapeHTML(req.supervisorName)}</span> · Outlets: <strong>${escapeHTML(req.outletNames || 'All')}</strong>
                </h4>
                <div style="font-size: 0.85rem; color: var(--text-muted);">
                  Submitted on (IST): <strong>${escapeHTML(formatIST(req.createdAt))}</strong> · Rows: <strong>${escapeHTML(req.rowCount)}</strong> · Total Value: <strong>${escapeHTML(formatCost(req.totalCostMinor || 0))}</strong>
                </div>
              </div>
              <div style="display: flex; gap: 8px;">
                <button type="button" class="btn btn-outline" data-admin-action="view" data-id="${escapeHTML(req.id)}">View Items (${req.rowCount})</button>
                <button type="button" class="btn btn-outline" data-admin-action="reject" data-id="${escapeHTML(req.id)}" style="color: #f87171; border-color: rgba(248, 113, 113, 0.4);">Reject</button>
                <button type="button" class="btn btn-primary" data-admin-action="approve" data-id="${escapeHTML(req.id)}">Approve & Receive Stock</button>
              </div>
            </div>
          </div>
        `;
      }).join('');

      // Bind admin action buttons
      adminList.querySelectorAll('[data-admin-action]').forEach(btn => {
        btn.onclick = async () => {
          const act = btn.dataset.adminAction;
          const reqId = btn.dataset.id;
          const targetReq = pending.find(r => r.id === reqId);
          if (!targetReq) return;

          if (act === 'view') {
            const dialog = document.createElement('dialog');
            dialog.className = 'operations-dialog';
            dialog.innerHTML = `
              <h2>Batch ${escapeHTML(targetReq.batchId)} Details</h2>
              <p>Supervisor: <strong>${escapeHTML(targetReq.supervisorName)}</strong> | Date (IST): <strong>${escapeHTML(formatIST(targetReq.createdAt))}</strong></p>
              <p>Outlets: <strong>${escapeHTML(targetReq.outletNames)}</strong> | Rows: <strong>${escapeHTML(targetReq.rowCount)}</strong> | Value: <strong>${escapeHTML(formatCost(targetReq.totalCostMinor || 0))}</strong></p>
              <div class="table-container" style="max-height: 320px; overflow-y: auto;">
                <table>
                  <thead><tr><th>Row</th><th>Outlet</th><th>Date</th><th>Item</th><th>Unit</th><th>Qty</th><th>Price (INR)</th><th>Notes</th></tr></thead>
                  <tbody>
                    ${(targetReq.itemsPreview || []).map(r => `
                      <tr>
                        <td>${escapeHTML(r.row)}</td>
                        <td>${escapeHTML(r.outlet)}</td>
                        <td>${escapeHTML(r.date)}</td>
                        <td>${escapeHTML(r.item)}</td>
                        <td>${escapeHTML(r.unit)}</td>
                        <td>${escapeHTML(r.qty)}</td>
                        <td>${escapeHTML(r.price)}</td>
                        <td>${escapeHTML(r.notes)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
              <div style="margin-top: 14px; display: flex; justify-content: flex-end; gap: 8px;">
                <button type="button" class="btn btn-outline" data-close>Close</button>
              </div>
            `;
            document.body.append(dialog);
            dialog.querySelector('[data-close]').onclick = () => dialog.close();
            dialog.onclose = () => dialog.remove();
            dialog.showModal();
            return;
          }

          if (act === 'reject') {
            const reason = prompt(`Enter rejection reason for batch ${targetReq.batchId}:`, 'Needs corrections');
            if (reason === null) return;
            btn.disabled = true;
            try {
              const state = await apiRequest('stock/bulk-receipt/resolve', 'POST', {
                requestId: reqId,
                approve: false,
                reason,
                operationId: crypto.randomUUID()
              });
              applyServerState(state);
              window.onLiveSyncReceived?.();
              window.renderBulkReceiptApprovalAndHistory(container);
              window.showToast?.(`Batch ${targetReq.batchId} rejected`, 'info');
            } catch (e) {
              window.showUiModal?.({ title: 'Rejection failed', message: e.message, type: 'warning' });
            } finally {
              btn.disabled = false;
            }
            return;
          }

          if (act === 'approve') {
            if (!confirm(`Approve batch ${targetReq.batchId} submitted by ${targetReq.supervisorName}? All ${targetReq.rowCount} items will be received into stock immediately.`)) return;
            btn.disabled = true;
            try {
              const state = await apiRequest('stock/bulk-receipt/resolve', 'POST', {
                requestId: reqId,
                approve: true,
                operationId: crypto.randomUUID()
              });
              applyServerState(state);
              window.onLiveSyncReceived?.();
              window.renderBulkReceiptApprovalAndHistory(container);
              window.showToast?.(`Batch ${targetReq.batchId} approved and received into stock!`, 'success');
            } catch (e) {
              window.showUiModal?.({ title: 'Approval failed', message: e.message, type: 'warning' });
            } finally {
              btn.disabled = false;
            }
            return;
          }
        };
      });
    }
  }
  if (window.lucide) window.lucide.createIcons();
};



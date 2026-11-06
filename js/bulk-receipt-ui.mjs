import { encodeCSV } from '../shared/legacy-import.mjs';
import { bulkReceiptHeaders, maxReceiptRows, maxReceiptBytes } from '../shared/bulk-receipt.mjs';

const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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

window.renderBulkReceipt = content => {
  let csv = '', validation = null, operationId = crypto.randomUUID(), errors = [];

  const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const isAdmin = currentUser?.role === 'admin';

  content.innerHTML = `
    <p>Upload stock receipts in bulk for existing catalog items using an Excel or CSV file. ${isAdmin ? 'Quantities are <strong>added directly to current outlet inventory</strong> upon receipt.' : 'Submissions are sent to <strong>Admin for approval</strong> before stock is received.'}</p>
    <p>Download the template below, enter your data in Excel and save as <strong>CSV UTF-8 (.csv)</strong>. Columns: <strong>Outlet Name, Date, Item, Unit, Quantity, Unit Price, Notes</strong>. Maximum ${maxReceiptRows} rows / ${maxReceiptBytes / 1000} KB.</p>
    
    <div class="operations-links" style="margin-bottom: 16px;">
      <button type="button" class="btn btn-outline" id="bulkReceiptTemplate">
        <i data-lucide="download" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 4px;"></i>Download CSV template
      </button>
      <button type="button" class="btn btn-outline" id="bulkReceiptAllowed">
        <i data-lucide="list" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 4px;"></i>Download allowed catalog items & outlets
      </button>
    </div>

    <!-- Admin: Incoming Requests Awaiting Approval -->
    <div id="adminBulkRequestsSection" class="${isAdmin ? '' : 'hidden'}" style="margin: 24px 0 28px 0; padding: 20px; border: 1.5px solid var(--primary, #FFBE0B); border-radius: 12px; background: rgba(255, 190, 11, 0.04); box-shadow: 0 4px 18px rgba(0,0,0,0.35);">
      <h3 style="margin: 0 0 14px 0; color: var(--primary, #FFBE0B); font-size: 1.15rem; display: flex; align-items: center; justify-content: space-between;">
        <span><i data-lucide="inbox" style="width: 18px; height: 18px; vertical-align: middle; margin-right: 6px;"></i>Incoming Supervisor Bulk Stock Requests</span>
        <span id="adminPendingBadge" class="approval-request-status awaiting" style="font-size: 0.8rem; font-weight: 500;">0 Pending</span>
      </h3>
      <div id="adminPendingRequestsList"></div>
    </div>

    <!-- Upload Stock Section with Distinct Yellow Border -->
    <div id="bulkUploadSection" style="margin: 24px 0; padding: 20px; border: 1.5px solid var(--primary, #FFBE0B); border-radius: 12px; background: #141416; box-shadow: 0 4px 18px rgba(0,0,0,0.35);">
      <h3 style="margin: 0 0 14px 0; color: var(--primary, #FFBE0B); font-size: 1.15rem; display: flex; align-items: center; gap: 8px;">
        <i data-lucide="file-up" style="width: 18px; height: 18px;"></i> Upload Bulk Stock Spreadsheet
      </h3>
      <form class="inventory-form" id="bulkReceiptUploadForm" style="margin: 0;">
        <label style="margin-bottom: 12px;">Excel-saved CSV (.csv)
          <input id="bulkReceiptFile" type="file" accept=".csv,text/csv" required>
        </label>
        <div>
          <button class="btn btn-primary" id="bulkReceiptValidate" type="submit">Validate entire file</button>
        </div>
      </form>

      <div id="unrecognizedAlert" class="hidden" style="margin-top: 16px; padding: 16px; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 8px;">
        <h3 style="margin: 0 0 8px 0; color: #f87171; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
          <i data-lucide="alert-triangle" style="width: 18px; height: 18px;"></i> Items Not in Catalog / Not in Stock
        </h3>
        <p style="margin: 0 0 12px 0; color: var(--text-muted); font-size: 0.95rem;">
          The following items entered in your CSV do not exist in the master catalog. Please get in touch with Admin to create them before receiving:
        </p>
        <div id="unrecognizedTableContainer"></div>
      </div>

      <div id="dateMalpracticeAlert" class="hidden" style="margin-top: 16px; padding: 16px; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 8px;">
        <h3 style="margin: 0 0 8px 0; color: #fbbf24; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
          <i data-lucide="shield-alert" style="width: 18px; height: 18px;"></i> Date Validation & Malpractice Audit Notice
        </h3>
        <p style="margin: 0 0 12px 0; color: var(--text-muted); font-size: 0.95rem;">
          Entries must be dated within 1 week from today. The following entries violate date policy (future date or backdated beyond 7 days) and cannot be processed:
        </p>
        <div id="dateMalpracticeTableContainer"></div>
      </div>

      <p id="bulkReceiptStatus" role="status" aria-live="polite" style="margin: 14px 0; font-weight: 500;"></p>
      <div id="bulkReceiptSummaryBox" class="hidden" style="margin: 16px 0; padding: 16px; background: rgba(52, 211, 153, 0.12); border: 1px solid rgba(52, 211, 153, 0.35); border-radius: 8px;"></div>
      <div id="bulkReceiptResults"></div>

      <div style="margin-top: 16px; display: flex; gap: 10px; flex-wrap: wrap;">
        <button type="button" class="btn btn-outline hidden" id="bulkReceiptErrors">Download error report</button>
        <button type="button" class="btn btn-primary hidden" id="bulkReceiptSendApproval">
          <i data-lucide="send" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 4px;"></i>Send for Admin Approval
        </button>
        <button type="button" class="btn btn-primary hidden" id="bulkReceiptConfirm">Receive all validated stock</button>
      </div>
    </div>

    <!-- Supervisor's Bulk Request History -->
    <div id="supervisorHistorySection" style="margin-top: 32px; padding-top: 20px; border-top: 1px solid var(--border);">
      <h3 style="margin: 0 0 12px 0; color: var(--text-main); font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
        <i data-lucide="history" style="width: 16px; height: 16px;"></i> ${isAdmin ? 'All Bulk Stock Upload History' : 'My Bulk Stock Upload History'}
      </h3>
      <div id="supervisorHistoryList"></div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  const buttonConfirm = content.querySelector('#bulkReceiptConfirm');
  const buttonSendApproval = content.querySelector('#bulkReceiptSendApproval');
  const status = content.querySelector('#bulkReceiptStatus');
  const summaryBox = content.querySelector('#bulkReceiptSummaryBox');
  const results = content.querySelector('#bulkReceiptResults');
  const fileInput = content.querySelector('#bulkReceiptFile');
  const unrecAlert = content.querySelector('#unrecognizedAlert');
  const unrecContainer = content.querySelector('#unrecognizedTableContainer');
  const dateAlert = content.querySelector('#dateMalpracticeAlert');
  const dateContainer = content.querySelector('#dateMalpracticeTableContainer');

  // Format helper for IST currency
  const formatCost = minor => (minor / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
  const formatIST = iso => iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : '—';

  const table = (headers, rows, isRaw = false) => `
    <div class="table-container">
      <table>
        <thead><tr>${headers.map(h => `<th>${escapeHTML(h)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${isRaw ? cell : escapeHTML(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </div>`;

  // Render Admin Incoming Requests & Supervisor History
  const renderRequestsAndHistory = () => {
    const allRecords = committedState?.operationRecords || [];
    const bulkRequests = allRecords.filter(r => (r.kind === 'notification' && r.eventType === 'bulk_receipt_request') || r.kind === 'bulk_receipt_request');

    // Admin pending list
    if (isAdmin) {
      const pending = bulkRequests.filter(r => r.status === 'Pending');
      const badge = content.querySelector('#adminPendingBadge');
      if (badge) {
        badge.textContent = `${pending.length} Pending`;
        badge.className = `approval-request-status ${pending.length ? 'awaiting' : 'approved'}`;
      }
      const adminList = content.querySelector('#adminPendingRequestsList');
      if (adminList) {
        if (!pending.length) {
          adminList.innerHTML = '<p style="color: var(--text-muted); margin: 6px 0;">No incoming bulk stock requests awaiting approval.</p>';
        } else {
          // Count fingerprints to identify duplicates among pending or past requests
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
                    revision: committedState?.revision,
                    operationId: crypto.randomUUID()
                  });
                  applyServerState(state);
                  window.onLiveSyncReceived?.();
                  renderRequestsAndHistory();
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
                    revision: committedState?.revision,
                    operationId: crypto.randomUUID()
                  });
                  applyServerState(state);
                  window.onLiveSyncReceived?.();
                  renderRequestsAndHistory();
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
    }

    // Supervisor & Admin History
    const historySection = content.querySelector('#supervisorHistoryList');
    if (historySection) {
      const filteredHistory = bulkRequests
        .filter(r => isAdmin || r.requestedBy === currentUser?.id)
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

      if (!filteredHistory.length) {
        historySection.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">No past bulk stock submissions found.</p>';
      } else {
        const fingerprintCounts = {};
        bulkRequests.forEach(r => {
          if (r.fingerprint) {
            fingerprintCounts[r.fingerprint] = (fingerprintCounts[r.fingerprint] || 0) + 1;
          }
        });

        const historyTable = table(
          ['Submitted (IST)', 'Batch ID', 'Supervisor', 'Outlets', 'Rows', 'Total Value', 'Status', 'Admin Note / Resolution'],
          filteredHistory.map(r => {
            const isDuplicate = r.fingerprint && fingerprintCounts[r.fingerprint] > 1;
            const duplicateBadge = isDuplicate ? ' <span style="background: rgba(239, 68, 68, 0.18); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.5); padding: 1px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; margin-left: 4px;">DUPLICATE</span>' : '';
            return [
              formatIST(r.createdAt),
              r.batchId + duplicateBadge,
              r.supervisorName || 'Supervisor',
              r.outletNames || 'All',
              r.rowCount,
              formatCost(r.totalCostMinor || 0),
              `<span class="approval-request-status ${r.status === 'Approved' ? 'approved' : r.status === 'Rejected' ? 'rejected' : 'awaiting'}">${escapeHTML(r.status)}</span>`,
              r.status === 'Approved' ? `Approved by ${escapeHTML(r.resolvedByName || 'Admin')} on ${escapeHTML(formatIST(r.resolvedAt))}` : r.status === 'Rejected' ? `Rejected: ${escapeHTML(r.reason || 'No note')}` : 'Awaiting Admin review'
            ];
          }),
          true
        );
        historySection.innerHTML = historyTable;
      }
    }
    if (window.lucide) window.lucide.createIcons();
  };

  renderRequestsAndHistory();

  // Download template with Date column
  content.querySelector('#bulkReceiptTemplate').onclick = () => {
    const sampleRows = [
      bulkReceiptHeaders,
      [outletsData[0]?.name || 'BRIGADE', todayIST, masterItemsData[0]?.name || 'COCONUT OIL', masterItemsData[0]?.unit || 'L', '10', '150.00', 'Invoice #1042'],
      [outletsData[0]?.name || 'BRIGADE', todayIST, masterItemsData[1]?.name || 'GLOVES (BOX)', masterItemsData[1]?.unit || 'BOX', '5', '80.00', 'Direct delivery']
    ];
    download('nchef-bulk-receipt-template.csv', sampleRows);
  };

  // Download allowed values reference
  content.querySelector('#bulkReceiptAllowed').onclick = () => {
    download('nchef-catalog-items-outlets.csv', [
      ['Type', 'Name / ID', 'Category', 'Unit', 'Active Status'],
      ...masterItemsData.map(i => ['Catalog Item', i.name, i.category, i.unit, i.active !== false ? 'Active' : 'Inactive']),
      ...outletsData.map(o => ['Outlet', o.name, 'ID: ' + o.id, '', 'Active'])
    ]);
  };

  const showErrors = (list, unrec = [], dateFlags = [], message = '') => {
    validation = null;
    errors = list;
    buttonConfirm.classList.add('hidden');
    buttonSendApproval.classList.add('hidden');
    content.querySelector('#bulkReceiptErrors').classList.toggle('hidden', !list.length);

    // Unrecognized items table
    if (unrec && unrec.length > 0) {
      unrecAlert.classList.remove('hidden');
      unrecContainer.innerHTML = table(
        ['Row', 'Outlet', 'Date', 'Item Entered', 'Unit', 'Quantity Entered', 'Unit Price (INR)', 'Notes', 'Catalog Status'],
        unrec.map(u => [
          u.row,
          u.outletName || 'Not specified',
          u.date || todayIST,
          u.itemText,
          u.unit || '-',
          u.quantity || '-',
          u.unitPrice || '-',
          u.notes || '-',
          'Not in Catalog — Contact Admin'
        ])
      );
    } else {
      unrecAlert.classList.add('hidden');
      unrecContainer.replaceChildren();
    }

    // Date validation / Malpractice audit table
    if (dateFlags && dateFlags.length > 0) {
      dateAlert.classList.remove('hidden');
      dateContainer.innerHTML = table(
        ['Row', 'Outlet', 'Item', 'Entered Date in Sheet', 'Audit / Policy Issue'],
        dateFlags.map(d => [
          d.row,
          d.outletName,
          d.item,
          d.enteredDate,
          d.reason
        ])
      );
    } else {
      dateAlert.classList.add('hidden');
      dateContainer.replaceChildren();
    }

    if (window.lucide) window.lucide.createIcons();

    // Filter out rows already in custom tables
    const otherErrors = list.filter(e => {
      if (e.column === 'Item' && unrec.some(u => u.row === e.row)) return false;
      if (e.column === 'Date' && dateFlags.some(d => d.row === e.row)) return false;
      return true;
    });

    if (otherErrors.length > 0) {
      status.textContent = message || `${otherErrors.length} additional issue(s) found. Nothing received. Correct the entries and upload again.`;
      status.style.color = '#ef4444';
      results.innerHTML = table(['Excel row', 'Column', 'Entered value', 'Problem'], otherErrors.map(e => [e.row, e.column, e.value || '', e.message]));
    } else if (unrec.length > 0 || dateFlags.length > 0) {
      status.textContent = `Validation failed due to ${unrec.length ? `${unrec.length} unrecognized item(s) ` : ''}${unrec.length && dateFlags.length ? 'and ' : ''}${dateFlags.length ? `${dateFlags.length} date policy violation(s)` : ''}. Review the details above.`;
      status.style.color = '#ef4444';
      results.replaceChildren();
    } else {
      status.textContent = message || `${list.length} issue(s) found.`;
      status.style.color = '#ef4444';
      results.innerHTML = table(['Excel row', 'Column', 'Entered value', 'Problem'], list.map(e => [e.row, e.column, e.value || '', e.message]));
    }
  };

  content.querySelector('#bulkReceiptErrors').onclick = () => {
    download('nchef-bulk-receipt-errors.csv', [
      ['Excel row', 'Column', 'Entered value', 'Problem'],
      ...errors.map(e => [e.row, e.column, e.value || '', e.message])
    ]);
  };

  fileInput.onchange = () => {
    validation = null;
    csv = '';
    operationId = crypto.randomUUID();
    results.replaceChildren();
    summaryBox.classList.add('hidden');
    summaryBox.replaceChildren();
    unrecAlert.classList.add('hidden');
    dateAlert.classList.add('hidden');
    buttonConfirm.classList.add('hidden');
    buttonSendApproval.classList.add('hidden');
    content.querySelector('#bulkReceiptErrors').classList.add('hidden');
    status.textContent = 'File selected. Validate the entire file before receiving.';
    status.style.color = 'var(--text-muted)';
  };

  const setBusy = value => {
    content.querySelectorAll('button, input').forEach(el => el.disabled = value);
  };

  content.querySelector('#bulkReceiptUploadForm').onsubmit = async event => {
    event.preventDefault();
    validation = null;
    buttonConfirm.classList.add('hidden');
    buttonSendApproval.classList.add('hidden');
    unrecAlert.classList.add('hidden');
    dateAlert.classList.add('hidden');

    const file = fileInput.files[0];
    if (!file) return;

    if (!/\.csv$/i.test(file.name)) {
      showErrors([{ row: 1, column: 'File', message: 'Save your Excel sheet as CSV UTF-8 (.csv) before uploading.' }]);
      return;
    }
    if (file.size > maxReceiptBytes) {
      showErrors([{ row: 1, column: 'File', message: `File exceeds limit of ${maxReceiptBytes / 1000} KB.` }]);
      return;
    }

    setBusy(true);
    status.textContent = 'Checking every row against catalog, dates and permissions…';
    status.style.color = 'var(--text-muted)';

    try {
      csv = await file.text();
      const result = await apiRequest('stock/bulk-receipt/validate', 'POST', { csv });
      validation = result;
      content.querySelector('#bulkReceiptErrors').classList.add('hidden');
      errors = [];

      status.textContent = `All ${result.rows.length} rows passed validation. Review the preview below. Click "${isAdmin ? 'Receive all validated stock' : 'Send for Admin Approval'}" to proceed.`;
      status.style.color = '#34d399';

      results.innerHTML = table(
        ['Excel row', 'Outlet', 'Receipt Date', 'Item', 'Category', 'Unit', 'Quantity to add', 'Unit price (INR)', 'Current stock', 'Stock after receipt', 'Total cost (INR)', 'Notes'],
        result.rows.map(r => [
          r.row,
          r.outletName,
          r.date,
          r.itemName,
          r.category,
          r.unit,
          r.quantity,
          (r.unitCostMinor / 100).toFixed(2),
          r.currentQuantity,
          r.resultingQuantity,
          ((r.quantity * r.unitCostMinor) / 100).toFixed(2),
          r.notes || 'Bulk Stock Receipt'
        ])
      );

      if (isAdmin) {
        buttonConfirm.classList.remove('hidden');
        buttonSendApproval.classList.add('hidden');
      } else {
        buttonSendApproval.classList.remove('hidden');
        buttonConfirm.classList.add('hidden');
      }
    } catch (error) {
      const errList = Array.isArray(error.details) ? error.details : (error.data?.errors || [{ row: 1, column: 'File', message: error.message }]);
      const unrec = error.unrecognizedItems || error.data?.unrecognizedItems || [];
      const dateFlags = error.dateAuditFlags || error.data?.dateAuditFlags || [];
      showErrors(errList, unrec, dateFlags);
    } finally {
      setBusy(false);
    }
  };

  // Supervisor Sends for Admin Approval
  buttonSendApproval.onclick = async () => {
    if (!validation) return;
    if (databaseWritePending || pendingChanges().length) {
      status.textContent = 'Finish your other pending changes before submitting.';
      status.style.color = '#ef4444';
      return;
    }

    setBusy(true);
    databaseWritePending = true;
    document.body.classList.add('database-saving');
    status.textContent = 'Submitting bulk receipt to Admin for approval…';
    status.style.color = 'var(--text-muted)';

    try {
      const count = validation.rows.length;
      const state = await apiRequest('stock/bulk-receipt/request', 'POST', {
        csv,
        revision: validation.revision,
        operationId
      });
      applyServerState(state);
      window.onLiveSyncReceived?.();
      validation = null;
      buttonSendApproval.classList.add('hidden');
      status.textContent = `Submitted ${count} items for Admin Approval. Stock will be added to outlet inventory once Admin approves.`;
      status.style.color = '#34d399';
      fileInput.value = '';

      const summary = state.batchSummary || {
        batchId: 'BR-' + Date.now().toString(36).toUpperCase(),
        rowsCount: count,
        supervisorName: currentUser?.name || currentUser?.username || 'Supervisor',
        submittedAt: new Date().toISOString()
      };

      summaryBox.classList.remove('hidden');
      summaryBox.innerHTML = `
        <h3 style="margin: 0 0 10px 0; color: var(--primary, #FFBE0B); font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
          <i data-lucide="clock" style="width: 18px; height: 18px;"></i> Request Sent to Admin for Approval
        </h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 12px; font-size: 0.95rem;">
          <div><span style="color: var(--text-muted);">Tracking Batch ID:</span><br><strong style="color: var(--primary, #FFBE0B); font-size: 1.05rem;">${escapeHTML(summary.batchId)}</strong></div>
          <div><span style="color: var(--text-muted);">Supervisor:</span><br><strong>${escapeHTML(summary.supervisorName)}</strong></div>
          <div><span style="color: var(--text-muted);">Submission Time (IST):</span><br><strong>${escapeHTML(formatIST(summary.submittedAt))}</strong></div>
          <div><span style="color: var(--text-muted);">Items:</span><br><strong>${escapeHTML(summary.rowsCount)} item(s)</strong></div>
        </div>
        <p style="margin: 0; font-size: 0.85rem; color: var(--text-muted);">
          A notification has been sent to Admin. You can track this submission under "My Bulk Stock Upload History" below.
        </p>
      `;
      if (window.lucide) window.lucide.createIcons();

      renderRequestsAndHistory();
      window.showToast?.(`Sent ${count} items to Admin for approval`, 'success');
    } catch (error) {
      const errList = Array.isArray(error.details) ? error.details : (error.data?.errors || [{ row: 1, column: 'File', message: error.message }]);
      showErrors(errList);
    } finally {
      databaseWritePending = false;
      document.body.classList.remove('database-saving');
      setBusy(false);
    }
  };

  // Admin Direct Receive
  buttonConfirm.onclick = async () => {
    if (!validation) return;
    if (databaseWritePending || pendingChanges().length) {
      status.textContent = 'Finish your other pending changes before receiving.';
      status.style.color = '#ef4444';
      return;
    }

    setBusy(true);
    databaseWritePending = true;
    document.body.classList.add('database-saving');
    status.textContent = 'Adding stock to outlet inventories…';
    status.style.color = 'var(--text-muted)';

    try {
      const count = validation.rows.length;
      const state = await apiRequest('stock/bulk-receipt', 'POST', {
        csv,
        revision: validation.revision,
        operationId
      });
      applyServerState(state);
      window.onLiveSyncReceived?.();
      validation = null;
      buttonConfirm.classList.add('hidden');
      status.textContent = `Received all ${count} rows successfully! Stock transactions are recorded in Stock History.`;
      status.style.color = '#34d399';
      fileInput.value = '';

      const summary = state.batchSummary || {
        batchId: 'BR-' + Date.now().toString(36).toUpperCase(),
        rowsCount: count,
        receivedBy: currentUser?.name || currentUser?.username || 'Admin',
        receivedAt: new Date().toISOString()
      };

      summaryBox.classList.remove('hidden');
      summaryBox.innerHTML = `
        <h3 style="margin: 0 0 10px 0; color: #34d399; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
          <i data-lucide="check-circle" style="width: 18px; height: 18px;"></i> Bulk Receipt Tracking Summary
        </h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 12px; font-size: 0.95rem;">
          <div><span style="color: var(--text-muted);">Tracking Batch ID:</span><br><strong style="color: var(--primary, #FFBE0B); font-size: 1.05rem;">${escapeHTML(summary.batchId)}</strong></div>
          <div><span style="color: var(--text-muted);">Received By:</span><br><strong>${escapeHTML(summary.receivedBy)}</strong> (${escapeHTML(currentUser?.role || 'Admin')})</div>
          <div><span style="color: var(--text-muted);">Timestamp (IST):</span><br><strong>${escapeHTML(formatIST(summary.receivedAt))}</strong></div>
          <div><span style="color: var(--text-muted);">Items Processed:</span><br><strong>${escapeHTML(summary.rowsCount)} item(s)</strong></div>
        </div>
        <p style="margin: 0; font-size: 0.85rem; color: var(--text-muted);">
          Each individual stock ledger and movement record in Stock History has been tagged with tracking ID <code>${escapeHTML(summary.batchId)}</code>.
        </p>
      `;
      if (window.lucide) window.lucide.createIcons();

      renderRequestsAndHistory();
      window.showToast?.(`Received ${count} bulk stock items successfully`, 'success');
    } catch (error) {
      if (error.status) {
        const errList = Array.isArray(error.details) ? error.details : (error.data?.errors || [{ row: 1, column: 'File', message: error.message }]);
        const unrec = error.unrecognizedItems || error.data?.unrecognizedItems || [];
        const dateFlags = error.dateAuditFlags || error.data?.dateAuditFlags || [];
        showErrors(errList, unrec, dateFlags);
      } else {
        status.textContent = 'Connection interrupted. Click Receive again to retry safely.';
        status.style.color = '#ef4444';
      }
    } finally {
      databaseWritePending = false;
      document.body.classList.remove('database-saving');
      setBusy(false);
    }
  };
};

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

  content.innerHTML = `
    <p>Upload stock receipts in bulk for existing catalog items using an Excel or CSV file. Quantities are <strong>added directly to current outlet inventory</strong> and logged with full pricing in Stock History.</p>
    <p>Download the template below, enter your data in Excel and save as <strong>CSV UTF-8 (.csv)</strong>. Columns: <strong>Outlet Name, Date, Item, Unit, Quantity, Unit Price, Notes</strong>. Maximum ${maxReceiptRows} rows / ${maxReceiptBytes / 1000} KB.</p>
    
    <div class="operations-links" style="margin-bottom: 16px;">
      <button type="button" class="btn btn-outline" id="bulkReceiptTemplate">
        <i data-lucide="download" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 4px;"></i>Download CSV template
      </button>
      <button type="button" class="btn btn-outline" id="bulkReceiptAllowed">
        <i data-lucide="list" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 4px;"></i>Download allowed catalog items & outlets
      </button>
    </div>

    <form class="inventory-form" id="bulkReceiptUploadForm">
      <label>Excel-saved CSV (.csv)
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

    <div style="margin-top: 16px; display: flex; gap: 10px;">
      <button type="button" class="btn btn-outline hidden" id="bulkReceiptErrors">Download error report</button>
      <button type="button" class="btn btn-primary hidden" id="bulkReceiptConfirm">Receive all validated stock</button>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  const button = content.querySelector('#bulkReceiptConfirm');
  const status = content.querySelector('#bulkReceiptStatus');
  const summaryBox = content.querySelector('#bulkReceiptSummaryBox');
  const results = content.querySelector('#bulkReceiptResults');
  const fileInput = content.querySelector('#bulkReceiptFile');
  const unrecAlert = content.querySelector('#unrecognizedAlert');
  const unrecContainer = content.querySelector('#unrecognizedTableContainer');
  const dateAlert = content.querySelector('#dateMalpracticeAlert');
  const dateContainer = content.querySelector('#dateMalpracticeTableContainer');

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

  const table = (headers, rows, isRaw = false) => `
    <div class="table-container">
      <table>
        <thead><tr>${headers.map(h => `<th>${escapeHTML(h)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${isRaw ? cell : escapeHTML(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </div>`;

  const showErrors = (list, unrec = [], dateFlags = [], message = '') => {
    validation = null;
    errors = list;
    button.classList.add('hidden');
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

    // Only render the generic bottom error table if there are non-unrecognized and non-date errors (e.g. invalid quantity, outlet)
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
    button.classList.add('hidden');
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
    button.classList.add('hidden');
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

      status.textContent = `All ${result.rows.length} rows passed validation. Review the complete preview, then confirm receipt. No stock has been changed yet.`;
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

      button.classList.remove('hidden');
    } catch (error) {
      const errList = Array.isArray(error.details) ? error.details : (error.data?.errors || [{ row: 1, column: 'File', message: error.message }]);
      const unrec = error.unrecognizedItems || error.data?.unrecognizedItems || [];
      const dateFlags = error.dateAuditFlags || error.data?.dateAuditFlags || [];
      showErrors(errList, unrec, dateFlags);
    } finally {
      setBusy(false);
    }
  };

  button.onclick = async () => {
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
      button.classList.add('hidden');
      status.textContent = `Received all ${count} rows successfully! Stock transactions are recorded in Stock History.`;
      status.style.color = '#34d399';
      fileInput.value = '';

      const summary = state.batchSummary || {
        batchId: 'BR-' + Date.now().toString(36).toUpperCase(),
        rowsCount: count,
        receivedBy: currentUser?.name || currentUser?.username || 'Supervisor',
        receivedAt: new Date().toISOString()
      };

      const dateIST = new Date(summary.receivedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });

      summaryBox.classList.remove('hidden');
      summaryBox.innerHTML = `
        <h3 style="margin: 0 0 10px 0; color: #34d399; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
          <i data-lucide="check-circle" style="width: 18px; height: 18px;"></i> Bulk Receipt Tracking Summary
        </h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 12px; font-size: 0.95rem;">
          <div><span style="color: var(--text-muted);">Tracking Batch ID:</span><br><strong style="color: var(--primary, #FFBE0B); font-size: 1.05rem;">${escapeHTML(summary.batchId)}</strong></div>
          <div><span style="color: var(--text-muted);">Received By:</span><br><strong>${escapeHTML(summary.receivedBy)}</strong> (${escapeHTML(currentUser?.role || 'Supervisor')})</div>
          <div><span style="color: var(--text-muted);">Timestamp (IST):</span><br><strong>${escapeHTML(dateIST)}</strong></div>
          <div><span style="color: var(--text-muted);">Items Processed:</span><br><strong>${escapeHTML(summary.rowsCount)} item(s)</strong></div>
        </div>
        <p style="margin: 0; font-size: 0.85rem; color: var(--text-muted);">
          Each individual stock ledger and movement record in Stock History has been tagged with tracking ID <code>${escapeHTML(summary.batchId)}</code>.
        </p>
      `;
      if (window.lucide) window.lucide.createIcons();

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

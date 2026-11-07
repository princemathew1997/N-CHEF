// Bulk Receipt Approval & History Component (attached to Receive Stock)
import { encodeCSV } from '../shared/legacy-import.mjs';
import { bulkReceiptHeaders } from '../shared/bulk-receipt.mjs';

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

// Render Admin Incoming Requests and Submission History into a container
window.renderBulkReceiptApprovalAndHistory = (container) => {
  if (!container || !currentUser) return;
  const isAdmin = currentUser.role === 'admin';
  const allRecords = committedState?.operationRecords || [];
  const bulkRequests = allRecords.filter(r => (r.kind === 'notification' && r.eventType === 'bulk_receipt_request') || r.kind === 'bulk_receipt_request');

  container.innerHTML = `
    <!-- Admin: Incoming Requests Awaiting Approval -->
    <div id="adminBulkRequestsSection" class="${isAdmin ? '' : 'hidden'}" style="margin: 28px 0 24px 0; padding: 20px; border: 1.5px solid var(--primary, #FFBE0B); border-radius: 12px; background: rgba(255, 190, 11, 0.04); box-shadow: 0 4px 18px rgba(0,0,0,0.35);">
      <h3 style="margin: 0 0 14px 0; color: var(--primary, #FFBE0B); font-size: 1.15rem; display: flex; align-items: center; justify-content: space-between;">
        <span><i data-lucide="inbox" style="width: 18px; height: 18px; vertical-align: middle; margin-right: 6px;"></i>Incoming Supervisor Bulk Stock Requests</span>
        <span id="adminPendingBadge" class="approval-request-status awaiting" style="font-size: 0.8rem; font-weight: 500;">0 Pending</span>
      </h3>
      <div id="adminPendingRequestsList"></div>
    </div>

    <!-- Supervisor & Admin Bulk Stock History -->
    <div id="supervisorHistorySection" style="margin-top: 32px; padding-top: 20px; border-top: 1px solid var(--border);">
      <h3 style="margin: 0 0 12px 0; color: var(--text-main); font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
        <i data-lucide="history" style="width: 16px; height: 16px;"></i> ${isAdmin ? 'All Bulk Stock Upload History' : 'My Bulk Stock Upload History'}
      </h3>
      <div id="supervisorHistoryList"></div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  // Populate Admin pending list
  if (isAdmin) {
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
  }

  // Populate Supervisor & Admin History
  const historySection = container.querySelector('#supervisorHistoryList');
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

      const historyRows = filteredHistory.map(r => {
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
      });

      historySection.innerHTML = tableMarkup(
        ['Submitted (IST)', 'Batch ID', 'Supervisor', 'Outlets', 'Rows', 'Total Value', 'Status', 'Admin Note / Resolution'],
        historyRows,
        true
      );
    }
  }
  if (window.lucide) window.lucide.createIcons();
};


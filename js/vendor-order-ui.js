(() => {
  const e = VendorOrders.escape;
  const modal = () => document.getElementById('modalVendorPO');
  const results = () => document.getElementById('poVendorResults');
  function showOrders(orders) {
    document.getElementById('poVendorEditor').classList.add('hidden');
    document.getElementById('btnConfirmSendPO').classList.add('hidden');
    document.getElementById('poModalCancelBtn').textContent='Close';
    results().classList.remove('hidden');
    results().innerHTML = `<p style="margin-bottom:14px">Saved ${orders.length} separate vendor order${orders.length===1?'':'s'}. Download and share each vendor's own document. Creating orders does not send messages or change stock.</p>` + orders.map(po=>`<section class="panel" style="padding:16px;margin-bottom:12px"><h3>${e(po.vendorName)}</h3><p>${e(po.poNumber)} | ${po.items.length} ingredient${po.items.length===1?'':'s'}</p><ul style="padding-left:20px;margin:12px 0">${po.items.map(i=>`<li>${e(i.itemName)}: ${e(i.qty)} ${e(i.unit)}${i.notes?' - '+e(i.notes):''}</li>`).join('')}</ul><button class="btn btn-primary" data-po-pdf="${e(po.id)}">Download PDF</button> <button class="btn btn-outline" data-po-print="${e(po.id)}">View / Print</button></section>`).join('');
    modal().classList.remove('hidden');
  }
  function open() {
    const indent=indentsData.find(i=>i.id===activeReviewingIndentId);
    if(!indent || currentUser?.role!=='admin')return;
    document.getElementById('poModalRef').textContent=indent.indentNumber || indent.id;
    document.getElementById('poModalOutlet').textContent=indent.outletName;
    const existing=purchaseOrdersData.filter(p=>p.indentId===indent.id);
    if(existing.length){showOrders(existing);return;}
    if(indent.status!=='Pending Approval'){showToast('Only pending consolidated requests can be ordered.','warning');return;}
    document.getElementById('poVendorEditor').classList.remove('hidden');
    document.getElementById('btnConfirmSendPO').classList.remove('hidden');
    document.getElementById('poModalCancelBtn').textContent='Cancel';
    results().classList.add('hidden');results().innerHTML='';
    const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);
    document.getElementById('poDeliveryDate').value=InventoryTools.day(tomorrow);
    const lines=VendorOrders.defaults(indent,masterItemsData,vendorsData);
    document.getElementById('poItemsTableBody').innerHTML=lines.map(i=>`<tr data-po-item="${e(i.itemId)}"><td><strong>${e(i.itemName)}</strong></td><td>${e(i.unit)}</td><td><input aria-label="${e(i.itemName)} quantity" class="po-item-qty" type="number" min="0.00000001" step="any" required value="${e(i.qty)}" style="width:90px"></td><td><select aria-label="${e(i.itemName)} vendor" class="po-item-vendor" required style="min-width:150px"><option value="">Choose vendor</option>${vendorsData.map(v=>`<option value="${e(v.id)}" ${v.id===i.vendorId?'selected':''}>${e(v.name)}</option>`).join('')}</select></td><td><input aria-label="${e(i.itemName)} vendor note" class="po-item-note" maxlength="500" placeholder="For this vendor only" style="min-width:150px"></td></tr>`).join('');
    modal().classList.remove('hidden');
  }
  async function submit() {
    const indent=indentsData.find(i=>i.id===activeReviewingIndentId);
    if(!indent || currentUser?.role!=='admin')return;
    const invalid=document.querySelector('#poVendorEditor input:invalid, #poVendorEditor select:invalid');
    if(invalid){invalid.reportValidity();return;}
    const items=[...document.querySelectorAll('#poItemsTableBody [data-po-item]')].map(row=>({itemId:row.dataset.poItem,vendorId:row.querySelector('.po-item-vendor').value,qty:Number(row.querySelector('.po-item-qty').value),notes:row.querySelector('.po-item-note').value.trim()}));
    if(!items.length){showToast('No positive consolidated quantities to order.','warning');return;}
    const button=document.getElementById('btnConfirmSendPO');button.disabled=true;
    try {
      await runDatabaseAction('purchase-orders/raise',{indentId:indent.id,items,expectedDelivery:document.getElementById('poDeliveryDate').value});
      document.getElementById('modalIndentApproval').classList.add('hidden');
      showOrders(purchaseOrdersData.filter(p=>p.indentId===indent.id));
      loadRequestsData();loadIndentsData();renderVendorPOTable();
    } catch(error) {
      // Keep every entered vendor, quantity and note visible so a retry does not lose edits.
      showUiModal({title:'Orders were not saved',message:error.message,type:'warning'});
    } finally {button.disabled=false;}
  }
  function order(id){return purchaseOrdersData.find(p=>p.id===id);}
  function print(id) {
    const po=order(id);if(!po)return;
    const preview=window.open('','_blank');
    if(!preview){showToast('Allow pop-ups to view this vendor order.','warning');return;}
    preview.opener=null;
    preview.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${e(po.poNumber)} - ${e(po.vendorName)}</title><style>@page{size:A4;margin:15mm}body{margin:0;background:white}article{width:100%!important}thead{display:table-header-group}tr{break-inside:avoid}@media print{.print-controls{display:none}}</style></head><body><div class="print-controls"><button onclick="window.print()">Print / Save as PDF</button></div>${VendorOrders.documentBody(po)}</body></html>`);
    preview.document.close();
  }
  async function download(id) {
    const po=order(id);if(!po)return;
    if(typeof html2pdf==='undefined'){print(id);return;}
    const host=document.createElement('div');
    host.innerHTML=VendorOrders.documentBody(po);
    // html2pdf creates an isolated rendering container; do not rasterize the whole app.
    try {
      await html2pdf().set({margin:10,filename:`${po.poNumber}-${po.vendorName}`.replace(/[^a-zA-Z0-9._-]/g,'_')+'.pdf',image:{type:'jpeg',quality:.98},html2canvas:{scale:2,backgroundColor:'#ffffff'},jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},pagebreak:{mode:['css','legacy'],avoid:'tr'}}).from(host.firstElementChild).save();
    } catch(error){showUiModal({title:'PDF could not be downloaded',message:'Use View / Print to save this vendor order as a PDF.',type:'warning'});}
  }
  document.addEventListener('click',event=>{
    const pdf=event.target.closest('[data-po-pdf]'), preview=event.target.closest('[data-po-print]');
    if(pdf)download(pdf.dataset.poPdf);if(preview)print(preview.dataset.poPrint);
  });
  window.VendorOrderUI={open,submit,download,print};
})();

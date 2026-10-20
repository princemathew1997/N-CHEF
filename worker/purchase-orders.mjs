import { money, lineCost } from './operations.mjs';
import { fail, number, safeText, hasOutlet } from './model.mjs';

// Derive all supplier orders and their workflow links on the server, then persist as one batch.
export function raiseVendorOrders(state, actor, input) {
  if (!['admin','purchaser'].includes(actor.role)) fail('Only admins can raise purchase orders.', 403);
  const indent = state.indents.find(i => i.id === input.indentId);
  if (indent && !hasOutlet(actor,indent.outletId)) fail('Outlet access denied.',403);
  if (!indent) fail('Consolidated request not found.', 404);
  if (!['Pending Approval','Approved'].includes(indent.status) || state.purchase_orders.some(p => p.indentId === indent.id)) fail('Orders have already been raised or this request is completed.', 409);
  if (!Array.isArray(input.items) || !input.items.length || input.items.length > indent.items.length) fail('Choose at least one consolidated ingredient.');
  const delivery = input.expectedDelivery || '';
  if (delivery && (!/^\d{4}-\d{2}-\d{2}$/.test(delivery) || !Number.isFinite(Date.parse(delivery)) || new Date(delivery).toISOString().slice(0, 10) !== delivery)) fail('Choose a valid delivery date.');
  const groups = new Map(), seen = new Set();
  for (const line of input.items) {
    const source = indent.items.find(i => i.itemId === line.itemId);
    const item = state.items.find(i => i.id === line.itemId);
    const vendor = state.vendors.find(v => v.id === line.vendorId);
    if (!source || !item || item.active === false || seen.has(line.itemId)) fail('Choose unique active ingredients from this consolidated request.');
    if (!vendor) fail('Choose an available vendor for every item.');
    seen.add(line.itemId);
    const qty = number(line.qty, 'Order quantity', true);
    const notes = line.notes?.trim() || '';
    if (notes) safeText(notes, 'Vendor item note', 500);
    if (!groups.has(vendor.id)) groups.set(vendor.id, {vendor, items:[]});
    groups.get(vendor.id).items.push({itemId:item.id, itemName:item.name, unit:item.unit, category:item.category, qty, notes});
  }
  if (indent.items.some(i=>(i.revisedQty ?? i.originalQty)>0 && !seen.has(i.itemId))) fail('Assign a vendor to every consolidated ingredient.');
  const createdAt = new Date().toISOString();
  const date = new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Kolkata', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date(createdAt));
  const orders = [...groups.values()].map(({vendor, items}) => {
    const orderId = crypto.randomUUID();
    return {id:orderId, poNumber:'PO-'+date.replaceAll('-','')+'-'+orderId.replaceAll('-','').slice(0,12).toUpperCase(), date, createdAt,
      indentId:indent.id, indentNumber:indent.indentNumber, outletId:indent.outletId,
      outletName:state.outlets.find(o=>o.id===indent.outletId)?.name || indent.outletName,
      vendorId:vendor.id, vendorName:vendor.name, items, expectedDelivery:delivery, status:'PO Raised', ownerId:actor.id, raisedBy:actor.name};
  });
  const valueChange = (entity, value) => ({entity, key:value.id, value});
  // Do not add a vendor or a single PO number to a multi-vendor parent record.
  const changes = [valueChange('indents', {...indent, status:indent.status==='Approved'?'Approved':`PO Raised (${orders.length} vendor${orders.length===1?'':'s'})`, purchaseOrderIds:orders.map(p=>p.id)})];
  for (const request of state.requests.filter(r=>r.indentId===indent.id)) {
    const matching = orders.filter(p=>p.items.some(i=>i.itemId===request.itemId));
    changes.push(valueChange('requests', {...request, status:request.status==='Approved'?'Approved':'PO Raised', purchaseOrderIds:matching.map(p=>p.id)}));
  }
  return [...changes, ...orders.map(p=>valueChange('purchase_orders',p))];
}

export function planVendorReceipt(state,actor,input){
  if(!['admin','purchaser'].includes(actor.role))fail('Purchaser permission required.',403);
  const source=state.purchase_orders.find(p=>p.id===input.poId);
  if(!source || !hasOutlet(actor,source.outletId))fail('Purchase order access denied.',403);
  if(source.status==='Received')fail('This order has already been received.',409);
  const po=structuredClone(source),seen=new Set(),receipts=[],events=[];
  const rows=input.lines ?? po.items.filter(i=>i.qty>(i.receivedQty || 0)).map(i=>({itemId:i.itemId,receivedQuantity:i.qty-(i.receivedQty || 0),rejectedQuantity:0,unitPrice:input.prices?.[i.itemId]}));
  if(!Array.isArray(rows) || !rows.length || rows.length>po.items.length)fail('Enter received quantities for this order.');
  for(const row of rows){
    const line=po.items.find(i=>i.itemId===row.itemId);
    if(!line || seen.has(row.itemId))fail('Choose unique items from this purchase order.');seen.add(row.itemId);
    const received=number(row.receivedQuantity,'Received quantity'),rejected=number(row.rejectedQuantity ?? 0,'Rejected quantity');
    if(received+rejected>line.qty-(line.receivedQty || 0)+1e-8)fail('Received plus rejected quantity exceeds the outstanding order.');
    if(received===0 && rejected===0)continue;
    if(rejected){if(!['Quality issues','Damaged goods','Wrong item','Other'].includes(row.reason))fail('Choose a reason for rejected goods.');if(row.reason==='Other' || row.message)safeText(row.message,'Rejection note',500);}
    const accepted=received,unitCostMinor=accepted?money(row.unitPrice):null;
    if(accepted)receipts.push({itemId:line.itemId,outletId:po.outletId,quantity:accepted,unitPrice:row.unitPrice,vendor:state.vendors.find(v=>v.id===po.vendorId)?.name,reason:'Vendor order '+po.poNumber});
    line.receivedQty=(line.receivedQty || 0)+accepted;line.rejectedQty=(line.rejectedQty || 0)+rejected;
    events.push({itemId:line.itemId,itemName:line.itemName,receivedQuantity:received+rejected,acceptedQuantity:accepted,rejectedQuantity:rejected,unitCostMinor,totalCostMinor:accepted?lineCost(accepted,unitCostMinor):0,reason:rejected?row.reason:'',message:rejected?(row.message || ''):''});
  }
  if(!events.length)fail('Enter at least one received or rejected quantity.');
  const event={id:crypto.randomUUID(),receivedAt:new Date().toISOString(),receivedBy:actor.id,lines:events};
  po.receiptEvents=[...(po.receiptEvents || []),event];po.status=po.items.every(i=>(i.receivedQty || 0)>=i.qty-1e-8)?'Received':'Partially Received';po.receivedBy=actor.name;po.receivedAt=event.receivedAt;
  return {po,receipts,event};
}

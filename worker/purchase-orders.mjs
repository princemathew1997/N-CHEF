import { fail, number, safeText } from './model.mjs';

// Derive all supplier orders and their workflow links on the server, then persist as one batch.
export function raiseVendorOrders(state, actor, input) {
  if (actor.role !== 'admin') fail('Only admins can raise purchase orders.', 403);
  const indent = state.indents.find(i => i.id === input.indentId);
  if (!indent) fail('Consolidated request not found.', 404);
  if (indent.status !== 'Pending Approval' || state.purchase_orders.some(p => p.indentId === indent.id)) fail('Orders have already been raised or this request is completed.', 409);
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
  const changes = [valueChange('indents', {...indent, status:`PO Raised (${orders.length} vendor${orders.length===1?'':'s'})`, purchaseOrderIds:orders.map(p=>p.id)})];
  for (const request of state.requests.filter(r=>r.indentId===indent.id)) {
    const matching = orders.filter(p=>p.items.some(i=>i.itemId===request.itemId));
    changes.push(valueChange('requests', {...request, status:'PO Raised', purchaseOrderIds:matching.map(p=>p.id)}));
  }
  return [...changes, ...orders.map(p=>valueChange('purchase_orders',p))];
}

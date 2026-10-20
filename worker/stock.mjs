import { canPurchase, money, lineCost } from './operations.mjs';
import { clone, fail, hasOutlet, number, safeText } from './model.mjs';

export function stockCommand(state, actor, input, kind, internal = false) {
  if(!internal && (input.replacementFor || kind==='return'))fail('Use delivery resolution for replacements and returns.',403);
  if (!canPurchase(actor)) fail('Stock management permission required.', 403);
  if (kind === 'reconcile') {
    if (actor.role !== 'admin') fail('Only admins can reconcile legacy stock.',403);
    safeText(input.reason,'Reconciliation reason',500);
    const item = state.items.find(i=>i.id===input.itemId);
    const legacyStock = clone(state.legacyStock);
    const legacy = legacyStock.find(s=>s.item_id===input.itemId);
    if (!item || !legacy || !legacy.issue) fail('Choose an inconsistent legacy balance.');
    const quantity = number(input.quantity,'Verified unassigned quantity');
    const delta = quantity-legacy.quantity; legacy.quantity=quantity;legacy.issue='';
    return {outletStock:clone(state.outletStock),legacyStock,movements:[{item_id:item.id,outlet_id:null,delta,quantity,kind,reason:input.reason,cuisine:'',vendor:'',item_name:item.name,unit:item.unit,actor_id:actor.id,actor_name:actor.name}]};
  }
  if (!state.outlets.some(o => o.id === input.outletId) || !hasOutlet(actor, input.outletId)) fail('Outlet access denied.', 403);
  const item = state.items.find(i => i.id === input.itemId);
  if (!item) fail('Item does not exist.', 404);
  if (item.active === false && ['receipt', 'distribute','opening'].includes(kind)) fail('Choose an active catalog item.');
  const stock = clone(state.outletStock || []);
  let balance = stock.find(s => s.item_id === item.id && s.outlet_id === input.outletId);
  if (!balance) { balance = { item_id: item.id, outlet_id: input.outletId, quantity: 0 }; stock.push(balance); }
  let delta;
  const deliveries=[];
  let unitCostMinor=balance.unit_cost_minor ?? null;
  if(kind==='receipt')unitCostMinor=money(input.unitPrice);
  if(kind==='opening' && input.unitPrice!==undefined)unitCostMinor=money(input.unitPrice);
  const legacy = clone(state.legacyStock || []);
  if (kind === 'adjust') {
    safeText(input.reason, 'Adjustment reason', 500);
    delta = number(input.quantity, 'Actual on-hand quantity') - balance.quantity;
  } else {
    delta = number(input.quantity, 'Quantity', true);
    if (kind === 'distribute') {
      if (!state.cuisines.some(c => c.name === input.cuisine)) fail('Choose a valid cuisine.');
      let request=null;
      if(input.requestId) {
        request=state.requests.find(r=>r.id===input.requestId && r.itemId===item.id && r.outletId===input.outletId && r.cuisine===input.cuisine && r.status==='Approved');
        if(!request)fail('Choose an approved request for this item and cuisine.');
        if(!input.replacementFor){const issued=(request.legacyIssuedQuantity || 0)+(state.operationRecords || []).filter(r=>r.kind==='delivery' && r.requestId===request.id && !r.replacementFor).reduce((sum,r)=>sum+r.quantity,0);if(issued+delta>(request.approvedQuantity ?? request.revisedQty ?? request.qty)+1e-8)fail('Distribution exceeds the remaining approved quantity.',409);}
      } else if((state.requests || []).some(r=>r.itemId===item.id && r.outletId===input.outletId && r.cuisine===input.cuisine && r.status==='Approved'))fail('Link this distribution to an approved request.');
      const recipientId=request?.ownerId || input.recipientId || null;
      deliveries.push({id:crypto.randomUUID(),itemId:item.id,itemName:item.name,unit:item.unit,outletId:input.outletId,cuisine:input.cuisine,quantity:delta,requestId:request?.id || null,issueComment:input.reason || '',recipientId,replacementFor:input.replacementFor || null,unitCostMinor,status:'Issued',issuedBy:actor.id,createdAt:new Date().toISOString()});
      delta = -delta;
    } else if (kind === 'receipt') {
      if (!state.vendors.some(v => v.name === input.vendor)) fail('Choose an existing vendor.');
    } else if(kind==='opening') {
      // Opening stock is ordinary outlet inventory; its origin is the vendor label.
    } else if (kind === 'return') {
      if(!input.deliveryId)fail('Return requires a delivery.');
    } else if (kind === 'assign') {
      if (actor.role !== 'admin') fail('Only admins can assign legacy stock.', 403);
      const remaining = legacy.find(s => s.item_id === item.id);
      if (!remaining || remaining.issue || remaining.quantity < delta) fail('Insufficient or inconsistent unassigned legacy stock.', 409);
      remaining.quantity -= delta;
    } else fail('Unknown stock action.');
  }
  const quantity = balance.quantity + delta;
  if (quantity < -1e-8) fail(`Insufficient outlet stock for ${item.name}.`, 409);
  balance.quantity = Math.max(0, quantity);
  if(kind==='receipt' || (kind==='opening' && balance.unit_cost_minor==null))balance.unit_cost_minor=unitCostMinor;
  if (input.reason) safeText(input.reason, 'Reason', 500);
  const movement = { item_id: item.id, outlet_id: input.outletId, delta, quantity: balance.quantity, kind, reason: input.reason || '', cuisine: kind === 'distribute' ? input.cuisine : '', vendor: kind==='opening' || kind==='assign'?'Legacy Stock':kind === 'receipt' ? input.vendor : '', item_name: item.name, unit: item.unit, actor_id: actor.id, actor_name: actor.name, unit_cost_minor:unitCostMinor,total_cost_minor:unitCostMinor===null?null:lineCost(Math.abs(delta),unitCostMinor),delivery_id:deliveries[0]?.id || input.deliveryId || null };
  return { outletStock: stock, legacyStock: legacy, movements: [movement], deliveries };
}

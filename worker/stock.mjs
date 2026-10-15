import { clone, fail, hasOutlet, number, safeText } from './model.mjs';

export function stockCommand(state, actor, input, kind) {
  if (!['admin', 'supervisor'].includes(actor.role)) fail('Stock management permission required.', 403);
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
  if (['receipt','distribute'].includes(kind) && state.legacyStock?.find(s => s.item_id === item.id)?.issue) fail('Reconcile inconsistent legacy stock before using this item.',409);
  if (item.active === false && ['receipt', 'distribute'].includes(kind)) fail('Choose an active catalog item.');
  const stock = clone(state.outletStock || []);
  let balance = stock.find(s => s.item_id === item.id && s.outlet_id === input.outletId);
  if (!balance) { balance = { item_id: item.id, outlet_id: input.outletId, quantity: 0 }; stock.push(balance); }
  let delta;
  const legacy = clone(state.legacyStock || []);
  if (kind === 'adjust') {
    safeText(input.reason, 'Adjustment reason', 500);
    delta = number(input.quantity, 'Actual on-hand quantity') - balance.quantity;
  } else {
    delta = number(input.quantity, 'Quantity', true);
    if (kind === 'distribute') {
      if (!state.cuisines.some(c => c.name === input.cuisine) && !['Supervisor Extra', 'Store Stock'].includes(input.cuisine)) fail('Choose a valid cuisine.');
      delta = -delta;
    } else if (kind === 'receipt') {
      if (!state.vendors.some(v => v.name === input.vendor)) fail('Choose an existing vendor.');
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
  if (input.reason) safeText(input.reason, 'Reason', 500);
  const movement = { item_id: item.id, outlet_id: input.outletId, delta, quantity: balance.quantity, kind, reason: input.reason || '', cuisine: kind === 'distribute' ? input.cuisine : '', vendor: kind === 'receipt' ? input.vendor : '', item_name: item.name, unit: item.unit, actor_id: actor.id, actor_name: actor.name };
  return { outletStock: stock, legacyStock: legacy, movements: [movement] };
}

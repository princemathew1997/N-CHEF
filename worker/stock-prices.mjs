import {clone, fail, hasOutlet, id, safeText} from './model.mjs';
import {canPurchase, money, lineCost} from './operations.mjs';

export const stockPriceEditingEnabled = env => env.NCHEF_STOCK_PRICE_EDITING !== 'disabled';

export function setAvailableStockPrice(state, actor, input) {
  if (!canPurchase(actor)) fail('Only Admin and Purchaser (Supervisor) can edit stock prices.',403);
  id(input.itemId); id(input.outletId);
  if (!hasOutlet(actor,input.outletId) || !state.outlets.some(o=>o.id===input.outletId)) fail('Outlet access denied.',403);
  const item=state.items.find(i=>i.id===input.itemId);
  if (!item) fail('Item not found.',404);
  const outletStock=clone(state.outletStock || []);
  let balance=outletStock.find(b=>b.item_id===item.id && b.outlet_id===input.outletId);
  if (!balance) {
    balance={item_id:item.id,outlet_id:input.outletId,quantity:0,unit_cost_minor:null};
    outletStock.push(balance);
  }
  const previousUnitCostMinor=balance.unit_cost_minor ?? null;
  if (input.expectedQuantity!==balance.quantity || input.expectedUnitCostMinor!==previousUnitCostMinor) fail('Stock or price changed. Reopen the item and try again.',409);
  safeText(input.reason,'Price change reason',500);
  const unitCostMinor=money(input.unitPrice);
  const stockValueMinor=lineCost(balance.quantity,unitCostMinor);
  balance.unit_cost_minor=unitCostMinor;
  return {outletStock,legacyStock:clone(state.legacyStock),
    stockPriceUpdates:[{itemId:item.id,outletId:input.outletId,quantity:balance.quantity,previousUnitCostMinor,unitCostMinor,stockValueMinor,reason:input.reason}],
    movements:[{item_id:item.id,outlet_id:input.outletId,delta:0,quantity:balance.quantity,kind:'price',reason:input.reason,cuisine:'',vendor:'',item_name:item.name,unit:item.unit,unit_cost_minor:unitCostMinor,total_cost_minor:0}]
  };
}

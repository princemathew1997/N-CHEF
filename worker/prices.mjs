import {clone, fail, hasOutlet, id, safeText} from './model.mjs';
import {canPurchase, dayIST, money, lineCost} from './operations.mjs';
import {dateRange} from './queues.mjs';

export async function correctStockPrice(db, state, actor, input) {
  if (!canPurchase(actor)) fail('Only Admin and Purchaser (Supervisor) can edit prices.',403);
  id(input.historyId);
  safeText(input.reason,'Price correction reason',500);
  const unitCostMinor=money(input.unitPrice);
  const movement=await db.prepare('SELECT * FROM outlet_stock_history WHERE id=?').bind(input.historyId).first();
  if (!movement) fail('Stock entry not found.',404);
  if (!hasOutlet(actor,movement.outlet_id)) fail('Outlet access denied.',403);
  if (!['receipt','opening'].includes(movement.kind) || movement.delta<=0) fail('Only received or opening stock prices can be edited.');
  if (input.expectedUnitCostMinor!==movement.unit_cost_minor) fail('This price changed. Refresh and try again.',409);
  const totalCostMinor=lineCost(movement.delta,unitCostMinor);
  const outletStock=clone(state.outletStock);
  // Receipts and manual stock prices set valuation; opening stock initializes it.
  const source=await db.prepare(`SELECT id FROM outlet_stock_history WHERE item_id=? AND outlet_id=?
    AND (kind IN ('receipt','price') OR (kind='opening' AND (unit_cost_minor IS NOT NULL OR id=?)))
    ORDER BY CASE WHEN kind IN ('receipt','price') THEN 0 ELSE 1 END, CASE WHEN kind IN ('receipt','price') THEN -rowid ELSE rowid END LIMIT 1`)
    .bind(movement.item_id,movement.outlet_id,movement.id).first();
  if (source?.id===movement.id) {
    const balance=outletStock.find(b=>b.item_id===movement.item_id && b.outlet_id===movement.outlet_id);
    if (balance) balance.unit_cost_minor=unitCostMinor;
  }
  return {outletStock,legacyStock:clone(state.legacyStock),movements:[],priceCorrections:[{
    id:movement.id,unitCostMinor,totalCostMinor,reason:input.reason,
    previousUnitCostMinor:movement.unit_cost_minor,previousTotalCostMinor:movement.total_cost_minor
  }]};
}

// Prices are receipt facts, never the mutable latest stock valuation.
export async function priceHistory(db, actor, query, detail = false) {
  if (!canPurchase(actor)) fail('Purchaser permission required.', 403);
  query = new URLSearchParams(query);
  const today = dayIST();
  if (!query.get('to')) query.set('to', today);
  if (!query.get('from')) query.set('from', dayIST(new Date(Date.parse(today+'T00:00:00+05:30')-89*86400000).toISOString()));
  const dates = dateRange(query);
  const clauses = ["h.kind='receipt'", 'h.delta>0', 'h.unit_cost_minor IS NOT NULL', 'h.created_at>=?', 'h.created_at<?'];
  const values = [dates.start, dates.end];
  const outlet = query.get('outlet');
  if (outlet && !hasOutlet(actor, outlet)) fail('Outlet access denied.', 403);
  if (outlet) { clauses.push('h.outlet_id=?'); values.push(outlet); }
  else if (actor.role !== 'admin' && !actor.assignedLocations?.includes('all')) {
    const ids = actor.assignedLocations || [];
    clauses.push(ids.length ? `h.outlet_id IN (${ids.map(()=>'?').join(',')})` : '0'); values.push(...ids);
  }
  if (query.get('vendor')) { clauses.push('h.vendor=?'); values.push(query.get('vendor')); }
  const itemClauses = [], itemValues = [];
  for (const [key, col] of [['item','id'], ['category','category']]) if(query.get(key)) {
    itemClauses.push(`i.${col}=?`); itemValues.push(query.get(key));
  }
  const catalog = `SELECT i.id,i.name,i.category,i.unit FROM items i ${itemClauses.length?'WHERE '+itemClauses.join(' AND '):''}`;
  const cte = `WITH catalog AS (${catalog}), receipts AS (
    SELECT h.*,row_number() OVER (PARTITION BY h.item_id ORDER BY h.created_at DESC,h.id DESC) rank
    FROM outlet_stock_history h JOIN catalog i ON i.id=h.item_id WHERE ${clauses.join(' AND ')}
  ) `;
  const params = [...itemValues,...values];
  const run = (sql, extra=[]) => db.prepare(cte+sql).bind(...params,...extra).all();
  const summary = await run(`SELECT i.*,count(r.id) receiptCount,
    max(CASE WHEN rank=1 THEN unit_cost_minor END) latestPriceMinor,
    max(CASE WHEN rank=1 THEN created_at END) latestAt,
    max(CASE WHEN rank=2 THEN unit_cost_minor END) previousPriceMinor,
    min(unit_cost_minor) minPriceMinor,max(unit_cost_minor) maxPriceMinor,
    CAST(round(sum(delta*unit_cost_minor)/sum(delta)) AS INTEGER) averagePriceMinor
    FROM catalog i LEFT JOIN receipts r ON r.item_id=i.id GROUP BY i.id ORDER BY i.name,i.id`);
  const items = summary.results.map(row=>({...row,changePercent:row.previousPriceMinor>0 ? (row.latestPriceMinor-row.previousPriceMinor)/row.previousPriceMinor*100 : null}));
  if (!detail) return {items,from:dates.from,to:dates.to};
  if (!query.get('item')) fail('Choose an item.');
  if (!items.length) fail('Item not found.',404);
  const limit = Number(query.get('limit') || 25);
  if (!Number.isInteger(limit) || limit<1 || limit>100) fail('Page size must be between 1 and 100.');
  let cursor;
  if (query.get('cursor')) {
    try { cursor=JSON.parse(atob(query.get('cursor'))); if(!Array.isArray(cursor) || cursor.length!==2 || cursor.some(v=>typeof v!=='string' || v.length>100)) throw Error(); }
    catch { fail('Invalid price history cursor.'); }
  }
  const [daily, receipts] = await Promise.all([
    run(`SELECT date(created_at,'+5 hours','+30 minutes') day,outlet_id outletId,vendor,
      CAST(round(sum(delta*unit_cost_minor)/sum(delta)) AS INTEGER) priceMinor,sum(delta) quantity
      FROM receipts GROUP BY day,outlet_id,vendor ORDER BY day,outlet_id,vendor`),
    run(`SELECT id,created_at,outlet_id,vendor,delta,unit_cost_minor,total_cost_minor,unit FROM receipts
      ${cursor?'WHERE (created_at,id)<(?,?)':''} ORDER BY created_at DESC,id DESC LIMIT ?`,[...(cursor || []),limit+1])
  ]);
  const rows=receipts.results.slice(0,limit), last=rows.at(-1);
  return {item:items[0],daily:daily.results,rows,nextCursor:receipts.results.length>limit?btoa(JSON.stringify([last.created_at,last.id])):null,from:dates.from,to:dates.to};
}

import {fail,hasOutlet} from './model.mjs';
import {dayIST} from './operations.mjs';

const parameters=query=>query instanceof URLSearchParams?query:new URLSearchParams(query);
export function dateRange(query,defaultToday=false){
  const from=query.get('from') || (defaultToday?dayIST():''),to=query.get('to') || (defaultToday?dayIST():'');
  for(const date of [from,to])if(date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || dayIST(date+'T00:00:00+05:30')!==date))fail('Choose valid IST dates.');
  if(from && to && from>to)fail('From date must be on or before To date.');
  return {from,to,start:from?new Date(from+'T00:00:00+05:30').toISOString():null,end:to?new Date(Date.parse(to+'T00:00:00+05:30')+86400000).toISOString():null};
}
function scope(actor,query,delivery=false){
  const clauses=[],values=[];
  const outlet=query.get('outlet');
  if(outlet && !hasOutlet(actor,outlet))fail('Outlet access denied.',403);
  const col=delivery?'delivery_outlet':'outlet_id';
  if(outlet){clauses.push(`${col}=?`);values.push(outlet);}
  else if(actor.role!=='admin' && !actor.assignedLocations?.includes('all')){
    const ids=actor.assignedLocations || [];clauses.push(ids.length?`${col} IN (${ids.map(()=>'?').join(',')})`:'0');values.push(...ids);
  }
  if(delivery){
    clauses.push("kind='delivery'");
    if(actor.role==='cuisine_head'){
      const sections=actor.assignedSections || actor.assignedCuisines || [];
      clauses.push(sections.length?`delivery_cuisine IN (${sections.map(()=>'?').join(',')})`:'0');values.push(...sections);
      clauses.push('(delivery_recipient IS NULL OR delivery_recipient=?)');values.push(actor.id);
    }
    if(query.get('cuisine')){clauses.push('delivery_cuisine=?');values.push(query.get('cuisine'));}
  }else if(actor.role==='cuisine_head')fail('Stock history access denied.',403);
  return {clauses,values};
}
function pageOptions(query){
  const limit=Number(query.get('limit') || 25);if(!Number.isInteger(limit) || limit<1 || limit>100)fail('Page size must be between 1 and 100.');
  let cursor=null;
  if(query.get('cursor')){try{cursor=JSON.parse(decodeURIComponent(atob(query.get('cursor'))));if(!Array.isArray(cursor) || ![2,3].includes(cursor.length) || cursor.slice(0,2).some(v=>typeof v!=='string' || v.length>500) || (cursor.length===3 && ![0,1].includes(cursor[2])))throw Error();}catch{fail('Invalid page cursor.');}}
  return {limit,cursor};
}
const statement=(db,sql,values=[])=>db.prepare(sql).bind(...values);
const page=(rows,limit)=>({rows:rows.slice(0,limit),nextCursor:rows.length>limit?btoa(encodeURIComponent(JSON.stringify([rows[limit-1].sort_time,rows[limit-1].page_id,...(rows[limit-1].priority!==undefined?[rows[limit-1].priority]:[])]))):null});

export async function deliveryCounts(db,actor){
  const {clauses,values}=scope(actor,new URLSearchParams(),true),today=dateRange(new URLSearchParams(),true);
  const result=await statement(db,`SELECT coalesce(sum(delivery_status='Issued'),0) awaiting,coalesce(sum(delivery_status='Issue reported'),0) issues,
    coalesce(sum(delivery_status IN ('Received','Resolved') AND coalesce(json_extract(payload_json,'$.resolvedAt'),json_extract(payload_json,'$.confirmedAt'))>=? AND coalesce(json_extract(payload_json,'$.resolvedAt'),json_extract(payload_json,'$.confirmedAt'))<?),0) completedToday
    FROM operation_records WHERE ${clauses.join(' AND ')}`,[today.start,today.end,...values]).first();
  return result;
}

export async function dispatchList(db,actor,input){
  const query=parameters(input),{clauses,values}=scope(actor,query,true),{limit,cursor}=pageOptions(query);
  const view=query.get('view') || 'attention';if(!['attention','today','history'].includes(view))fail('Invalid delivery view.');
  // Search selects dispatches, not a subset of their lines: acceptance always refers to the whole card.
  for(const [key,expression] of [['item',"json_extract(payload_json,'$.itemId')"],['order',"coalesce(json_extract(payload_json,'$.orderRef'),json_extract(payload_json,'$.indentId'),'')"]]){
    if(query.get(key)){
      const inner=scope(actor,query,true);
      clauses.push(`delivery_dispatch IN (SELECT delivery_dispatch FROM operation_records WHERE ${inner.clauses.join(' AND ')} AND ${expression}${key==='order'?' LIKE ?':'=?'})`);
      values.push(...inner.values,key==='order'?'%'+query.get(key)+'%':query.get(key));
    }
  }
  const dates=dateRange(query,view==='today');
  const having=[];
  if(dates.start){having.push('min(delivery_created)>=?');values.push(dates.start);}if(dates.end){having.push('min(delivery_created)<?');values.push(dates.end);}
  if(view==='attention')having.push("sum(delivery_status IN ('Issued','Issue reported'))>0");
  if(view==='history')having.push("sum(delivery_status IN ('Issued','Issue reported'))=0");
  const status=query.get('status');
  if(status){if(!['Issued','Issue reported','Received','Resolved'].includes(status))fail('Invalid delivery status.');having.push('sum(delivery_status=?)>0');values.push(status);}
  const grouped=`SELECT delivery_dispatch dispatchId,delivery_dispatch page_id,max(delivery_created) sort_time,min(delivery_created) createdAt,
    ${view==='attention' && actor.role!=='cuisine_head'?"max(delivery_status='Issue reported')":'0'} priority,
    delivery_outlet outletId,delivery_cuisine cuisine,delivery_recipient recipientId,
    count(*) itemCount,sum(delivery_status='Issued') awaiting,sum(delivery_status='Issue reported') issues,
    min(json_extract(payload_json,'$.issuedBy')) issuedBy,min(json_extract(payload_json,'$.issuedByName')) issuedByName,min(json_extract(payload_json,'$.orderRef')) orderRef,
    min(json_extract(payload_json,'$.indentId')) indentId,max(json_extract(payload_json,'$.earlierDelivery') IS NOT NULL OR json_extract(payload_json,'$.dispatchId') IS NULL) earlierDelivery
    FROM operation_records WHERE ${clauses.join(' AND ')} GROUP BY delivery_dispatch,delivery_outlet,delivery_cuisine,delivery_recipient ${having.length?'HAVING '+having.join(' AND '):''}`;
  const rows=await statement(db,`SELECT * FROM (${grouped}) ${cursor?'WHERE (priority,sort_time,page_id)<(?,?,?)':''} ORDER BY priority DESC,sort_time DESC,page_id DESC LIMIT ?`,[...values,...(cursor?[cursor[2] || 0,cursor[0],cursor[1]]:[]),limit+1]).all();
  const result=page(rows.results,limit);
  const people=(await db.prepare('SELECT id,name FROM users WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(result.rows.flatMap(row=>[row.issuedBy,row.recipientId]).filter(Boolean))).all()).results;
  result.rows=result.rows.map(row=>({...row,issuedByName:row.issuedByName || people.find(user=>user.id===row.issuedBy)?.name || 'Earlier account',recipientName:people.find(user=>user.id===row.recipientId)?.name || null}));
  return {...result,counts:await deliveryCounts(db,actor)};
}

export async function dispatchItems(db,actor,input){
  const query=parameters(input),{clauses,values}=scope(actor,query,true),{limit,cursor}=pageOptions(query);
  if(cursor && cursor.length!==2)fail('Invalid item page cursor.');
  if(!query.get('dispatch'))fail('Choose a dispatch.');
  clauses.push('delivery_dispatch=?');values.push(query.get('dispatch'));
  if(cursor){clauses.push('(delivery_created,id)<(?,?)');values.push(...cursor);}
  const rows=await statement(db,`SELECT payload_json,delivery_created sort_time,id page_id FROM operation_records WHERE ${clauses.join(' AND ')} ORDER BY delivery_created DESC,id DESC LIMIT ?`,[...values,limit+1]).all();
  const result=page(rows.results,limit);
  result.rows=result.rows.map(row=>({...JSON.parse(row.payload_json),dispatchId:query.get('dispatch')}));return result;
}

export async function stockHistoryPage(db,actor,input){
  const query=parameters(input),{clauses,values}=scope(actor,query),{limit,cursor}=pageOptions(query),dates=dateRange(query,!query.get('allDates') && !query.get('delivery'));
  if(cursor && cursor.length!==2)fail('Invalid movement page cursor.');
  for(const [key,col] of [['item','item_id'],['vendor','vendor'],['type','kind'],['person','actor_id'],['delivery','delivery_id']])if(query.get(key)){clauses.push(`${col}=?`);values.push(query.get(key));}
  if(dates.start){clauses.push('created_at>=?');values.push(dates.start);}if(dates.end){clauses.push('created_at<?');values.push(dates.end);}
  const totals=await statement(db,`SELECT count(*) count,coalesce(sum(total_cost_minor),0) totalCostMinor,coalesce(sum(total_cost_minor IS NULL),0) unknownCosts FROM outlet_stock_history WHERE ${clauses.length?clauses.join(' AND '):'1'}`,values).first();
  if(cursor){clauses.push('(created_at,id)<(?,?)');values.push(...cursor);}
  const rows=await statement(db,`SELECT *,created_at sort_time,id page_id FROM outlet_stock_history WHERE ${clauses.length?clauses.join(' AND '):'1'} ORDER BY created_at DESC,id DESC LIMIT ?`,[...values,limit+1]).all();return {...page(rows.results,limit),totals};
}

export async function stockReport(db,actor,input){
  if(actor.role==='cuisine_head')fail('Stock report access denied.',403);
  const query=parameters(input),outlet=query.get('outlet');if(!outlet || !hasOutlet(actor,outlet))fail('Choose an assigned outlet.',403);
  const dates=dateRange(query,true),filter=query.get('item'),category=query.get('category');
  const items=(await db.prepare('SELECT payload_json FROM items WHERE active=1').all()).results.map(r=>JSON.parse(r.payload_json)).filter(i=>(!filter || i.id===filter) && (!category || i.category===category));
  const movements=(await statement(db,`SELECT item_id,kind,cuisine,sum(delta) delta,count(*) entries,
    CASE WHEN created_at>=? THEN 'after' ELSE 'period' END bucket FROM outlet_stock_history WHERE outlet_id=? AND created_at>=?
    GROUP BY item_id,kind,cuisine,bucket`,[dates.end,outlet,dates.start]).all()).results;
  const balances=(await statement(db,'SELECT item_id,quantity FROM outlet_stock WHERE outlet_id=?',[outlet]).all()).results;
  const cuisines=[...new Set(movements.filter(r=>r.bucket==='period' && r.kind==='distribute').map(r=>r.cuisine || 'Unspecified'))].sort();
  const rows=items.map(item=>{
    const relevant=movements.filter(m=>m.item_id===item.id),period=relevant.filter(m=>m.bucket==='period');
    const sum=rows=>rows.reduce((n,m)=>n+m.delta,0),remaining=(balances.find(b=>b.item_id===item.id)?.quantity || 0)-sum(relevant.filter(m=>m.bucket==='after'));
    return {item,remaining,opening:remaining-sum(period.filter(m=>m.kind!=='opening')),received:sum(period.filter(m=>['receipt','assign'].includes(m.kind))),adjustments:sum(period.filter(m=>m.kind==='adjust')),usage:Object.fromEntries(cuisines.map(c=>[c,-sum(period.filter(m=>m.kind==='distribute' && (m.cuisine || 'Unspecified')===c))])),activity:period.reduce((n,m)=>n+m.entries,0)};
  }).filter(r=>Math.abs(r.opening)>1e-8 || r.activity || Math.abs(r.remaining)>1e-8);return {rows,cuisines};
}

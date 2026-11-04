import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {priceHistory} from '../worker/prices.mjs';

let mf,db,item;
const admin={role:'admin'}, purchaser={role:'purchaser',assignedLocations:['brigade']};
const range={from:'2026-10-01',to:'2026-10-03'};
async function receipt(id,date,price,quantity=1,extra={}) {
 const row={id,date,price,quantity,outlet:'brigade',vendor:'Vendor A',kind:'receipt',...extra};
 await db.prepare(`INSERT INTO outlet_stock_history(id,operation_id,item_id,outlet_id,delta,quantity,kind,vendor,item_name,unit,actor_name,created_at,unit_cost_minor,total_cost_minor)
 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(row.id,row.id,item,row.outlet,row.quantity,10,row.kind,row.vendor,'Test item','kg','Tester',row.date,row.price,row.price==null?null:Math.round(Math.abs(row.quantity)*row.price)).run();
}
before(async()=>{
 mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("ok")}}',compatibilityDate:'2026-10-14',d1Databases:['DB']}));
 db=await mf.getD1Database('DB');
 for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/--[^\n]*/g,'').replace(/\s+/g,' ').trim());
 item=(await db.prepare('SELECT id FROM items LIMIT 1').first()).id;
 await receipt('before','2026-09-30T18:29:59.000Z',9000);
 await receipt('a','2026-09-30T18:30:00.000Z',100,1);
 await receipt('b','2026-10-01T10:00:00.000Z',300,3);
 await receipt('c','2026-10-02T10:00:00.000Z',0,2);
 await receipt('d','2026-10-03T18:29:59.000Z',200,2);
 await receipt('after','2026-10-03T18:30:00.000Z',9000);
 await receipt('other','2026-10-02T12:00:00.000Z',800,1,{outlet:'cafe',vendor:'Vendor B'});
 await receipt('opening','2026-10-02T12:00:00.000Z',9999,1,{kind:'opening'});
 await receipt('unpriced','2026-10-02T12:00:00.000Z',null);
 await receipt('negative','2026-10-02T12:00:00.000Z',9999,-1);
});
after(async()=>{await mf?.dispose();});
test('receipt prices use IST boundaries, positive priced receipts, and quantity weights',async()=>{
 const result=await priceHistory(db,purchaser,new URLSearchParams(range));
 const summary=result.items.find(i=>i.id===item);
 assert.equal(summary.receiptCount,4);assert.equal(summary.averagePriceMinor,175);
 assert.equal(summary.minPriceMinor,0);assert.equal(summary.maxPriceMinor,300);
 assert.equal(summary.latestPriceMinor,200);assert.equal(summary.previousPriceMinor,0);assert.equal(summary.changePercent,null);
 assert.ok(result.items.some(i=>i.receiptCount===0 && i.latestPriceMinor===null));
 const detail=await priceHistory(db,purchaser,new URLSearchParams({...range,item,limit:'1'}),true);
 assert.equal(detail.rows.length,1);assert.equal(detail.daily.length,3);
 assert.equal(detail.daily[0].day,'2026-10-01');assert.equal(detail.daily[0].priceMinor,250);
 const second=await priceHistory(db,purchaser,new URLSearchParams({...range,item,limit:'1',cursor:detail.nextCursor}),true);
 assert.equal(second.rows[0].id,'c');assert.deepEqual(second.daily,detail.daily);assert.deepEqual(second.item,detail.item);
});
test('vendor and outlet filters apply equally to summaries, daily prices and receipt pages',async()=>{
 const result=await priceHistory(db,admin,new URLSearchParams({...range,item,vendor:'Vendor B'}),true);
 assert.equal(result.item.receiptCount,1);assert.equal(result.item.latestPriceMinor,800);
 assert.equal(result.rows[0].outlet_id,'cafe');assert.equal(result.daily[0].outletId,'cafe');
 const percent=await priceHistory(db,purchaser,new URLSearchParams({...range,item,to:'2026-10-01'}),true);
 assert.equal(percent.item.changePercent,200);
});
test('role, outlet, dates, item and pagination validation',async()=>{
 for(const role of ['cuisine_head','executive_chef'])await assert.rejects(()=>priceHistory(db,{role},new URLSearchParams(range)),e=>e.status===403);
 await assert.rejects(()=>priceHistory(db,purchaser,new URLSearchParams({...range,outlet:'cafe'})),e=>e.status===403);
 await assert.rejects(()=>priceHistory(db,admin,new URLSearchParams({...range,from:'2026-10-04'})),/From date/);
 await assert.rejects(()=>priceHistory(db,admin,new URLSearchParams({...range,item,limit:'0'}),true),/Page size/);
 await assert.rejects(()=>priceHistory(db,admin,new URLSearchParams({...range,item,cursor:'bad'}),true),/cursor/);
 await assert.rejects(()=>priceHistory(db,admin,new URLSearchParams({...range,item:'missing'}),true),e=>e.status===404);
 const empty=await priceHistory(db,{role:'purchaser',assignedLocations:[]},new URLSearchParams(range));
 assert.ok(empty.items.every(i=>i.receiptCount===0));
});

test('equal receipt timestamps have deterministic ordering and no duplicate pages',async()=>{
 await receipt('tie-a','2026-10-03T12:00:00.000Z',400,1,{vendor:'Tie vendor'});
 await receipt('tie-b','2026-10-03T12:00:00.000Z',600,1,{vendor:'Tie vendor'});
 const query={...range,item,vendor:'Tie vendor',limit:'1'};
 const first=await priceHistory(db,purchaser,new URLSearchParams(query),true);
 assert.equal(first.rows[0].id,'tie-b');assert.equal(first.item.latestPriceMinor,600);assert.equal(first.item.previousPriceMinor,400);
 assert.equal(first.item.averagePriceMinor,500);assert.equal(first.item.changePercent,50);
 const second=await priceHistory(db,purchaser,new URLSearchParams({...query,cursor:first.nextCursor}),true);
 assert.equal(second.rows[0].id,'tie-a');assert.equal(second.nextCursor,null);
 assert.deepEqual(first.daily,second.daily);
});

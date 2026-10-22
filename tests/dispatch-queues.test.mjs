import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {build} from 'esbuild';
import {dispatchList,dispatchItems,stockHistoryPage,stockReport} from '../worker/queues.mjs';
import {readClientState} from '../worker/database.mjs';
import {dayIST} from '../worker/operations.mjs';

let mf,db,cookie,headCookie,itemId;
const head={id:'queue_head',name:'Queue Head',username:'queue_head',role:'cuisine_head',assignedLocations:['brigade'],assignedSections:['Indian']};
const purchaser={id:'queue_purchaser',role:'purchaser',assignedLocations:['brigade']};
const now=new Date().toISOString();
async function api(path,method='GET',input,session=cookie){const response=await mf.dispatchFetch('http://localhost/api/'+path,{method,headers:{Origin:'http://localhost','Content-Type':'application/json','X-NCHEF-Workspace':'paged',...(session?{Cookie:session}:{})},body:input?JSON.stringify(input):undefined});return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
async function record(value){await db.prepare('INSERT INTO operation_records(id,kind,payload_json) VALUES (?,?,?)').bind(value.id,value.kind || 'delivery',JSON.stringify(value)).run();}
const delivery=(id,dispatchId,status='Issued',extra={})=>({id,dispatchId,kind:'delivery',itemId,itemName:'Rice',unit:'kg',quantity:2,outletId:'brigade',cuisine:'Indian',recipientId:head.id,status,createdAt:now,issuedBy:'admin',...extra});
before(async()=>{
 const bundle=await build({entryPoints:['worker/index.mjs'],bundle:true,format:'esm',platform:'browser',write:false});
 mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-14',d1Databases:['DB'],bindings:{SETUP_TOKEN:'queue-setup'}}));
 db=await mf.getD1Database('DB');
 for(const file of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+file,'utf8').replace(/--[^\n]*/g,'').replace(/\s+/g,' ').trim());
 assert.equal((await api('setup','POST',{setupToken:'queue-setup',username:'queue_admin',name:'Admin',password:'queue-password'},'')).status,201);
 cookie=(await api('login','POST',{username:'queue_admin',password:'queue-password'},'')).cookie;
 const state=(await api('state')).data;itemId=state.items[0].id;
 const saved=await api('changes','POST',{revision:state.revision,operationId:crypto.randomUUID(),changes:[{entity:'users',key:head.id,value:{...head,password:'queue-password'}}]});assert.equal(saved.status,200,JSON.stringify(saved.data));
 headCookie=(await api('login','POST',{username:head.username,password:'queue-password'},'')).cookie;
});
after(async()=>{await mf?.dispose();});

test('attention includes old unfinished work and dispatch items enforce recipient/outlet scope',async()=>{
 await record(delivery('old','old-dispatch','Issued',{createdAt:'2026-01-01T00:00:00.000Z'}));
 await record(delivery('one','dispatch-one'));await record(delivery('two','dispatch-one','Issue reported',{reason:'Quality issues'}));
 await record(delivery('done','dispatch-done','Received',{confirmedAt:now}));
 await record(delivery('other','other-recipient','Issued',{recipientId:'someone_else'}));
 const result=await dispatchList(db,head,new URLSearchParams());
 assert.ok(result.rows.some(r=>r.dispatchId==='old-dispatch'));assert.equal(result.rows.find(r=>r.dispatchId==='dispatch-one').itemCount,2);
 assert.ok(!result.rows.some(r=>r.dispatchId==='other-recipient' || r.dispatchId==='dispatch-done'));
 assert.equal(result.counts.awaiting,2);assert.equal(result.counts.issues,1);assert.equal(result.counts.completedToday,1);
 assert.equal((await dispatchItems(db,head,{dispatch:'other-recipient'})).rows.length,0);
 await assert.rejects(()=>dispatchList(db,head,{outlet:'cafe'}),/access denied/);
 await assert.rejects(()=>stockHistoryPage(db,head,{}),/access denied/);
});

test('card acceptance preserves issues, rejects cross-dispatch batches and is retry safe',async()=>{
 let state=(await api('state','GET',undefined,headCookie)).data;
 const bad=await api('operations/deliveries/accept-all','POST',{revision:state.revision,operationId:crypto.randomUUID(),dispatchId:'dispatch-one',ids:['old','one']},headCookie);assert.equal(bad.status,409);
 const input={revision:state.revision,operationId:crypto.randomUUID(),dispatchId:'dispatch-one',ids:['one']};
 const result=await api('operations/deliveries/accept-all','POST',input,headCookie);assert.equal(result.status,200,JSON.stringify(result.data));
 assert.equal(result.data.historyPaged,true);assert.equal(result.data.operationRecords.some(r=>r.kind==='delivery'),false);
 const details=await dispatchItems(db,head,{dispatch:'dispatch-one'});assert.equal(details.rows.find(r=>r.id==='one').status,'Received');assert.equal(details.rows.find(r=>r.id==='two').status,'Issue reported');
 assert.equal((await api('operations/deliveries/accept-all','POST',input,headCookie)).status,200);
 const wrong=await api('operations/deliveries/confirm','POST',{revision:result.data.revision,operationId:crypto.randomUUID(),id:'other',receivedQuantity:2},headCookie);assert.equal(wrong.status,403);
});

test('paging is stable across insertion, and filters use valid IST dates',async()=>{
 for(let n=0;n<30;n++)await record(delivery('page-'+String(n).padStart(2,'0'),'page-'+String(n).padStart(2,'0')));
 const first=await dispatchList(db,head,{view:'attention',limit:'25'});assert.equal(first.rows.length,25);assert.ok(first.nextCursor);
 await record(delivery('new','new','Issued',{createdAt:new Date(Date.now()+1000).toISOString()}));
 const second=await dispatchList(db,head,{view:'attention',cursor:first.nextCursor});assert.ok(second.rows.every(r=>!first.rows.some(firstRow=>firstRow.dispatchId===r.dispatchId)));
 await assert.rejects(()=>dispatchList(db,head,{limit:'101'}),/Page size/);
 await assert.rejects(()=>dispatchList(db,head,{from:'2026-02-30'}),/valid IST/);
 await assert.rejects(()=>dispatchList(db,head,{cursor:'bad'}),/cursor/);
 const purchasing=await dispatchList(db,purchaser,{view:'attention',limit:'1'});assert.equal(purchasing.rows[0].dispatchId,'dispatch-one','Issue dispatch is first across the full queue, not only within a page');
 const completed=await dispatchList(db,head,{view:'history'});assert.ok(completed.rows.every(row=>row.awaiting===0 && row.issues===0));
});

test('notification counts and mark-all-read cover records beyond the compact window',async()=>{
 await db.prepare(`WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<300)
 INSERT INTO operation_records(id,kind,payload_json) SELECT 'notice_'||x,'notification',json_object('id','notice_'||x,'userId',?,'message','Delivery alert','read',json('false')) FROM n`).bind(head.id).run();
 await record({id:'other-notice',kind:'notification',userId:'another_head',read:false,message:'Private'});
 const state=(await api('state','GET',undefined,headCookie)).data;assert.equal(state.unreadNotificationCount,300);assert.equal(state.operationRecords.filter(r=>r.kind==='notification').length,200);
 const input={revision:state.revision,operationId:crypto.randomUUID()};
 const result=await api('operations/notifications/read-all','POST',input,headCookie);assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.data.unreadNotificationCount,0);
 const other=JSON.parse((await db.prepare("SELECT payload_json FROM operation_records WHERE id='other-notice'").first()).payload_json);assert.equal(other.read,false);
 assert.equal((await api('operations/notifications/read-all','POST',input,headCookie)).data.revision,result.data.revision);
});

test('100k movement and delivery records produce bounded indexed pages and compact state',async()=>{
 const started=Date.now();
 await db.prepare(`WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<100000)
 INSERT INTO operation_records(id,kind,payload_json) SELECT 'scale_'||x,'delivery',json_object('id','scale_'||x,'kind','delivery','dispatchId','scale_dispatch_'||CAST((x-1)/10 AS INT),'itemId',?,'itemName','Rice','unit','kg','quantity',1,'outletId','brigade','cuisine','Indian','recipientId',?,'status','Received','createdAt','2026-01-01T00:00:00.000Z','confirmedAt','2026-01-01T01:00:00.000Z','requestId','scale_request') FROM n`).bind(itemId,head.id).run();
 await db.prepare(`WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<100000)
 INSERT INTO outlet_stock_history(id,operation_id,item_id,outlet_id,delta,quantity,kind,item_name,unit,actor_name,created_at)
 SELECT 'scale_movement_'||x,'scale',?,'brigade',1,x,'receipt','Rice','kg','Scale test','2026-01-01T00:00:00.000Z' FROM n`).bind(itemId).run();
 const queryStart=Date.now();
 const result=await dispatchList(db,head,{view:'history',limit:'25'});assert.equal(result.rows.length,25);assert.ok(JSON.stringify(result).length<30000);
 const history=await stockHistoryPage(db,purchaser,{from:'2026-01-01',to:'2026-01-01'});assert.equal(history.rows.length,25);assert.equal(history.totals.count,100000);
 const state=await readClientState(db,head);assert.equal(state.stockHistory.length,0);assert.equal(state.operationRecords.filter(r=>r.kind==='delivery').length,0);
 assert.ok(JSON.stringify(state).length<100000,'Daily refresh does not contain history');
 const report=await stockReport(db,purchaser,{outlet:'brigade',from:'2026-01-01',to:'2026-01-01'});assert.equal(report.rows.find(r=>r.item.id===itemId).received,100000);
 const explain=await db.prepare("EXPLAIN QUERY PLAN SELECT id FROM outlet_stock_history WHERE outlet_id='brigade' ORDER BY created_at DESC,id DESC LIMIT 25").all();assert.ok(explain.results.some(row=>String(row.detail).includes('stock_history_page')));
 console.log(`100k scale checks: seed ${queryStart-started}ms, queries ${Date.now()-queryStart}ms`);
 assert.ok(Date.now()-queryStart<15000,'Bounded queries finish within 15s on the local emulator');
});

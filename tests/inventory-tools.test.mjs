import { test } from 'node:test';
import assert from 'node:assert/strict';
await import('../js/inventory-tools.js');
const {day,timestamp,bounds,resolveOutlet,matchItems,report}=globalThis.InventoryTools;
test('distribution matches approved cuisine requests and excludes replacement issues from their remaining balance',()=>{
    const request={id:'r1',status:'Approved',itemId:'rice',outletId:'cafe',cuisine:'Indian',qty:10,approvedQuantity:8,legacyIssuedQuantity:1};
    const requests=[request,{...request,id:'wrong',outletId:'other'},{...request,id:'pending',status:'Pending'}];
    const deliveries=[{kind:'delivery',requestId:'r1',quantity:2},{kind:'delivery',requestId:'r1',quantity:2,replacementFor:'d1'}];
    const result=InventoryTools.distributionRequests(requests,deliveries,'rice','cafe','Indian');
    assert.equal(result.length,1);assert.equal(result[0].remainingQuantity,5);
    assert.equal(request.remainingQuantity,undefined);
    assert.equal(InventoryTools.distributionRequests(requests,[...deliveries,{kind:'delivery',requestId:'r1',quantity:9}],'rice','cafe','Indian')[0].remainingQuantity,0);
});
test('IST calendar dates and report bounds do not depend on browser timezone',()=>{
    assert.equal(day('2026-10-14T18:29:59Z'),'2026-10-14');
    assert.equal(day('2026-10-14T18:30:00Z'),'2026-10-15');
    assert.deepEqual(bounds('2026-10-15','2026-10-15'),{start:Date.parse('2026-10-14T18:30:00Z'),end:Date.parse('2026-10-15T18:30:00Z')});
    assert.match(timestamp('2026-10-14T18:30:00Z'),/15 Oct 2026.*12:00.*am IST/);
    assert.throws(()=>bounds('2026-10-16','2026-10-15'));
});
test('cached outlets are validated against current assignments',()=>{
    assert.equal(resolveOutlet([{id:'brigade'}],'cafe'),'brigade');
    assert.equal(resolveOutlet([{id:'brigade'},{id:'cafe'}],'cafe'),'cafe');
    assert.equal(resolveOutlet([],'cafe'),'');
});
test('item search handles large lists, case and whitespace',()=>{
    const items=Array.from({length:10000},(_,id)=>({id,name:'Ingredient '+id}));
    assert.equal(matchItems(items,' INGREDIENT 9999 ')[0].id,9999);
    assert.equal(matchItems(items,'missing').length,0);
});
test('report reconstructs historical balances, cuisine usage and opening balances',()=>{
    const items=[{id:'rice',name:'Rice',active:false},{id:'empty',name:'Empty'},{id:'zero',name:'Zero'}];
    const entry=(delta,kind,created_at,cuisine='',item_id='rice')=>({outlet_id:'cafe',item_id,delta,kind,created_at,cuisine});
    const history=[entry(20,'opening','2026-10-13T12:00:00Z'),entry(10,'receipt','2026-10-14T18:30:00Z'),entry(-5,'distribute','2026-10-15T01:00:00Z','Indian'),entry(-2,'distribute','2026-10-15T02:00:00Z','Retired Cuisine'),entry(-1,'adjust','2026-10-15T03:00:00Z'),entry(3,'assign','2026-10-15T04:00:00Z'),entry(-4,'distribute','2026-10-15T18:30:00Z','Indian'),entry(2,'receipt','2026-10-15T02:00:00Z','','zero'),entry(-2,'distribute','2026-10-15T03:00:00Z','Indian','zero')];
    const balances=[{item_id:'rice',outlet_id:'cafe',quantity:21},{item_id:'zero',outlet_id:'cafe',quantity:0}];
    const result=report(items,balances,history,'cafe','2026-10-15','2026-10-15');
    assert.deepEqual(result.cuisines,['Indian','Retired Cuisine']);
    const rice=result.rows.find(r=>r.item.id==='rice');
    assert.equal(rice.opening,20);assert.equal(rice.received,13);assert.equal(rice.adjustments,-1);assert.equal(rice.remaining,25);assert.deepEqual(rice.usage,{Indian:5,'Retired Cuisine':2});
    assert.ok(result.rows.some(r=>r.item.id==='zero'));assert.ok(!result.rows.some(r=>r.item.id==='empty'));
    assert.equal(report(items,balances,history,'other','2026-10-15','2026-10-15').rows.length,0);
});

test('cuisine edits recompute totals while preserving original requests and zero revisions',()=>{
    const entry={chefRequests:[{cuisine:'Indian',qty:6},{cuisine:'Indian',qty:4},{cuisine:'Chinese',qty:3}],revisedQty:13};
    InventoryTools.reviseCuisine(entry,'Indian',5);
    assert.deepEqual(entry.chefRequests.map(r=>r.revisedQty),[3,2,undefined]);
    assert.equal(entry.revisedQty,8);
    InventoryTools.reviseCuisine(entry,'Chinese',0);assert.equal(entry.revisedQty,5);
    InventoryTools.reviseCuisine(entry,'Indian',0);assert.equal(entry.revisedQty,0);
    InventoryTools.reviseCuisine(entry,'Indian',2);assert.equal(entry.revisedQty,2);
    assert.deepEqual(entry.chefRequests.map(r=>r.qty),[6,4,3]);
    assert.throws(()=>InventoryTools.reviseCuisine(entry,'Indian',-1));
});

test('recalled consolidation restores saved revision notes without duplicating them',()=>{
 const rows=[{qty:5,revisedQty:3,supervisorNote:'Reduced kitchen requirement'},{qty:2,supervisorNote:'Reduced kitchen requirement'},{qty:1}];
 assert.equal(InventoryTools.consolidationNote(rows),'Reduced kitchen requirement');
 assert.equal(InventoryTools.consolidationNote([{supervisorNote:' '},{}]),'');
 assert.equal(InventoryTools.consolidationNote([...rows,{supervisorNote:' Additional note '}]),'Reduced kitchen requirement; Additional note');
});

test('save consolidation edits preserves request ownership and status without creating an indent',()=>{
 const current={id:'r',outletId:'a',ownerId:'chef',qty:5,status:'Accepted'};
 const snapshots=new Map([['r',JSON.stringify(current)]]);
 const items=[{comment:'Less required',chefRequests:[{...current,revisedQty:3}]}];
 const changes=InventoryTools.workspaceEditChanges(items,[current],snapshots,'a',[]);
 assert.equal(changes.length,1);assert.equal(changes[0].value.revisedQty,3);assert.equal(changes[0].value.supervisorNote,'Less required');assert.equal(changes[0].value.status,'Accepted');assert.equal(changes[0].value.qty,5);
 const saved=changes[0].value;
 assert.equal(InventoryTools.workspaceEditChanges(items,[saved],new Map([['r',JSON.stringify(saved)]]),'a',[]).length,0);
 assert.throws(()=>InventoryTools.workspaceEditChanges(items,[{...current,qty:6}],snapshots,'a',[]));
 assert.throws(()=>InventoryTools.workspaceEditChanges(items,[current],snapshots,'a',[{outletId:'a',status:'Pending Approval'}]));
 const extra={id:'new',outletId:'a',qty:2,status:'Pending'};
 assert.equal(InventoryTools.workspaceEditChanges(items,[current,extra],snapshots,'a',[]).length,1,'New requests must not be overwritten by saving older edits');
});

test('submenu attention follows the exact workflow stage and clears after handling',()=>{
 const state={requests:[{id:'r',status:'Pending'}],indents:[{id:'i',status:'Pending Approval'}],operationRecords:[{kind:'delivery',status:'Issue reported'},{kind:'account_request',status:'Pending'}]};
 assert.equal(InventoryTools.menuAttention(state,{role:'executive_chef'}).manage,1);
 assert.equal(InventoryTools.menuAttention(state,{role:'purchaser'}).approvals,1);
 state.requests[0].status='Accepted';const executive=InventoryTools.menuAttention(state,{role:'executive_chef'});assert.equal(executive.manage,0);assert.equal(executive.consolidate,1);
 state.indents[0].status='Approved';let counts=InventoryTools.menuAttention(state,{role:'admin'});assert.equal(counts.approvals,0);assert.equal(counts.vendorOrders,1);assert.equal(counts.deliveries,1);assert.equal(counts.accounts,1);
 state.indents[0].purchaseOrderIds=['po'];state.operationRecords[0].status='Resolved';state.operationRecords[1].status='Approved';counts=InventoryTools.menuAttention(state,{role:'admin'});assert.equal(counts.vendorOrders,0);assert.equal(counts.deliveries,0);assert.equal(counts.accounts,0);
 const head=InventoryTools.menuAttention(state,{role:'cuisine_head'});assert.equal(head.approvals,0);assert.equal(head.accounts,0);
});

test('purchase orders move between open and received sections and filter by the relevant IST date',()=>{
 const orders=[{id:'open',status:'PO Raised',createdAt:'2026-10-19T12:00:00Z'},{id:'partial',status:'Partially Received',createdAt:'2026-10-20T01:00:00Z'},{id:'done',status:'Received',createdAt:'2026-10-18T01:00:00Z',receivedAt:'2026-10-19T19:00:00Z'}];
 assert.deepEqual(InventoryTools.purchaseOrderList(orders,'open').map(p=>p.id),['partial','open']);
 assert.deepEqual(InventoryTools.purchaseOrderList(orders,'received','2026-10-20','2026-10-20').map(p=>p.id),['done']);
 assert.equal(InventoryTools.purchaseOrderList(orders,'received','2026-10-19','2026-10-19').length,0);
 orders[0].status='Received';orders[0].receivedAt='2026-10-20T10:00:00Z';assert.equal(InventoryTools.purchaseOrderList(orders,'open').length,1);assert.equal(InventoryTools.purchaseOrderList(orders,'received').length,2);
 assert.throws(()=>InventoryTools.purchaseOrderList(orders,'received','2026-10-21','2026-10-20'));
});

test('distribution prefills requested remainder or maximum stock while sharing stock between cuisines',()=>{
    const allocate=InventoryTools.defaultDistributionAllocations;
    assert.deepEqual(allocate([{itemId:'rice',remaining:10,available:20}]),[10]);
    assert.deepEqual(allocate([{itemId:'rice',remaining:10,available:6}]),[6]);
    assert.deepEqual(allocate([{itemId:'rice',remaining:10,available:0}]),[0]);
    assert.deepEqual(allocate([{itemId:'rice',remaining:3,available:5},{itemId:'rice',remaining:4,available:5},{itemId:'milk',remaining:2.5,available:3}]),[3,2,2.5]);
    assert.deepEqual(allocate([{itemId:'rice',remaining:2,available:-1}]),[0]);
});
